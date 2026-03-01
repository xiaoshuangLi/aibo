import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync, execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";

const execFileAsync = promisify(execFile);

/**
 * 检查 claude 命令是否在本地可用
 *
 * @returns boolean - 如果 claude 命令可用则返回 true
 */
function isClaudeAvailable(): boolean {
  try {
    execSync("claude --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 处理 Claude CLI 执行错误
 *
 * @param error - 原始错误对象
 * @param prompt - 执行的提示词
 * @param timeout - 超时时间（毫秒）
 * @returns 标准化的错误 JSON 字符串
 */
function handleClaudeExecutionError(
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
      message: "Claude execution was interrupted by user. The user may provide feedback in the next message.",
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      prompt,
    }, null, 2);
  }

  if (err.signal === "SIGTERM") {
    return JSON.stringify({
      success: false,
      error: "Command timeout",
      message: `Claude command exceeded ${timeout}ms timeout limit`,
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
 * Claude Code CLI 执行工具
 *
 * 通过本地 claude 命令行工具执行编程任务或提示词，利用 Claude Code 的
 * 自主编程能力完成代码生成、调试、重构等任务。
 *
 * 行为分支：
 * 1. 正常执行：claude 命令成功执行，返回包含 stdout、stderr 和 success:true 的 JSON
 * 2. 命令超时：执行时间超过指定超时，返回包含 "Command timeout" 错误的 JSON
 * 3. 命令执行失败：返回包含错误代码和消息的 JSON
 */
function createClaudeExecuteTool(session?: Session) {
  return tool(
  async ({ prompt, timeout = 6000000, cwd, args = [] }) => {
    // Use execFile with a separate args array to prevent command injection
    const execArgs = ["-p", prompt, ...args, "--yolo"];

    try {
      const promise = execFileAsync("claude", execArgs, {
        timeout,
        cwd: cwd || process.cwd(),
        env: process.env,
        signal: session?.abortController?.signal,
      });

      // Stream stdout in real-time while the command is running
      (promise as any).child?.stdout?.on?.('data', (data: Buffer) => {
        session?.logToolProgress('claude_execute', data.toString());
      });

      const { stdout, stderr } = await promise;

      return JSON.stringify({
        success: true,
        stdout: stdout || "(empty)",
        stderr: stderr || "(empty)",
        prompt,
      }, null, 2);
    } catch (error) {
      return handleClaudeExecutionError(error, prompt, timeout);
    }
  },
  {
    name: "claude_execute",
    description: `Execute a task or prompt using the Claude Code CLI (claude command).
Sends the prompt to Claude Code running locally and returns the result.
Use this to leverage Claude's autonomous coding capabilities: writing code, debugging, refactoring, explaining code, and more.
Requires the 'claude' command to be installed locally.`,
    schema: z.object({
      prompt: z.string().describe("The task or prompt to send to Claude Code (e.g., 'fix the bug in src/utils.ts', 'explain this function')."),
      timeout: z.number().optional().default(300000).describe("Timeout in milliseconds (default: 300000 = 5 minutes). Increase for complex tasks."),
      cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
      args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the claude command (e.g., ['--model', 'claude-opus-4-5'])."),
    }),
  }
);
}

/**
 * 异步获取 Claude CLI 工具的方法
 *
 * 在返回工具前检查本地是否安装了 claude 命令。
 * 如果命令不可用，返回空数组。
 *
 * @returns Promise<Array<any>> - 包含 Claude CLI 工具的数组，或空数组（如果命令不可用）
 */
export default async function getClaudeTools(session?: Session) {
  if (!isClaudeAvailable()) {
    return [];
  }

  return [createClaudeExecuteTool(session)];
}
