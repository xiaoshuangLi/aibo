/**
 * 结构化日志工具模块
 * 
 * 该模块提供结构化的日志记录功能，支持时间戳、日志级别和上下文信息。
 */

/**
 * 结构化日志记录函数
 * 
 * 中文名称：结构化日志记录函数
 * 
 * 预期行为：
 * - 接收日志级别、消息和可选的上下文对象
 * - 生成包含ISO 8601时间戳的日志条目
 * - 将日志级别转换为大写格式
 * - 将上下文对象序列化为JSON字符串（如果提供）
 * - 使用console.log输出格式化的日志消息
 * 
 * 行为分支：
 * 1. info级别：记录信息性日志，用于正常操作和状态更新
 * 2. warn级别：记录警告日志，用于潜在问题或异常情况
 * 3. error级别：记录错误日志，用于错误和故障情况
 * 4. 有上下文：在日志消息后附加序列化的上下文JSON
 * 5. 无上下文：仅输出基本的日志消息
 * 6. 无效级别：TypeScript类型系统确保只接受有效级别，运行时不会出现无效级别
 * 
 * @param level - 日志级别，必须是'info'、'warn'或'error'之一
 * @param message - 日志消息字符串，描述要记录的事件或信息
 * @param context - 可选的上下文对象，包含额外的调试信息，如组件名称、错误堆栈、相关数据等
 * @returns void - 无返回值，直接输出到控制台
 * 
 * @example
 * ```typescript
 * // 记录信息日志
 * structuredLog('info', 'AI Agent initialized successfully', { component: 'main' });
 * 
 * // 记录警告日志
 * structuredLog('warn', 'Low memory warning', { availableMemory: '100MB' });
 * 
 * // 记录错误日志
 * structuredLog('error', 'Failed to initialize AI Agent', { 
 *   component: 'main', 
 *   error: 'API key missing',
 *   stack: error.stack 
 * });
 * ```
 * 
 * @format
 * 日志格式：[YYYY-MM-DDTHH:MM:SS.sssZ] [LEVEL] message {context}
 * 例如：[2023-12-21T10:30:45.123Z] [INFO] AI Agent initialized successfully {"component":"main"}
 */
export function structuredLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, any>
): void {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  console.log(`[${timestamp}] [${levelUpper}] ${message}${contextStr}`);
}