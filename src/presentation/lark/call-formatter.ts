/**
 * 工具调用格式化器 - 专门处理工具调用参数的格式化
 * 
 * 中文名称：工具调用格式化器
 * 
 * 为 LARK 飞书适配器提供工具调用参数的智能格式化功能，
 * 根据不同的工具类型和参数结构提供针对性的展示格式。
 * 
 * @module call-formatter
 */

import { 
  inferLanguageType, 
  getToolType
} from './shared';

/**
 * 格式化 task 工具调用参数
 * @param args - task 工具的参数对象
 * @returns 格式化后的内容字符串
 */
export const formatTaskToolCall = (args: any): string => {
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
export const formatFilesystemToolCall = (name: string, args: any): string => {
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
    
    case 'view_file':
    case 'read_file':
      if (typeof args === 'string') {
        return `**文件路径**: \`${args}\``;
      } else if (typeof args === 'object') {
        const filePath = args.file_path || args.filePath || '未知路径';
        let content = `**文件路径**: \`${filePath}\``;
        if (args.start_line !== undefined || args.end_line !== undefined) {
          const start = args.start_line ?? 1;
          const end = args.end_line ?? '末尾';
          content += `\n**行范围**: 第 ${start} – ${end} 行`;
        }
        return content;
      }
      break;

    case 'write_file':
    case 'edit_file':
      if (typeof args === 'string') {
        return `**文件路径**: \`${args}\``;
      } else if (typeof args === 'object') {
        const filePath = args.file_path || args.filePath || '未知路径';
        let content = `**文件路径**: \`${filePath}\``;
        
        if (name === 'write_file') {
          if (args.content != null) {
            const lang = inferLanguageType(filePath, args.content);
            const langTag = lang ? lang : '';
            content += `\n\n**内容预览**: \n\`\`\`${langTag}\n${args.content}\n\`\`\` `;
          }
        }
        
        if (args.old_string != null) {
          const lang = inferLanguageType(filePath, args.old_string);
          const langTag = lang ? lang : '';
          content += `\n\n**原内容** \n\`\`\`${langTag}\n${args.old_string}\n\`\`\` `;
        }
        
        if (args.new_string != null) {
          const lang = inferLanguageType(filePath, args.new_string);
          const langTag = lang ? lang : '';
          content += `\n\n**新内容**: \n\`\`\`${langTag}\n${args.new_string}\n\`\`\` `;
        }

        return content;
      }
      break;
    
    case 'glob_files':
    case 'glob':
      if (typeof args === 'string') {
        return `**模式**: \`${args}\``;
      } else if (typeof args === 'object') {
        const pattern = args.pattern || '未知模式';
        const path = args.path || args.cwd || '/';
        return `**模式**: \`${pattern}\`\n**路径**: \`${path}\``;
      }
      break;
    
    case 'grep_files':
    case 'grep':
      if (typeof args === 'object') {
        const pattern = args.pattern || '未知模式';
        const path = args.path || args.cwd || '/';
        const fileFilter = args.include || args.glob || '所有文件';
        let content = `**搜索模式**: \`${pattern}\`\n**路径**: \`${path}\`\n**文件过滤**: \`${fileFilter}\``;
        if (args.case_insensitive) {
          content += '\n**大小写**: 不敏感';
        }
        return content;
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
      const lang = inferLanguageType(undefined, trimmedArgs);
      const langTag = lang ? lang : '';
      return `\`\`\`${langTag}\n${trimmedArgs}\n\`\`\``;
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
export const formatSystemToolCall = (name: string, args: any): string => {
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
      const lang = inferLanguageType(undefined, trimmedArgs);
      const langTag = lang ? lang : '';
      return `\`\`\`${langTag}\n${trimmedArgs}\n\`\`\``;
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
 * 格式化默认工具调用参数
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
export const formatDefaultToolCall = (args: any): string => {
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
        const lang = inferLanguageType(undefined, trimmedArgs);
        const langTag = lang ? lang : '';
        return `\`\`\`${langTag}\n${trimmedArgs}\n\`\`\``;
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
 * 格式化网页获取工具调用参数
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
export const formatWebFetchToolCall = (args: any): string => {
  if (args == null) return '无参数';
  if (typeof args === 'string') {
    return `**URL**: \`${args}\``;
  }
  if (typeof args === 'object') {
    const url = args.url || '未知 URL';
    let content = `**URL**: \`${url}\``;
    if (args.timeout) content += `\n**超时**: ${args.timeout}ms`;
    if (args.max_length) content += `\n**最大长度**: ${args.max_length} 字符`;
    return content;
  }
  return `\`${String(args)}\``;
};

/**
 * 格式化思考工具调用参数
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
export const formatThinkToolCall = (args: any): string => {
  if (args == null) return '无参数';
  if (typeof args === 'object' && args.reasoning) {
    const lines = String(args.reasoning).split('\n');
    const preview = lines.slice(0, 5).join('\n');
    const more = lines.length > 5 ? `\n... (共 ${lines.length} 行)` : '';
    return `💭 **推理过程**\n\`\`\`\n${preview}${more}\n\`\`\``;
  }
  if (typeof args === 'string') {
    const lines = args.split('\n');
    const preview = lines.slice(0, 5).join('\n');
    const more = lines.length > 5 ? `\n... (共 ${lines.length} 行)` : '';
    return `💭 **推理过程**\n\`\`\`\n${preview}${more}\n\`\`\``;
  }
  return `\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``;
};


/**
 * 格式化 AI 代理执行工具调用参数
 * @param name - 工具名称
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
export const formatAgentRunnerToolCall = (name: string, args: any): string => {
  if (args == null) {
    return '无参数';
  }

  if (name === 'cursor_open') {
    if (typeof args === 'string') {
      return `**路径**: \`${args}\``;
    }
    if (typeof args === 'object') {
      const path = args.path || '未知路径';
      let content = `**路径**: \`${path}\``;
      if (args.timeout) content += `\n**超时**: ${args.timeout}ms`;
      return content;
    }
  }

  // claude_execute / cursor_execute / gemini_execute / codex_execute
  if (typeof args === 'object') {
    const prompt = args.prompt || '无提示词';
    let content = `**提示词**:\n\`\`\`\n${prompt}\n\`\`\``;
    if (args.cwd) content += `\n**工作目录**: \`${args.cwd}\``;
    if (args.timeout) content += `\n**超时**: ${args.timeout}ms`;
    if (args.args && Array.isArray(args.args) && args.args.length > 0) {
      content += `\n**附加参数**: \`${args.args.join(' ')}\``;
    }
    return content;
  }
  if (typeof args === 'string') {
    return `**提示词**:\n\`\`\`\n${args}\n\`\`\``;
  }
  return formatDefaultToolCall(args);
};

/**
 * 格式化 todo_write 工具调用参数
 * @param args - 工具参数
 * @returns 格式化后的内容字符串
 */
export const formatTodoWriteToolCall = (args: any): string => {
  if (args == null) return '无参数';
  if (typeof args === 'object' && Array.isArray(args.todos)) {
    const todos = args.todos;
    if (todos.length === 0) return '清空待办事项列表';
    const lines = todos.map((t: any) => {
      const status = t.status || 'not_started';
      const priority = t.priority ? ` [${t.priority}]` : '';
      const id = t.id ? `#${t.id} ` : '';
      return `- ${id}**${status}**${priority}: ${t.content || '(无内容)'}`;
    });
    return `📝 **更新待办事项 (${todos.length} 项)**\n\n${lines.join('\n')}`;
  }
  return formatDefaultToolCall(args);
};

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
      if (name === 'todo_write') {
        return formatTodoWriteToolCall(args);
      }
      if (name === 'todo_read') {
        return '读取当前待办事项列表';
      }
      return formatDefaultToolCall(args);
    
    case 'filesystem':
      return formatFilesystemToolCall(name, args);
    
    case 'system':
      return formatSystemToolCall(name, args);
    
    case 'web':
      return formatWebFetchToolCall(args);
    
    case 'thinking':
      return formatThinkToolCall(args);
    
    case 'agent_runner':
      return formatAgentRunnerToolCall(name, args);
    
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
    web: '🔗',
    thinking: '💭',
    code_analysis: '🔍',
    knowledge: '📚',
    search: '🌐',
    task_management: '📋',
    composio: '🔌',
    agent_runner: '🤖',
    other: '🔧'
  };
  
  const typeEmoji = typeEmojis[toolType] || '🔧';
  return `${typeEmoji} 工具调用: ${name}`;
};