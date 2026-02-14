/**
 * 优雅关闭处理器
 * 
 * 中文名称：优雅关闭处理器
 * 
 * 负责处理应用程序的优雅关闭，包括信号处理和资源清理。
 * 
 * @module graceful-shutdown
 */

import { structuredLog } from '@/shared/utils/logging';

/**
 * 会话接口（用于关闭处理器）
 * @interface ShutdownSession
 */
export interface ShutdownSession {
  /** 是否正在运行 */
  isRunning: boolean;
  /** Readline接口 */
  rl: any;
}

/**
 * 优雅关闭处理器
 * 
 * 预期行为：
 * - 接收信号类型和会话对象
 * - 检查是否有正在运行的操作
 * - 如果有运行中操作，只设置状态为非运行，不立即关闭
 * - 如果无运行中操作，记录日志并立即关闭Readline接口和进程
 * 
 * 行为分支：
 * 1. 有运行中操作：记录"正在中断当前操作"日志，设置isRunning为false，不关闭接口
 * 2. 无运行中操作：记录"正在退出"日志，关闭Readline接口，调用process.exit(0)
 * 
 * @param signal - 接收到的信号类型（如'SIGINT'、'SIGTERM'）
 * @param session - 会话对象，包含isRunning状态和rl接口
 * @returns void - 无返回值
 */
export function gracefulShutdownHandler(
  signal: string,
  session: ShutdownSession
): void {
  if (session.isRunning) {
    structuredLog('info', `收到 ${signal} 信号，正在中断当前操作...`);
    session.isRunning = false;
    // 当操作正在运行时，不应该关闭 readline 接口
    // 只设置状态为非运行，让当前操作自然结束
  } else {
    structuredLog('info', `收到 ${signal} 信号，正在退出...`);
    session.rl?.close?.();
    process.exit(0);
  }
}

/**
 * 创建优雅关闭函数
 * 
 * 中文名称：创建优雅关闭函数
 * 
 * 预期行为：
 * - 接收会话对象作为参数
 * - 返回一个接受信号参数的关闭处理函数
 * - 该函数调用内部的gracefulShutdownHandler
 * 
 * 行为分支：
 * 1. 正常情况：返回一个绑定会话对象的关闭处理函数
 * 
 * @param session - 会话对象，传递给内部的关闭处理器
 * @returns (signal: string) => void - 返回一个接受信号参数的关闭处理函数
 */
export function createGracefulShutdown(
  session: ShutdownSession
): (signal: string) => void {
  return (signal: string): void => {
    gracefulShutdownHandler(signal, session);
  };
}