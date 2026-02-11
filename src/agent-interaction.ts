/**
 * AI代理交互工具模块
 * 
 * 该模块提供与AI代理进行交互的核心功能，包括调用代理、处理响应和错误处理。
 * 所有方法都经过严格的输入验证，并提供详细的错误信息用于调试。
 */

/**
 * 调用AI代理
 * 
 * 中文名称：调用AI代理
 * 
 * 预期行为：
 * - 接收AI代理实例、用户输入和会话线程ID作为参数
 * - 对所有输入参数进行严格验证
 * - 使用指定的配置调用AI代理的invoke方法
 * - 返回代理的响应结果
 * 
 * 行为分支：
 * 1. 正常情况：当所有参数有效时，成功调用代理并返回响应
 * 2. 代理无效：当agent参数为null/undefined或没有invoke方法时，抛出"Invalid agent provided"错误
 * 3. 输入无效：当input参数不是非空字符串时，抛出"Input must be a non-empty string"错误
 * 4. 线程ID无效：当threadId参数不是非空字符串时，抛出"Thread ID must be a non-empty string"错误
 * 5. 代理调用失败：如果代理内部调用失败，错误会直接向上抛出
 * 
 * @param agent - AI代理实例，必须包含invoke方法
 * @param input - 用户输入字符串，必须是非空字符串
 * @param threadId - 会话线程ID，用于维护对话上下文，必须是非空字符串
 * @returns Promise<any> - 代理响应的Promise
 * @throws {Error} 当输入参数无效时抛出相应的错误信息
 * 
 * @example
 * ```typescript
 * try {
 *   const response = await invokeAgent(agent, "Hello", "session-123");
 *   console.log(response);
 * } catch (error) {
 *   console.error("调用失败:", error.message);
 * }
 * ```
 */
export async function invokeAgent(agent: any, input: string, threadId: string): Promise<any> {
  if (!agent || typeof agent.invoke !== 'function') {
    throw new Error('Invalid agent provided');
  }
  
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('Input must be a non-empty string');
  }
  
  if (typeof threadId !== 'string' || threadId.trim() === '') {
    throw new Error('Thread ID must be a non-empty string');
  }
  
  return await agent.invoke(
    { messages: [{ role: "user", content: input }] },
    { 
      modelKwargs: { enable_thinking: true },
      configurable: { thread_id: threadId },
      recursionLimit: Infinity,
    },
  );
}

/**
 * 处理代理响应
 * 
 * 中文名称：处理代理响应
 * 
 * 预期行为：
 * - 接收原始的代理响应数据
 * - 根据响应数据的类型进行格式化处理
 * - 返回适合显示的字符串格式
 * 
 * 行为分支：
 * 1. 字符串响应：直接返回原始字符串
 * 2. 对象响应：将对象转换为格式化的JSON字符串（带缩进）
 * 3. 其他类型响应：转换为字符串表示形式
 * 4. null/undefined响应：转换为"null"/"undefined"字符串
 * 
 * @param response - 原始的代理响应数据，可以是任意类型
 * @returns string - 格式化后的响应字符串，适合在控制台或UI中显示
 * 
 * @example
 * ```typescript
 * const rawResponse = { result: "success", data: [1, 2, 3] };
 * const formatted = handleAgentResponse(rawResponse);
 * console.log(formatted); // 格式化的JSON字符串
 * ```
 */
export function handleAgentResponse(response: any): string {
  if (typeof response === 'string') {
    return response;
  } else if (response && typeof response === 'object') {
    return JSON.stringify(response, null, 2);
  } else {
    return String(response);
  }
}

/**
 * 处理代理交互错误
 * 
 * 中文名称：处理代理交互错误
 * 
 * 预期行为：
 * - 接收错误对象和可选的上下文信息
 * - 在控制台记录详细的错误信息
 * - 在开发环境中记录额外的调试信息（堆栈跟踪和上下文）
 * - 返回用户友好的错误消息
 * 
 * 行为分支：
 * 1. 有错误消息：使用错误对象的message属性作为错误描述
 * 2. 无错误消息：使用"Unknown error occurred"作为默认错误描述
 * 3. 开发环境：额外记录错误堆栈和上下文信息到控制台
 * 4. 生产环境：只记录基本的错误信息，避免暴露敏感信息
 * 5. 上下文缺失：使用默认上下文{ component: 'agent' }
 * 
 * @param error - 错误对象，通常包含message和stack属性
 * @param context - 可选的上下文信息对象，用于标识错误发生的组件和相关数据，默认为{ component: 'agent' }
 * @returns string - 用户友好的错误消息，格式为"发生错误: {错误描述}"
 * 
 * @example
 * ```typescript
 * try {
 *   // ... some agent operation
 * } catch (error) {
 *   const errorMessage = handleAgentError(error, { component: 'chat', userId: '123' });
 *   console.log(errorMessage); // "发生错误: ..."
 * }
 * ```
 */
export function handleAgentError(error: any, context: { component: string; [key: string]: any } = { component: 'agent' }): string {
  const errorMessage = error?.message || 'Unknown error occurred';
  console.error(`[${context.component}] Agent interaction error:`, errorMessage);
  
  // Log detailed error info in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error stack:', error?.stack);
    console.error('Error context:', context);
  }
  
  return `发生错误: ${errorMessage}`;
}