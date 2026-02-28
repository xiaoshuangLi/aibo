import { formatToolCallArgs, getToolCallTitle } from '@/presentation/lark/call-formatter';

describe('Tool Call Formatter Comprehensive Tests', () => {
  // Test formatTaskToolCall function
  describe('formatTaskToolCall', () => {
    it('should handle valid task parameters with subagent_type and description', () => {
      const args = {
        subagent_type: 'researcher',
        description: 'Research the latest developments'
      };
      const result = formatToolCallArgs('task', JSON.stringify(args));
      expect(result).toContain('**委派给 researcher 代理**');
      expect(result).toContain('Research the latest developments');
    });

    it('should handle task parameters without subagent_type', () => {
      const args = {
        description: 'Research the latest developments'
      };
      const result = formatToolCallArgs('task', JSON.stringify(args));
      expect(result).toContain('**委派给 未知代理 代理**');
      expect(result).toContain('Research the latest developments');
    });

    it('should handle task parameters without description', () => {
      const args = {
        subagent_type: 'researcher'
      };
      const result = formatToolCallArgs('task', JSON.stringify(args));
      expect(result).toContain('**委派给 researcher 代理**');
      expect(result).toContain('执行复杂任务');
    });

    it('should handle task parameters with additional properties', () => {
      const args = {
        subagent_type: 'researcher',
        description: 'Research the latest developments',
        priority: 'high',
        deadline: '2023-12-31'
      };
      const result = formatToolCallArgs('task', JSON.stringify(args));
      expect(result).toContain('**委派给 researcher 代理**');
      expect(result).toContain('Research the latest developments');
      expect(result).toContain('**其他参数:**');
      expect(result).toContain('priority');
      expect(result).toContain('deadline');
    });

    it('should handle invalid task parameters (non-object)', () => {
      expect(formatToolCallArgs('task', 'invalid string')).toBe('无效的 task 参数');
      expect(formatToolCallArgs('task', 123)).toBe('无效的 task 参数');
      expect(formatToolCallArgs('task', null)).toBe('无效的 task 参数');
      expect(formatToolCallArgs('task', undefined)).toBe('无效的 task 参数');
    });
  });

  // Test formatFilesystemToolCall function
  describe('formatFilesystemToolCall', () => {
    // ls tool tests
    it('should handle ls with string parameter', () => {
      expect(formatToolCallArgs('ls', '/test/path')).toContain('**路径**: `/test/path`');
    });

    it('should handle ls with object parameter containing path', () => {
      expect(formatToolCallArgs('ls', { path: '/custom/path' })).toContain('**路径**: `/custom/path`');
    });

    it('should handle ls with object parameter without path (default to /)', () => {
      expect(formatToolCallArgs('ls', {})).toContain('**路径**: `/`');
    });

    it('should handle ls with non-string/non-object parameter', () => {
      // For non-string/non-object, it should go to default handling
      expect(formatToolCallArgs('ls', 123)).toBe('`123`');
      expect(formatToolCallArgs('ls', true)).toBe('`true`');
    });

    // read_file tool tests
    it('should handle read_file with string parameter', () => {
      expect(formatToolCallArgs('read_file', '/test/file.txt')).toContain('**文件路径**: `/test/file.txt`');
    });

    it('should handle read_file with object parameter', () => {
      expect(formatToolCallArgs('read_file', { file_path: '/test/file.txt' })).toContain('**文件路径**: `/test/file.txt`');
    });

    it('should handle read_file with filePath property instead of file_path', () => {
      expect(formatToolCallArgs('read_file', { filePath: '/test/file.txt' })).toContain('**文件路径**: `/test/file.txt`');
    });

    it('should handle read_file with unknown path', () => {
      expect(formatToolCallArgs('read_file', {})).toContain('**文件路径**: `未知路径`');
    });

    // write_file tool tests
    it('should handle write_file with content preview', () => {
      const result = formatToolCallArgs('write_file', { 
        file_path: '/test/file.ts',
        content: 'console.log("hello");'
      });
      expect(result).toContain('**文件路径**: `/test/file.ts`');
      expect(result).toContain('**内容预览**');
      expect(result).toContain('```typescript');
      expect(result).toContain('console.log("hello");');
    });

    it('should handle write_file without content', () => {
      const result = formatToolCallArgs('write_file', { file_path: '/test/file.txt' });
      expect(result).toContain('**文件路径**: `/test/file.txt`');
      expect(result).not.toContain('**内容预览**');
    });

    // edit_file tool tests
    it('should handle edit_file with old_string and new_string', () => {
      const result = formatToolCallArgs('edit_file', { 
        file_path: '/test/file.ts',
        old_string: 'old code',
        new_string: 'new code'
      });
      expect(result).toContain('**文件路径**: `/test/file.ts`');
      expect(result).toContain('**原内容**');
      expect(result).toContain('**新内容**');
      expect(result).toContain('```typescript');
    });

    it('should handle edit_file with only old_string', () => {
      const result = formatToolCallArgs('edit_file', { 
        file_path: '/test/file.txt',
        old_string: 'old content'
      });
      expect(result).toContain('**文件路径**: `/test/file.txt`');
      expect(result).toContain('**原内容**');
      expect(result).not.toContain('**新内容**');
    });

    it('should handle edit_file with only new_string', () => {
      const result = formatToolCallArgs('edit_file', { 
        file_path: '/test/file.txt',
        new_string: 'new content'
      });
      expect(result).toContain('**文件路径**: `/test/file.txt`');
      expect(result).not.toContain('**原内容**');
      expect(result).toContain('**新内容**');
    });

    // glob tool tests
    it('should handle glob with string parameter', () => {
      expect(formatToolCallArgs('glob', '*.ts')).toContain('**模式**: `*.ts`');
    });

    it('should handle glob with object parameters', () => {
      const result = formatToolCallArgs('glob', { pattern: '*.ts', path: '/src' });
      expect(result).toContain('**模式**: `*.ts`');
      expect(result).toContain('**路径**: `/src`');
    });

    it('should handle glob with default values', () => {
      const result = formatToolCallArgs('glob', {});
      expect(result).toContain('**模式**: `未知模式`');
      expect(result).toContain('**路径**: `/`');
    });

    // grep tool tests
    it('should handle grep with object parameters', () => {
      const result = formatToolCallArgs('grep', { 
        pattern: 'test', 
        path: '/src', 
        glob: '*.ts' 
      });
      expect(result).toContain('**搜索模式**: `test`');
      expect(result).toContain('**路径**: `/src`');
      expect(result).toContain('**文件过滤**: `*.ts`');
    });

    it('should handle grep with default values', () => {
      const result = formatToolCallArgs('grep', {});
      expect(result).toContain('**搜索模式**: `未知模式`');
      expect(result).toContain('**路径**: `/`');
      expect(result).toContain('**文件过滤**: `所有文件`');
    });

    // Default filesystem handling for edge cases
    it('should handle filesystem tool with empty string', () => {
      // Empty string is treated as a path
      expect(formatToolCallArgs('ls', '')).toContain('**路径**: ``');
      expect(formatToolCallArgs('ls', '   ')).toContain('**路径**: `   `');
    });

    it('should handle filesystem tool with multi-line string', () => {
      // Multi-line string is treated as a path
      const result = formatToolCallArgs('ls', 'line1\nline2');
      expect(result).toContain('**路径**: `line1');
      expect(result).toContain('line2`');
    });

    it('should handle filesystem tool with single-line string', () => {
      // Single-line string is treated as a path
      expect(formatToolCallArgs('ls', 'single line')).toContain('**路径**: `single line`');
    });
  });

  // Test formatSystemToolCall function
  describe('formatSystemToolCall', () => {
    // execute_bash tests
    it('should handle execute_bash with string parameter', () => {
      expect(formatToolCallArgs('execute_bash', 'ls -la')).toContain('**命令**: `ls -la`');
    });

    it('should handle execute_bash with object parameters', () => {
      const result = formatToolCallArgs('execute_bash', { 
        command: 'ls -la', 
        timeout: 5000, 
        cwd: '/home' 
      });
      expect(result).toContain('**命令**: `ls -la`');
      expect(result).toContain('**超时**: 5000ms');
      expect(result).toContain('**工作目录**: `/home`');
    });

    it('should handle execute_bash with default values', () => {
      const result = formatToolCallArgs('execute_bash', {});
      expect(result).toContain('**命令**: `未知命令`');
      expect(result).toContain('**超时**: 30000ms');
      expect(result).toContain('**工作目录**: `当前目录`');
    });

    // sleep tests
    it('should handle sleep with number parameter', () => {
      expect(formatToolCallArgs('sleep', 1000)).toContain('**时长**: 1000 毫秒');
    });

    it('should handle sleep with object parameter', () => {
      expect(formatToolCallArgs('sleep', { duration: 2000 })).toContain('**时长**: 2000 毫秒');
    });

    it('should handle sleep with default duration', () => {
      expect(formatToolCallArgs('sleep', {})).toContain('**时长**: 0 毫秒');
    });

    // echo tests
    it('should handle echo with string parameter', () => {
      expect(formatToolCallArgs('echo', 'Hello World')).toContain('**消息**: `Hello World`');
    });

    it('should handle echo with object parameter', () => {
      expect(formatToolCallArgs('echo', { message: 'Test Message' })).toContain('**消息**: `Test Message`');
    });

    it('should handle echo with default message', () => {
      expect(formatToolCallArgs('echo', {})).toContain('**消息**: `无消息`');
    });

    // Default system handling for edge cases
    it('should handle system tool with empty string', () => {
      // Empty string is treated as a command
      expect(formatToolCallArgs('execute_bash', '')).toContain('**命令**: ``');
    });

    it('should handle system tool with multi-line string', () => {
      // Multi-line string is treated as a command
      const result = formatToolCallArgs('execute_bash', 'line1\nline2');
      expect(result).toContain('**命令**: `line1');
      expect(result).toContain('line2`');
    });
  });

  // Test formatDefaultToolCall function
  describe('formatDefaultToolCall', () => {
    it('should handle null/undefined parameters', () => {
      expect(formatToolCallArgs('unknown_tool', null)).toBe('无参数');
      expect(formatToolCallArgs('unknown_tool', undefined)).toBe('无参数');
    });

    it('should handle empty string parameters', () => {
      expect(formatToolCallArgs('unknown_tool', '')).toBe('空参数');
      expect(formatToolCallArgs('unknown_tool', '   ')).toBe('空参数');
    });

    it('should handle valid JSON string parameters', () => {
      const result = formatToolCallArgs('unknown_tool', '{"key": "value"}');
      expect(result).toContain('```json');
      expect(result).toContain('"key": "value"');
    });

    it('should handle invalid JSON string parameters', () => {
      expect(formatToolCallArgs('unknown_tool', 'invalid json')).toBe('`invalid json`');
    });

    it('should handle multi-line non-JSON string parameters', () => {
      const result = formatToolCallArgs('unknown_tool', 'line1\nline2');
      expect(result).toContain('```');
      expect(result).toContain('line1');
      expect(result).toContain('line2');
    });

    it('should handle single-line string parameters', () => {
      expect(formatToolCallArgs('unknown_tool', 'single line')).toBe('`single line`');
    });

    it('should handle object parameters', () => {
      const result = formatToolCallArgs('unknown_tool', { key: 'value' });
      expect(result).toContain('```json');
      expect(result).toContain('"key": "value"');
    });

    it('should handle other primitive types', () => {
      expect(formatToolCallArgs('unknown_tool', 123)).toBe('`123`');
      expect(formatToolCallArgs('unknown_tool', true)).toBe('`true`');
      expect(formatToolCallArgs('unknown_tool', false)).toBe('`false`');
    });
  });

  // Test main formatToolCallArgs function routing
  describe('formatToolCallArgs routing', () => {
    it('should route task_management tools correctly', () => {
      expect(formatToolCallArgs('task', '{}')).toContain('委派给');
      expect(formatToolCallArgs('write_todos', '{}')).toContain('```json');
      expect(formatToolCallArgs('write-subagent-todos', '{}')).toContain('```json');
    });

    it('should route filesystem tools correctly', () => {
      const filesystemTools = ['ls', 'read_file', 'write_file', 'edit_file', 'glob', 'grep'];
      filesystemTools.forEach(tool => {
        expect(formatToolCallArgs(tool, '{}')).not.toBe('```json\n{}\n```');
      });
    });

    it('should route system tools correctly', () => {
      const systemTools = ['execute_bash', 'sleep', 'echo'];
      systemTools.forEach(tool => {
        expect(formatToolCallArgs(tool, '{}')).not.toBe('```json\n{}\n```');
      });
    });

    it('should route github tools to default', () => {
      expect(formatToolCallArgs('WebFetchFromGithub', '{}')).toContain('```json');
    });

    it('should route code_analysis tools to default', () => {
      expect(formatToolCallArgs('hybrid_code_reader', '{}')).toContain('```json');
    });

    it('should route knowledge tools to default', () => {
      const knowledgeTools = ['add_knowledge', 'get_knowledge_summaries', 'search_knowledge'];
      knowledgeTools.forEach(tool => {
        expect(formatToolCallArgs(tool, '{}')).toContain('```json');
      });
    });

    it('should route search tools to default', () => {
      expect(formatToolCallArgs('TencentWsaSearch', '{}')).toContain('```json');
    });

    it('should route composio tools to default', () => {
      expect(formatToolCallArgs('COMPOSIO_SEARCH_TOOLS', '{}')).toContain('```json');
    });

    it('should route other tools to default', () => {
      expect(formatToolCallArgs('unknown_tool', '{}')).toContain('```json');
    });

    it('should handle JSON parsing in main function', () => {
      // String that can be parsed as JSON
      const result1 = formatToolCallArgs('task', '{"subagent_type": "test"}');
      expect(result1).toContain('委派给 test 代理');

      // String that cannot be parsed as JSON
      const result2 = formatToolCallArgs('task', 'invalid json string');
      expect(result2).toBe('无效的 task 参数');
    });

    it('should handle direct object parameters without JSON parsing', () => {
      // When passing object directly (not as JSON string)
      const result = formatToolCallArgs('task', { subagent_type: 'test' });
      expect(result).toContain('委派给 test 代理');
    });
  });

  // Test getToolCallTitle function
  describe('getToolCallTitle', () => {
    it('should return special title for task with subagent_type', () => {
      const title = getToolCallTitle('task', { subagent_type: 'researcher' });
      expect(title).toBe('🧠 委派任务给 researcher 代理');
    });

    it('should return default title for task without subagent_type', () => {
      const title = getToolCallTitle('task', {});
      expect(title).toBe('📋 工具调用: task');
    });

    it('should return correct emoji for filesystem tools', () => {
      expect(getToolCallTitle('ls', {})).toBe('📁 工具调用: ls');
      expect(getToolCallTitle('read_file', {})).toBe('📁 工具调用: read_file');
    });

    it('should return correct emoji for system tools', () => {
      expect(getToolCallTitle('execute_bash', {})).toBe('💻 工具调用: execute_bash');
      expect(getToolCallTitle('sleep', {})).toBe('💻 工具调用: sleep');
    });

    it('should return correct emoji for github tools', () => {
      expect(getToolCallTitle('WebFetchFromGithub', {})).toBe('🐧 工具调用: WebFetchFromGithub');
    });

    it('should return correct emoji for code_analysis tools', () => {
      expect(getToolCallTitle('hybrid_code_reader', {})).toBe('🔍 工具调用: hybrid_code_reader');
    });

    it('should return correct emoji for knowledge tools', () => {
      expect(getToolCallTitle('add_knowledge', {})).toBe('📚 工具调用: add_knowledge');
    });

    it('should return correct emoji for search tools', () => {
      expect(getToolCallTitle('TencentWsaSearch', {})).toBe('🌐 工具调用: TencentWsaSearch');
    });

    it('should return correct emoji for task_management tools', () => {
      expect(getToolCallTitle('write_todos', {})).toBe('📋 工具调用: write_todos');
    });

    it('should return correct emoji for composio tools', () => {
      expect(getToolCallTitle('COMPOSIO_SEARCH_TOOLS', {})).toBe('🔌 工具调用: COMPOSIO_SEARCH_TOOLS');
    });

    it('should return default emoji for unknown tools', () => {
      expect(getToolCallTitle('unknown_tool', {})).toBe('🔧 工具调用: unknown_tool');
    });

    it('should return correct emoji for web_fetch tool', () => {
      expect(getToolCallTitle('web_fetch', {})).toBe('🔗 工具调用: web_fetch');
    });

    it('should return correct emoji for think tool', () => {
      expect(getToolCallTitle('think', {})).toBe('💭 工具调用: think');
    });

    it('should return correct emoji for view_file tool', () => {
      expect(getToolCallTitle('view_file', {})).toBe('📁 工具调用: view_file');
    });

    it('should return correct emoji for glob_files tool', () => {
      expect(getToolCallTitle('glob_files', {})).toBe('📁 工具调用: glob_files');
    });

    it('should return correct emoji for grep_files tool', () => {
      expect(getToolCallTitle('grep_files', {})).toBe('📁 工具调用: grep_files');
    });
  });

  // ─── Tests for new tool names ────────────────────────────────────────────────

  describe('view_file tool call formatting', () => {
    it('should format view_file with just file_path', () => {
      const result = formatToolCallArgs('view_file', { file_path: '/src/index.ts' });
      expect(result).toContain('**文件路径**: `/src/index.ts`');
    });

    it('should format view_file with line range', () => {
      const result = formatToolCallArgs('view_file', { file_path: '/src/index.ts', start_line: 10, end_line: 50 });
      expect(result).toContain('**文件路径**: `/src/index.ts`');
      expect(result).toContain('第 10 – 50 行');
    });
  });

  describe('glob_files tool call formatting', () => {
    it('should format glob_files with pattern and cwd', () => {
      const result = formatToolCallArgs('glob_files', { pattern: '**/*.ts', cwd: '/src' });
      expect(result).toContain('**模式**: `**/*.ts`');
      expect(result).toContain('**路径**: `/src`');
    });

    it('should format glob_files with pattern only', () => {
      const result = formatToolCallArgs('glob_files', { pattern: '*.json' });
      expect(result).toContain('**模式**: `*.json`');
    });
  });

  describe('grep_files tool call formatting', () => {
    it('should format grep_files with all parameters', () => {
      const result = formatToolCallArgs('grep_files', { 
        pattern: 'export const', 
        include: '**/*.ts',
        cwd: '/src',
        case_insensitive: true
      });
      expect(result).toContain('**搜索模式**: `export const`');
      expect(result).toContain('**文件过滤**: `**/*.ts`');
      expect(result).toContain('**大小写**: 不敏感');
    });

    it('should format grep_files with pattern only', () => {
      const result = formatToolCallArgs('grep_files', { pattern: 'TODO' });
      expect(result).toContain('**搜索模式**: `TODO`');
    });
  });

  describe('web_fetch tool call formatting', () => {
    it('should format web_fetch with url only', () => {
      const result = formatToolCallArgs('web_fetch', { url: 'https://example.com' });
      expect(result).toContain('**URL**: `https://example.com`');
    });

    it('should format web_fetch with url and timeout', () => {
      const result = formatToolCallArgs('web_fetch', { url: 'https://example.com', timeout: 5000 });
      expect(result).toContain('**URL**: `https://example.com`');
      expect(result).toContain('**超时**: 5000ms');
    });
  });

  describe('think tool call formatting', () => {
    it('should format think with short reasoning', () => {
      const result = formatToolCallArgs('think', { reasoning: 'I need to analyze this.' });
      expect(result).toContain('💭 **推理过程**');
      expect(result).toContain('I need to analyze this.');
    });

    it('should truncate think reasoning longer than 5 lines', () => {
      const reasoning = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result = formatToolCallArgs('think', { reasoning });
      expect(result).toContain('💭 **推理过程**');
      expect(result).toContain('共 10 行');
    });
  });
});