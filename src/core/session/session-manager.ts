import { createConsoleThreadId } from './interactive-logic';
import { createGracefulShutdown } from '../session/graceful-shutdown';
import { showPrompt } from '../../presentation/console/user-input-handler';

/**
 * Session Manager module that handles session state management and lifecycle.
 * 
 * This module provides functions for creating and managing session state,
 * including thread ID generation, command history tracking, and graceful shutdown.
 * It also handles the setup of exit handlers for proper resource cleanup.
 * 
 * @module SessionManager
 */

/**
 * 创建会话状态对象
 * 
 * 中文名称：创建会话状态对象
 * 
 * 预期行为：
 * - 生成唯一的会话线程ID
 * - 初始化会话运行状态为false
 * - 初始化中止控制器为null
 * - 存储Readline接口引用
 * - 初始化命令历史数组和历史索引
 * - 初始化语音录制相关状态
 * 
 * 行为分支：
 * 1. 正常情况：成功创建并返回完整的会话状态对象
 * 2. 线程ID生成失败：理论上不会发生，因为createConsoleThreadId()总是返回有效ID
 * 
 * @param rl - Readline接口实例，用于会话中的输入输出操作
 * @returns Object - 包含完整会话状态的对象
 * 
 * @example
 * ```typescript
 * const session = createSessionState(rl);
 * // session包含threadId、isRunning、abortController等属性
 * ```
 */
export function createSessionState(rl: any) {
  return {
    threadId: createConsoleThreadId(),
    isRunning: false,
    abortController: null as AbortController | null,
    rl: rl, // Add rl to session for graceful shutdown
    commandHistory: [] as string[],
    historyIndex: 0,
    isVoiceRecording: false,
    voiceASR: null as any | null,
  };
}

/**
 * 设置退出处理器
 * 
 * 中文名称：设置退出处理器
 * 
 * 预期行为：
 * - 为SIGINT和SIGTERM信号设置进程级退出处理器
 * - 为Readline的SIGINT事件设置交互式退出处理器
 * - 实现双击Ctrl+C快速退出机制
 * - 在退出前清理语音录制资源
 * 
 * 行为分支：
 * 1. SIGINT/SIGTERM信号：清理语音录制并调用优雅关闭处理器
 * 2. Readline SIGINT（Ctrl+C）且有运行中操作：中断当前操作并提示再次Ctrl+C强制退出
 * 3. Readline SIGINT且有语音录制：取消语音录制并显示提示
 * 4. Readline SIGINT且无运行操作：实现双击确认退出（500ms内双击则立即退出，否则提示再次确认）
 * 
 * @param session - 会话对象，包含isRunning、abortController、isVoiceRecording等状态
 * @param rl - Readline接口，用于监听SIGINT事件和关闭接口
 * @param gracefulShutdown - 优雅关闭处理器函数
 * @returns void - 无返回值
 * 
 * @example
 * ```typescript
 * setupExitHandlers(session, rl, gracefulShutdown); // 设置退出处理器
 * ```
 */
export function setupExitHandlers(session: any, rl: any, gracefulShutdown: any): void {
  process.on('SIGINT', () => {
    if (session.voiceASR && session.isVoiceRecording) {
      try {
        session.voiceASR.stopManualRecording().catch(() => {});
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    session.isVoiceRecording = false;
    session.voiceASR = null;
    gracefulShutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    if (session.voiceASR && session.isVoiceRecording) {
      try {
        session.voiceASR.stopManualRecording().catch(() => {});
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    session.isVoiceRecording = false;
    session.voiceASR = null;
    gracefulShutdown('SIGTERM');
  });
  
  // Handle Ctrl+C in readline with double-press confirmation
  let lastInterrupt = 0;
  rl.on('SIGINT', () => {
    const now = Date.now();
    
    if (session.isRunning && session.abortController) {
      // Interrupt current operation
      session.abortController.abort();
      console.log('\x1b[33m⚠️  正在中断当前操作... (再次 Ctrl+C 强制退出)\x1b[0m');
    } else if (session.isVoiceRecording) {
      // Stop voice recording if active
      if (session.voiceASR && session.isVoiceRecording) {
        try {
          session.voiceASR.stopManualRecording().catch(() => {});
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      session.isVoiceRecording = false;
      session.voiceASR = null;
      console.log('\x1b[36m🎙️ 语音输入已取消\x1b[0m');
      // Show prompt after canceling voice input
      showPrompt(session, rl);
    } else {
      // Double-press quick exit
      if (now - lastInterrupt < 500) {
        console.log('\x1b[36m\n👋 双击确认，立即退出...\x1b[0m');
        rl.close();
        process.exit(0);
      } else {
        console.log('\x1b[36m\n👋 检测到退出请求 (再次 Ctrl+C 确认退出)\x1b[0m');
        lastInterrupt = now;
      }
    }
  });
}

/**
 * 创建优雅关闭处理器
 * 
 * 中文名称：创建优雅关闭处理器
 * 
 * 预期行为：
 * - 接收会话对象作为参数
 * - 返回一个处理优雅关闭的函数
 * - 在关闭时显示退出消息并终止进程
 * 
 * 行为分支：
 * 1. 正常情况：显示退出消息并以退出码0终止进程
 * 2. 无异常情况：该函数不抛出异常，直接调用process.exit()
 * 
 * @param session - 会话对象，用于访问rl接口进行关闭
 * @returns (signal: string) => void - 返回一个接受信号字符串的关闭函数
 * 
 * @example
 * ```typescript
 * const gracefulShutdown = createGracefulShutdown(session);
 * gracefulShutdown('SIGINT'); // 执行优雅关闭
 * ```
 */
export function createGracefulShutdownHandler(session: any): (signal: string) => void {
  return (signal: string) => {
    console.log(`\n收到 ${signal} 信号，正在安全退出...`);
    session.rl.close();
    process.exit(0);
  };
}