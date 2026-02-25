/**
 * 流处理模块
 * 
 * 中文名称：流处理模块
 * 
 * 负责处理AI代理的流式响应，包括工具调用、工具结果、AI内容和待办事项的处理。
 * 
 * @module stream-handler
 */

import { HumanMessage } from "langchain";
import { structuredLog } from '@/shared/utils/logging';
import { extractMessagesAndTodos, MessagesAndTodos } from '@/core/utils/message-processor';

/**
 * 流状态接口
 * 
 * 中文名称：流状态接口
 * 
 * 定义流处理过程中需要维护的状态信息。
 */
export interface StreamState {
  /** 完整的响应内容 */
  fullResponse: string;
  /** 最后一次工具调用信息 */
  lastToolCall: any;
  /** 是否已显示思考提示 */
  hasDisplayedThinking: boolean;
  /** 中断信号 */
  abortSignal: AbortSignal;
}

/**
 * 处理工具调用
 * 
 * 中文名称：处理工具调用
 * 
 * 预期行为：
 * - 接收消息对象、流状态和会话对象
 * - 检查消息是否包含工具调用
 * - 提取工具调用的名称和参数
 * - 使用会话的Adapter发送工具调用事件
 * - 更新流状态中的最后工具调用信息
 * 
 * 行为分支：
 * 1. 无工具调用：直接返回，不执行任何操作
 * 2. 有工具调用：遍历所有工具调用，提取名称和参数，发送调用事件
 * 3. 参数解析：如果参数是JSON字符串，则解析为对象
 * 
 * @param msg - 消息对象，可能包含tool_calls属性
 * @param state - 流状态对象，用于存储最后工具调用信息
 * @param session - 会话对象，用于发送I/O事件
 * @returns Promise<void> - 异步操作完成时解析
 */
export async function handleToolCall(msg: any, state: StreamState, session: any) {
  if (!msg.tool_calls?.length) return;
  
  for (const call of msg.tool_calls) {
    state.lastToolCall = call;
    const name = call.name || call.function?.name;
    const args = call.args || (call.function?.arguments ? JSON.parse(call.function.arguments) : {});
    await session.adapter?.emit({
      type: 'toolCall',
      data: { name, args },
      timestamp: Date.now()
    });
  }
}

/**
 * 处理工具结果
 * 
 * 中文名称：处理工具结果
 * 
 * 预期行为：
 * - 接收消息对象、流状态和会话对象
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
 * @param session - 会话对象，用于发送I/O事件
 * @returns void - 无返回值
 */
export function handleToolResult(msg: any, state: StreamState, session: any) {
  if (!msg.tool_call_id || state.abortSignal.aborted) return;

  const result = String(msg.content || "");
  const isJson = result.trim().startsWith("{");
  let preview = "";

  if (isJson) {
    handleJsonToolResult(result, state.lastToolCall, session);
  } else {
    handleTextToolResult(result, state.lastToolCall, session);
  }
}

/**
 * 处理JSON格式工具结果
 * 
 * 中文名称：处理JSON格式工具结果
 * 
 * 预期行为：
 * - 接收JSON字符串结果、最后工具调用信息和会话对象
 * - 解析JSON并提取关键信息（命令、文件路径、标准输出、标准错误等）
 * - 根据详细输出模式设置不同的截断长度
 * - 使用会话的Adapter发送工具结果事件
 * - 特别优化 task 工具的结果展示
 * 
 * 行为分支：
 * 1. JSON解析成功：提取并格式化相关信息，发送成功/失败状态
 * 2. JSON解析失败：发送原始结果内容（截断处理）
 * 3. 无输出内容：发送"无输出"提示
 * 4. 详细模式：使用更长的截断长度（200-300字符）
 * 5. 简略模式：使用较短的截断长度（60-150字符）
 * 6. task工具结果：提供专门的友好展示格式
 * 
 * @param result - JSON格式的工具结果字符串
 * @param lastToolCall - 最后一次工具调用信息，用于获取工具名称
 * @param session - 会话对象，用于发送I/O事件
 * @returns void - 无返回值
 */
export async function handleJsonToolResult(result: string, lastToolCall: any, session: any) {
  try {
    const parsed = JSON.parse(result);
    const success = parsed.success !== false;

    // 发送原始的解析结果，让 TerminalAdapter 处理截断和格式化
    await session.adapter?.emit({
      type: 'toolResult',
      data: { 
        name: lastToolCall?.name || "unknown", 
        success, 
        result: parsed,
        originalResult: result,
        isJsonResult: true
      },
      timestamp: Date.now()
    });
  } catch {
    // 发送原始的错误结果
    await session.adapter?.emit({
      type: 'toolResult',
      data: { 
        name: lastToolCall?.name || "unknown", 
        success: true, 
        result: result,
        originalResult: result,
        isJsonResult: false
      },
      timestamp: Date.now()
    });
  }
}

/**
 * 处理文本格式工具结果
 * 
 * 中文名称：处理文本格式工具结果
 * 
 * 预期行为：
 * - 接收文本结果、最后工具调用信息和会话对象
 * - 根据内容判断执行是否成功（检查是否包含错误标识符）
 * - 应用截断处理以控制输出长度
 * - 使用会话的Adapter发送工具结果事件
 * - 特别优化 task 工具的文本结果展示
 * 
 * 行为分支：
 * 1. 包含"❌"或"失败"：标记为失败
 * 2. 不包含错误标识符：标记为成功
 * 3. 详细模式：截断长度为300字符
 * 4. 简略模式：截断长度为150字符
 * 5. task工具结果：提供专门的友好展示格式
 * 
 * @param result - 文本格式的工具结果字符串
 * @param lastToolCall - 最后一次工具调用信息，用于获取工具名称
 * @param session - 会话对象，用于发送I/O事件
 * @returns Promise<void> - 异步操作完成时解析
 */
export async function handleTextToolResult(result: string, lastToolCall: any, session: any) {
  // 特别处理 task 工具的结果
  if (lastToolCall?.name === 'task') {
    const type = lastToolCall?.args?.subagent_type
    const name = type ? `🧠 ${type} 结果` : '子代理任务';
    const success = !result.includes("❌") && !result.includes("失败");
    
    await session.adapter?.emit({
      type: 'toolResult',
      data: { 
        name, 
        success, 
        result: result,
        isTaskResult: true
      },
      timestamp: Date.now()
    });
    return;
  }
  
  const success = !result.includes("❌") && !result.includes("失败");
  await session.adapter?.emit({
    type: 'toolResult',
    data: { 
      name: lastToolCall?.name || "unknown", 
      success, 
      result: result,
      isTextResult: true
    },
    timestamp: Date.now()
  });
}

/**
 * 处理AI内容流
 * 
 * 中文名称：处理AI内容流
 * 
 * 预期行为：
 * - 接收消息对象、流状态、会话对象和可选的用户输入
 * - 检查是否为有效的内容消息
 * - 计算新增的内容部分（避免重复显示）
 * - 逐字符流式输出，提供打字机效果
 * - 使用会话的Adapter发送流数据块事件
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
 * @param session - 会话对象，用于发送I/O事件
 * @param userInput - 可选的用户输入，用于上下文（当前未使用）
 * @returns Promise<void> - 无返回值的Promise
 */
export async function handleAIContent(msg: any, state: StreamState, session: any, userInput?: string) {
  if (!msg.content || msg.tool_call_id || state.abortSignal.aborted) return;

  const currentContent = String(msg.content);

  if (state.fullResponse && !currentContent.startsWith(state.fullResponse)) {
    state.fullResponse = '';
  }
  // 只显示新增的内容，避免重复
  if (currentContent.length <= state.fullResponse.length) return;
  
  const newContent = currentContent.substring(state.fullResponse.length);
  if (!newContent) return;

  // 发送完整的AI响应内容
  await session.adapter?.emit({
    type: 'aiResponse',
    data: { content: newContent },
    timestamp: Date.now()
  });

  state.fullResponse = currentContent;
}

/**
 * 处理待办事项
 * 
 * 中文名称：处理待办事项
 * 
 * 预期行为：
 * - 接收消息对象、流状态和会话对象
 * - 检查是否包含待办事项数组
 * - 发送完整的思考过程事件，包括所有状态的待办事项
 * - 避免重复显示已显示的待办事项
 * - 使用不同的图标表示不同状态的思考步骤
 * 
 * 行为分支：
 * 1. 无待办事项或已被中断：直接返回
 * 2. 无新待办事项：直接返回
 * 3. 首次显示待办事项：发送"AI正在思考..."提示事件
 * 4. 待办事项状态为completed：使用✅图标
 * 5. 待办事项状态为in_progress：使用🔄图标  
 * 6. 待办事项状态为pending：使用💭图标
 * 
 * @param msg - 消息对象，可能包含todos数组
 * @param state - 流状态对象，包含完整响应、思考提示状态和中断信号
 * @param session - 会话对象，用于发送I/O事件
 * @returns void - 无返回值
 */
export async function handleTodos(msg: any, state: StreamState, session: any) {
  if (!Array.isArray(msg.todos) || state.abortSignal.aborted) return;

  // 显示所有状态的待办事项（completed, in_progress, pending），提供完整的思考过程
  const newTodos = msg.todos.filter((todo: any) => 
    todo && todo.content && !state.fullResponse.includes(todo.content)
  );

  if (newTodos.length === 0) return;

  await session.adapter?.emit({
    type: 'thinkingProcess',
    data: { steps: newTodos },
    timestamp: Date.now()
  });
  
  if (!state.hasDisplayedThinking) {
    state.hasDisplayedThinking = true;
  }
}

const processedMessageIds = new Set<string>();

/**
 * 处理流数据块
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
  session: any,
  userInput?: string
): Promise<string> {
  let hasShownInitialIndicator = false;

  try {
    for await (const chunk of await stream) {
      if (state.abortSignal.aborted) throw new Error("操作已被用户中断");

      const { messages, todos }: MessagesAndTodos = extractMessagesAndTodos(chunk);
      
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
            await session.adapter?.emit({
              type: 'streamStart',
              data: { initialContent: "" },
              timestamp: Date.now()
            });
          }
          hasShownInitialIndicator = true;
        }
      }

      // 扁平化处理各类消息（无嵌套），只处理非用户消息
      for (const msg of newMessages) {
        // 跳过用户消息，只处理 AI 助手、工具调用等消息
        if (msg.role === 'user') continue;
        
        // 标记消息是否已被处理，避免重复处理
        let processedAsToolResult = false;
        
        await handleToolCall(msg, state, session);
        
        // 如果是工具结果消息，处理后标记为已处理
        if (msg.tool_call_id) {
          handleToolResult(msg, state, session);
          processedAsToolResult = true;
        }
        
        // 只有不是工具结果的消息才进行AI内容流处理
        if (!processedAsToolResult) {
          await handleAIContent(msg, state, session, userInput);
        }
        
        if (todos.length) await handleTodos({ ...msg, todos }, state, session);
      }
    }

    // 完成指示器 - 由 TerminalAdapter 处理
    if (!state.abortSignal.aborted && state.fullResponse && !state.fullResponse.trim().endsWith(".")) {
      await session.adapter?.emit({
        type: 'streamEnd',
        data: { finalContent: state.fullResponse },
        timestamp: Date.now()
      });
    }

    return state.fullResponse;
  } catch (error: any) {
    if (error.name === "AbortError" || state.abortSignal.aborted) {
      session.adapter?.emit({
        type: 'errorMessage',
        data: { message: "⚠️ 操作已被用户中断" },
        timestamp: Date.now()
      });
    } else {
      session.adapter?.emit({
        type: 'errorMessage',
        data: { message: `发生错误: ${error.message}` },
        timestamp: Date.now()
      });
      structuredLog('error', 'Interactive mode error', { 
        component: 'interactive', 
        error: error.message,
        stack: error.stack 
      });
    }
    return state.fullResponse;
  }
}