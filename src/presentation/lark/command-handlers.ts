import { config } from '@/core/config/config';
import { styled } from '@/presentation/styling/output-styler';
import { SessionManager } from '@/infrastructure/session/session-manager';

/**
 * Command Handlers module for Lark that provides internal command processing functionality.
 * 
 * This module handles all the internal commands available in the Lark interactive mode,
 * such as /help, /verbose, /new, /abort and /exit commands.
 * Each command has its own dedicated handler function with proper error handling.
 * 
 * @module lark-command-handlers
 */

// ==================== 内部命令处理器辅助函数 ====================

/**
 * 处理帮助命令
 * 
 * 中文名称：处理帮助命令
 * 
 * 预期行为：
 * - 显示所有可用的内部命令及其说明
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：总是成功显示帮助信息并返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 */
export async function handleHelpCommand(): Promise<boolean> {
  const helpMessage = `
🔧 可用命令:
   /help        - 显示此帮助
   /exit        - 立即退出（任何时刻可用）
   /verbose     - 切换详细/简略输出模式
   /new         - 开始新会话（清除对话历史）
   /abort       - 中断当前操作（任何时刻可用）
`;
  console.log(helpMessage);
  return true;
}

/**
 * 处理切换详细输出模式命令
 * 
 * 中文名称：处理切换详细输出模式命令
 * 
 * 预期行为：
 * - 切换配置中的verbose输出模式
 * - 显示当前输出模式状态
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功切换模式并显示状态，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 */
export async function handleVerboseCommand(): Promise<boolean> {
  config.output.verbose = !config.output.verbose;
  console.log(styled.system(`输出模式已切换为: ${config.output.verbose ? '详细模式' : '简略模式（自动截断长内容）'}`));
  return true;
}

/**
 * 处理创建新会话命令
 * 
 * 中文名称：处理创建新会话命令
 * 
 * 预期行为：
 * - 为会话生成新的线程ID
 * - 显示新会话创建成功的消息
 * - 触发commandExecuted事件
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功生成新ID并显示消息，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，其threadId属性将被更新为新的会话ID
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 */
export async function handleNewCommand(session: any): Promise<boolean> {
  const sessionManager = SessionManager.getInstance();
  session.threadId = sessionManager.clearCurrentSession();
  
  // 触发commandExecuted事件
  await session.ioChannel.emit({
    type: 'commandExecuted',
    data: { 
      command: '/new', 
      result: { 
        success: true, 
        sessionId: session.threadId,
        message: `✅ 已创建新会话 (ID: ${session.threadId})`
      } 
    },
    timestamp: Date.now()
  });
  
  console.log(styled.system(`✅ 已创建新会话 (ID: ${session.threadId})`));
  return true;
}

/**
 * 处理中断当前操作命令
 * 
 * 中文名称：处理中断当前操作命令
 * 
 * 预期行为：
 * - 中断当前正在运行的操作
 * - 显示中断成功的消息
 * - 触发commandExecuted事件
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功中断操作并显示消息，返回true
 * 2. 无当前操作：显示无操作可中断的消息，返回true
 * 3. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，包含abortController用于中断操作
 * @returns Promise<boolean> - 始终返回true，表示命令处理完成
 */
export async function handleAbortCommand(session: any): Promise<boolean> {
  let success = false;
  let message = "";
  
  if (session.abortController && !session.abortController.signal.aborted) {
    session.abortController.abort();
    success = true;
    message = "🔄 当前操作已中断";
  } else {
    message = "ℹ️ 没有正在进行的操作";
  }
  
  // 触发commandExecuted事件
  await session.ioChannel.emit({
    type: 'commandExecuted',
    data: { 
      command: '/abort', 
      result: { 
        success: success, 
        message: message
      } 
    },
    timestamp: Date.now()
  });
  
  console.log(styled.system(message));
  return true;
}

/**
 * 处理退出命令
 * 
 * 预期行为：
 * - 显示安全退出消息
 * - 终止进程（调用process.exit(0)）
 * - 理论上返回true，但实际上不会执行到return语句
 * 
 * 行为分支：
 * 1. 正常情况：显示退出消息，终止进程
 * 2. 无异常情况：该函数不抛出异常，但实际不会返回值
 * 
 * @param session - 会话对象，用于正确结束会话
 * @returns Promise<boolean> - 理论上返回true，但实际上由于process.exit()调用而不会执行
 */
export async function handleExitCommand(session: any): Promise<boolean> {
  console.log(styled.system("👋 正在安全退出..."));
  
  // End the session properly
  session.end();
  process.exit(0);
  return true;
}

/**
 * 处理未知命令
 * 
 * 中文名称：处理未知命令
 * 
 * 预期行为：
 * - 显示未知命令错误信息
 * - 提示用户输入/help查看可用命令
 * - 返回true表示命令处理完成
 * 
 * 行为分支：
 * 1. 正常情况：显示错误信息和帮助提示，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param command - 用户输入的未知命令字符串
 * @returns Promise<boolean> - 始终返回true，表示命令处理完成
 */
export async function handleUnknownCommand(command: string): Promise<boolean> {
  console.log(styled.error(`未知命令: ${command}\n输入 /help 查看可用命令`));
  return true;
}

// ==================== 内部命令处理器 (柯里化) ====================

/**
 * 创建内部命令处理器
 * 
 * 中文名称：创建内部命令处理器
 * 
 * 预期行为：
 * - 接收会话对象作为参数
 * - 返回一个处理内部命令的函数
 * - 根据命令字符串调用相应的命令处理函数
 * 
 * 行为分支：
 * 1. /help命令：调用handleHelpCommand()
 * 2. /verbose命令：调用handleVerboseCommand()
 * 3. /new命令：调用handleNewCommand(session)
 * 4. /abort命令：调用handleAbortCommand(session)
 * 5. /exit、/quit、/q或/stop命令：调用handleExitCommand(session)
 * 6. 其他未知命令：调用handleUnknownCommand(command)
 * 
 * @param session - 会话对象，包含threadId等会话状态信息
 * @returns (command: string) => Promise<boolean> - 返回一个接受命令字符串并返回Promise<boolean>的函数
 */
export function createHandleInternalCommand(session: any): (command: string) => Promise<boolean> {
  return async (command: string): Promise<boolean> => {
    switch (command) {
      case "/help":
        return await handleHelpCommand();
        
      case "/verbose":
        return await handleVerboseCommand();
        
      case "/new":
        return await handleNewCommand(session);
        
      case "/abort":
        return await handleAbortCommand(session);
        
      case "/exit":
      case "/quit":
      case "/q":
      case "/stop":
        return await handleExitCommand(session);
        
      default:
        return await handleUnknownCommand(command);
    }
  };
}