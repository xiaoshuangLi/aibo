import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync, execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";

const execFileAsync = promisify(execFile);

/**
 * 检查 gemini 命令是否在本地可用
 *
 * @returns boolean - 如果 gemini 命令可用则返回 true
 */
function isGeminiAvailable(): boolean {
  try {
    execSync("which gemini", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 处理 Gemini CLI 执行错误
 *
 * @param error - 原始错误对象
 * @param prompt - 执行的提示词
 * @param timeout - 超时时间（毫秒）
 * @returns 标准化的错误 JSON 字符串
 */
function handleGeminiExecutionError(
  error: unknown,
  prompt: string,
  timeout: number
): string {
  const err = error as any;

  if (err.signal === "SIGTERM") {
    return JSON.stringify({
      success: false,
      error: "Command timeout",
      message: `Gemini command exceeded ${timeout}ms timeout limit`,
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
 * Google Gemini CLI 执行工具
 *
 * 通过本地 gemini 命令行工具执行编程任务，利用 Google Gemini 的
 * AI 能力完成前端开发、算法实现、代码生成等任务。
 *
 * 行为分支：
 * 1. 正常执行：gemini 命令成功执行，返回包含 stdout、stderr 和 success:true 的 JSON
 * 2. 命令超时：执行时间超过指定超时，返回包含 "Command timeout" 错误的 JSON
 * 3. 命令执行失败：返回包含错误代码和消息的 JSON
 *
 * 最适合场景：
 * - 前端 UI 组件开发（React、Vue、HTML/CSS）
 * - 算法实现与优化
 * - 多模态任务（代码 + 图像分析）
 * - 需要大上下文窗口的任务（1M token）
 */
function createGeminiExecuteTool(session?: Session) {
  return tool(
  async ({ prompt, timeout = 300000, cwd, args = [] }) => {
    // Use execFile with a separate args array to prevent command injection
    const execArgs = ["-p", prompt, ...args];

    try {
      const promise = execFileAsync("gemini", execArgs, {
        timeout,
        cwd: cwd || process.cwd(),
        env: process.env,
      });

      // Stream stdout in real-time while the command is running
      (promise as any).child?.stdout?.on?.('data', (data: Buffer) => {
        session?.logToolProgress('gemini_execute', data.toString());
      });

      const { stdout, stderr } = await promise;

      return JSON.stringify({
        success: true,
        stdout: stdout || "(empty)",
        stderr: stderr || "(empty)",
        prompt,
      }, null, 2);
    } catch (error) {
      return handleGeminiExecutionError(error, prompt, timeout);
    }
  },
  {
    name: "gemini_execute",
    description: `Execute a task or prompt using the Google Gemini CLI (gemini command).
Sends the prompt to Gemini AI running locally and returns the result.
Best suited for: frontend UI development (React/Vue/HTML/CSS), algorithm implementation, multimodal tasks, and tasks requiring a large context window.
Requires the 'gemini' command to be installed locally (https://github.com/google-gemini/gemini-cli).`,
    schema: z.object({
      prompt: z.string().describe("The task or prompt to send to Gemini (e.g., 'create a React login form component', 'implement a binary search algorithm')."),
      timeout: z.number().optional().default(300000).describe("Timeout in milliseconds (default: 300000 = 5 minutes). Increase for complex tasks."),
      cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
      args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the gemini command."),
    }),
  }
);
}

/**
 * 异步获取 Gemini CLI 工具的方法
 *
 * 在返回工具前检查本地是否安装了 gemini 命令。
 * 如果命令不可用，返回空数组。
 *
 * @returns Promise<Array<any>> - 包含 Gemini CLI 工具的数组，或空数组（如果命令不可用）
 */
export default async function getGeminiTools(session?: Session) {
  if (!isGeminiAvailable()) {
    return [];
  }

  return [createGeminiExecuteTool(session)];
}
