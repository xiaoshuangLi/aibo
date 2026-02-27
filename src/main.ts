import { config } from '@/core/config/config';
import { structuredLog } from '@/shared/utils/logging';
import { startInteractiveMode } from '@/presentation/console/interactive-mode';
import { startLarkInteractiveMode } from '@/presentation/lark/interactive-mode';
import { createAIAgent } from '@/core/agent/agent-factory';
import { runInit } from '@/cli/init';

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
 * - 读取配置中的交互模式（已在 config.ts 中处理命令行参数和环境变量）
 * - 如果是控制台模式，启动交互式对话界面
 * - 如果是飞书模式，启动飞书交互模式
 * - 如果是非交互模式，初始化AI代理并返回
 * - 记录成功的初始化日志
 * - 提供初始化失败的错误处理
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
 */
export async function main() {
  // 检查交互模式（所有逻辑已在 config.ts 中处理）
  if (config.interaction.mode === 'console') {
    await startInteractiveMode();
    return createAIAgent();
  } else if (config.interaction.mode === 'lark') {
    await startLarkInteractiveMode();
    return createAIAgent();
  }

  try {
    structuredLog('info', 'AI Agent initialized successfully', { component: 'main' });
    return await createAIAgent();
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
  // Handle `aibo init` subcommand before the normal startup flow so that
  // dotenv / config loading (which requires a .env to exist) is bypassed.
  if (process.argv[2] === 'init') {
    runInit().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    main().catch(console.error);
  }
}