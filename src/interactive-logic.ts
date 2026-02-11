/**
 * 交互模式逻辑工具模块
 * 
 * 该模块提供可轻松测试的交互模式逻辑工具函数，用于处理用户输入、响应格式化和会话管理。
 */

/**
 * 判断是否应退出交互模式
 * 
 * 中文名称：判断是否应退出交互模式
 * 
 * 预期行为：
 * - 接收用户输入字符串
 * - 去除首尾空格并转换为小写
 * - 检查是否等于"exit"或"quit"
 * - 返回布尔值表示是否应退出
 * 
 * 行为分支：
 * 1. 输入为"exit"（不区分大小写）：返回true
 * 2. 输入为"quit"（不区分大小写）：返回true
 * 3. 其他任何输入：返回false
 * 4. 空输入或仅包含空格：返回false
 * 
 * @param input - 用户输入字符串
 * @returns boolean - 如果输入是'exit'或'quit'（不区分大小写）则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * shouldExitInteractiveMode("EXIT"); // true
 * shouldExitInteractiveMode("quit"); // true
 * shouldExitInteractiveMode("help"); // false
 * ```
 */
export function shouldExitInteractiveMode(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  return trimmed === 'exit' || trimmed === 'quit';
}

/**
 * 判断用户输入是否为空
 * 
 * 中文名称：判断用户输入是否为空
 * 
 * 预期行为：
 * - 接收用户输入字符串
 * - 去除首尾空格
 * - 检查结果是否为空字符串
 * - 返回布尔值表示输入是否为空
 * 
 * 行为分支：
 * 1. 输入为null/undefined：会抛出TypeError（因为调用trim()方法）
 * 2. 输入为非字符串类型：会抛出TypeError（因为调用trim()方法）
 * 3. 输入为仅包含空格的字符串：返回true
 * 4. 输入为空字符串：返回true
 * 5. 输入包含非空格字符：返回false
 * 
 * @param input - 用户输入字符串
 * @returns boolean - 如果输入为空或仅包含空格则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * isEmptyInput(""); // true
 * isEmptyInput("   "); // true
 * isEmptyInput("hello"); // false
 * ```
 */
export function isEmptyInput(input: string): boolean {
  return input.trim() === '';
}

/**
 * 处理代理响应并返回格式化输出
 * 
 * 中文名称：处理代理响应并返回格式化输出
 * 
 * 预期行为：
 * - 接收原始的代理响应数据
 * - 根据响应数据的类型进行格式化处理
 * - 返回适合显示的字符串格式
 * 
 * 行为分支：
 * 1. 字符串响应：直接返回原始字符串
 * 2. 非空对象响应：将对象转换为格式化的JSON字符串（带缩进）
 * 3. null/undefined响应：转换为"null"/"undefined"字符串
 * 4. 其他原始类型响应（数字、布尔值等）：转换为字符串表示形式
 * 
 * @param response - 原始的代理响应数据，可以是任意类型
 * @returns string - 格式化后的响应字符串，适合在控制台或UI中显示
 * 
 * @example
 * ```typescript
 * formatAgentResponse("Hello"); // "Hello"
 * formatAgentResponse({ result: "success" }); // "{\n  \"result\": \"success\"\n}"
 * formatAgentResponse(null); // "null"
 * ```
 */
export function formatAgentResponse(response: any): string {
  if (typeof response === 'string') {
    return response;
  } else if (response && typeof response === 'object') {
    return JSON.stringify(response, null, 2);
  } else {
    return String(response);
  }
}

/**
 * 验证线程ID是否有效
 * 
 * 中文名称：验证线程ID是否有效
 * 
 * 预期行为：
 * - 接收线程ID参数
 * - 检查参数是否为字符串类型
 * - 检查去除首尾空格后是否长度大于0
 * - 返回布尔值表示ID是否有效
 * 
 * 行为分支：
 * 1. 参数为非字符串类型：返回false
 * 2. 参数为null/undefined：返回false
 * 3. 参数为仅包含空格的字符串：返回false
 * 4. 参数为空字符串：返回false
 * 5. 参数为包含非空格字符的字符串：返回true
 * 
 * @param threadId - 要验证的线程ID
 * @returns boolean - 如果线程ID有效（非空字符串）则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * isValidThreadId("session-123"); // true
 * isValidThreadId(""); // false
 * isValidThreadId("   "); // false
 * isValidThreadId(null); // false (编译时可能报错)
 * ```
 */
export function isValidThreadId(threadId: string): boolean {
  return typeof threadId === 'string' && threadId.trim().length > 0;
}

/**
 * 创建控制台会话的默认线程ID
 * 
 * 中文名称：创建控制台会话的默认线程ID
 * 
 * 预期行为：
 * - 生成基于当前时间戳的唯一线程ID
 * - 返回格式为"console-session-{timestamp}"的字符串
 * 
 * 行为分支：
 * 1. 正常情况：返回格式正确的唯一线程ID字符串
 * 2. 无异常情况：该函数不抛出异常，始终返回有效字符串
 * 
 * @returns string - 生成的线程ID字符串，格式为"console-session-{时间戳}"
 * 
 * @example
 * ```typescript
 * const threadId = createConsoleThreadId();
 * // 例如: "console-session-1703123456789"
 * ```
 */
export function createConsoleThreadId(): string {
  return "console-session-" + Date.now();
}