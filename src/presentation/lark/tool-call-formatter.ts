/**
 * 工具调用格式化器 - 专门处理工具调用参数的格式化
 * 
 * 中文名称：工具调用格式化器
 * 
 * 为 LARK 飞书适配器提供工具调用参数的智能格式化功能，
 * 根据不同的工具类型和参数结构提供针对性的展示格式。
 * 
 * @module tool-call-formatter
 */

/**
 * 零宽空格字符 - 用于避免 Lark 将缩进行识别为代码块
 */
const ZERO_WIDTH_SPACE = '\u200B';

/**
 * 在文本行首添加零宽空格以避免 Lark 代码块识别
 * @param text - 要处理的文本
 * @returns 处理后的文本
 */
export const escapeLarkIndentation = (text: string): string => {
  if (!text) return text;
  
  // 按行分割文本
  const lines = text.split('\n');
  
  // 为每一行添加零宽空格（如果该行以空白字符开头）
  const processedLines = lines.map(line => {
    // 如果行以空白字符（空格、制表符等）开头，则在开头添加零宽空格
    if (line.length > 0 && /^\s/.test(line)) {
      return ZERO_WIDTH_SPACE + line;
    }
    return line;
  });
  
  return processedLines.join('\n');
};

/**
 * 转义 Lark 特殊字符
 * @param text - 要转义的文本
 * @returns 转义后的文本
 */
export const escapeLarkSpecialChars = (text: string): string => {
  if (!text) return text;
  
  // Lark 支持完整的 Markdown，但某些特殊字符可能需要处理
  // 目前主要处理可能导致解析问题的字符
  let escapedText = text;
  
  // 转义反斜杠（如果后面跟着特殊字符）
  escapedText = escapedText.replace(/\\/g, '\\\\');
  
  // 转义可能导致问题的其他字符（根据实际需要添加）
  // 这里保持相对保守，因为 Lark 的 Markdown 解析相对宽松
  
  return escapedText;
};

/**
 * 完整的 Lark 文本处理函数
 * @param text - 要处理的原始文本
 * @param options - 处理选项
 * @returns 处理后的文本
 */
export const processLarkText = (
  text: string, 
  options: { 
    escapeIndentation?: boolean; 
    escapeSpecialChars?: boolean;
    preserveCodeBlocks?: boolean;
  } = {}
): string => {
  if (!text) return text;
  
  const { 
    escapeIndentation = true, 
    escapeSpecialChars = true,
    preserveCodeBlocks = false 
  } = options;
  
  let processedText = text;
  
  // 如果需要保留代码块，则先提取代码块内容
  if (preserveCodeBlocks) {
    // 提取并临时替换代码块
    const codeBlockRegex = /(```[\s\S]*?```)/g;
    const tempCodeBlocks: string[] = [];
    processedText = processedText.replace(codeBlockRegex, (match) => {
      tempCodeBlocks.push(match);
      return `__CODE_BLOCK_${tempCodeBlocks.length - 1}__`;
    });
    
    // 应用零宽空格转义（避免缩进被识别为代码块）
    if (escapeIndentation) {
      processedText = escapeLarkIndentation(processedText);
    }
    
    // 应用特殊字符转义
    if (escapeSpecialChars) {
      processedText = escapeLarkSpecialChars(processedText);
    }
    
    // 恢复代码块
    processedText = processedText.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
      return tempCodeBlocks[parseInt(index)] || '';
    });
  } else {
    // 不保留代码块的情况
    if (escapeIndentation) {
      processedText = escapeLarkIndentation(processedText);
    }
    
    if (escapeSpecialChars) {
      processedText = escapeLarkSpecialChars(processedText);
    }
  }
  
  return processedText;
};

/**
 * 截断文本辅助函数（内部使用）
 */
const truncateText = (text: string, limit: number): string => {
  if (text.length <= limit) {
    return text;
  }
  return text.substring(0, limit) + '...';
};

/**
 * 检测内容是否包含错误信息
 * @param content - 要检测的内容
 * @returns 是否包含错误信息
 */
export const isErrorContent = (content: string): boolean => {
  return content.toLowerCase().includes('error') || 
         content.toLowerCase().includes('exception') ||
         content.includes('stderr') ||
         content.startsWith('Error:') ||
         content.startsWith('Exception:');
};

/**
 * 格式化 task 工具调用参数
 * @param args - task 工具的参数对象
 * @returns 格式化后的内容字符串
 */
const formatTaskToolCall = (args: any): string => {
  if (!args || typeof args !== 'object') {
    return '无效的 task 参数';
  }
  
  const subagentType = args.subagent_type || '未知代理';
  const description = args.description || '执行复杂任务';
  
  let content = `**委派给 ${subagentType} 代理**\n\n`;
  content += `${description}\n\n`;
  
  // 添加其他参数信息（如果有）
  const otherKeys = Object.keys(args).filter(key => key !== 'subagent_type' && key !== 'description');
  if (otherKeys.length > 0) {
    content += '**其他参数:**\n';
    otherKeys.forEach(key => {
      const value = args[key];
      if (value != null) {
        if (typeof value === 'object') {
          content += `- **${key}**: \`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
        } else {
          content += `- **${key}**: \`${String(value)}\`\n`;
        }
      }
    });
  }
  
  return content.trim();
};

/**
 * 格式化文件系统工具调用参数
 * @param name - 工具名称
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
const formatFilesystemToolCall = (name: string, args: any): string => {
  if (args == null) {
    return '无参数';
  }
  
  switch (name) {
    case 'ls':
      if (typeof args === 'string') {
        return `**路径**: \`${args}\``;
      } else if (typeof args === 'object') {
        const path = args.path || '/';
        return `**路径**: \`${path}\``;
      }
      break;
    
    case 'read_file':
    case 'write_file':
    case 'edit_file':
      if (typeof args === 'string') {
        return `**文件路径**: \`${args}\``;
      } else if (typeof args === 'object') {
        const filePath = args.file_path || args.filePath || '未知路径';
        let content = `**文件路径**: \`${filePath}\``;
        
        if (name === 'write_file' || name === 'edit_file') {
          if (args.content != null) {
            content += `\n\n**内容预览**: \n\`\`\` \n${args.content}\n\`\`\` `;
          }
        }
        
        if (args.old_string != null) {
          content += `\n\n**原内容** \n\`\`\` \n${args.old_string}\n\`\`\` `;
        }
        
        if (args.new_string != null) {
          content += `\n\n**新内容**: \n\`\`\` \n${args.new_string}\n\`\`\` `;
        }

        return content;
      }
      break;
    
    case 'glob':
      if (typeof args === 'string') {
        return `**模式**: \`${args}\``;
      } else if (typeof args === 'object') {
        const pattern = args.pattern || '未知模式';
        const path = args.path || '/';
        return `**模式**: \`${pattern}\`\n**路径**: \`${path}\``;
      }
      break;
    
    case 'grep':
      if (typeof args === 'object') {
        const pattern = args.pattern || '未知模式';
        const path = args.path || '/';
        const glob = args.glob || '所有文件';
        return `**搜索模式**: \`${pattern}\`\n**路径**: \`${path}\`\n**文件过滤**: \`${glob}\``;
      }
      break;
  }
  
  // 默认处理
  if (typeof args === 'string') {
    const trimmedArgs = args.trim();
    if (!trimmedArgs) {
      return '空参数';
    }
    if (trimmedArgs.includes('\n')) {
      return `\`\`\`\n${trimmedArgs}\n\`\`\``;
    } else {
      return `\`${trimmedArgs}\``;
    }
  } else if (typeof args === 'object') {
    return `\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
  } else {
    return `\`${String(args)}\``;
  }
};

/**
 * 格式化系统/Bash工具调用参数
 * @param name - 工具名称
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
const formatSystemToolCall = (name: string, args: any): string => {
  if (args == null) {
    return '无参数';
  }
  
  switch (name) {
    case 'execute_bash':
      if (typeof args === 'string') {
        return `**命令**: \`${args}\``;
      } else if (typeof args === 'object') {
        const command = args.command || '未知命令';
        const timeout = args.timeout || 30000;
        const cwd = args.cwd || '当前目录';
        return `**命令**: \`${command}\`\n**超时**: ${timeout}ms\n**工作目录**: \`${cwd}\``;
      }
      break;
    
    case 'sleep':
      if (typeof args === 'number') {
        return `**时长**: ${args} 毫秒`;
      } else if (typeof args === 'object') {
        const duration = args.duration || 0;
        return `**时长**: ${duration} 毫秒`;
      }
      break;
    
    case 'echo':
      if (typeof args === 'string') {
        return `**消息**: \`${args}\``;
      } else if (typeof args === 'object') {
        const message = args.message || '无消息';
        return `**消息**: \`${message}\``;
      }
      break;
  }
  
  // 默认处理
  if (typeof args === 'string') {
    const trimmedArgs = args.trim();
    if (!trimmedArgs) {
      return '空参数';
    }
    if (trimmedArgs.includes('\n')) {
      return `\`\`\`\n${trimmedArgs}\n\`\`\``;
    } else {
      return `\`${trimmedArgs}\``;
    }
  } else if (typeof args === 'object') {
    return `\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
  } else {
    return `\`${String(args)}\``;
  }
};

/**
 * 检测工具类型
 * @param name - 工具名称
 * @returns 工具类型分类
 */
const getToolType = (name: string): string => {
  // 文件系统工具
  if (['ls', 'read_file', 'write_file', 'edit_file', 'glob', 'grep'].includes(name)) {
    return 'filesystem';
  }
  // 系统/Bash工具
  if (['execute_bash', 'sleep', 'echo'].includes(name)) {
    return 'system';
  }
  // GitHub工具
  if (name === 'WebFetchFromGithub') {
    return 'github';
  }
  // 代码分析工具
  if (name === 'hybrid_code_reader') {
    return 'code_analysis';
  }
  // 知识库工具
  if (['add_knowledge', 'get_knowledge_summaries', 'search_knowledge'].includes(name)) {
    return 'knowledge';
  }
  // 搜索工具
  if (name === 'TencentWsaSearch') {
    return 'search';
  }
  // 任务管理工具
  if (name === 'write-subagent-todos' || name === 'write_todos' || name === 'task') {
    return 'task_management';
  }
  // Composio工具
  if (name.startsWith('COMPOSIO_')) {
    return 'composio';
  }
  // 其他工具
  return 'other';
};

/**
 * 格式化默认工具调用参数
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
const formatDefaultToolCall = (args: any): string => {
  if (args == null) {
    return '无参数';
  }
  
  if (typeof args === 'string') {
    const trimmedArgs = args.trim();
    if (!trimmedArgs) {
      return '空参数';
    }
    // 尝试解析是否为JSON字符串
    try {
      const parsed = JSON.parse(trimmedArgs);
      // 如果成功解析为对象或数组，格式化为JSON代码块
      return `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch {
      // 不是有效的JSON，按普通字符串处理
      if (trimmedArgs.includes('\n')) {
        // 多行字符串使用代码块
        return `\`\`\`\n${trimmedArgs}\n\`\`\``;
      } else {
        // 单行字符串使用行内代码
        return `\`${trimmedArgs}\``;
      }
    }
  } else if (typeof args === 'object') {
    // 对象参数，直接格式化为JSON
    return `\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
  } else {
    // 其他类型（数字、布尔值等）
    return `\`${String(args)}\``;
  }
};

/**
 * 格式化工具调用参数
 * @param name - 工具名称
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
export const formatToolCallArgs = (name: string, args: any): string => {
  const toolType = getToolType(name);

  try {
    args = JSON.parse(args);
  } catch {}
  
  switch (toolType) {
    case 'task_management':
      if (name === 'task') {
        return formatTaskToolCall(args);
      }
      return formatDefaultToolCall(args);
    
    case 'filesystem':
      return formatFilesystemToolCall(name, args);
    
    case 'system':
      return formatSystemToolCall(name, args);
    
    default:
      return formatDefaultToolCall(args);
  }
};

/**
 * 获取工具调用的标题
 * @param name - 工具名称
 * @param args - 工具参数
 * @returns 标题字符串
 */
export const getToolCallTitle = (name: string, args: any): string => {
  if (name === 'task' && args?.subagent_type) {
    const subagentType = args.subagent_type;
    return `🧠 委派任务给 ${subagentType} 代理`;
  }
  
  // 根据工具类型设置不同的标题前缀
  const toolType = getToolType(name);
  const typeEmojis: Record<string, string> = {
    filesystem: '📁',
    system: '💻',
    github: '🐧',
    code_analysis: '🔍',
    knowledge: '📚',
    search: '🌐',
    task_management: '📋',
    composio: '🔌',
    other: '🔧'
  };
  
  const typeEmoji = typeEmojis[toolType] || '🔧';
  return `🔧 工具调用: ${name}`;
};