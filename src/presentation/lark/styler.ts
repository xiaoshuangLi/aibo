/**
 * LARK 飞书消息模板格式化器（优化版）
 * 
 * 中文名称：LARK 飞书消息模板格式化器（优化版）
 * 
 * 为 LARK 飞书适配器提供消息模板格式化功能，使用飞书模板消息格式：
 * {"type":"template","data":{"template_id":"<TEMPLATE_ID>","template_variable":{"title":"标题","content":"Markdown内容"}}}
 * 
 * 模板ID通过环境变量 AIBO_LARK_INTERACTIVE_TEMPLATE_ID 配置
 * 
 * 所有方法返回飞书模板消息 JSON 字符串，可直接用于飞书模板消息发送。
 * 充分利用Lark支持的完整Markdown语法进行优化。
 * 
 * @module lark-template-formatter
 */

import { config } from '@/core/config';
import { OutputStyler } from '@/presentation/styling';
import { 
  processLarkText,
  isJsonContent,
  isErrorContent,
  getToolType,
  getToolTypeEmoji,
  formatErrorText
} from './shared';
import { 
  formatToolResultByType,
  formatStructuredResult
} from './result-formatter';
import { 
  getToolCallTitle,
  formatToolCallArgs
} from './call-formatter';

/**
 * 创建飞书模板消息
 * @param title - 消息标题
 * @param content - Markdown 格式的内容
 * @returns 飞书模板消息 JSON 字符串
 */
export const createTemplateMessage = (title: string, content: string): string => {
  // 对内容应用 Lark 文本处理，特别保留代码块格式
  const processedContent = processLarkText(content, { 
    escapeIndentation: true, 
    escapeSpecialChars: true,
    preserveCodeBlocks: true 
  });
  
  const templateId = config.lark.interactiveTemplateId;

  if (!templateId) {
    return [title, content].filter(Boolean).join('\n');
  }
  
  return JSON.stringify({
    msg_type: 'interactive',
    content: JSON.stringify({
      type: "template",
      data: {
        template_id: templateId,
        template_variable: {
          title: title,
          content: processedContent,
        },
      },
    }),
  });
};

/**
 * LARK 飞书模板格式化函数实现
 * 保持与 styled 对象相同的接口和行为，但输出飞书模板消息格式
 */
export const styled: OutputStyler = {
  /**
   * AI助手消息样式 - 使用模板格式
   * @param text - 要显示的文本
   * @returns 飞书模板消息 JSON 字符串
   */
  assistant: (text: string) => {
    const title = "🤖 AI 助手消息";
    const content = text || "无内容";
    return createTemplateMessage(title, content);
  },
  
  /**
   * 工具调用样式 - 使用模板格式展示
   * @param name - 工具名称
   * @param args - 工具参数对象
   * @returns 飞书模板消息 JSON 字符串
   */
  toolCall: (name: string, args: any) => {
    const title = getToolCallTitle(name, args);
    const content = formatToolCallArgs(name, args);
    return createTemplateMessage(title, content);
  },
  
  /**
   * 工具结果样式 - 智能识别结果类型并使用模板格式
   * @param name - 工具名称
   * @param success - 执行是否成功
   * @param preview - 结果预览文本
   * @returns 飞书模板消息 JSON 字符串
   */
  toolResult: (name: string, success: boolean, preview: string) => {
    // 智能检测 task 工具的结果（使用正则表达式而不是硬编码）
    const isTaskResult = /^子代理任务$|^🧠\s+\w+\s+结果$/.test(name);
    const toolType = getToolType(name);
    
    let title = '';
    if (isTaskResult) {
      title = `${success ? '✅' : '❌'} ${name}: ${success ? '完成' : '失败'}`;
    } else {
      // 根据工具类型设置不同的标题前缀
      const typeEmoji = getToolTypeEmoji(toolType);
      title = `${success ? '✅' : '❌'} ${typeEmoji} ${name}: ${success ? '成功' : '失败'}`;
    }
    
    // 优化preview内容的格式化
    let content = preview;
    if (preview && preview.trim()) {
      content = formatToolResultByType(name, toolType, success, preview);
    }
    
    return createTemplateMessage(title, content);
  },
  
  /**
   * 系统消息样式 - 使用模板格式
   * @param title - 要显示的系统标题
   * @param text - 要显示的系统文本（可选）
   * @returns 飞书模板消息 JSON 字符串
   */
  system: (title: string, text?: string) => {
    if (!text) {
      text = title;
      title = '⚙️ 系统消息';
    }

    return createTemplateMessage(title, text);
  },
  
  /**
   * 错误消息样式 - 使用模板格式
   * @param text - 要显示的错误文本
   * @returns 飞书模板消息 JSON 字符串
   */
  error: (text: string) => {
    const title = "❌ 错误消息";
    let content = text;
    
    // 错误消息使用代码块格式化（多行）或粗体（单行）
    if (text && text.includes('\n')) {
      content = `\`\`\`\n${text}\n\`\`\``;
    } else {
      content = `**${text}**`;
    }
    
    return createTemplateMessage(title, content);
  },
  
  /**
   * 提示消息样式 - 使用模板格式
   * @param text - 要显示的提示文本
   * @returns 飞书模板消息 JSON 字符串
   */
  hint: (text: string) => {
    const title = "💡 提示消息";
    const content = text;
    return createTemplateMessage(title, content);
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
   * 深度思考过程样式 - 使用模板格式（优化版）
   * 
   * 中文名称：深度思考过程样式（优化版）
   * 
   * @param steps - 思考步骤数组，每个步骤包含内容和可选的状态
   * @returns 飞书模板消息 JSON 字符串
   */
  thinkingProcess: (steps: Array<{ content: string; status?: string }>) => {
    if (!steps || steps.length === 0) {
      return createTemplateMessage("🧠 深度思考过程", "无思考步骤");
    }
    
    let content = '## 🧠 深度思考过程\n\n';
    
    if (steps.length === 1) {
      const step = steps[0];
      let emoji = '💭';
      if (step.status === 'completed') {
        emoji = '✅';
      } else if (step.status === 'in_progress') {
        emoji = '🔄';
      }
      content += `${emoji} ${step.content}`;
    } else {
      // 使用有序列表展示多个步骤
      content += steps.map((step, index) => {
        let emoji = '💭';
        if (step.status === 'completed') {
          emoji = '✅';
        } else if (step.status === 'in_progress') {
          emoji = '🔄';
        }
        return `${index + 1}. ${emoji} ${step.content}`;
      }).join('\n');
    }
    
    const title = steps.length === 1 ? "🧠 深度思考过程" : `🧠 深度思考过程 (${steps.length} 步骤)`;
    return createTemplateMessage(title, content.trim());
  },
  
  /**
   * 详细思考模式提示 - 使用模板格式
   * 
   * 中文名称：详细思考模式提示
   * 
   * @param mode - 思考模式类型（如"干活模式"）
   * @returns 飞书模板消息 JSON 字符串
   */
  detailedThinkingMode: (mode: string = "干活模式") => {
    const title = "🔍 详细思考模式";
    const content = `## 🔍 进入${mode}\n\n正在展示完整思考过程...`;
    return createTemplateMessage(title, content);
  },
  
  /**
   * 格式化 task 工具结果预览（改进版 - 充分利用Markdown语法）
   * @param result - 工具结果（可以是字符串、对象或null/undefined）
   * @param verbose - 是否详细模式
   * @returns 格式化的预览字符串（使用丰富的Markdown格式）
   */
  formatTaskResultPreview: (result: any, verbose: boolean) => {
    // 处理 null/undefined 情况
    if (result == null) {
      return "**任务已完成** ✅";
    }
    
    // 处理字符串结果
    if (typeof result === 'string') {
      const trimmed = result.trim();
      if (!trimmed) {
        return "**任务已完成** ✅";
      }
      
      // 检测是否为JSON字符串
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return formatStructuredResult(parsed, verbose);
        }
      } catch {
        // 不是JSON，继续处理为普通字符串
      }
      
      // 检测错误信息
      if (isErrorContent(trimmed)) {
        return formatErrorText(trimmed);
      }
      
      // 处理多行文本
      if (trimmed.includes('\n')) {
        const lines = trimmed.split('\n');
        if (lines.length > 1) {
          // 如果是代码或结构化数据，使用代码块
          if (verbose || lines.length <= 5) {
            return `\`\`\`\n${trimmed}\n\`\`\``;
          } else {
            // 简洁模式：只显示前几行
            const previewLines = lines.slice(0, 3);
            const remaining = lines.length - 3;
            return `\`\`\`\n${previewLines.join('\n')}${remaining > 0 ? `\n... (${remaining} more lines)` : ''}\n\`\`\``;
          }
        }
      }
      
      // 单行文本
      return `✅ **${trimmed}**`;
    }
    
    // 处理对象结果
    if (typeof result === 'object') {
      // 检查空输出
      if (result.stdout === "(empty)" && result.stderr === "(empty)") {
        return "**无输出** ⚪";
      }
      
      // 构建结构化结果
      let outputParts: string[] = [];
      
      // 处理消息字段
      if (result.message) {
        outputParts.push(`✅ **结果**: ${result.message}`);
      }
      
      // 处理标准输出
      if (result.stdout && result.stdout !== "(empty)") {
        const stdout = String(result.stdout).trim();
        if (stdout) {
          if (stdout.includes('\n') || stdout.length > 100) {
            outputParts.push(`📋 **标准输出**:\n\`\`\`\n${stdout}\n\`\`\``);
          } else {
            outputParts.push(`📋 **标准输出**: \`${stdout}\``);
          }
        }
      }
      
      // 处理标准错误
      if (result.stderr && result.stderr !== "(empty)") {
        const stderr = String(result.stderr).trim();
        if (stderr) {
          if (stderr.includes('\n') || stderr.length > 100) {
            outputParts.push(`❌ **标准错误**:\n\`\`\`\n${stderr}\n\`\`\``);
          } else {
            outputParts.push(`❌ **标准错误**: \`${stderr}\``);
          }
        }
      }
      
      // 处理其他字段（在详细模式下）
      if (verbose) {
        const otherFields: string[] = [];
        for (const key in result) {
          if (['message', 'stdout', 'stderr'].includes(key)) continue;
          if (result[key] != null) {
            otherFields.push(`- **${key}**: ${typeof result[key] === 'object' ? 
              `\`\`\`json\n${JSON.stringify(result[key], null, 2)}\n\`\`\`` : 
              `\`${String(result[key])}\``}`);
          }
        }
        if (otherFields.length > 0) {
          outputParts.push(`🔍 **其他信息**:\n${otherFields.join('\n')}`);
        }
      }
      
      // 如果没有有效内容，返回默认消息
      if (outputParts.length === 0) {
        return "**任务已完成** ✅";
      }
      
      return outputParts.join('\n\n');
    }
    
    // 其他类型（数字、布尔值等）
    return `✅ **结果**: \`${String(result)}\``;
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
   * 格式化通用工具结果预览（改进版 - 充分利用Markdown语法）
   * @param parsed - 解析后的工具结果对象
   * @param verbose - 是否详细模式
   * @returns 格式化的预览字符串（使用丰富的Markdown格式）
   */
  formatToolResultPreview: (parsed: any, verbose: boolean) => {
    // 处理 null/undefined 情况
    if (!parsed || typeof parsed !== 'object') {
      return "**无有效结果** ⚪";
    }
    
    let outputParts: string[] = [];
    
    // 处理命令信息
    if (parsed.command) {
      outputParts.push(`💻 **执行命令**: \`${parsed.command}\``);
    } else if (parsed.filepath || parsed.filePath) {
      const filePath = parsed.filepath || parsed.filePath;
      outputParts.push(`📁 **文件路径**: \`${filePath}\``);
    }
    
    // 处理标准输出
    if (parsed.stdout && parsed.stdout !== "(empty)") {
      const stdout = String(parsed.stdout).trim();
      if (stdout) {
        // 检测输出类型
        if (isJsonContent(stdout)) {
          // JSON 输出
          try {
            const jsonParsed = JSON.parse(stdout);
            if (verbose) {
              outputParts.push(`📋 **标准输出 (JSON)**:\n\`\`\`json\n${JSON.stringify(jsonParsed, null, 2)}\n\`\`\``);
            } else {
              // 简洁模式：只显示摘要
              if (Array.isArray(jsonParsed)) {
                outputParts.push(`📋 **标准输出**: JSON 数组 (${jsonParsed.length} 项)`);
              } else if (typeof jsonParsed === 'object') {
                const keys = Object.keys(jsonParsed);
                outputParts.push(`📋 **标准输出**: JSON 对象 (${keys.length} 个字段)`);
              } else {
                outputParts.push(`📋 **标准输出**: JSON 值`);
              }
            }
          } catch {
            // 如果解析失败，按普通文本处理
            if (stdout.includes('\n')) {
              outputParts.push(`📋 **标准输出**:\n\`\`\`\n${stdout}\n\`\`\``);
            } else {
              outputParts.push(`📋 **标准输出**: \`${stdout}\``);
            }
          }
        } else if (stdout.includes('\n') || stdout.length > 150) {
          // 多行或长文本输出
          if (verbose) {
            outputParts.push(`📋 **标准输出**:\n\`\`\`\n${stdout}\n\`\`\``);
          } else {
            // 简洁模式：截断并显示行数
            const lines = stdout.split('\n');
            const previewLines = lines.slice(0, 3);
            const remainingLines = lines.length - 3;
            let previewText = previewLines.join('\n');
            if (remainingLines > 0) {
              previewText += `\n... (${remainingLines} more lines)`;
            }
            outputParts.push(`📋 **标准输出 (${lines.length} 行)**:\n\`\`\`\n${previewText}\n\`\`\``);
          }
        } else {
          // 单行短文本
          outputParts.push(`📋 **标准输出**: \`${stdout}\``);
        }
      }
    }
    
    // 处理标准错误
    if (parsed.stderr && parsed.stderr !== "(empty)") {
      const stderr = String(parsed.stderr).trim();
      if (stderr) {
        if (stderr.includes('\n') || stderr.length > 100) {
          outputParts.push(`❌ **标准错误**:\n\`\`\`\n${stderr}\n\`\`\``);
        } else {
          outputParts.push(`❌ **标准错误**: \`${stderr}\``);
        }
      }
    }
    
    // 处理其他成功/错误状态
    if (parsed.success !== undefined) {
      if (!parsed.success) {
        if (!outputParts.some(part => part.includes('❌'))) {
          outputParts.unshift("❌ **操作失败**");
        }
      } else if (outputParts.length === 0) {
        outputParts.push("✅ **操作成功**");
      }
    }
    
    // 如果没有任何输出，检查是否有其他有用的信息
    if (outputParts.length === 0) {
      // 检查是否有 message 字段
      if (parsed.message) {
        outputParts.push(`✅ **${parsed.message}**`);
      } else {
        return "**无输出** ⚪";
      }
    }
    
    return outputParts.join('\n\n');
  }
};