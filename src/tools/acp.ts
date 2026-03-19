import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";
import { isCliCommandAvailable, handleCliExecutionError } from "@/shared/utils";
import { setAcpSessionState, getAcpAgentDisplayName } from "@/shared/acp-session";

const execFileAsync = promisify(execFile);

/**
 * ACP (Agent Client Protocol) mode for individual tool operations.
 *
 * - "prompt"       : Send a prompt to a persistent ACP session (default).
 * - "exec"         : One-shot execution — no saved session state.
 * - "sessions_new" : Create a new session for the given agent/cwd scope.
 * - "sessions_list": List existing sessions.
 * - "sessions_close": Close the session for the given agent/cwd scope.
 * - "cancel"       : Cooperatively cancel an in-flight prompt.
 */
export type AcpMode =
  | "prompt"
  | "exec"
  | "sessions_new"
  | "sessions_list"
  | "sessions_close"
  | "cancel";

const acpSchema = z.object({
  agent: z
    .string()
    .describe(
      'The ACP-compatible coding agent to use. Built-in names: "codex", "claude", "gemini", "cursor", "copilot", "pi", "openclaw", "kimi", "opencode", "kiro", "kilocode", "qwen", "droid". Unknown names are treated as raw commands.',
    ),
  prompt: z
    .string()
    .optional()
    .default("")
    .describe(
      'The task or prompt to send to the agent. Required for "prompt" and "exec" modes.',
    ),
  mode: z
    .enum(["prompt", "exec", "sessions_new", "sessions_list", "sessions_close", "cancel"])
    .optional()
    .default("prompt")
    .describe(
      'Execution mode. "prompt" uses a persistent session (default). "exec" is one-shot. "sessions_new/close/list" manage sessions. "cancel" cancels an in-flight prompt.',
    ),
  session_name: z
    .string()
    .optional()
    .describe(
      "Named session within the same cwd (-s flag). Allows parallel workstreams in the same repo.",
    ),
  cwd: z
    .string()
    .optional()
    .describe(
      "Working directory / session scope root (default: current process directory).",
    ),
  approve: z
    .enum(["approve-all", "approve-reads", "deny-all"])
    .optional()
    .default("approve-all")
    .describe(
      'Permission mode for ACP agent requests. "approve-all" auto-approves everything (default). "approve-reads" approves reads but prompts for writes. "deny-all" denies all.',
    ),
  timeout: z
    .number()
    .optional()
    .default(6000000)
    .describe(
      "Timeout in milliseconds (default: 6000000 = 100 minutes). Increase for long-running tasks.",
    ),
  args: z
    .array(z.string())
    .optional()
    .default([])
    .describe("Additional acpx CLI arguments to pass through."),
  start_passthrough: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "When true, activates Lark ACP passthrough mode after this call. " +
      "All subsequent Lark messages will be forwarded directly to this agent session " +
      "until the user says 'exit acp' / '退出acp'. " +
      "Use this when the user explicitly wants to enter a direct conversation with the coding tool.",
    ),
});

/**
 * Build the acpx argv for a given set of tool inputs.
 *
 * Accepts the *input* type (before Zod defaults are applied) so callers don't
 * need to supply optional fields such as `start_passthrough`.
 */
export function buildAcpxArgs(input: z.input<typeof acpSchema>): string[] {
  const {
    agent,
    prompt,
    mode = "prompt",
    session_name,
    cwd,
    approve = "approve-all",
    args = [],
  } = input;

  const globalArgs: string[] = [];

  // Permission flag
  globalArgs.push(`--${approve}`);

  // Format: structured text output (suitable for agent consumption)
  globalArgs.push("--format", "text");

  // Working directory (affects session scope)
  if (cwd) {
    globalArgs.push("--cwd", cwd);
  }

  // Agent positional argument
  globalArgs.push(agent);

  // Session name flag
  if (session_name) {
    globalArgs.push("-s", session_name);
  }

  // Mode-specific subcommand / prompt
  switch (mode) {
    case "exec":
      globalArgs.push("exec");
      if (prompt) globalArgs.push(prompt);
      break;
    case "sessions_new":
      globalArgs.push("sessions", "new");
      if (session_name) {
        // -s already added above; pass --name for the new subcommand explicitly
        // (acpx sessions new --name is distinct from the prompt -s flag)
        // We already added -s above for the agent scope; for sessions new we
        // need --name if a name was requested.
        globalArgs.push("--name", session_name);
      }
      break;
    case "sessions_list":
      globalArgs.push("sessions", "list");
      break;
    case "sessions_close":
      globalArgs.push("sessions", "close");
      if (session_name) globalArgs.push(session_name);
      break;
    case "cancel":
      globalArgs.push("cancel");
      break;
    case "prompt":
    default:
      // "prompt" is the implicit default verb
      if (prompt) globalArgs.push(prompt);
      break;
  }

  return [...globalArgs, ...args];
}

function createAcpExecuteTool(session?: Session) {
  return tool(
    async (input) => {
      const { timeout = 6000000 } = input;
      const startPassthrough = (input as any).start_passthrough === true;
      const execArgs = buildAcpxArgs(input as z.infer<typeof acpSchema>);

      try {
        const promise = execFileAsync("acpx", execArgs, {
          timeout,
          cwd: (input as any).cwd || process.cwd(),
          env: process.env,
          signal: session?.abortController?.signal,
          killSignal: "SIGKILL",
        });

        (promise as any).child?.stdout?.on?.("data", (data: Buffer) => {
          session?.logToolProgress(`${getAcpAgentDisplayName((input as any).agent)} 输出`, data.toString());
        });

        const { stdout, stderr } = await promise;

        // Activate Lark passthrough mode as a side effect when requested.
        // From this point, all Lark messages will be forwarded directly to the
        // running ACP session without going through the LLM.
        if (startPassthrough) {
          setAcpSessionState({
            agent: (input as any).agent,
            sessionName: (input as any).session_name,
            cwd: (input as any).cwd,
          });
        }

        return JSON.stringify(
          {
            success: true,
            stdout: stdout || "(empty)",
            stderr: stderr || "(empty)",
            agent: (input as any).agent,
            mode: (input as any).mode || "prompt",
            prompt: (input as any).prompt || "",
            passthrough_activated: startPassthrough,
          },
          null,
          2,
        );
      } catch (error) {
        return handleCliExecutionError(error, "acpx", (input as any).prompt || "", timeout);
      }
    },
    {
      name: "acpx_execute",
      description: `Execute a task using the acpx ACP (Agent Client Protocol) CLI to communicate with local AI coding agents over a structured protocol.

acpx is a headless CLI client for ACP that avoids PTY scraping. It supports persistent multi-turn sessions, one-shot execution, named parallel sessions, and cooperative cancellation.

Supported built-in agents: "codex", "claude", "gemini", "cursor", "copilot", "pi", "openclaw", "kimi", "opencode", "kiro", "kilocode", "qwen", "droid", and any custom ACP server via raw command name.

Use this tool to:
- Send prompts to ACP-compatible coding agents with persistent session continuity
- Run one-shot tasks without saving session state (exec mode)
- Manage ACP sessions (create, list, close) for parallel workstreams
- Cancel in-flight prompts cooperatively

Requires the 'acpx' command to be installed locally (npm install -g acpx).`,
      schema: acpSchema,
    },
  );
}

export default async function getAcpTools(session?: Session) {
  if (!isCliCommandAvailable("acpx")) {
    return [];
  }
  return [createAcpExecuteTool(session)];
}
