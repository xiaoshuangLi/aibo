import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync, execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";

const execFileAsync = promisify(execFile);

/**
 * Shared schema for all CLI coding tools.
 */
export const cliToolSchema = z.object({
  prompt: z.string().describe("The task or prompt to send to the CLI tool."),
  timeout: z.number().optional().default(6000000).describe("Timeout in milliseconds (default: 6000000 = 100 minutes). Increase for complex tasks."),
  cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
  args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the command."),
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
  /** Extra fixed args appended after the prompt args (e.g. ["--yolo"]) */
  extraArgs?: string[];
  /** Flag used to pass the prompt (e.g. "-p" for claude, "--ai" for cursor) */
  promptFlag: string;
  /** Additional flags appended at the end (e.g. ["--autopilot"] for copilot) */
  trailingArgs?: string[];
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

  // Abort/interrupt must be checked before SIGTERM (abort also sends SIGTERM)
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

  if (err.signal === "SIGTERM") {
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
 * @param config - Configuration describing the CLI tool
 * @param session - Optional session for real-time progress streaming
 */
export function createCliExecuteTool(config: CliToolConfig, session?: Session) {
  const { command, toolName, description, promptFlag, extraArgs = [], trailingArgs = [] } = config;

  return tool(
    async ({ prompt, timeout = 6000000, cwd, args = [] }) => {
      const execArgs = [promptFlag, prompt, ...args, ...extraArgs, ...trailingArgs];

      try {
        const promise = execFileAsync(command, execArgs, {
          timeout,
          cwd: cwd || process.cwd(),
          env: process.env,
          signal: session?.abortController?.signal,
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
