// bash_tool.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * ⚠️ 安全警告：此工具可执行任意系统命令，仅限以下场景使用：
 *   - 本地开发/测试环境
 *   - 完全受信任的私有部署
 *   - 用户明确知晓风险的实验场景
 * 
 * 生产环境必须添加：
 *   - 命令白名单/黑名单
 *   - 路径隔离（chroot/sandbox）
 *   - 权限最小化原则
 *   - 审计日志
 */

/**
 * 执行Bash命令工具
 * 
 * 中文名称：执行Bash命令工具
 * 
 * 预期行为：
 * - 接收命令字符串、超时时间和工作目录参数
 * - 在指定工作目录中执行Bash命令
 * - 限制环境变量以提供基础安全防护
 * - 捕获并返回标准输出和标准错误
 * - 处理命令执行超时和错误情况
 * - 返回结构化的JSON响应
 * 
 * 行为分支：
 * 1. 正常执行：命令成功执行，返回包含stdout、stderr和success:true的JSON
 * 2. 命令超时：命令执行时间超过指定超时，返回包含"Command timeout"错误的JSON
 * 3. 命令执行失败：命令返回非零退出码，返回包含错误代码和消息的JSON
 * 4. 工作目录未指定：使用当前进程工作目录作为默认值
 * 5. 环境变量限制：只传递PATH和HOME环境变量，其他变量被过滤
 * 6. 空输出处理：stdout或stderr为空时显示"(empty)"字符串
 * 
 * @param command - 要执行的Bash命令字符串（例如：'ls -la', 'pwd', 'cat file.txt'），不包含'bash -c'前缀
 * @param timeout - 超时时间（毫秒），默认30000（30秒），防止命令挂起
 * @param cwd - 命令执行的工作目录，默认为当前进程工作目录
 * @returns Promise<string> - 包含执行结果的JSON字符串，包含success、stdout、stderr、command等字段
 * 
 * @example
 * ```typescript
 * // 执行简单命令
 * const result = await executeBashTool.invoke({ command: "ls -la" });
 * 
 * // 执行带超时的命令
 * const result = await executeBashTool.invoke({ command: "sleep 10", timeout: 5000 });
 * 
 * // 在指定目录执行命令
 * const result = await executeBashTool.invoke({ command: "pwd", cwd: "/home/user" });
 * ```
 * 
 * @security
 * ⚠️ 危险操作：此工具可以使用当前用户权限执行任何命令
 * - 切勿执行不受信任或未知的命令
 * - 推荐的安全命令：ls, pwd, cat, echo, grep, find（谨慎使用）
 * - 危险命令：rm -rf, dd, mkfs, chmod 777, 任何包含sudo的命令
 */
/**
 * 处理Bash命令执行错误
 * 
 * 中文名称：处理Bash命令执行错误
 * 
 * 预期行为：
 * - 统一处理Bash命令执行过程中的各种错误
 * - 区分超时错误和其他执行错误
 * - 返回标准化的错误响应
 * 
 * @param error - 原始错误对象
 * @param command - 执行的命令
 * @param timeout - 超时时间（毫秒）
 * @returns 标准化的错误JSON字符串
 */
function handleBashExecutionError(error: unknown, command: string, timeout: number): string {
  const err = error as any;
  
  // Handle timeout specifically
  if (err.signal === "SIGTERM") {
    return JSON.stringify({
      success: false,
      error: "Command timeout",
      message: `Command exceeded ${timeout}ms timeout limit`,
      command: command,
    }, null, 2);
  }

  // Handle other execution errors
  return JSON.stringify({
    success: false,
    error: err.code || "EXECUTION_ERROR",
    message: err.message,
    stdout: err.stdout || "",
    stderr: err.stderr || "",
    command: command,
  }, null, 2);
}

export const executeBashTool = tool(
  async ({ command, timeout = 30000, cwd }) => {
    try {
      // 执行命令
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeout,
        cwd: cwd || process.cwd(),
        // 限制环境变量（基础防护）
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
        },
      });

      return JSON.stringify({
        success: true,
        stdout: stdout || "(empty)",
        stderr: stderr || "(empty)",
        command: command,
      }, null, 2);
    } catch (error) {
      return handleBashExecutionError(error, command, timeout);
    }
  },
  {
    name: "execute_bash",
    description: `Execute a bash/shell command in the current environment.
⚠️ DANGEROUS: Can run ANY command with current user permissions.
Use with extreme caution. Never run untrusted/unknown commands.
Recommended safe commands: ls, pwd, cat, echo, grep, find (with caution).
Dangerous commands: rm -rf, dd, mkfs, chmod 777, any command with sudo.`,
    schema: z.object({
      command: z.string().describe("The bash command to execute (e.g., 'ls -la', 'pwd', 'cat file.txt'). DO NOT include 'bash -c' prefix."),
      timeout: z.number().optional().default(30000).describe("Timeout in milliseconds (default: 30000 = 30 seconds). Prevents hanging commands."),
      cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
    }),
  }
);

// 导出工具数组（方便批量导入）
export default [executeBashTool];