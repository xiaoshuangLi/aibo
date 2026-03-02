import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";
import { createCliExecuteTool, isCliCommandAvailable } from "@/shared/utils";

const execFileAsync = promisify(execFile);

function createCursorExecuteTool(session?: Session) {
  return createCliExecuteTool(
    {
      command: "cursor",
      toolName: "cursor_execute",
      description: `Execute a task or prompt using the Cursor AI CLI (cursor command).
Sends the prompt to Cursor AI running locally and returns the result.
Use this to leverage Cursor's AI coding capabilities: writing code, debugging, refactoring, and more.
Requires the 'cursor' command to be installed locally.`,
      subcommand: ["agent"],
      promptFlag: "-p",
    },
    session,
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
  if (!isCliCommandAvailable("cursor")) {
    return [];
  }
  return [createCursorExecuteTool(session), cursorOpenTool];
}

