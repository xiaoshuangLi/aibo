/**
 * 工具结果格式化器 - 专门处理不同工具类型的结果格式化
 * 
 * 中文名称：工具结果格式化器
 * 
 * 为 LARK 飞书适配器提供工具结果的智能格式化功能，
 * 根据不同的工具类型提供针对性的展示格式。
 * 
 * @module result-formatter
 */

import { inferLanguageType, isErrorContent } from './shared';

/**
 * 检测工具类型
 * @param name - 工具名称
 * @returns 工具类型分类
 */
export const getToolType = (name: string): string => {
  // 文件系统工具
  if (['ls', 'read_file', 'view_file', 'write_file', 'edit_file', 'glob', 'glob_files', 'grep', 'grep_files'].includes(name)) {
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
  // 网页获取工具
  if (name === 'web_fetch') {
    return 'web';
  }
  // 思考工具
  if (name === 'think') {
    return 'thinking';
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
  if (['write-subagent-todos', 'read-subagent-todos', 'write_todos', 'task', 'todo_write', 'todo_read'].includes(name)) {
    return 'task_management';
  }
  // AI代理执行工具
  if (['claude_execute', 'cursor_execute', 'cursor_open', 'gemini_execute', 'codex_execute'].includes(name)) {
    return 'agent_runner';
  }
  // Composio工具
  if (name.startsWith('COMPOSIO_')) {
    return 'composio';
  }
  // 其他工具
  return 'other';
};

/**
 * 格式化文件系统工具结果
 */
export const formatFilesystemResult = (name: string, result: any): string => {
  // 处理字符串输入（非JSON格式）- 这是关键！
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (!trimmed) return '无内容';
    
    switch (name) {
      case 'ls':
        if (trimmed.startsWith('/')) {
          // ls 工具返回的文本按换行符分割成文件列表
          const lsLines = trimmed.split('\n').filter(line => line.trim());
          if (lsLines.length === 0) return '目录为空';
          return lsLines.map(item => `- \`${item}\``).join('\n');
        }

        const lang = inferLanguageType(undefined, trimmed);
        const langTag = lang ? lang : '';
        return `\`\`\`${langTag}\n${trimmed}\n\`\`\``;
      
      case 'grep':
      case 'grep_files':
        // 智能解析 grep 工具的输出格式
        const grepLines = trimmed.split('\n').filter(line => line.trim());
        if (grepLines.length === 0) return '未找到匹配内容';
        
        // 解析内置 grep 工具的特殊格式：文件路径后跟缩进的内容行
        const parsedResults: string[] = [];
        let currentFile = '';
        
        for (const line of grepLines) {
          // 检查是否是文件路径行（以冒号结尾，且不以空格开头）
          if (line.endsWith(':') && !line.startsWith(' ')) {
            currentFile = line.slice(0, -1); // 移除末尾的冒号
          } 
          // 检查是否是内容行（以空格开头，包含行号:内容格式）
          else if (line.startsWith(' ') && line.includes(':')) {
            const content = line.trim();
            if (currentFile) {
              parsedResults.push(`📄 \`${currentFile}\`\n   🔹 ${content}`);
            } else {
              parsedResults.push(`🔹 ${content}`);
            }
          }
          // 处理其他可能的格式（兼容标准 grep 格式）
          else if (line.includes(':') && /^\d+:/.test(line.split(':')[1] || '')) {
            // 标准格式：文件:行号:内容
            const parts = line.split(':');
            if (parts.length >= 3) {
              const file = parts[0];
              const lineNumber = parts[1];
              const content = parts.slice(2).join(':');
              parsedResults.push(`📄 \`${file}\`\n   🔹 第${lineNumber}行: ${content}`);
            }
          }
          // 兜底处理
          else {
            parsedResults.push(`🔹 ${line}`);
          }
        }
        
        if (parsedResults.length === 0) return '未找到匹配内容';
        
        const displayResults = parsedResults.slice(0, 10);
        let resultText = `找到 ${parsedResults.length} 个匹配项:\n\n${displayResults.join('\n\n')}`;
        
        if (parsedResults.length > 10) {
          resultText += `\n\n... 还有 ${parsedResults.length - 10} 个匹配项`;
        }
        
        return resultText;
      
      case 'read_file':
      case 'view_file':
        // read_file/view_file 工具的字符串结果直接显示
        const lines = trimmed.split('\n').length;
        const chars = trimmed.length;
        const preview = trimmed;
        const fileLang = inferLanguageType(undefined, preview);
        const fileLangTag = fileLang ? fileLang : '';
        return `**文件内容:** ${lines} 行, ${chars} 字符\n\n\`\`\`${fileLangTag}\n${preview}\n\`\`\``;
      
      case 'glob':
      case 'glob_files':
        // glob 工具返回的文本按换行符分割成文件路径
        const globLines = trimmed.split('\n').filter(line => line.trim());
        if (globLines.length === 0) return '未找到匹配文件';
        return `找到 ${globLines.length} 个匹配文件:\n\n` + 
               globLines.slice(0, 10).map(file => `- \`${file}\``).join('\n') + 
               (globLines.length > 10 ? `\n... 还有 ${globLines.length - 10} 个文件` : '');
      
      default:
        // 其他文件系统工具的字符串结果
        if (trimmed.includes('\n')) {
          const lang = inferLanguageType(undefined, trimmed);
          const langTag = lang ? lang : '';
          return `\`\`\`${langTag}\n${trimmed}\n\`\`\``;
        } else {
          return `\`${trimmed}\``;
        }
    }
  }
  
  // 处理对象/数组输入（JSON格式）
  switch (name) {
    case 'ls':
      if (Array.isArray(result)) {
        if (result.length === 0) return '目录为空';
        return result.map(item => `- ${item}`).join('\n');
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    case 'read_file':
      if (result.content !== undefined) {
        const lines = result.content.split('\n').length;
        const chars = result.content.length;
        const preview = result.content;
        // 尝试从结果对象中提取文件路径
        const filePath = result.file_path || result.filePath || undefined;
        const fileLang = inferLanguageType(filePath, preview);
        const fileLangTag = fileLang ? fileLang : '';
        return `**文件信息:** ${lines} 行, ${chars} 字符\n\n\`\`\`${fileLangTag}\n${preview}\n\`\`\``;
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;

    case 'view_file':
      // view_file 返回 {success, file_path, total_lines, start_line, end_line, content}
      if (result.success === false) {
        return `❌ **读取失败**: ${result.message || result.error || '未知错误'}`;
      }
      if (result.content !== undefined) {
        const filePath = result.file_path || undefined;
        const fileLang = inferLanguageType(filePath, result.content);
        const fileLangTag = fileLang ? fileLang : '';
        const totalLines = result.total_lines || result.content.split('\n').length;
        const startLine = result.start_line || 1;
        const endLine = result.end_line || totalLines;
        const rangeInfo = (startLine === 1 && endLine === totalLines)
          ? `共 ${totalLines} 行`
          : `第 ${startLine}–${endLine} 行 / 共 ${totalLines} 行`;
        return `**文件:** \`${filePath || '未知'}\` (${rangeInfo})\n\n\`\`\`${fileLangTag}\n${result.content}\n\`\`\``;
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    case 'write_file':
    case 'edit_file':
      if (result.success) {
        const filePath = result.file_path || result.filePath;
        let detail = `**路径:** \`${filePath}\``;
        if (result.action) {
          const actionLabel: Record<string, string> = { created: '新建', overwritten: '覆写', edited: '编辑' };
          detail = `**操作:** ${actionLabel[result.action] || result.action}  ${detail}`;
        }
        if (result.lines_written !== undefined) {
          detail += `\n**写入行数:** ${result.lines_written}`;
        }
        if (result.lines_removed !== undefined || result.lines_added !== undefined) {
          detail += `\n**变更:** <font color="red">-${result.lines_removed ?? 0}</font> / <font color="green">+${result.lines_added ?? 0}</font>`;
        }
        return `✅ 文件操作成功\n${detail}`;
      }
      return `❌ 文件操作失败\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    case 'glob':
      if (Array.isArray(result)) {
        if (result.length === 0) return '未找到匹配文件';
        return `找到 ${result.length} 个匹配文件:\n\n` + 
               result.slice(0, 10).map(file => `- \`${file}\``).join('\n') + 
               (result.length > 10 ? `\n... 还有 ${result.length - 10} 个文件` : '');
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;

    case 'glob_files':
      // glob_files 返回 {success, pattern, cwd, count, files}
      if (result.success === false) {
        return `❌ **搜索失败**: ${result.error || '未知错误'}`;
      }
      if (result.files !== undefined) {
        const files: string[] = result.files || [];
        if (files.length === 0) return `未找到匹配模式 \`${result.pattern}\` 的文件`;
        const shown = files.slice(0, 10);
        const remaining = files.length - shown.length;
        return `找到 ${files.length} 个匹配文件 (\`${result.pattern}\`):\n\n` +
               shown.map(f => `- \`${f}\``).join('\n') +
               (remaining > 0 ? `\n... 还有 ${remaining} 个文件` : '');
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    case 'grep':
      if (Array.isArray(result)) {
        if (result.length === 0) return '未找到匹配内容';
        return `找到 ${result.length} 个匹配项:\n\n` + 
               result.slice(0, 10).map(match => `- ${match}`).join('\n') + 
               (result.length > 10 ? `\n... 还有 ${result.length - 10} 个匹配项` : '');
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;

    case 'grep_files':
      // grep_files 返回 {success, pattern, include, cwd, count, truncated, results}
      // results 是 [{file, line, content}] 数组
      if (result.success === false) {
        return `❌ **搜索失败**: ${result.message || result.error || '未知错误'}`;
      }
      if (result.results !== undefined) {
        const matches: Array<{file: string; line: number; content: string}> = result.results || [];
        if (matches.length === 0) return `未找到匹配模式 \`${result.pattern}\` 的内容`;
        const shown = matches.slice(0, 10);
        const remaining = matches.length - shown.length;
        const lines = shown.map(m => `📄 \`${m.file}\` 第 ${m.line} 行\n   🔹 ${m.content.trim()}`);
        let text = `找到 ${result.count || matches.length} 个匹配项 (\`${result.pattern}\`):\n\n` + lines.join('\n\n');
        if (remaining > 0) text += `\n\n... 还有 ${remaining} 个匹配项`;
        if (result.truncated) text += `\n\n⚠️ 结果已截断（超过最大数量限制）`;
        return text;
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    default:
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  }
};

/**
 * 格式化系统/Bash工具结果
 */
export const formatSystemResult = (name: string, result: any): string => {
  // 处理字符串输入（非JSON格式）
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (!trimmed) return '无输出';
    
    switch (name) {
      case 'execute_bash':
        // execute_bash 的字符串结果直接显示为标准输出
        const bashLang = inferLanguageType(undefined, trimmed);
        const bashLangTag = bashLang ? bashLang : 'bash';
        return `**标准输出:**\n\`\`\`${bashLangTag}\n${trimmed}\n\`\`\``;
      
      case 'echo':
        const echoLang = inferLanguageType(undefined, trimmed);
        const echoLangTag = echoLang ? echoLang : '';
        return `💬 回显内容:\n\`\`\`${echoLangTag}\n${trimmed}\n\`\`\``;
      
      case 'sleep':
        // sleep 工具通常返回数字或简单消息
        return `⏱️ 延迟执行完成\n**时长:** ${trimmed} 毫秒`;
      
      default:
        if (trimmed.includes('\n')) {
          const lang = inferLanguageType(undefined, trimmed);
          const langTag = lang ? lang : '';
          return `\`\`\`${langTag}\n${trimmed}\n\`\`\``;
        } else {
          return `\`${trimmed}\``;
        }
    }
  }
  
  // 处理对象/数组输入（JSON格式）
  switch (name) {
    case 'execute_bash':
      let output = '';
      if (result.stdout && result.stdout !== '(empty)') {
        const stdoutLang = inferLanguageType(undefined, result.stdout);
        const stdoutLangTag = stdoutLang ? stdoutLang : 'bash';
        output += `**标准输出:**\n\`\`\`${stdoutLangTag}\n${result.stdout}\n\`\`\`\n\n`;
      }
      if (result.stderr && result.stderr !== '(empty)') {
        const stderrLang = inferLanguageType(undefined, result.stderr);
        const stderrLangTag = stderrLang ? stderrLang : '';
        output += `**标准错误:**\n\`\`\`${stderrLangTag}\n${result.stderr}\n\`\`\``;
      }
      if (result.command) {
        output = `**命令:** \`${result.command}\`\n\n` + output;
      }
      return output || '无输出';
    
    case 'sleep':
      // sleep 返回 {success: true, message: "Slept for X milliseconds"}
      // 向后兼容：也处理 {duration: X} 格式
      {
        const matched = result.message ? result.message.match(/(\d+)/) : null;
        const sleepDuration = result.duration !== undefined
          ? result.duration
          : (matched ? parseInt(matched[1]) : undefined);
        if (sleepDuration !== undefined) {
          return `⏱️ 延迟执行完成\n**时长:** ${sleepDuration} 毫秒`;
        }
        return `⏱️ 延迟执行完成\n**结果:** ${result.message || '完成'}`;
      }
    
    case 'echo':
      const echoContentLang = inferLanguageType(undefined, result.echoed || result.message);
      const echoContentLangTag = echoContentLang ? echoContentLang : '';
      return `💬 回显内容:\n\`\`\`${echoContentLangTag}\n${result.echoed || result.message}\n\`\`\``;
    
    default:
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  }
};

/**
 * 格式化GitHub工具结果
 */
export const formatGithubResult = (result: any): string => {
  if (result.success === false) {
    return `❌ **GitHub 获取失败**: ${result.message || result.error || '未知错误'}`;
  }
  if (result.content) {
    const lines = result.content.split('\n').length;
    const githubLang = inferLanguageType(result.path, result.content);
    const githubLangTag = githubLang ? githubLang : '';
    const meta = [
      result.owner && result.repo ? `**仓库:** \`${result.owner}/${result.repo}\`` : null,
      result.path ? `**文件:** \`${result.path}\`` : null,
      result.branch ? `**分支:** \`${result.branch}\`` : null,
    ].filter(Boolean).join('  ');
    return `🐙 **GitHub 文件内容** (${lines} 行)${meta ? `\n${meta}` : ''}\n\n\`\`\`${githubLangTag}\n${result.content}\n\`\`\``;
  }
  return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
};

/**
 * 格式化代码分析工具结果
 */
export const formatCodeAnalysisResult = (result: any): string => {
  if (result.implementation || result.definition || result.references) {
    const content = result.implementation || result.definition || result.references;
    return `🔍 **代码分析结果**\n\n\`\`\`typescript\n${content}\n\`\`\``;
  }
  return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
};

/**
 * 格式化知识库工具结果
 */
export const formatKnowledgeResult = (name: string, result: any): string => {
  switch (name) {
    case 'add_knowledge':
      if (result.success) {
        const keywordCount = result.keywordCount ?? result.keywords?.length ?? 0;
        return `📚 **知识添加成功**\n\n**标题:** ${result.title || '未知'}\n**关键词数量:** ${keywordCount}`;
      }
      return `❌ 知识添加失败\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    case 'get_knowledge_summaries':
      // 实际输出: {success, knowledgeSummaries, total}
      const summaries = result.knowledgeSummaries || (Array.isArray(result) ? result : null);
      if (summaries) {
        if (summaries.length === 0) return '知识库为空';
        return `📚 **知识库摘要 (${summaries.length} 项)**\n\n` + 
               summaries.map((item: any) => `- **${item.title}** [${item.keywords?.join(', ') || '无关键词'}]`).join('\n');
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    case 'search_knowledge':
      // 实际输出: {success, message, knowledgeItems, total}
      const items = result.knowledgeItems || (Array.isArray(result) ? result : null);
      if (items) {
        if (items.length === 0) return '未找到匹配的知识';
        return `📚 **知识搜索结果 (${items.length} 项)**\n\n` + 
               items.map((item: any) => 
                 `- **${item.title}**\n  ${item.content || ''}`
               ).join('\n\n');
      }
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    
    default:
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  }
};

/**
 * 格式化搜索工具结果
 */
export const formatSearchResult = (result: any): string => {
  // 获取搜索结果数组（兼容不同结构）
  let searchResults: any[] = [];
  
  if (result.success !== undefined && result.results && Array.isArray(result.results)) {
    // TencentWsaSearch 工具的标准响应结构
    searchResults = result.results;
  } else if (Array.isArray(result)) {
    // 直接传入数组的情况
    searchResults = result;
  } else if (result.Pages && Array.isArray(result.Pages)) {
    // 直接的 Pages 结构
    searchResults = result.Pages;
  }
  
  if (searchResults.length === 0) {
    return '未找到搜索结果';
  }
  
  // 处理每个搜索结果项
  const formattedResults = searchResults.slice(0, 5).map((item: any, index: number) => {
    // 如果 item 是字符串，尝试解析为 JSON 对象
    let parsedItem: any = item;
    if (typeof item === 'string') {
      try {
        parsedItem = JSON.parse(item);
      } catch (e) {
        // 如果解析失败，创建一个包含原始字符串的对象
        parsedItem = { title: '解析失败', url: '#', description: item };
      }
    }
    
    // 如果 parsedItem 不是对象，创建默认对象
    if (!parsedItem || typeof parsedItem !== 'object') {
      parsedItem = { title: '无标题', url: '#', description: '无描述' };
    }
    
    // 提取标题（兼容多种字段名和大小写）
    const title = parsedItem.Title || parsedItem.title || parsedItem.Name || parsedItem.name || '无标题';
    
    // 提取URL（兼容多种字段名和大小写）
    const url = parsedItem.Url || parsedItem.url || parsedItem.Link || parsedItem.link || parsedItem.href || '#';
    
    // 提取描述/摘要（兼容多种字段名和大小写）
    const snippet = parsedItem.Description || parsedItem.description || 
                   parsedItem.Abstract || parsedItem.abstract || 
                   parsedItem.Snippet || parsedItem.snippet || 
                   parsedItem.Content || parsedItem.content || 
                   parsedItem.passage || '无描述';
    
    // 创建安全的链接文本
    const safeUrl = url && url !== '#' ? url : '#';
    const linkText = safeUrl !== '#' ? `[${title}](${safeUrl})` : title;
    
    return `${index + 1}. **${linkText}**\n\`\`\` \n${String(snippet)}\n \`\`\``;
  });
  
  return `🌐 **网络搜索结果 (${searchResults.length} 项)**\n\n` + formattedResults.join('\n\n');
};

/**
 * 格式化任务管理工具结果
 */
export const formatTaskManagementResult = (name: string, result: any): string => {
  if (name === 'write-subagent-todos' || name === 'write_todos') {
    if (result.todos && Array.isArray(result.todos)) {
      const completed = result.todos.filter((t: any) => t.status === 'completed').length;
      const total = result.todos.length;
      return `📋 **待办事项更新 (${completed}/${total} 完成)**\n\n` + 
             result.todos.map((todo: any) => 
               `- [${todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '🔄' : ' '}] ${todo.content}`
             ).join('\n');
    }
  }
  if (name === 'read-subagent-todos') {
    if (result.todos && Array.isArray(result.todos)) {
      if (result.todos.length === 0) return '📋 **待办事项列表为空**';
      const completed = result.todos.filter((t: any) => t.status === 'completed').length;
      const total = result.todos.length;
      return `📋 **待办事项 (${completed}/${total} 完成)**\n\n` + 
             result.todos.map((todo: any) => 
               `- [${todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '🔄' : ' '}] \`${todo.subagent_type || '?'}\` ${todo.content}`
             ).join('\n');
    }
  }
  if (name === 'todo_write') {
    if (result.success === false) {
      return `❌ **待办事项更新失败**: ${result.message || result.error || '未知错误'}`;
    }
    if (result.todos && Array.isArray(result.todos)) {
      if (result.todos.length === 0) return '📝 **待办事项列表已清空**';
      const completed = result.todos.filter((t: any) => t.status === 'completed').length;
      const total = result.todos.length;
      return `📝 **待办事项已更新 (${completed}/${total} 完成)**\n\n` +
             result.todos.map((todo: any) => {
               const statusIcon = todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '🔄' : '⬜';
               const priorityTag = todo.priority ? ` \`${todo.priority}\`` : '';
               return `- ${statusIcon} \`#${todo.id}\`${priorityTag} ${todo.content}`;
             }).join('\n');
    }
  }
  if (name === 'todo_read') {
    if (result.todos && Array.isArray(result.todos)) {
      if (result.todos.length === 0) return '📝 **待办事项列表为空**';
      const summary = result.summary || {};
      const notStarted = summary.not_started ?? 0;
      const inProgress = summary.in_progress ?? 0;
      const completed = summary.completed ?? 0;
      const header = `📝 **待办事项 (共 ${result.total || result.todos.length} 项: ✅${completed} 🔄${inProgress} ⬜${notStarted})**\n\n`;
      const lines = result.todos.map((todo: any) => {
        const statusIcon = todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '🔄' : '⬜';
        const priorityTag = todo.priority ? ` \`${todo.priority}\`` : '';
        return `- ${statusIcon} \`#${todo.id}\`${priorityTag} ${todo.content}`;
      });
      return header + lines.join('\n');
    }
  }
  return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
};

/**
 * 格式化网页获取工具结果
 */
export const formatWebFetchResult = (result: any): string => {
  if (result.success === false) {
    return `❌ **网页获取失败** (HTTP ${result.status || '?'}): ${result.message || result.error || '未知错误'}`;
  }
  if (result.content !== undefined) {
    const lines = result.content.split('\n').length;
    const contentType = result.content_type || '';
    const isHtml = contentType.includes('html');
    const lang = isHtml ? 'html' : inferLanguageType(result.url, result.content);
    const langTag = lang || '';
    const truncatedNote = result.truncated ? '\n\n⚠️ 内容已截断（超过最大长度限制）' : '';
    const meta = [
      result.url ? `**URL:** ${result.url}` : null,
      result.status ? `**状态:** ${result.status}` : null,
      contentType ? `**类型:** ${contentType}` : null,
    ].filter(Boolean).join('  ');
    return `🌐 **网页内容** (${lines} 行)\n${meta}\n\n\`\`\`${langTag}\n${result.content}\n\`\`\`${truncatedNote}`;
  }
  return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
};

/**
 * 格式化思考工具结果
 */
export const formatThinkResult = (result: any): string => {
  if (result.reasoning) {
    return `💭 **思考过程**\n\n${result.reasoning}`;
  }
  return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
};

/**
 * 格式化Composio工具结果
 */
export const formatComposioResult = (name: string, result: any): string => {
  // Composio工具通常返回结构化的数据，尝试提取有用信息
  if (result.data) {
    if (Array.isArray(result.data)) {
      if (result.data.length === 0) return '无数据返回';
      // 尝试识别常见的Composio响应格式
      if (result.data[0].subject || result.data[0].title) {
        return `🔌 **${name.replace('COMPOSIO_', '')} 结果 (${result.data.length} 项)**\n\n` + 
               result.data.slice(0, 3).map((item: any, index: number) => 
                 `- **${item.subject || item.title || '无标题'}**\n  ${item.body || item.content || item.snippet || '无内容'}`
               ).join('\n\n');
      }
    } else if (typeof result.data === 'object') {
      return `🔌 **${name.replace('COMPOSIO_', '')} 结果**\n\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``;
    }
  }
  return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
};

/**
 * 格式化 AI 代理执行工具结果
 */
export const formatAgentRunnerResult = (name: string, result: any): string => {
  if (result.success === false) {
    if (result.interrupted) {
      return `⚠️ **执行被中断**\n${result.message || '用户中断了执行'}`;
    }
    let errorOutput = `❌ **执行失败**: ${result.error || '未知错误'}\n${result.message || ''}`;
    if (result.stdout && result.stdout !== '(empty)') {
      const stdoutLang = inferLanguageType(undefined, result.stdout);
      errorOutput += `\n\n**标准输出:**\n\`\`\`${stdoutLang || 'bash'}\n${result.stdout}\n\`\`\``;
    }
    if (result.stderr && result.stderr !== '(empty)') {
      const stderrLang = inferLanguageType(undefined, result.stderr);
      errorOutput += `\n\n**标准错误:**\n\`\`\`${stderrLang || ''}\n${result.stderr}\n\`\`\``;
    }
    return errorOutput.trim();
  }
  if (name === 'cursor_open') {
    const path = result.path || '未知路径';
    return `✅ **已在 Cursor 中打开**: \`${path}\``;
  }
  let output = '';
  if (result.stdout && result.stdout !== '(empty)') {
    const stdoutLang = inferLanguageType(undefined, result.stdout);
    output += `**输出:**\n\`\`\`${stdoutLang || 'bash'}\n${result.stdout}\n\`\`\``;
  }
  if (result.stderr && result.stderr !== '(empty)') {
    const stderrLang = inferLanguageType(undefined, result.stderr);
    output += `${output ? '\n\n' : ''}**标准错误:**\n\`\`\`${stderrLang || ''}\n${result.stderr}\n\`\`\``;
  }
  return output || '✅ 执行完成（无输出）';
};

/**
 * @param result - 结构化结果对象
 * @param verbose - 是否详细模式
 * @returns 格式化的Markdown字符串
 */
export const formatStructuredResult = (result: any, verbose: boolean): string => {
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return "**空数组** ⚪";
    }
    
    // 尝试识别数组类型
    if (result.every(item => typeof item === 'string')) {
      // 字符串数组
      if (verbose || result.length <= 5) {
        return `📋 **结果列表 (${result.length} 项)**:\n\n` + 
               result.map((item, index) => `${index + 1}. \`${item}\``).join('\n');
      } else {
        const preview = result.slice(0, 3);
        const remaining = result.length - 3;
        return `📋 **结果列表 (${result.length} 项)**:\n\n` + 
               preview.map((item, index) => `${index + 1}. \`${item}\``).join('\n') +
               `\n... 还有 ${remaining} 项`;
      }
    } else {
      // 对象数组
      if (verbose || result.length <= 2) {
        return `📊 **数据表格 (${result.length} 行)**:\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
      } else {
        const preview = result.slice(0, 2);
        const remaining = result.length - 2;
        return `📊 **数据表格 (${result.length} 行)**:\n\n\`\`\`json\n${JSON.stringify(preview, null, 2)}\n\`\`\`\n... 还有 ${remaining} 行`;
      }
    }
  }
  
  // 处理错误对象
  if (result.error || result.message) {
    const errorMsg = result.error || result.message;
    if (typeof errorMsg === 'string' && errorMsg.includes('\n')) {
      const errorLang = inferLanguageType(undefined, errorMsg);
      const errorLangTag = errorLang ? errorLang : '';
      return `❌ **执行错误**:\n\`\`\`${errorLangTag}\n${errorMsg}\n\`\`\``;
    } else {
      return `❌ **${errorMsg}**`;
    }
  }
  
  // 处理成功的结果对象
  if (result.success !== undefined) {
    if (result.success) {
      let successMsg = "✅ **操作成功**";
      if (result.data) {
        if (typeof result.data === 'string') {
          successMsg += `\n\n📄 **数据**: \`${result.data}\``;
        } else {
          successMsg += `\n\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``;
        }
      }
      return successMsg;
    } else {
      return `❌ **操作失败**${result.error ? `\n\n${result.error}` : ''}`;
    }
  }
  
  // 通用对象处理
  const keys = Object.keys(result);
  if (keys.length === 0) {
    return "**空对象** ⚪";
  }
  
  // 如果对象包含 stdout/stderr，按命令输出处理
  if (result.stdout || result.stderr) {
    let outputParts: string[] = [];
    if (result.stdout) {
      const stdout = String(result.stdout).trim();
      if (stdout && stdout !== "(empty)") {
        if (stdout.includes('\n') || stdout.length > 100) {
          const stdoutLang = inferLanguageType(undefined, stdout);
          const stdoutLangTag = stdoutLang ? stdoutLang : 'bash';
          outputParts.push(`📋 **标准输出**:\n\`\`\`${stdoutLangTag}\n${stdout}\n\`\`\``);
        } else {
          outputParts.push(`📋 **标准输出**: \`${stdout}\``);
        }
      }
    }
    if (result.stderr) {
      const stderr = String(result.stderr).trim();
      if (stderr && stderr !== "(empty)") {
        if (stderr.includes('\n') || stderr.length > 100) {
          const stderrLang = inferLanguageType(undefined, stderr);
          const stderrLangTag = stderrLang ? stderrLang : '';
          outputParts.push(`❌ **标准错误**:\n\`\`\`${stderrLangTag}\n${stderr}\n\`\`\``);
        } else {
          outputParts.push(`❌ **标准错误**: \`${stderr}\``);
        }
      }
    }
    return outputParts.join('\n\n') || "**无输出** ⚪";
  }
  
  // 其他对象，使用JSON代码块
  if (verbose) {
    return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  } else {
    // 简洁模式：只显示主要字段
    const mainFields = keys.slice(0, 3);
    const otherFields = keys.length - 3;
    let content = "**结果对象**:\n";
    content += mainFields.map(key => `- **${key}**: \`${String(result[key])}\``).join('\n');
    if (otherFields > 0) {
      content += `\n- ... 还有 ${otherFields} 个字段`;
    }
    return content;
  }
};

/**
 * 格式化默认工具类型的结果（处理未分类的工具）
 * @param parsedResult - 已解析的结果（可能是字符串、对象或数组）
 * @returns 格式化后的内容字符串
 */
export const formatDefaultToolResult = (parsedResult: any): string => {
  // 其他工具类型，尝试智能格式化
  if (typeof parsedResult === 'object' && parsedResult !== null) {
    if (parsedResult.stdout || parsedResult.stderr) {
      // 类似Bash命令的输出
      let output = '';
      if (parsedResult.stdout && parsedResult.stdout !== '(empty)') {
        const stdoutLang = inferLanguageType(undefined, parsedResult.stdout);
        const stdoutLangTag = stdoutLang ? stdoutLang : 'bash';
        output += `**标准输出:**\n\`\`\`${stdoutLangTag}\n${parsedResult.stdout}\n\`\`\`\n\n`;
      }
      if (parsedResult.stderr && parsedResult.stderr !== '(empty)') {
        const stderrLang = inferLanguageType(undefined, parsedResult.stderr);
        const stderrLangTag = stderrLang ? stderrLang : '';
        output += `**标准错误:**\n\`\`\`${stderrLangTag}\n${parsedResult.stderr}\n\`\`\``;
      }
      return output || '无输出';
    } else if (parsedResult.message) {
      return parsedResult.message;
    } else {
      return `\`\`\`json\n${JSON.stringify(parsedResult, null, 2)}\n\`\`\``;
    }
  } else if (typeof parsedResult === 'string') {
    const trimmed = parsedResult.trim();
    if (!trimmed) return '无内容';
    // 检查是否包含错误信息
    if (isErrorContent(trimmed)) {
      if (trimmed.includes('\n')) {
        const errorLang = inferLanguageType(undefined, trimmed);
        const errorLangTag = errorLang ? errorLang : '';
        return `❌ **执行错误**\n\`\`\`${errorLangTag}\n${trimmed}\n\`\`\``;
      } else {
        return `❌ **${trimmed}**`;
      }
    }
    // 普通文本内容
    if (trimmed.includes('\n')) {
      const lang = inferLanguageType(undefined, trimmed);
      const langTag = lang ? lang : '';
      return `\`\`\`${langTag}\n${trimmed}\n\`\`\``;
    } else {
      return `\`${trimmed}\``;
    }
  }
  return String(parsedResult);
};

/**
 * 格式化不同工具类型的结果
 * @param name - 工具名称
 * @param toolType - 工具类型
 * @param success - 执行是否成功
 * @param result - 原始结果（可能是字符串、对象或数组）
 * @returns 格式化后的内容字符串
 */
export const formatToolResultByType = (name: string, toolType: string, success: boolean, result: any): string => {
  // 首先尝试解析JSON（向后兼容）
  let parsedResult = result;
  let isJson = false;
  if (typeof result === 'string') {
    try {
      const trimmed = result.trim();
      if (trimmed) {
        // 检查是否看起来像JSON
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          parsedResult = JSON.parse(trimmed);
          isJson = true;
        }
      }
    } catch (e) {
      // 不是有效的JSON，保持为字符串
      parsedResult = result;
    }
  }
  
  // 根据工具类型调用相应的格式化函数
  switch (toolType) {
    case 'filesystem':
      return formatFilesystemResult(name, parsedResult);
    case 'system':
      return formatSystemResult(name, parsedResult);
    case 'github':
      return formatGithubResult(parsedResult);
    case 'web':
      return formatWebFetchResult(parsedResult);
    case 'thinking':
      return formatThinkResult(parsedResult);
    case 'code_analysis':
      return formatCodeAnalysisResult(parsedResult);
    case 'knowledge':
      return formatKnowledgeResult(name, parsedResult);
    case 'search':
      return formatSearchResult(parsedResult);
    case 'task_management':
      return formatTaskManagementResult(name, parsedResult);
    case 'composio':
      return formatComposioResult(name, parsedResult);
    case 'agent_runner':
      return formatAgentRunnerResult(name, parsedResult);
    default:
      return formatDefaultToolResult(parsedResult);
  }
};