import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";
import { isCliCommandAvailable, handleCliExecutionError } from "@/shared/utils";

const execFileAsync = promisify(execFile);

function createCursorExecuteTool(session?: Session) {
  return tool(
    async ({ prompt, continueSession = false, timeout = 6000000, cwd, args = [] }) => {
      const continueArgs = continueSession ? ["--continue"] : [];
      const execArgs = ["-p", prompt, ...continueArgs, ...args];

      try {
        const promise = execFileAsync("agent", execArgs, {
          timeout,
          cwd: cwd || process.cwd(),
          env: process.env,
          signal: session?.abortController?.signal,
          killSignal: "SIGKILL",
        });

        (promise as any).child?.stdout?.on?.("data", (data: Buffer) => {
          session?.logToolProgress("cursor_execute", data.toString());
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
        return handleCliExecutionError(error, "agent", prompt, timeout);
      }
    },
    {
      name: "cursor_execute",
      description: `Execute a task or prompt using the Cursor AI CLI (agent command).
Sends the prompt to Cursor AI running locally and returns the result.
Use this to leverage Cursor's AI coding capabilities: writing code, debugging, refactoring, and more.
Requires the Cursor CLI 'agent' command to be installed locally.`,
      schema: z.object({
        prompt: z.string().describe("The task or prompt to send to the CLI tool."),
        continueSession: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to continue the previous Cursor agent session (adds --continue flag)."),
        timeout: z
          .number()
          .optional()
          .default(6000000)
          .describe("Timeout in milliseconds (default: 6000000 = 100 minutes). Increase for complex tasks."),
        cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
        args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the command."),
      }),
    },
  );
}

export const cursorOpenTool = tool(
  async ({ path, timeout = 30000 }) => {
    try {
      const { stdout, stderr } = await execFileAsync("cursor", [path], {
        timeout,
        env: process.env,
      });

      return JSON.stringify({
        success: true,
        stdout: stdout || "(empty)",
        stderr: stderr || "(empty)",
        path,
      }, null, 2);
    } catch (error) {
      const err = error as any;

      if (err.signal === "SIGTERM") {
        return JSON.stringify({
          success: false,
          error: "Command timeout",
          message: `Cursor open command exceeded ${timeout}ms timeout limit`,
          stdout: err.stdout || "",
          stderr: err.stderr || "",
          path,
        }, null, 2);
      }

      return JSON.stringify({
        success: false,
        error: err.code || "EXECUTION_ERROR",
        message: err.message,
        stdout: err.stdout || "",
        stderr: err.stderr || "",
        path,
      }, null, 2);
    }
  },
  {
    name: "cursor_open",
    description: `Open a file or directory in the Cursor editor using the cursor CLI.
Use this to open specific files or project directories in Cursor for inspection or editing.
Requires the 'cursor' command to be installed locally.`,
    schema: z.object({
      path: z.string().describe("The file or directory path to open in Cursor (e.g., 'src/utils.ts', './my-project')."),
      timeout: z.number().optional().default(30000).describe("Timeout in milliseconds (default: 30000 = 30 seconds)."),
    }),
  }
);

export default async function getCursorTools(session?: Session) {
  if (!isCliCommandAvailable("agent")) {
    return [];
  }
  return [createCursorExecuteTool(session), cursorOpenTool];
}

