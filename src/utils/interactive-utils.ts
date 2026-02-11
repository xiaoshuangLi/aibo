/**
 * 交互模式工具函数模块
 * 
 * 该模块提供AI助手交互模式的核心功能，包括消息提取、流处理、工具调用处理和用户输入处理。
 */

import { HumanMessage } from "langchain";

import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  createConsoleThreadId
} from '../interactive-logic';
import { structuredLog } from './logging';
import { config } from '../config';

/**
 * 样式化输出函数集合
 * 
 * 中文名称：样式化输出函数集合
 * 
 * 提供各种类型的控制台输出格式化函数，用于不同场景的用户界面显示。
 */
export const styled = {
  /**
   * AI助手消息样式
   * @param text - 要显示的文本
   * @returns 格式化的助手消息字符串
   */
  assistant: (text: string) => `\n🤖 ${text}`,
  
  /**
   * 工具调用样式
   * @param name - 工具名称
   * @param args - 工具参数对象
   * @returns 格式化的工具调用消息字符串
   */
  toolCall: (name: string, args: any) => `\n🔧 正在调用工具: ${name}\n   参数: ${JSON.stringify(args, null, 2).split('\n').map(l => '   ' + l).join('\n').trim()}`,
  
  /**
   * 工具结果样式
   * @param name - 工具名称
   * @param success - 执行是否成功
   * @param preview - 结果预览文本
   * @returns 格式化的工具结果消息字符串
   */
  toolResult: (name: string, success: boolean, preview: string) => 
    `\n${success ? '✅' : '❌'} 工具执行 ${name}: ${success ? '成功' : '失败'}\n${preview}`,
  
  /**
   * 系统消息样式
   * @param text - 要显示的系统文本
   * @returns 格式化的系统消息字符串
   */
  system: (text: string) => `\n⚙️  ${text}`,
  
  /**
   * 错误消息样式
   * @param text - 要显示的错误文本
   * @returns 格式化的错误消息字符串
   */
  error: (text: string) => `\n❌ ${text}`,
  
  /**
   * 提示消息样式
   * @param text - 要显示的提示文本
   * @returns 格式化的提示消息字符串
   */
  hint: (text: string) => `\n💡 ${text}`,
  
  /**
   * 截断文本样式
   * @param original - 原始文本
   * @param limit - 截断限制长度
   * @returns 如果原文本超过限制则返回截断后的文本，否则返回原文本
   */
  truncated: (original: string, limit: number) => 
    original.length > limit ? original.substring(0, limit) + `... [已截断 ${original.length - limit} 字符]` : original,
};

// ============ 消息提取模块 ============

/**
 * 提取消息和待办事项
 * 
 * 中文名称：提取消息和待办事项
 * 
 * 预期行为：
 * - 接收流数据块（chunk）作为输入
 * - 根据不同的数据结构格式提取消息和待办事项
 * - 按照优先级顺序尝试多种提取策略
 * - 返回包含消息数组和待办事项数组的对象
 * 
 * 行为分支：
 * 1. 数组输入：直接返回数组作为消息，待办事项为空数组
 * 2. 非对象或null输入：返回空的消息和待办事项数组
 * 3. model_request格式：从model_request.messages提取消息
 * 4. todoListMiddleware格式：从todoListMiddleware.after_model提取消息和待办事项
 * 5. patchToolCallsMiddleware格式：从patchToolCallsMiddleware.before_agent提取消息
 * 6. SummarizationMiddleware格式：从SummarizationMiddleware.before_model提取消息
 * 7. 直接messages格式：从chunk.messages和chunk.todos提取
 * 8. 消息中包含待办事项：如果提取的待办事项为空，但消息中包含todos属性，则从消息中提取
 * 9. 无匹配格式：返回空的消息和待办事项数组
 * 
 * @param chunk - 流数据块，可以是数组、对象或其他类型
 * @returns { messages: any[]; todos: any[] } - 包含消息数组和待办事项数组的对象
 * 
 * @example
 * ```typescript
 * // 从数组提取
 * const result = extractMessagesAndTodos([{ role: "user", content: "hello" }]);
 * // result.messages = [{ role: "user", content: "hello" }]
 * // result.todos = []
 * 
 * // 从对象提取
 * const result = extractMessagesAndTodos({ messages: [...], todos: [...] });
 * ```
 */
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

/**
 * 流状态接口
 * 
 * 中文名称：流状态接口
 * 
 * 定义流处理过程中需要维护的状态信息。
 */
interface StreamState {
  fullResponse: string;           // 完整的响应内容
  lastToolCall: any;              // 最后一次工具调用信息
  hasDisplayedThinking: boolean;   // 是否已显示思考提示
  abortSignal: AbortSignal;        // 中断信号
}

/**
 * 处理工具调用
 * 
 * 中文名称：处理工具调用
 * 
 * 预期行为：
 * - 接收消息对象和流状态
 * - 检查消息是否包含工具调用
 * - 提取工具调用的名称和参数
 * - 使用样式化输出显示工具调用信息
 * - 更新流状态中的最后工具调用信息
 * 
 * 行为分支：
 * 1. 无工具调用：直接返回，不执行任何操作
 * 2. 有工具调用：遍历所有工具调用，提取名称和参数，显示调用信息
 * 3. 参数解析：如果参数是JSON字符串，则解析为对象
 * 
 * @param msg - 消息对象，可能包含tool_calls属性
 * @param state - 流状态对象，用于存储最后工具调用信息
 * @returns void - 无返回值
 */
export function handleToolCall(msg: any, state: StreamState) {
  if (!msg.tool_calls?.length) return;
  
  for (const call of msg.tool_calls) {
    state.lastToolCall = call;
    const name = call.name || call.function?.name;
    const args = call.args || (call.function?.arguments ? JSON.parse(call.function.arguments) : {});
    console.log(styled.toolCall(name, args));
  }
}

/**
 * 处理工具结果
 * 
 * 中文名称：处理工具结果
 * 
 * 预期行为：
 * - 接收消息对象和流状态
 * - 检查是否为工具结果消息（包含tool_call_id）
 * - 检查是否已被中断
 * - 根据结果内容类型（JSON或文本）调用相应的处理函数
 * 
 * 行为分支：
 * 1. 非工具结果消息：直接返回
 * 2. 已被中断：直接返回
 * 3. JSON格式结果：调用handleJsonToolResult处理
 * 4. 文本格式结果：调用handleTextToolResult处理
 * 
 * @param msg - 消息对象，可能包含tool_call_id和content属性
 * @param state - 流状态对象，包含中断信号和最后工具调用信息
 * @returns void - 无返回值
 */
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

/**
 * 处理JSON格式工具结果
 * 
 * 中文名称：处理JSON格式工具结果
 * 
 * 预期行为：
 * - 接收JSON字符串结果和最后工具调用信息
 * - 解析JSON并提取关键信息（命令、文件路径、标准输出、标准错误等）
 * - 根据详细输出模式设置不同的截断长度
 * - 使用样式化输出显示工具结果
 * 
 * 行为分支：
 * 1. JSON解析成功：提取并格式化相关信息，显示成功/失败状态
 * 2. JSON解析失败：显示原始结果内容（截断处理）
 * 3. 无输出内容：显示"无输出"提示
 * 4. 详细模式：使用更长的截断长度（200-300字符）
 * 5. 简略模式：使用较短的截断长度（60-150字符）
 * 
 * @param result - JSON格式的工具结果字符串
 * @param lastToolCall - 最后一次工具调用信息，用于获取工具名称
 * @returns void - 无返回值
 */
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

/**
 * 处理文本格式工具结果
 * 
 * 中文名称：处理文本格式工具结果
 * 
 * 预期行为：
 * - 接收文本结果和最后工具调用信息
 * - 根据内容判断执行是否成功（检查是否包含错误标识符）
 * - 应用截断处理以控制输出长度
 * - 使用样式化输出显示工具结果
 * 
 * 行为分支：
 * 1. 包含"❌"或"失败"：标记为失败
 * 2. 不包含错误标识符：标记为成功
 * 3. 详细模式：截断长度为300字符
 * 4. 简略模式：截断长度为150字符
 * 
 * @param result - 文本格式的工具结果字符串
 * @param lastToolCall - 最后一次工具调用信息，用于获取工具名称
 * @returns void - 无返回值
 */
export function handleTextToolResult(result: string, lastToolCall: any) {
  const preview = styled.truncated(result, config.output.verbose ? 300 : 150);
  const success = !result.includes("❌") && !result.includes("失败");
  console.log(styled.toolResult(lastToolCall?.name || "unknown", success, preview));
}

/**
 * 处理AI内容流
 * 
 * 中文名称：处理AI内容流
 * 
 * 预期行为：
 * - 接收消息对象、流状态和可选的用户输入
 * - 检查是否为有效的内容消息
 * - 计算新增的内容部分（避免重复显示）
 * - 逐字符流式输出，提供打字机效果
 * - 更新流状态中的完整响应内容
 * 
 * 行为分支：
 * 1. 无内容或工具结果：直接返回
 * 2. 已被中断：直接返回
 * 3. 无新增内容：直接返回
 * 4. 有新增内容：逐字符输出，根据详细模式调整打字速度
 * 5. 详细模式：字符间隔5ms
 * 6. 简略模式：字符间隔15ms
 * 
 * @param msg - 消息对象，包含content属性
 * @param state - 流状态对象，包含完整响应、中断信号等
 * @param userInput - 可选的用户输入，用于上下文（当前未使用）
 * @returns Promise<void> - 无返回值的Promise
 */
export async function handleAIContent(msg: any, state: StreamState, userInput?: string) {
  if (!msg.content || msg.tool_call_id || state.abortSignal.aborted) return;

  const currentContent = String(msg.content);
  // 只显示新增的内容，避免重复
  if (currentContent.length <= state.fullResponse.length) return;
  
  const newContent = currentContent.substring(state.fullResponse.length);
  if (!newContent) return;

  for (const char of newContent) {
    if (state.abortSignal.aborted) break;
    process.stdout.write(char);
    await new Promise(resolve => setTimeout(resolve, config.output.verbose ? 5 : 15));
  }

  state.fullResponse = currentContent;
}

/**
 * 处理待办事项
 * 
 * 中文名称：处理待办事项
 * 
 * 预期行为：
 * - 接收消息对象和流状态
 * - 检查是否包含待办事项数组
 * - 过滤出非pending状态的待办事项（completed或in_progress）
 * - 避免重复显示已显示的待办事项
 * - 显示AI思考提示和待办事项列表
 * 
 * 行为分支：
 * 1. 无待办事项或已被中断：直接返回
 * 2. 无非pending状态的待办事项：直接返回
 * 3. 首次显示待办事项：显示"AI正在思考..."提示
 * 4. 待办事项状态为completed：显示✅图标
 * 5. 待办事项状态为in_progress：显示🔄图标
 * 
 * @param msg - 消息对象，可能包含todos数组
 * @param state - 流状态对象，包含完整响应、思考提示状态和中断信号
 * @returns void - 无返回值
 */
export function handleTodos(msg: any, state: StreamState) {
  if (!Array.isArray(msg.todos) || state.abortSignal.aborted) return;

  // 只显示非pending状态的todo（completed或in_progress），避免显示过多的pending任务
  const nonPendingTodos = msg.todos.filter((todo: any) => 
    (todo.status === 'completed' || todo.status === 'in_progress') && 
    !state.fullResponse.includes(todo.content)
  );

  if (nonPendingTodos.length === 0) return;

  if (!state.hasDisplayedThinking) {
    console.log('\n💭 AI 正在思考...');
    state.hasDisplayedThinking = true;
  }

  nonPendingTodos.forEach((todo: any) => {
    const emoji = todo.status === 'completed' ? '✅' : '🔄';
    console.log(`\n${emoji} ${todo.content}`);
  });
}

const processedMessageIds = new Set<string>();

// ============ 主流程控制 ============

/**
 * 处理流数据块
 * 
 * 中文名称：处理流数据块
 * 
 * 预期行为：
 * - 接收异步可迭代的流数据、流状态、Readline接口和可选的用户输入
 * - 迭代处理每个数据块
 * - 提取消息和待办事项
 * - 实现消息去重机制
 * - 调用相应的消息处理函数
 * - 处理流完成后的指示器
 * - 捕获并处理异常
 * 
 * 行为分支：
 * 1. 正常处理：逐个处理数据块，提取消息，调用处理函数
 * 2. 用户中断：检测到中断信号，抛出"操作已被用户中断"错误
 * 3. 消息去重：基于消息ID、内容或JSON字符串进行去重
 * 4. 用户消息过滤：跳过HumanMessage和role为'user'的消息
 * 5. 初始指示器：首次显示非待办事项消息时显示"..."提示
 * 6. 流完成：在响应末尾添加完成指示器（...）
 * 7. 中断异常：显示"操作已被用户中断"错误消息
 * 8. 其他异常：显示错误消息并记录结构化日志
 * 
 * @param stream - 异步可迭代的流数据
 * @param state - 流状态对象，包含完整响应、中断信号等
 * @param rl - Readline接口，用于输入输出
 * @param userInput - 可选的用户输入，传递给AI内容处理函数
 * @returns Promise<string> - 返回完整的响应内容字符串
 */
export async function processStreamChunks(
  stream: AsyncIterable<any>,
  state: StreamState,
  rl: any,
  userInput?: string
): Promise<string> {
  let hasShownInitialIndicator = false;

  try {
    for await (const chunk of await stream) {
      if (state.abortSignal.aborted) throw new Error("操作已被用户中断");

      const { messages, todos } = extractMessagesAndTodos(chunk);
      
      // 使用更可靠的去重机制 - 基于消息内容或ID
      const newMessages = messages.filter((msg: any) => {
        const messageId = msg.id || msg.content?.substring(0, 50) || JSON.stringify(msg);
        if (processedMessageIds.has(messageId)) {
          return false;
        }

        if (msg instanceof HumanMessage) {
          return false;
        }

        processedMessageIds.add(messageId);
        return true;
      });

      // Show initial indicator on first unprocessed message
      if (!hasShownInitialIndicator && newMessages.length > 0) {
        // Check if any of the new messages are actually unprocessed
        const hasUnprocessedMessage = newMessages.some((msg: any) => !msg._processed);
        if (hasUnprocessedMessage) {
          if (todos.length > 0) {
            // Will be handled by handleTodos
          } else {
            console.log(styled.assistant("..."));
          }
          hasShownInitialIndicator = true;
        }
      }

      // 扁平化处理各类消息（无嵌套），只处理非用户消息
      for (const msg of newMessages) {
        // 跳过用户消息，只处理 AI 助手、工具调用等消息
        if (msg.role === 'user') continue;
        
        handleToolCall(msg, state);
        handleToolResult(msg, state);
        await handleAIContent(msg, state, userInput);
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

// ============ 辅助函数 ============

/**
 * 优雅关闭处理器
 * 
 * 中文名称：优雅关闭处理器
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
function gracefulShutdownHandler(
  signal: string,
  session: { isRunning: boolean; rl: any }
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

// ============ 公共 API ============

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
  session: { 
    threadId: string; 
    isRunning: boolean; 
    abortController: AbortController | null;
    rl: any;
  },
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
  session: { isRunning: boolean; rl: any }
): (signal: string) => void {
  return (signal: string): void => {
    gracefulShutdownHandler(signal, session);
  };
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
    if (rl.line.slice(rl.line.length - 8, rl.line.length).includes('干活')) {
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