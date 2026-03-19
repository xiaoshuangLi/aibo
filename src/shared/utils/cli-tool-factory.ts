import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync, execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";
import { setAcpSessionState, getAcpAgentDisplayName } from "@/shared/acp-session";

const execFileAsync = promisify(execFile);

/**
 * Shared schema for all CLI coding tools.
 *
 * Includes optional ACP fields (`session_name`, `start_passthrough`) that are
 * only used when the tool is running in ACP mode (i.e. acpx is available and
 * an `acpAgent` name is configured in the tool's `CliToolConfig`).
 */
export const cliToolSchema = z.object({
  prompt: z.string().describe("The task or prompt to send to the CLI tool."),
  timeout: z.number().optional().default(6000000).describe("Timeout in milliseconds (default: 6000000 = 100 minutes). Increase for complex tasks."),
  cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
  args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the command."),
  session_name: z.string().optional().describe(
    "Named ACP session (-s flag). Allows parallel workstreams in the same repo. Only used in ACP mode.",
  ),
  start_passthrough: z.boolean().optional().default(true).describe(
    "When true (default), activates Lark ACP passthrough mode after this call so subsequent Lark messages are forwarded directly to the agent. Only used in ACP mode.",
  ),
});

/**
 * Configuration for creating a CLI execute tool.
 */
export interface CliToolConfig {
  /** The CLI command name (e.g. "claude", "gemini") */
  command: string;
  /** The LangChain tool name (e.g. "claude_execute") */
  toolName: string;
  /** Description of the tool shown to the LLM */
  description: string;
  /** Subcommand args prepended before the prompt flag (e.g. ["subcommand"]) */
  subcommand?: string[];
  /** Extra fixed args appended after the prompt args (e.g. ["--verbose"]) */
  extraArgs?: string[];
  /** Flag used to pass the prompt (e.g. "-p" for claude/cursor) */
  promptFlag: string;
  /** Additional flags appended at the end (e.g. ["--autopilot"] for copilot) */
  trailingArgs?: string[];
  /**
   * ACP agent name to use when routing through acpx (e.g. "claude", "codex").
   * When set and acpx is available on PATH, the tool will call
   * `acpx --approve-all --format text <acpAgent> <prompt>` instead of the
   * direct CLI command, and activate Lark passthrough mode after completion.
   */
  acpAgent?: string;
}

/**
 * Checks whether a CLI command is available on the system PATH.
 */
export function isCliCommandAvailable(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds a standardised error JSON string for CLI execution failures.
 */
export function handleCliExecutionError(
  error: unknown,
  toolLabel: string,
  prompt: string,
  timeout: number,
): string {
  const err = error as any;

  // Abort/interrupt must be checked before SIGTERM/SIGKILL (AbortController may trigger
  // these signals via the killSignal option when the abort fires)
  if (err.code === "ABORT_ERR" || err.name === "AbortError") {
    return JSON.stringify(
      {
        success: false,
        interrupted: true,
        error: "Command interrupted",
        message: `${toolLabel} execution was interrupted by user. The user may provide feedback in the next message.`,
        stdout: err.stdout || "",
        stderr: err.stderr || "",
        prompt,
      },
      null,
      2,
    );
  }

  if (err.signal === "SIGTERM" || err.signal === "SIGKILL") {
    return JSON.stringify(
      {
        success: false,
        error: "Command timeout",
        message: `${toolLabel} command exceeded ${timeout}ms timeout limit`,
        stdout: err.stdout || "",
        stderr: err.stderr || "",
        prompt,
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      success: false,
      error: err.code || "EXECUTION_ERROR",
      message: err.message,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      prompt,
    },
    null,
    2,
  );
}

/**
 * Creates a LangChain tool that delegates a prompt to a local AI CLI command.
 *
 * When `config.acpAgent` is set and the `acpx` command is available on PATH,
 * the tool automatically routes through acpx (ACP mode) and activates Lark
 * passthrough after each call. Falls back to direct CLI execution otherwise.
 *
 * @param config - Configuration describing the CLI tool
 * @param session - Optional session for real-time progress streaming
 */
export function createCliExecuteTool(config: CliToolConfig, session?: Session) {
  const {
    command,
    toolName,
    description,
    promptFlag,
    subcommand = [],
    extraArgs = [],
    trailingArgs = [],
    acpAgent,
  } = config;

  return tool(
    async ({ prompt, timeout = 6000000, cwd, args = [], session_name, start_passthrough = true }) => {
      // ── ACP mode (preferred when acpx is available) ──────────────────────────
      if (acpAgent && isCliCommandAvailable("acpx")) {
        const displayName = getAcpAgentDisplayName(acpAgent);
        const execArgs: string[] = ["--approve-all", "--format", "text"];
        if (cwd) execArgs.push("--cwd", cwd);
        execArgs.push(acpAgent);
        if (session_name) execArgs.push("-s", session_name);
        execArgs.push(prompt);
        if (args.length) execArgs.push(...args);

        try {
          const promise = execFileAsync("acpx", execArgs, {
            timeout,
            cwd: cwd || process.cwd(),
            env: process.env,
            signal: session?.abortController?.signal,
            killSignal: "SIGKILL",
          });

          (promise as any).child?.stdout?.on?.("data", (data: Buffer) => {
            session?.logToolProgress(`${displayName} 输出`, data.toString());
          });

          const { stdout, stderr } = await promise;

          if (start_passthrough) {
            setAcpSessionState({ agent: acpAgent, sessionName: session_name, cwd });
          }

          return JSON.stringify(
            {
              success: true,
              stdout: stdout || "(empty)",
              stderr: stderr || "(empty)",
              prompt,
              agent: acpAgent,
              passthrough_activated: start_passthrough,
            },
            null,
            2,
          );
        } catch (error) {
          return handleCliExecutionError(error, "acpx", prompt, timeout);
        }
      }

      // ── Fallback: direct CLI execution ────────────────────────────────────────
      const execArgs = [...subcommand, promptFlag, prompt, ...args, ...extraArgs, ...trailingArgs];

      try {
        const promise = execFileAsync(command, execArgs, {
          timeout,
          cwd: cwd || process.cwd(),
          env: process.env,
          signal: session?.abortController?.signal,
          killSignal: 'SIGKILL',
        });

        (promise as any).child?.stdout?.on?.("data", (data: Buffer) => {
          session?.logToolProgress(toolName, data.toString());
        });

        const { stdout, stderr } = await promise;

        return JSON.stringify(
          {
            success: true,
            stdout: stdout || "(empty)",
            stderr: stderr || "(empty)",
            prompt,
          },
          null,
          2,
        );
      } catch (error) {
        return handleCliExecutionError(error, command, prompt, timeout);
      }
    },
    {
      name: toolName,
      description,
      schema: cliToolSchema,
    },
  );
}
