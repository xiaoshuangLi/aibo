/**
 * 消息和待办事项提取模块
 * 
 * 中文名称：消息和待办事项提取模块
 * 
 * 负责从流数据块中提取消息和待办事项，支持多种数据格式。
 * 
 * @module message-processor
 */

/**
 * 提取消息和待办事项结果接口
 * @interface MessagesAndTodos
 */
export interface MessagesAndTodos {
  /** 提取的消息数组 */
  messages: any[];
  /** 提取的待办事项数组 */
  todos: any[];
}

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
export function extractMessagesAndTodos(chunk: any): MessagesAndTodos {
  if (Array.isArray(chunk)) return { messages: chunk, todos: [] };
  
  if (typeof chunk !== 'object' || chunk === null) return { messages: [], todos: [] };

  // 按优先级尝试提取消息
  const sources = [
    () => ({ messages: chunk.tools?.messages, todos: [] }),
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