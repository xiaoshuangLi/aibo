/**
 * Interactive mode utility functions for AI Assistant (重构版).
 */

import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  createConsoleThreadId
} from '../interactive-logic';
import { structuredLog } from './logging';
import { config } from '../config';

export const styled = {
  assistant: (text: string) => `\n🤖 ${text}`,
  toolCall: (name: string, args: any) => `\n🔧 正在调用工具: ${name}\n   参数: ${JSON.stringify(args, null, 2).split('\n').map(l => '   ' + l).join('\n').trim()}`,
  toolResult: (name: string, success: boolean, preview: string) => 
    `\n${success ? '✅' : '❌'} 工具执行 ${name}: ${success ? '成功' : '失败'}\n${preview}`,
  system: (text: string) => `\n⚙️  ${text}`,
  error: (text: string) => `\n❌ ${text}`,
  hint: (text: string) => `\n💡 ${text}`,
  truncated: (original: string, limit: number) => 
    original.length > limit ? original.substring(0, limit) + `... [已截断 ${original.length - limit} 字符]` : original,
};

// ============ 消息提取模块 ============
export function extractMessagesAndTodos(chunk: any): { messages: any[]; todos: any[] } {
  if (Array.isArray(chunk)) return { messages: chunk, todos: [] };
  
  if (typeof chunk !== 'object' || chunk === null) return { messages: [], todos: [] };

  // 按优先级尝试提取消息
  const sources = [
    () => ({ messages: chunk.model_request?.messages, todos: [] }),
    () => ({ messages: chunk['todoListMiddleware.after_model']?.messages, todos: chunk['todoListMiddleware.after_model']?.todos || [] }),
    () => ({ messages: chunk['patchToolCallsMiddleware.before_agent']?.messages, todos: [] }),
    () => ({ messages: chunk['SummarizationMiddleware.before_model']?.messages, todos: [] }),
    () => ({ messages: chunk.messages, todos: chunk.todos || [] }),
  ];

  for (const source of sources) {
    const { messages, todos } = source();
    if (messages?.length) {
      // 如果 todos 为空，但 messages 中包含 todos，提取它们
      let extractedTodos = todos;
      if (!extractedTodos.length) {
        extractedTodos = (messages as any[])
          .flatMap((msg: any) => msg.todos || [])
          .filter((todo: any) => todo && todo.content);
      }
      return { messages, todos: extractedTodos };
    }
  }

  return { messages: [], todos: [] };
}

// ============ 消息处理模块 ============
interface StreamState {
  fullResponse: string;
  lastToolCall: any;
  hasDisplayedThinking: boolean;
  abortSignal: AbortSignal;
}

export function handleToolCall(msg: any, state: StreamState) {
  if (!msg.tool_calls?.length) return;
  
  for (const call of msg.tool_calls) {
    state.lastToolCall = call;
    const name = call.name || call.function?.name;
    const args = call.args || (call.function?.arguments ? JSON.parse(call.function.arguments) : {});
    console.log(styled.toolCall(name, args));
  }
}

export function handleToolResult(msg: any, state: StreamState) {
  if (!msg.tool_call_id || state.abortSignal.aborted) return;

  const result = String(msg.content || "");
  const isJson = result.trim().startsWith("{");
  let preview = "";

  if (isJson) {
    handleJsonToolResult(result, state.lastToolCall);
  } else {
    handleTextToolResult(result, state.lastToolCall);
  }
}

export function handleJsonToolResult(result: string, lastToolCall: any) {
  try {
    const parsed = JSON.parse(result);
    const success = parsed.success !== false;
    let preview = "";

    if (parsed.command) {
      preview = `▸ 命令: ${styled.truncated(parsed.command, 80)}`;
    } else if (parsed.filepath) {
      preview = `▸ 文件: ${parsed.filepath}`;
    }

    if (parsed.stdout) {
      const out = String(parsed.stdout).trim();
      if (out && out !== "(empty)") {
        preview += `\n▸ 输出: ${styled.truncated(out.split('\n')[0] || out, config.output.verbose ? 200 : 80)}`;
      }
    }

    if (parsed.stderr?.trim() !== "(empty)") {
      preview += `\n▸ 错误: ${styled.truncated(parsed.stderr.split('\n')[0], config.output.verbose ? 100 : 60)}`;
    }

    console.log(styled.toolResult(
      lastToolCall?.name || "unknown",
      success,
      preview || "无输出"
    ));
  } catch {
    const preview = styled.truncated(result, config.output.verbose ? 300 : 150);
    console.log(styled.toolResult(lastToolCall?.name || "unknown", true, preview));
  }
}

export function handleTextToolResult(result: string, lastToolCall: any) {
  const preview = styled.truncated(result, config.output.verbose ? 300 : 150);
  const success = !result.includes("❌") && !result.includes("失败");
  console.log(styled.toolResult(lastToolCall?.name || "unknown", success, preview));
}

export async function handleAIContent(msg: any, state: StreamState) {
  if (!msg.content || msg.tool_call_id || state.abortSignal.aborted) return;

  const newContent = String(msg.content).replace(state.fullResponse, "");
  if (!newContent) return;

  for (const char of newContent) {
    if (state.abortSignal.aborted) break;
    process.stdout.write(char);
    await new Promise(resolve => setTimeout(resolve, config.output.verbose ? 5 : 15));
  }

  state.fullResponse = msg.content;
}

export function handleTodos(msg: any, state: StreamState) {
  if (!Array.isArray(msg.todos) || state.abortSignal.aborted) return;

  const newTodos = msg.todos.filter((todo: any) => 
    !state.fullResponse.includes(todo.content) && todo.status !== 'pending'
  );

  if (newTodos.length === 0) return;

  if (!state.hasDisplayedThinking) {
    console.log('\n💭 AI 正在思考...');
    state.hasDisplayedThinking = true;
  }

  newTodos.forEach((todo: any) => {
    const emoji = todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '🔄' : '⏳';
    console.log(`\n${emoji} ${todo.content}`);
  });
}

// ============ 主流程控制 ============
export async function processStreamChunks(
  stream: AsyncIterable<any>,
  state: StreamState,
  rl: any
): Promise<string> {
  let hasShownInitialIndicator = false;

  try {
    for await (const chunk of await stream) {
      if (state.abortSignal.aborted) throw new Error("操作已被用户中断");

      const { messages, todos } = extractMessagesAndTodos(chunk);
      const newMessages = messages.filter((msg: any) => !msg._processed);
      newMessages.forEach((msg: any) => msg._processed = true);

      // Show initial indicator on first message
      if (!hasShownInitialIndicator && newMessages.length > 0) {
        if (todos.length > 0) {
          // Will be handled by handleTodos
        } else {
          console.log(styled.assistant("..."));
        }
        hasShownInitialIndicator = true;
      }

      // 扁平化处理各类消息（无嵌套）
      for (const msg of newMessages) {
        handleToolCall(msg, state);
        handleToolResult(msg, state);
        await handleAIContent(msg, state);
        if (todos.length) handleTodos({ ...msg, todos }, state);
      }
    }

    // 完成指示器
    if (!state.abortSignal.aborted && state.fullResponse && !state.fullResponse.trim().endsWith(".")) {
      for (let i = 0; i < 2; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        process.stdout.write(".");
      }
      process.stdout.write(".\n");
    }

    return state.fullResponse;
  } catch (error: any) {
    if (error.name === "AbortError" || state.abortSignal.aborted) {
      console.log(styled.error("⚠️ 操作已被用户中断"));
    } else {
      console.log(styled.error(`发生错误: ${error.message}`));
      structuredLog('error', 'Interactive mode error', { 
        component: 'interactive', 
        error: error.message,
        stack: error.stack 
      });
    }
    return state.fullResponse;
  }
}

// ============ 输入循环（替代递归） ============
export async function startInputLoop(
  session: { threadId: string; isRunning: boolean; abortController: AbortController | null },
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
          signal: session.abortController.signal,
          recursionLimit: Infinity,
        }
      );

      await processStreamChunks(stream, state, rl);
    } finally {
      session.isRunning = false;
      session.abortController = null;
    }
  }
}

// ============ 公共 API ============
export async function handleUserInput(
  input: string,
  session: { 
    threadId: string; 
    isRunning: boolean; 
    abortController: AbortController | null;
    rl: any;
  },
  agent: any,
  rl: any
) {
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
        signal: session.abortController.signal,
        recursionLimit: Infinity,
      }
    );

    await processStreamChunks(stream, state, rl);
  } finally {
    session.isRunning = false;
    session.abortController = null;
  }
  
  // Ask for next input
  showPrompt(session, rl);
}

export const createGracefulShutdown = (
  session: { isRunning: boolean; rl: any }
) => {
  return (signal: string) => {
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
  };
};

export function showPrompt(
  session: { isRunning: boolean }, 
  rl: any
) {
  if (session.isRunning) return;
  rl.setPrompt?.(`\n👤 You: `);
  rl.prompt?.();
}