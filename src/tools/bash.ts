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
    } catch (error: any) {
      // 处理超时/执行错误
      if (error.signal === "SIGTERM") {
        return JSON.stringify({
          success: false,
          error: "Command timeout",
          message: `Command exceeded ${timeout}ms timeout limit`,
          command: command,
        }, null, 2);
      }

      return JSON.stringify({
        success: false,
        error: error.code || "EXECUTION_ERROR",
        message: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        command: command,
      }, null, 2);
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