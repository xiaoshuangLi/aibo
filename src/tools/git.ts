import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Supported git operations and their allowed argument patterns.
 * Each entry maps an operation name to the git sub-command it executes.
 */
const GIT_OPERATIONS = [
  "status",
  "diff",
  "log",
  "blame",
  "add",
  "commit",
  "push",
  "pull",
  "checkout",
  "branch",
  "stash",
] as const;

type GitOperation = (typeof GIT_OPERATIONS)[number];

/**
 * Execute a git sub-command in the given working directory.
 * Arguments are passed as an array to execFile so they are never subject to
 * shell word-splitting or glob expansion.
 *
 * @param operation - The git sub-command (e.g. "status", "diff")
 * @param args      - Additional arguments passed verbatim after the sub-command
 * @param cwd       - Working directory (defaults to process.cwd())
 * @param timeout   - Timeout in milliseconds (default: 30 s)
 */
async function execGit(
  operation: GitOperation,
  args: string[],
  cwd: string,
  timeout: number
): Promise<{ success: boolean; output?: string; error?: string }> {
  // Reject arguments that contain shell meta-characters so callers cannot
  // sneak injection payloads through the args array.
  for (const a of args) {
    if (/[;&|`$<>\\]/.test(a)) {
      throw new Error(`Unsafe argument rejected: "${a}"`);
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "git",
      [operation, ...args],
      {
        cwd,
        timeout,
        // Pass through the process environment so git can read ~/.gitconfig,
        // SSH keys, credential helpers, etc.
        env: process.env,
      }
    );

    return {
      success: true,
      // Prefer stdout; fall back to stderr for commands that write there (e.g. git push)
      output: stdout || stderr || "",
    };
  } catch (err: any) {
    const message: string =
      err.stderr || err.stdout || err.message || String(err);
    return { success: false, error: message.trim() };
  }
}

/**
 * Structured Git operations tool — the primary way for the AI to interact
 * with a Git repository without having to compose raw shell commands.
 *
 * Compared with execute_bash this tool:
 *  - Accepts a typed `operation` parameter, reducing prompt ambiguity
 *  - Always returns structured JSON that downstream agents can parse reliably
 *  - Provides a single, consistent error-handling contract across all operations
 *
 * Supported operations: status | diff | log | blame | add | commit |
 *                        push | pull | checkout | branch | stash
 */
export const gitOperationTool = tool(
  async ({ operation, args = [], cwd, timeout = 30000 }) => {
    const workdir = cwd || process.cwd();

    try {
      const result = await execGit(
        operation as GitOperation,
        args,
        workdir,
        timeout
      );

      return JSON.stringify(
        {
          success: result.success,
          operation,
          ...(result.success
            ? { output: result.output }
            : { error: result.error }),
          args,
        },
        null,
        2
      );
    } catch (err) {
      return JSON.stringify(
        {
          success: false,
          operation,
          error: err instanceof Error ? err.message : String(err),
          args,
        },
        null,
        2
      );
    }
  },
  {
    name: "git_operation",
    description: `Run a structured Git operation and receive a JSON response.
Prefer this over execute_bash for all Git tasks — it handles errors uniformly
and returns machine-readable output that other tools and agents can parse.

Supported operations:
  status   — show working-tree status (equivalent to: git status --short)
  diff     — show unstaged changes; pass ["--staged"] in args for staged diff
  log      — show commit history; pass ["-10"] in args to limit to 10 commits
  blame    — show line-by-line authorship; pass ["<file>"] in args
  add      — stage files; pass ["."] to stage everything, or specific paths
  commit   — create a commit; args MUST include ["-m", "<message>"]
  push     — push current branch to origin (pass remote/branch in args if needed)
  pull     — pull/fetch from origin
  checkout — switch branch or restore file; pass ["-b", "<branch>"] to create
  branch   — list branches; pass ["-a"] for all, ["-d", "<name>"] to delete
  stash    — manage stash; pass ["pop"] to restore, ["list"] to list entries

Examples:
  { operation: "status" }
  { operation: "diff", args: ["--staged"] }
  { operation: "log", args: ["-10", "--oneline"] }
  { operation: "add", args: ["."] }
  { operation: "commit", args: ["-m", "feat: my change"] }
  { operation: "checkout", args: ["-b", "feature/my-branch"] }`,
    schema: z.object({
      operation: z
        .enum(GIT_OPERATIONS)
        .describe("The git sub-command to run."),
      args: z
        .array(z.string())
        .optional()
        .default([])
        .describe(
          "Additional arguments passed to git after the sub-command (e.g. [\"-m\", \"commit message\"] for commit)."
        ),
      cwd: z
        .string()
        .optional()
        .describe(
          "Working directory for the git command. Defaults to the current process directory."
        ),
      timeout: z
        .number()
        .optional()
        .default(30000)
        .describe("Timeout in milliseconds (default: 30000 = 30 s)."),
    }),
  }
);

/**
 * Returns the git_operation tool.
 */
export default async function getGitTools() {
  return [gitOperationTool];
}
