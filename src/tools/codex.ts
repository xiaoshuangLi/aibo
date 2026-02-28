import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync, execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";

const execFileAsync = promisify(execFile);

/**
 * 检查 codex 命令是否在本地可用
 *
 * @returns boolean - 如果 codex 命令可用则返回 true
 */
function isCodexAvailable(): boolean {
  try {
    execSync("which codex", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 处理 Codex CLI 执行错误
 *
 * @param error - 原始错误对象
 * @param prompt - 执行的提示词
 * @param timeout - 超时时间（毫秒）
 * @returns 标准化的错误 JSON 字符串
 */
function handleCodexExecutionError(
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
      message: "Codex execution was interrupted by user. The user may provide feedback in the next message.",
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      prompt,
    }, null, 2);
  }

  if (err.signal === "SIGTERM") {
    return JSON.stringify({
      success: false,
      error: "Command timeout",
      message: `Codex command exceeded ${timeout}ms timeout limit`,
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
 * OpenAI Codex CLI 执行工具
 *
 * 通过本地 codex 命令行工具执行后端编程任务，利用 OpenAI Codex 的
 * AI 能力完成 API 开发、数据库操作、服务端逻辑实现等任务。
 *
 * 行为分支：
 * 1. 正常执行：codex 命令成功执行，返回包含 stdout、stderr 和 success:true 的 JSON
 * 2. 命令超时：执行时间超过指定超时，返回包含 "Command timeout" 错误的 JSON
 * 3. 命令执行失败：返回包含错误代码和消息的 JSON
 *
 * 最适合场景：
 * - 后端 API 开发（REST、GraphQL）
 * - 数据库操作与 ORM 设计
 * - 服务端业务逻辑实现
 * - CLI 工具与脚本开发
 */
function createCodexExecuteTool(session?: Session) {
  return tool(
  async ({ prompt, timeout = 300000, cwd, args = [] }) => {
    // Use execFile with a separate args array to prevent command injection
    const execArgs = ["-p", prompt, ...args];

    try {
      const promise = execFileAsync("codex", execArgs, {
        timeout,
        cwd: cwd || process.cwd(),
        env: process.env,
        signal: session?.abortController?.signal,
      });

      // Stream stdout in real-time while the command is running
      (promise as any).child?.stdout?.on?.('data', (data: Buffer) => {
        session?.logToolProgress('codex_execute', data.toString());
      });

      const { stdout, stderr } = await promise;

      return JSON.stringify({
        success: true,
        stdout: stdout || "(empty)",
        stderr: stderr || "(empty)",
        prompt,
      }, null, 2);
    } catch (error) {
      return handleCodexExecutionError(error, prompt, timeout);
    }
  },
  {
    name: "codex_execute",
    description: `Execute a task or prompt using the OpenAI Codex CLI (codex command).
Sends the prompt to Codex AI running locally and returns the result.
Best suited for: backend API development (REST/GraphQL), database design and queries, server-side business logic, CLI tools, and scripts.
Requires the 'codex' command to be installed locally (https://github.com/openai/codex).`,
    schema: z.object({
      prompt: z.string().describe("The task or prompt to send to Codex (e.g., 'implement a REST API endpoint for user authentication', 'write a SQL migration script')."),
      timeout: z.number().optional().default(300000).describe("Timeout in milliseconds (default: 300000 = 5 minutes). Increase for complex tasks."),
      cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
      args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the codex command."),
    }),
  }
);
}

/**
 * 异步获取 Codex CLI 工具的方法
 *
 * 在返回工具前检查本地是否安装了 codex 命令。
 * 如果命令不可用，返回空数组。
 *
 * @returns Promise<Array<any>> - 包含 Codex CLI 工具的数组，或空数组（如果命令不可用）
 */
// Session-less instance exported for testing purposes only.
// In production use getCodexTools(session) to get a session-aware instance.
export const codexExecuteTool = createCodexExecuteTool();

export default async function getCodexTools(session?: Session) {
  if (!isCodexAvailable()) {
    return [];
  }

  return [createCodexExecuteTool(session)];
}
