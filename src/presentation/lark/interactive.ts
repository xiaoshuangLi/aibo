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

import { LarkAdapter } from './adapter';
import { LarkChatService } from './chat';
import { Session } from '@/core/agent';
import { createAIAgent } from '@/core/agent';
import { config } from '@/core/config';
import { processStreamChunks } from '@/core/utils';
import { createHandleInternalCommand } from './commander';
import { LspClientManager } from '@/infrastructure/code-analysis';

// 全局会话和代理实例
let currentSession: Session | null = null;
let currentAgent: any = null;

/**
 * 启动飞书交互模式
 */
export async function startLarkInteractiveMode(): Promise<void> {
  console.log('🚀 启动飞书交互模式...');
  
  try {
    // 解析 lark 交互类型
    const larkType = config.interaction.larkType;

    // chat 模式：获取或创建与当前工作目录绑定的群聊
    let chatId: string | undefined;
    if (larkType === 'group_chat') {
      console.log('💬 group_chat 模式：正在获取或创建群聊...');
      const chatService = new LarkChatService();
      chatId = await chatService.getOrCreateChat();
    }

    // 创建Lark适配器（chat 模式传入 chatId）
    const larkAdapter = new LarkAdapter(chatId);
    
    // 创建会话
    currentSession = new Session(larkAdapter);
    
    // 启动会话（发送启动信息）
    await currentSession.start();
    
    // 创建AI代理
    currentAgent = await createAIAgent(currentSession);
    
    // 设置用户消息回调
    larkAdapter.setUserMessageCallback(async (userMessage: string) => {
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
  input: string,
  session: Session,
  agent: any
): Promise<void> {
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

    // 处理响应流
    await processStreamChunks(stream, state, session, input);
    
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