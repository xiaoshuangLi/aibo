/**
 * 配置验证工具模块
 * 
 * 该模块提供配置值的验证和清理功能，确保应用程序安全正确地运行。
 */

/**
 * 验证API密钥格式
 * 
 * 中文名称：验证API密钥格式
 * 
 * 预期行为：
 * - 接收API密钥字符串作为参数
 * - 验证是否为非空字符串
 * - 检查是否以'sk-'开头（OpenAI API密钥格式）
 * - 验证后缀长度是否至少20个字符
 * - 确保后缀只包含字母数字字符
 * - 返回布尔值表示验证结果
 * 
 * 行为分支：
 * 1. 非字符串输入：返回false
 * 2. 空字符串或仅包含空格：返回false
 * 3. 不以'sk-'开头：返回false
 * 4. 后缀长度小于20：返回false
 * 5. 后缀包含非字母数字字符：返回false
 * 6. 符合所有条件：返回true
 * 
 * @param apiKey - 要验证的API密钥字符串
 * @returns boolean - 如果API密钥格式有效则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * isValidApiKey("sk-abcdefghijklmnopqrstuvwxyz123456789"); // true
 * isValidApiKey("invalid-key"); // false
 * isValidApiKey(""); // false
 * isValidApiKey("sk-short"); // false (后缀太短)
 * ```
 * 
 * @note
 * - 该函数专门针对OpenAI API密钥格式进行验证
 * - 实际的API密钥验证应通过API调用进行，此函数仅验证格式
 */
export function isValidApiKey(apiKey: string): boolean {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return false;
  }
  
  // OpenAI API keys typically start with 'sk-' followed by alphanumeric characters
  // Minimum length should be reasonable (e.g., at least 20 characters after 'sk-')
  const trimmedKey = apiKey.trim();
  if (!trimmedKey.startsWith('sk-')) {
    return false;
  }
  
  const suffix = trimmedKey.substring(3);
  if (suffix.length < 20) {
    return false;
  }
  
  // Check if suffix contains only alphanumeric characters
  return /^[a-zA-Z0-9]+$/.test(suffix);
}

/**
 * 验证URL格式
 * 
 * 中文名称：验证URL格式
 * 
 * 预期行为：
 * - 接收URL字符串作为参数
 * - 验证是否为非空字符串
 * - 使用浏览器内置URL构造函数验证URL格式
 * - 返回布尔值表示验证结果
 * 
 * 行为分支：
 * 1. 非字符串输入：返回false
 * 2. 空字符串或仅包含空格：返回false
 * 3. 无效URL格式：URL构造函数抛出异常，返回false
 * 4. 有效URL格式：URL构造函数成功，返回true
 * 
 * @param url - 要验证的URL字符串
 * @returns boolean - 如果URL格式有效则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * isValidUrl("https://example.com"); // true
 * isValidUrl("http://localhost:3000"); // true
 * isValidUrl("invalid-url"); // false
 * isValidUrl(""); // false
 * ```
 * 
 * @note
 * - 该函数使用浏览器标准URL API进行验证
 * - 支持所有标准URL协议（http, https, ftp, file等）
 * - 需要完整的URL（包括协议），相对路径会被视为无效
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  
  try {
    new URL(url.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证模型名称格式
 * 
 * 中文名称：验证模型名称格式
 * 
 * 预期行为：
 * - 接收模型名称字符串作为参数
 * - 验证是否为非空字符串
 * - 使用正则表达式验证字符集
 * - 返回布尔值表示验证结果
 * 
 * 行为分支：
 * 1. 非字符串输入：返回false
 * 2. 空字符串或仅包含空格：返回false
 * 3. 包含不允许的字符（除字母、数字、点、下划线、连字符外）：返回false
 * 4. 只包含允许的字符：返回true
 * 
 * @param modelName - 要验证的模型名称字符串
 * @returns boolean - 如果模型名称格式有效则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * isValidModelName("gpt-4o"); // true
 * isValidModelName("text-davinci-003"); // true
 * isValidModelName("my_model.v1"); // true
 * isValidModelName("invalid model"); // false (包含空格)
 * isValidModelName(""); // false
 * ```
 * 
 * @note
 * - 允许的字符：字母(a-z, A-Z)、数字(0-9)、点(.)、下划线(_)、连字符(-)
 * - 该格式适用于大多数AI模型命名约定
 */
export function isValidModelName(modelName: string): boolean {
  if (typeof modelName !== 'string' || modelName.trim() === '') {
    return false;
  }
  
  const pattern = /^[a-zA-Z0-9._-]+$/;
  return pattern.test(modelName.trim());
}

/**
 * 验证正整数值
 * 
 * 中文名称：验证正整数值
 * 
 * 预期行为：
 * - 接收数值作为参数
 * - 使用Number.isInteger()验证是否为整数
 * - 检查是否大于0
 * - 返回布尔值表示验证结果
 * 
 * 行为分支：
 * 1. 非数值输入：返回false
 * 2. 浮点数：返回false
 * 3. 零或负数：返回false
 * 4. 正整数：返回true
 * 
 * @param value - 要验证的数值
 * @returns boolean - 如果是有效的正整数则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * isValidPositiveInteger(42); // true
 * isValidPositiveInteger(1); // true
 * isValidPositiveInteger(0); // false
 * isValidPositiveInteger(-5); // false
 * isValidPositiveInteger(3.14); // false
 * ```
 * 
 * @note
 * - 该函数严格验证正整数，不接受字符串形式的数字
 * - 适用于需要正整数配置的场景（如超时时间、重试次数等）
 */
export function isValidPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}