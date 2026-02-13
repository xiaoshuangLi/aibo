/**
 * 用户输入处理模块
 * 
 * 中文名称：用户输入处理模块
 * 
 * 负责处理用户输入、启动输入循环和显示提示符。
 * 
 * @module user-input-handler
 */

import { shouldExitInteractiveMode, isEmptyInput } from '../../core/session/interactive-logic';
import { styled } from '../styling/output-styler';
import { StreamState } from '../../core/agent/stream-handler';

/**
 * 会话接口
 * @interface Session
 */
export interface Session {
  /** 会话线程ID */
  threadId: string;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 中断控制器 */
  abortController: AbortController | null;
  /** Readline接口 */
  rl: any;
}

/**
 * 启动输入循环
 * 
 * 中文名称：启动输入循环
 * 
 * 预期行为：
 * - 接收会话对象、AI代理实例和Readline接口
 * - 进入无限循环等待用户输入
 * - 处理退出命令和空输入
 * - 为每个用户查询创建流状态和中断控制器
 * - 调用流处理函数处理AI响应
 * - 确保资源清理（finally块中重置状态）
 * 
 * 行为分支：
 * 1. 退出命令：检测到"exit"或"quit"，显示告别消息并关闭Readline
 * 2. 空输入：跳过处理，继续等待下一次输入
 * 3. 有效输入：创建流状态，调用代理stream方法，处理响应流
 * 4. 异常处理：确保在finally块中重置会话状态
 * 5. 中断处理：支持通过中断控制器取消当前操作
 * 
 * @param session - 会话对象，包含threadId、isRunning、abortController等属性
 * @param agent - AI代理实例，用于处理用户查询
 * @param rl - Readline接口，用于获取用户输入
 * @returns Promise<void> - 无返回值的Promise，函数持续运行直到用户退出
 */
export async function startInputLoop(
  session: Session,
  agent: any,
  rl: any
) {
  while (true) {
    const input = await new Promise<string>(resolve => 
      rl.question("\n👤 你: ", resolve)
    );

    if (shouldExitInteractiveMode(input)) {
      console.log(styled.system("再见！"));
      rl.close();
      return;
    }

    if (isEmptyInput(input)) continue; // 跳过空输入，不递归

    session.isRunning = true;
    session.abortController = new AbortController();
    
    try {
      const state: StreamState = {
        fullResponse: '',
        lastToolCall: null,
        hasDisplayedThinking: false,
        abortSignal: session.abortController.signal,
      };

      const stream = (agent as any).stream(
        { messages: [{ role: "user", content: input }] },
        { 
          configurable: { thread_id: session.threadId },
          modelKwargs: { enable_thinking: true },
          signal: session.abortController.signal,
          recursionLimit: Infinity,
        }
      );

      await processStreamChunks(stream, state, rl, input);
    } finally {
      session.isRunning = false;
      session.abortController = null;
    }
  }
}

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
 * @param rl - Readline接口，用于显示提示符
 * @returns Promise<void> - 无返回值的Promise
 */
export async function handleUserInput(
  input: string,
  session: Session,
  agent: any,
  rl: any
): Promise<void> {
  if (shouldExitInteractiveMode(input)) {
    console.log(styled.system("再见！"));
    rl.close();
    return;
  }

  if (isEmptyInput(input)) {
    // Ask for next input
    showPrompt(session, rl);
    return;
  }

  session.isRunning = true;
  session.abortController = new AbortController();
  
  try {
    const state: StreamState = {
      fullResponse: '',
      lastToolCall: null,
      hasDisplayedThinking: false,
      abortSignal: session.abortController.signal,
    };

    const stream = (agent as any).stream(
      { messages: [{ role: "user", content: input }] },
      { 
        configurable: { thread_id: session.threadId },
        modelKwargs: { enable_thinking: true },
        signal: session.abortController.signal,
        recursionLimit: Infinity,
      }
    );

    await processStreamChunks(stream, state, rl, input);
  } finally {
    session.isRunning = false;
    session.abortController = null;
  }
  
  // Ask for next input
  showPrompt(session, rl);
}

/**
 * 显示输入提示符
 * 
 * 中文名称：显示输入提示符
 * 
 * 预期行为：
 * - 接收会话对象和Readline接口
 * - 检查是否正在运行操作
 * - 如果有"干活"关键词，清除输入行
 * - 设置并显示用户输入提示符
 * 
 * 行为分支：
 * 1. 正在运行操作：直接返回，不显示提示符
 * 2. 输入行包含"干活"：逐字符删除输入行内容
 * 3. 正常情况：设置提示符为"\n👤 You: "并显示
 * 
 * @param session - 会话对象，包含isRunning状态
 * @param rl - Readline接口，用于设置和显示提示符
 * @returns void - 无返回值
 */
export function showPrompt(
  session: { isRunning: boolean }, 
  rl: any
): void {
  if (session.isRunning) return;

  if (rl.line) {
    const max = Math.max(rl.line.length - 8, 0);

    if (rl.line.slice(max, rl.line.length).includes('干活')) {
      for (let i = 0; i < rl.line.length + 4; i++) {
        setTimeout(() => {
          rl.write('', { name: 'backspace', ctrl: false, meta: false, shift: false });
        }, 10 * i);
      }
    }
  }

  rl.setPrompt?.(`\n👤 You: `);
  rl.prompt?.();
}

// Import processStreamChunks from StreamHandler to avoid circular dependency
import { processStreamChunks } from '../../core/agent/stream-handler';