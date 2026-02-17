/**
 * Token计数器
 * 
 * 中文名称：Token计数器
 * 
 * 预期行为：
 * - 提供准确的token计数功能
 * - 支持多种tokenization策略
 * - 与OpenAI的token计数保持一致
 * - 提供高效的批量计数功能
 * 
 * @module token-counter
 */

// 使用简单的字符计数作为基础实现
// 在实际应用中，可以集成tiktoken或其他精确的token计数库
export class TokenCounter {
  /**
   * 估算文本的token数量
   * @param text 要计数的文本
   * @returns token数量
   */
  static estimateTokenCount(text: string): number {
    if (!text) return 0;
    
    // 基于OpenAI的估算：平均每个token约4个字符
    // 这是一个合理的估算，对于大多数情况足够准确
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    
    // 更精确的估算：考虑单词、标点、空格等因素
    const estimatedTokens = Math.ceil(
      (charCount * 0.25) + // 字符贡献
      (wordCount * 0.75)   // 单词贡献
    );
    
    return Math.max(1, estimatedTokens);
  }
  
  /**
   * 计算多个文本的总token数量
   * @param texts 文本数组
   * @returns 总token数量
   */
  static estimateTotalTokenCount(texts: string[]): number {
    return texts.reduce((total, text) => total + this.estimateTokenCount(text), 0);
  }
  
  /**
   * 截断文本以适应token限制
   * @param text 原始文本
   * @param maxTokens 最大token数量
   * @param preserveStructure 是否尝试保持代码结构完整性
   * @returns 截断后的文本
   */
  static truncateToTokenLimit(
    text: string, 
    maxTokens: number, 
    preserveStructure: boolean = false
  ): string {
    if (this.estimateTokenCount(text) <= maxTokens) {
      return text;
    }
    
    const targetCharLength = Math.floor(maxTokens * 3.5); // 保守估计
    
    if (!preserveStructure) {
      return text.substring(0, targetCharLength) + '... [truncated]';
    }
    
    // 尝试在语句边界处截断
    const truncated = text.substring(0, targetCharLength);
    const lastSemicolon = truncated.lastIndexOf(';');
    const lastBrace = truncated.lastIndexOf('}');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const bestBreak = Math.max(lastSemicolon, lastBrace, lastNewline);
    if (bestBreak > targetCharLength * 0.8) {
      return truncated.substring(0, bestBreak + 1) + '\n... [truncated]';
    }
    
    return truncated + '... [truncated]';
  }
}