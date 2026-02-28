/**
 * 样式化输出函数集合
 * 
 * 中文名称：样式化输出函数集合
 * 
 * 提供各种类型的控制台输出格式化函数，用于不同场景的用户界面显示。
 * 
 * @module output-styler
 */

import { config } from '@/core/config';

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
   * @param title - 要显示的系统标题
   * @param text - 要显示的系统文本（可选）
   * @returns 格式化的系统消息字符串
   */
  system: (title: string, text?: string) => string;
  
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
  
  /**
   * 格式化 task 工具结果预览
   * @param result - 工具结果（可以是字符串或对象）
   * @param verbose - 是否详细模式
   * @returns 格式化的预览字符串
   */
  formatTaskResultPreview: (result: any, verbose: boolean) => string;
  
  /**
   * 获取 task 工具显示名称
   * @param subagentType - 子代理类型
   * @returns 显示名称
   */
  getTaskDisplayName: (subagentType?: string) => string;
  
  /**
   * 格式化通用工具结果预览
   * @param parsed - 解析后的工具结果对象
   * @param verbose - 是否详细模式
   * @returns 格式化的预览字符串
   */
  formatToolResultPreview: (parsed: any, verbose: boolean) => string;
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
  toolResult: (name: string, success: boolean, preview: string) => {
    // 智能检测 task 工具的结果（使用正则表达式而不是硬编码）
    const isTaskResult = /^子代理任务$|^🧠\s+\w+\s+结果$/.test(name);
    
    if (isTaskResult) {
      return `\n${success ? '✅' : '❌'} ${name}: ${success ? '完成' : '失败'}\n${preview}`;
    }
    
    return `\n${success ? '✅' : '❌'} 工具执行 ${name}: ${success ? '成功' : '失败'}\n${preview}`;
  },
  
  /**
   * 系统消息样式
   * @param title - 要显示的系统标题
   * @param text - 要显示的系统文本（可选）
   * @returns 格式化的系统消息字符串
   */
  system: (title: string, text?: string) => `\n⚙️  ${[title, text].filter(Boolean).join('\n')}`,
  
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
   * 格式化 task 工具结果预览
   * @param result - 工具结果（可以是字符串或对象）
   * @param verbose - 是否详细模式
   * @returns 格式化的预览字符串
   */
  formatTaskResultPreview: (result: any, verbose: boolean) => {
    const limit = verbose ? 300 : 150;
    
    if (typeof result === 'object' && result !== null) {
      // Check if stdout and stderr are both "(empty)"
      if (result.stdout === "(empty)" && result.stderr === "(empty)") {
        return "无输出";
      }
      
      if (result.message) {
        return `▸ 结果: ${styled.truncated(result.message, limit)}`;
      } else {
        return `▸ 任务已完成`;
      }
    } else if (typeof result === 'string') {
      return `▸ 结果: ${styled.truncated(result, limit)}`;
    } else {
      return `▸ 任务已完成`;
    }
  },
  
  /**
   * 获取 task 工具显示名称
   * @param subagentType - 子代理类型
   * @returns 显示名称
   */
  getTaskDisplayName: (subagentType?: string) => {
    if (subagentType) {
      return `🧠 ${subagentType} 结果`;
    }
    return '子代理任务';
  },
  
  /**
   * 格式化通用工具结果预览
   * @param parsed - 解析后的工具结果对象
   * @param verbose - 是否详细模式
   * @returns 格式化的预览字符串
   */
  formatToolResultPreview: (parsed: any, verbose: boolean) => {
    let preview = "";
    
    if (parsed.command) {
      preview = `▸ 命令: ${styled.truncated(parsed.command, 80)}`;
    } else if (parsed.filepath) {
      preview = `▸ 文件: ${parsed.filepath}`;
    }

    if (parsed.stdout) {
      const out = String(parsed.stdout).trim();
      if (out && out !== "(empty)") {
        const limit = verbose ? 200 : 80;
        preview += `\n▸ 输出: ${styled.truncated(out.split('\n')[0] || out, limit)}`;
      }
    }

    if (parsed.stderr && parsed.stderr.trim() !== "(empty)") {
      const limit = verbose ? 100 : 60;
      preview += `\n▸ 错误: ${styled.truncated(parsed.stderr.split('\n')[0], limit)}`;
    }
    
    return preview || "无输出";
  },
  
  /**
   * 截断文本样式
   * @param original - 原始文本
   * @param limit - 截断限制长度
   * @returns 如果原文本超过限制则返回截断后的文本，否则返回原文本
   */
  truncated: (original: string, limit: number) => {
    if (original.length <= limit) {
      return original;
    }
    
    const truncatedText = original.substring(0, limit);
    const truncatedChars = original.length - limit;
    const originalLines = original.split('\n').length;
    const truncatedLines = truncatedText.split('\n').length;
    const truncatedLineCount = originalLines - truncatedLines;
    
    let truncationInfo = `[已截断 ${truncatedChars} 字符`;
    if (truncatedLineCount > 0) {
      truncationInfo += `, ${truncatedLineCount} 行`;
    }
    truncationInfo += ']';
    
    return truncatedText + `... ${truncationInfo}`;
  },
  
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