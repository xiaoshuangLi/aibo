import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync, execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";

const execFileAsync = promisify(execFile);

/**
 * 检查 cursor 命令是否在本地可用
 *
 * @returns boolean - 如果 cursor 命令可用则返回 true
 */
function isCursorAvailable(): boolean {
  try {
    execSync("cursor --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 处理 Cursor CLI 执行错误
 *
 * @param error - 原始错误对象
 * @param prompt - 执行的提示词
 * @param timeout - 超时时间（毫秒）
 * @returns 标准化的错误 JSON 字符串
 */
function handleCursorExecutionError(
  error: unknown,
  prompt: string,
  timeout: number
): string {
  const err = error as any;

  // Handle abort/interrupt (must check before SIGTERM, as abort also sends SIGTERM)
  if (err.code === 'ABORT_ERR' || err.name === 'AbortError') {
    return JSON.stringify({
      success: false,
      interrupted: true,
      error: "Command interrupted",
      message: "Cursor execution was interrupted by user. The user may provide feedback in the next message.",
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      prompt,
    }, null, 2);
  }

  if (err.signal === "SIGTERM") {
    return JSON.stringify({
      success: false,
      error: "Command timeout",
      message: `Cursor command exceeded ${timeout}ms timeout limit`,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      prompt,
    }, null, 2);
  }

  return JSON.stringify({
    success: false,
    error: err.code || "EXECUTION_ERROR",
    message: err.message,
    stdout: err.stdout || "",
    stderr: err.stderr || "",
    prompt,
  }, null, 2);
}

/**
 * Cursor CLI 执行工具
 *
 * 通过本地 cursor 命令行工具执行编程任务，利用 Cursor AI 的
 * 自主编程能力完成代码生成、调试、重构等任务。
 *
 * 行为分支：
 * 1. 正常执行：cursor 命令成功执行，返回包含 stdout、stderr 和 success:true 的 JSON
 * 2. 命令超时：执行时间超过指定超时，返回包含 "Command timeout" 错误的 JSON
 * 3. 命令执行失败：返回包含错误代码和消息的 JSON
 */
function createCursorExecuteTool(session?: Session) {
  return tool(
    async ({ prompt, timeout = 6000000, cwd, args = [] }) => {
      // Use execFile with a separate args array to prevent command injection
      const execArgs = ["--ai", prompt, ...args];

      try {
        const promise = execFileAsync("cursor", execArgs, {
          timeout,
          cwd: cwd || process.cwd(),
          env: process.env,
          signal: session?.abortController?.signal,
        });

        // Stream stdout in real-time while the command is running
        (promise as any).child?.stdout?.on?.('data', (data: Buffer) => {
          session?.logToolProgress('cursor_execute', data.toString());
        });

        const { stdout, stderr } = await promise;

        return JSON.stringify({
          success: true,
          stdout: stdout || "(empty)",
          stderr: stderr || "(empty)",
          prompt,
        }, null, 2);
      } catch (error) {
        return handleCursorExecutionError(error, prompt, timeout);
      }
    },
    {
      name: "cursor_execute",
      description: `Execute a task or prompt using the Cursor AI CLI (cursor command).
Sends the prompt to Cursor AI running locally and returns the result.
Use this to leverage Cursor's AI coding capabilities: writing code, debugging, refactoring, and more.
Requires the 'cursor' command to be installed locally.`,
      schema: z.object({
        prompt: z.string().describe("The task or prompt to send to Cursor AI (e.g., 'fix the bug in src/utils.ts', 'add unit tests for this module')."),
        timeout: z.number().optional().default(6000000).describe("Timeout in milliseconds (default: 6000000 = 100 minutes). Increase for complex tasks."),
        cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
        args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the cursor command."),
      }),
    }
  );
}

/**
 * Cursor 打开文件/目录工具
 *
 * 使用 cursor 命令打开指定的文件或目录，在 Cursor 编辑器中展示代码。
 *
 * 行为分支：
 * 1. 正常执行：cursor 命令成功执行，返回包含 stdout、stderr 和 success:true 的 JSON
 * 2. 命令超时：执行时间超过指定超时，返回包含 "Command timeout" 错误的 JSON
 * 3. 命令执行失败：返回包含错误代码和消息的 JSON
 */
export const cursorOpenTool = tool(
  async ({ path, timeout = 30000 }) => {
    // Use execFile with a separate args array to prevent command injection
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

/**
 * 异步获取 Cursor CLI 工具的方法
 *
 * 在返回工具前检查本地是否安装了 cursor 命令。
 * 如果命令不可用，返回空数组。
 *
 * @returns Promise<Array<any>> - 包含 Cursor CLI 工具的数组，或空数组（如果命令不可用）
 */
export default async function getCursorTools(session?: Session) {
  if (!isCursorAvailable()) {
    return [];
  }

  return [createCursorExecuteTool(session), cursorOpenTool];
}
