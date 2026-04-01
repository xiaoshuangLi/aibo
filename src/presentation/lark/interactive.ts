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
import { handleCliExecutionError, isNoAcpSessionError, createAcpSession } from '@/shared/utils';
import {
  AcpPassthroughState,
  getAcpPassthroughState,
  setAcpPassthroughState,
  clearAcpPassthroughState,
} from './acp-passthrough';
import { getAcpAgentDisplayName } from '@/shared/acp-session';

export { AcpPassthroughState, getAcpPassthroughState, setAcpPassthroughState, clearAcpPassthroughState };

const execFileAsync = promisify(execFile);

/** Timeout in ms for acpx executions (100 minutes).
 * ACP coding agents may perform long-running tasks so a generous timeout avoids premature cancellation. */
const ACP_EXEC_TIMEOUT_MS = 6_000_000;

// 全局会话和代理实例
let currentSession: Session | null = null;
let currentAgent: any = null;

/**
 * Patterns that signal the user wants to exit ACP passthrough mode.
 * These are matched case-insensitively against the trimmed input string.
 */
const ACP_EXIT_PATTERNS: RegExp[] = [
  /退出\s*acp/i,
  /关闭\s*acp/i,
  /停止\s*acp/i,
  /结束\s*acp/i,
  /exit\s*acp/i,
  /stop\s*acp/i,
  /quit\s*acp/i,
  /close\s*acp/i,
  /退出.*透传/i,
  /停止.*透传/i,
  /关闭.*透传/i,
];

/**
 * Return true when the input is an intent to leave ACP passthrough mode.
 */
function isAcpExitIntent(input: string): boolean {
  const trimmed = input.trim();
  return ACP_EXIT_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * 将用户输入直传到 acpx ACP 会话，并把输出以 ACP 风格回送到 Session。
 *
 * 当 input 匹配退出意图时，会自动清除直传状态并通知用户，而不会将消息
 * 发送给 acpx。
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
  const displayName = getAcpAgentDisplayName(agent);

  // Detect natural-language exit intent before forwarding to ACP.
  if (isAcpExitIntent(input)) {
    clearAcpPassthroughState();
    session.logSystemMessage(`✅ 已退出与 ${displayName} 的对话，恢复正常 AI 对话。`);
    return;
  }

  // 构建 acpx 参数：
  //   acpx --approve-all --format text [--cwd <cwd>] <agent> [-s <name>] <prompt>
  const execArgs: string[] = ['--approve-all', '--format', 'text'];
  if (cwd) execArgs.push('--cwd', cwd);
  execArgs.push(agent);
  if (sessionName) execArgs.push('-s', sessionName);
  execArgs.push(input);

  try {
    const acpOptions = {
      timeout: ACP_EXEC_TIMEOUT_MS,
      cwd: cwd || process.cwd(),
      env: process.env,
      signal: session?.abortController?.signal,
      killSignal: 'SIGKILL' as const,
    };

    const runAcp = () => {
      const promise = execFileAsync('acpx', execArgs, acpOptions);
      (promise as any).child?.stdout?.on?.('data', (data: Buffer) => {
        session.logToolProgress(`${displayName} 输出`, data.toString());
      });
      return promise;
    };

    let stdout: string;
    try {
      ({ stdout } = await runAcp());
    } catch (firstError) {
      if (!isNoAcpSessionError(firstError)) throw firstError;
      await createAcpSession(agent, cwd);
      ({ stdout } = await runAcp());
    }

    session.logAcpResponse(agent, stdout || '(empty)');
  } catch (error) {
    const errJson = handleCliExecutionError(error, 'acpx', input, ACP_EXEC_TIMEOUT_MS);
    let parsedError: any;
    try {
      parsedError = JSON.parse(errJson);
    } catch {
      parsedError = null;
    }
    // Silently discard abort errors — these occur when the user sends a new message
    // while a passthrough execution is in progress. The abort is intentional and the
    // new message is already being forwarded to ACP, so no error should be shown.
    if (parsedError?.interrupted) {
      return;
    }
    const message = parsedError?.message || errJson;
    session.logAcpResponse(agent, `❌ 错误: ${message}`);
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
  
  // 记录调用前的 ACP 状态，用于检测是否在本次 LLM 响应中激活了直传模式
  const acpStateBeforeStream = getAcpPassthroughState();

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

    // 如果本次 LLM 响应激活了 ACP 直传模式（工具调用 acpx_execute 的副作用），
    // 向 Lark 发送提示，告知后续消息将直接转发给 ACP。
    const acpStateAfterStream = getAcpPassthroughState();
    if (!acpStateBeforeStream && acpStateAfterStream) {
      const { agent: acpAgent, sessionName, cwd } = acpStateAfterStream;
      const sessionInfo = sessionName ? `\n• 会话: \`${sessionName}\`` : '';
      const cwdInfo = cwd ? `\n• 目录: \`${cwd}\`` : '';
      session.logAcpResponse(
        acpAgent,
        `**ACP 直传模式已激活**${sessionInfo}${cwdInfo}\n\n` +
        `后续所有 Lark 消息将直接转发给 \`${acpAgent}\`，不再经过 AI 大模型处理。\n` +
        `说「退出 acp」或输入 \`/acp stop\` 可退出直传模式。`,
      );
    }
    
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
