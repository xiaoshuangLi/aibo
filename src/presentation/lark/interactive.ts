/**
 * 飞书(Lark)交互模式 - 主入口文件
 * 
 * 中文名称：飞书交互模式
 * 
 * 负责初始化Lark适配器并启动交互循环。
 * 通过 Session 对象进行所有 I/O 操作，保持原有的事件驱动架构。
 * 
 * @module interactive
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { LarkAdapter, MessageContent } from './adapter';
import { Session } from '@/core/agent';
import { createAIAgent } from '@/core/agent';
import { processStreamChunks } from '@/core/utils';
import { createHandleInternalCommand } from './commander';
import { LspClientManager } from '@/infrastructure/code-analysis';
import { handleCliExecutionError } from '@/shared/utils';
import {
  AcpPassthroughState,
  getAcpPassthroughState,
  setAcpPassthroughState,
  clearAcpPassthroughState,
} from './acp-passthrough';

export { AcpPassthroughState, getAcpPassthroughState, setAcpPassthroughState, clearAcpPassthroughState };

const execFileAsync = promisify(execFile);

// 全局会话和代理实例
let currentSession: Session | null = null;
let currentAgent: any = null;

/**
 * 将用户输入直传到 acpx ACP 会话，并把输出流回 Session。
 * 
 * @param input   用户输入的文本
 * @param session 当前会话（用于日志和进度上报）
 */
export async function handleAcpPassthrough(input: string, session: Session): Promise<void> {
  const state = getAcpPassthroughState();
  if (!state) {
    return;
  }

  const { agent, sessionName, cwd } = state;
  const toolName = `acpx[${agent}]`;
  const timeout = 6000000;

  // 构建 acpx 参数：
  //   acpx --approve-all --format text [--cwd <cwd>] <agent> [-s <name>] <prompt>
  const execArgs: string[] = ['--approve-all', '--format', 'text'];
  if (cwd) execArgs.push('--cwd', cwd);
  execArgs.push(agent);
  if (sessionName) execArgs.push('-s', sessionName);
  execArgs.push(input);

  session.logToolCall(toolName, { agent, sessionName, prompt: input });

  try {
    const promise = execFileAsync('acpx', execArgs, {
      timeout,
      cwd: cwd || process.cwd(),
      env: process.env,
      signal: session?.abortController?.signal,
      killSignal: 'SIGKILL',
    });

    (promise as any).child?.stdout?.on?.('data', (data: Buffer) => {
      session.logToolProgress(toolName, data.toString());
    });

    const { stdout } = await promise;

    session.logToolResult(toolName, true, stdout ? stdout.slice(0, 200) : '(empty)');
  } catch (error) {
    const errJson = handleCliExecutionError(error, 'acpx', input, timeout);
    let preview: string;
    try {
      preview = JSON.parse(errJson)?.message || errJson;
    } catch {
      preview = errJson;
    }
    session.logToolResult(toolName, false, preview);
  }
}

/**
 * 启动飞书交互模式
 */
export async function startLarkInteractiveMode(): Promise<void> {
  console.log('🚀 启动飞书交互模式...');
  
  try {
    // 创建Lark适配器（group_chat 模式下内部自动获取或创建群聊）
    const larkAdapter = new LarkAdapter();

    await larkAdapter.launch();
    
    // 创建会话
    currentSession = new Session(larkAdapter);
    
    // 启动会话（发送启动信息）
    await currentSession.start();
    
    // 创建AI代理
    currentAgent = await createAIAgent(currentSession);
    
    // 设置用户消息回调
    larkAdapter.setUserMessageCallback(async (userMessage: MessageContent) => {
      await handleUserMessage(userMessage, currentSession!, currentAgent);
    });
    
    console.log('✅ 飞书交互模式已启动，等待用户消息...');
    
    // 保持进程运行
    process.on('SIGINT', () => {
      console.log('\n👋 正在关闭飞书交互模式...');
      if (currentSession) {
        currentSession.end("再见！");
      }
      LspClientManager.shutdownAll().then(() => process.exit(0));
    });
    
    process.on('SIGTERM', () => {
      console.log('\n👋 正在关闭飞书交互模式...');
      if (currentSession) {
        currentSession.end("再见！");
      }
      LspClientManager.shutdownAll().then(() => process.exit(0));
    });
    
  } catch (error) {
    console.error('❌ 启动飞书交互模式失败:', error);
    process.exit(1);
  }
}

/**
 * 处理用户消息
 */
export async function handleUserMessage(
  input: MessageContent,
  session: Session,
  agent: any
): Promise<void> {
  // 仅文本消息可触发退出命令、空输入检查和内部命令
  if (typeof input === 'string') {
    // 检查退出命令
    if (shouldExitInteractiveMode(input)) {
      session.end("再见！");
      return;
    }

    // 检查空输入
    if (isEmptyInput(input)) {
      return;
    }

    // 检查是否为内部命令
    if (input.startsWith('/')) {
      const handleCommand = createHandleInternalCommand(session);
      const commandHandled = await handleCommand(input);
      if (commandHandled) {
        return;
      }
    }

    // ACP 直传模式：将文本消息直接透传到 ACP 会话，不经过大模型
    if (getAcpPassthroughState()) {
      if (session.isRunning && session.abortController) {
        session.abortController.abort();
      }
      session.isRunning = true;
      const abortController = new AbortController();
      session.setAbortController(abortController);
      try {
        await handleAcpPassthrough(input, session);
      } finally {
        if (session.abortController === abortController) {
          session.isRunning = false;
          session.setAbortController(new AbortController());
        }
      }
      return;
    }
  }

  // 如果大模型正在运行，取消当前任务
  if (session.isRunning && session.abortController) {
    console.log('🔄 检测到新用户消息，取消当前大模型任务...');
    session.abortController.abort();
  }

  // 设置会话为运行状态
  session.isRunning = true;
  
  // 创建新的中断控制器（在 try 外部，以便 finally 能访问并比较）
  const abortController = new AbortController();
  session.setAbortController(abortController);

  try {
    // 创建流状态
    const state: any = {
      fullResponse: '',
      lastToolCall: null,
      hasDisplayedThinking: false,
      abortSignal: abortController.signal,
    };

    // 调用AI代理的stream方法
    const stream = (agent as any).stream(
      { messages: [{ role: "user", content: input }] },
      { 
        configurable: { thread_id: session.threadId },
        modelKwargs: { enable_thinking: true },
        signal: abortController.signal,
        recursionLimit: Infinity,
      }
    );

    // 处理响应流（图片消息不传递 userInput，仅文本消息提供上下文）
    await processStreamChunks(stream, state, session, typeof input === 'string' ? input : undefined);
    
  } catch (error) {
    console.error('❌ 处理用户消息时出错:', error);
    // 错误处理应该由LarkAdapter的emit方法处理，这里不需要手动调用
    // processStreamChunks会自动处理错误事件
  } finally {
    // 只有当前控制器未被新消息替换时才重置，避免覆盖并发新会话的控制器
    if (session.abortController === abortController) {
      session.isRunning = false;
      session.setAbortController(new AbortController());
    }
  }
}

/**
 * 检查是否应该退出交互模式
 */
export function shouldExitInteractiveMode(input: string): boolean {
  const exitCommands = ['exit', 'quit', 'bye', '再见', '退出', '拜拜'];
  return exitCommands.some(cmd => input.trim().toLowerCase() === cmd);
}

/**
 * 检查是否为空输入
 */
export function isEmptyInput(input: string): boolean {
  return !input.trim();
}
