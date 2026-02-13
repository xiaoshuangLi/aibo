import { config } from './core/config/config';
import { structuredLog } from './shared/utils/logging';
import { startInteractiveMode } from './presentation/console/interactive-mode';
import { createAIAgent } from './core/agent/agent-factory';

/**
 * Main entry point module for the AIBO AI Assistant application.
 * 
 * This module serves as the clean entry point for the application, handling
 * both interactive and non-interactive modes. It coordinates the initialization
 * of core components and provides a simple interface for programmatic usage.
 * 
 * @module main
 */

/**
 * 主执行函数
 * 
 * 中文名称：主执行函数
 * 
 * 预期行为：
 * - 作为应用程序的主要入口点
 * - 检查是否以交互模式运行（通过命令行参数或环境变量）
 * - 如果是交互模式，启动交互式对话界面
 * - 如果是非交互模式，初始化AI代理并返回
 * - 记录成功的初始化日志
 * - 提供初始化失败的错误处理
 * 
 * 行为分支：
 * 1. 交互模式：当命令行参数包含--interactive/-i或环境变量AIBO_INTERACTIVE为'true'时，调用startInteractiveMode()
 * 2. 非交互模式：初始化AI代理，记录成功日志，返回代理实例
 * 3. 初始化失败：捕获异常，记录错误日志，以退出码1终止进程
 * 4. 脚本执行：当文件直接运行时，自动调用main()并处理错误
 * 
 * @async
 * @returns Promise<ReturnType<typeof createAIAgent>> - 解析为已初始化AI代理的Promise
 * @throws {Error} 如果AI代理初始化因任何原因失败
 * 
 * @example
 * ```typescript
 * // 编程式使用
 * const agent = await main();
 * ```
 * 
 * @example
 * ```bash
 * # 脚本执行（直接运行文件时）
 * # 这将自动调用main()并处理错误
 * ```
 * 
 * @see {@link createAIAgent} 了解代理创建详情
 */
export async function main() {
  // 检查是否以交互模式运行（通过命令行参数或环境变量）
  const args = process.argv.slice(2);
  if (args.includes('--interactive') || args.includes('-i') || process.env.AIBO_INTERACTIVE === 'true') {
    await startInteractiveMode();
    return createAIAgent();
  }

  try {
    structuredLog('info', 'AI Agent initialized successfully', { component: 'main' });
    return createAIAgent();
  } catch (error: any) {
    structuredLog('error', 'Failed to initialize AI Agent', { 
      component: 'main', 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动主函数
if (require.main === module) {
  main().catch(console.error);
}