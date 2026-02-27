/**
 * 用户输入处理模块 - 使用 Session 和 Adapter 解耦终端依赖
 * 
 * 中文名称：用户输入处理模块
 * 
 * 负责处理用户输入、启动输入循环和显示提示符。
 * 通过 Session 对象进行所有 I/O 操作，保持原有的事件驱动架构。
 * 
 * @module user-input-handler
 */

import { shouldExitInteractiveMode, isEmptyInput } from '@/core/utils/interactive-logic';
import { StreamState } from '@/core/utils/stream-handler';
import { Session } from '@/core/agent/session';

// Import processStreamChunks from StreamHandler to avoid circular dependency
import { processStreamChunks } from '@/core/utils/stream-handler';

/**
 * 处理用户输入
 * 
 * 中文名称：处理用户输入
 * 
 * 预期行为：
 * - 接收用户输入字符串、会话对象、AI代理实例和Readline接口
 * - 处理退出命令和空输入
 * - 为用户查询创建流状态和中断控制器
 * - 调用AI代理的stream方法处理查询
 * - 处理响应流并显示结果
 * - 在finally块中确保资源清理
 * - 显示下一个输入提示符
 * 
 * 行为分支：
 * 1. 退出命令：显示告别消息，关闭Readline接口，返回
 * 2. 空输入：显示提示符，返回
 * 3. 有效输入：创建流状态，调用代理stream，处理响应，显示提示符
 * 4. 异常处理：确保在finally块中重置会话状态
 * 5. 中断处理：支持通过abortController取消当前操作
 * 
 * @param input - 用户输入的字符串
 * @param session - 会话对象，包含threadId、isRunning、abortController、rl等属性
 * @param agent - AI代理实例，用于处理用户查询
 * @returns Promise<void> - 无返回值的Promise
 */
export async function handleUserInput(
  input: string,
  session: Session,
  agent: any
): Promise<void> {
  if (shouldExitInteractiveMode(input)) {
    session.end("再见！");
    return;
  }

  if (isEmptyInput(input)) {
    // Ask for next input
    session.requestUserInput();
    return;
  }

  session.isRunning = true;
  
  // 创建新的中断控制器（在 try 外部，以便 finally 能访问并比较）
  const abortController = new AbortController();
  session.abortController = abortController;

  try {
    const state: StreamState = {
      fullResponse: '',
      lastToolCall: null,
      hasDisplayedThinking: false,
      abortSignal: abortController.signal,
    };

    const stream = (agent as any).stream(
      { messages: [{ role: "user", content: input }] },
      { 
        configurable: { thread_id: session.threadId },
        modelKwargs: { enable_thinking: true },
        signal: abortController.signal,
        recursionLimit: Infinity,
      }
    );

    await processStreamChunks(stream, state, session, input);
  } finally {
    session.isRunning = false;
    // 只有当前控制器未被新消息替换时才重置，避免覆盖并发新会话的控制器
    if (session.abortController === abortController) {
      session.abortController = new AbortController();
    }
  }

  session.requestUserInput();
}