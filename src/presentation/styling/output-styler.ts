/**
 * 样式化输出函数集合
 * 
 * 中文名称：样式化输出函数集合
 * 
 * 提供各种类型的控制台输出格式化函数，用于不同场景的用户界面显示。
 * 
 * @module output-styler
 */

import { config } from '../../core/config/config';

/**
 * 样式化输出函数接口
 * @interface OutputStyler
 */
export interface OutputStyler {
  /**
   * AI助手消息样式
   * @param text - 要显示的文本
   * @returns 格式化的助手消息字符串
   */
  assistant: (text: string) => string;
  
  /**
   * 工具调用样式
   * @param name - 工具名称
   * @param args - 工具参数对象
   * @returns 格式化的工具调用消息字符串
   */
  toolCall: (name: string, args: any) => string;
  
  /**
   * 工具结果样式
   * @param name - 工具名称
   * @param success - 执行是否成功
   * @param preview - 结果预览文本
   * @returns 格式化的工具结果消息字符串
   */
  toolResult: (name: string, success: boolean, preview: string) => string;
  
  /**
   * 系统消息样式
   * @param text - 要显示的系统文本
   * @returns 格式化的系统消息字符串
   */
  system: (text: string) => string;
  
  /**
   * 错误消息样式
   * @param text - 要显示的错误文本
   * @returns 格式化的错误消息字符串
   */
  error: (text: string) => string;
  
  /**
   * 提示消息样式
   * @param text - 要显示的提示文本
   * @returns 格式化的提示消息字符串
   */
  hint: (text: string) => string;
  
  /**
   * 截断文本样式
   * @param original - 原始文本
   * @param limit - 截断限制长度
   * @returns 如果原文本超过限制则返回截断后的文本，否则返回原文本
   */
  truncated: (original: string, limit: number) => string;
  
  /**
   * 深度思考过程样式
   * 
   * 中文名称：深度思考过程样式
   * 
   * 预期行为：
   * - 接收思考步骤数组作为输入
   * - 为每个思考步骤添加适当的前缀和格式
   * - 返回格式化的深度思考过程字符串
   * 
   * 行为分支：
   * 1. 空数组：返回空字符串
   * 2. 单个步骤：显示单个思考步骤
   * 3. 多个步骤：显示编号的思考步骤列表
   * 
   * @param steps - 思考步骤数组，每个步骤包含内容和可选的状态
   * @returns 格式化的深度思考过程字符串
   */
  thinkingProcess: (steps: Array<{ content: string; status?: string }>) => string;
  
  /**
   * 详细思考模式提示
   * 
   * 中文名称：详细思考模式提示
   * 
   * 预期行为：
   * - 显示进入详细思考模式的提示信息
   * - 返回格式化的提示字符串
   * 
   * @param mode - 思考模式类型（如"干活模式"）
   * @returns 格式化的详细思考模式提示字符串
   */
  detailedThinkingMode: (mode: string) => string;
}

/**
 * 样式化输出函数实现
 * @constant styled
 * @type {OutputStyler}
 */
export const styled: OutputStyler = {
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
  toolCall: (name: string, args: any) => {
    if (name === 'task' && args?.subagent_type) {
      // 优化 task 工具的展示形式
      const subagentType = args.subagent_type;
      const description = args.description || '执行复杂任务';
      return `\n🧠 正在委派任务给 ${subagentType} 代理\n   任务描述: ${description}`;
    }
    return `\n🔧 正在调用工具: ${name}\n   参数: ${JSON.stringify(args, null, 2).split('\n').map(l => '   ' + l).join('\n').trim()}`;
  },
  
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
  
  /**
   * 深度思考过程样式
   * 
   * 中文名称：深度思考过程样式
   * 
   * 预期行为：
   * - 接收思考步骤数组作为输入
   * - 为每个思考步骤添加适当的前缀和格式
   * - 返回格式化的深度思考过程字符串
   * 
   * 行为分支：
   * 1. 空数组：返回空字符串
   * 2. 单个步骤：显示单个思考步骤
   * 3. 多个步骤：显示编号的思考步骤列表
   * 
   * @param steps - 思考步骤数组，每个步骤包含内容和可选的状态
   * @returns 格式化的深度思考过程字符串
   */
  thinkingProcess: (steps: Array<{ content: string; status?: string }>) => {
    if (!steps || steps.length === 0) return '';
    
    const formattedSteps = steps.map((step, index) => {
      const emoji = step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '🔄' : '💭';
      return `\n${emoji} 步骤 ${index + 1}: ${step.content}`;
    });
    
    return `\n🧠 深度思考过程:${formattedSteps.join('')}`;
  },
  
  /**
   * 详细思考模式提示
   * 
   * 中文名称：详细思考模式提示
   * 
   * 预期行为：
   * - 显示进入详细思考模式的提示信息
   * - 返回格式化的提示字符串
   * 
   * @param mode - 思考模式类型（如"干活模式"）
   * @returns 格式化的详细思考模式提示字符串
   */
  detailedThinkingMode: (mode: string = "干活模式") => 
    `\n🔍 进入${mode} - 展示完整思考过程...`,
};