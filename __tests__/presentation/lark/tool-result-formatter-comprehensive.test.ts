import { formatToolResultByType, getToolType } from '@/presentation/lark/tool-result-formatter';

describe('Tool Result Formatter - Comprehensive Coverage', () => {
  describe('Filesystem Tools', () => {
    // Test ls with string input (path starting with /)
    it('should format ls result with string input starting with /', () => {
      const result = formatToolResultByType('ls', 'filesystem', true, '/file1.txt\n/file2.txt\n');
      expect(result).toContain('- `/file1.txt`');
      expect(result).toContain('- `/file2.txt`');
    });

    // Test ls with string input (not starting with /)
    it('should format ls result with string input not starting with /', () => {
      const result = formatToolResultByType('ls', 'filesystem', true, 'file1.txt\nfile2.txt\n');
      expect(result).toContain('```');
      expect(result).toContain('file1.txt');
    });

    // Test ls with empty string
    it('should handle empty ls result', () => {
      const result = formatToolResultByType('ls', 'filesystem', true, '');
      expect(result).toBe('无内容');
    });

    // Test grep with string input
    it('should format grep result with string input', () => {
      const result = formatToolResultByType('grep', 'filesystem', true, 'match1\nmatch2\nmatch3\n');
      expect(result).toContain('找到 3 个匹配项');
      expect(result).toContain('- match1');
    });

    // Test grep with empty string
    it('should handle empty grep result', () => {
      const result = formatToolResultByType('grep', 'filesystem', true, '');
      expect(result).toBe('无内容');
    });

    // Test read_file with string input
    it('should format read_file result with string input', () => {
      const content = 'line1\nline2\nline3';
      const result = formatToolResultByType('read_file', 'filesystem', true, content);
      expect(result).toContain('**文件内容:** 3 行');
      expect(result).toContain('```');
    });

    // Test glob with string input
    it('should format glob result with string input', () => {
      const result = formatToolResultByType('glob', 'filesystem', true, 'file1.ts\nfile2.ts\n');
      expect(result).toContain('找到 2 个匹配文件');
      expect(result).toContain('- `file1.ts`');
    });

    // Test write_file with success object
    it('should format write_file success result', () => {
      const result = formatToolResultByType('write_file', 'filesystem', true, { success: true, file_path: '/test.txt' });
      expect(result).toContain('✅ 文件操作成功');
      expect(result).toContain('**路径:** `/test.txt`');
    });

    // Test write_file with failure object
    it('should format write_file failure result', () => {
      const result = formatToolResultByType('write_file', 'filesystem', false, { success: false, error: 'Permission denied' });
      expect(result).toContain('❌ 文件操作失败');
    });

    // Test edit_file with success object
    it('should format edit_file success result', () => {
      const result = formatToolResultByType('edit_file', 'filesystem', true, { success: true, filePath: '/test.txt' });
      expect(result).toContain('✅ 文件操作成功');
      expect(result).toContain('**路径:** `/test.txt`');
    });

    // Test ls with array input
    it('should format ls result with array input', () => {
      const result = formatToolResultByType('ls', 'filesystem', true, ['file1.txt', 'file2.txt']);
      expect(result).toContain('- file1.txt');
      expect(result).toContain('- file2.txt');
    });

    // Test read_file with object input
    it('should format read_file result with object input', () => {
      const result = formatToolResultByType('read_file', 'filesystem', true, { content: 'line1\nline2' });
      expect(result).toContain('**文件信息:** 2 行');
    });

    // Test glob with array input
    it('should format glob result with array input', () => {
      const result = formatToolResultByType('glob', 'filesystem', true, ['file1.ts', 'file2.ts']);
      expect(result).toContain('找到 2 个匹配文件');
    });

    // Test grep with array input
    it('should format grep result with array input', () => {
      const result = formatToolResultByType('grep', 'filesystem', true, ['match1', 'match2']);
      expect(result).toContain('找到 2 个匹配项');
    });
  });

  describe('System/Bash Tools', () => {
    // Test execute_bash with string input
    it('should format execute_bash result with string input', () => {
      const result = formatToolResultByType('execute_bash', 'system', true, 'output line 1\noutput line 2');
      expect(result).toContain('**标准输出:**');
      expect(result).toContain('```');
    });

    // Test execute_bash with object input (stdout only)
    it('should format execute_bash result with stdout only', () => {
      const result = formatToolResultByType('execute_bash', 'system', true, { stdout: 'hello world', stderr: '(empty)' });
      expect(result).toContain('**标准输出:**');
      expect(result).toContain('hello world');
    });

    // Test execute_bash with object input (stderr only)
    it('should format execute_bash result with stderr only', () => {
      const result = formatToolResultByType('execute_bash', 'system', false, { stdout: '(empty)', stderr: 'error message' });
      expect(result).toContain('**标准错误:**');
      expect(result).toContain('error message');
    });

    // Test execute_bash with object input (both stdout and stderr)
    it('should format execute_bash result with both stdout and stderr', () => {
      const result = formatToolResultByType('execute_bash', 'system', true, { 
        command: 'ls -la', 
        stdout: 'file1.txt', 
        stderr: 'warning message' 
      });
      expect(result).toContain('**命令:** `ls -la`');
      expect(result).toContain('**标准输出:**');
      expect(result).toContain('**标准错误:**');
    });

    // Test echo with string input
    it('should format echo result with string input', () => {
      const result = formatToolResultByType('echo', 'system', true, 'hello world');
      expect(result).toContain('💬 回显内容:');
      expect(result).toContain('hello world');
    });

    // Test echo with object input
    it('should format echo result with object input', () => {
      const result = formatToolResultByType('echo', 'system', true, { echoed: 'hello world' });
      expect(result).toContain('💬 回显内容:');
      expect(result).toContain('hello world');
    });

    // Test sleep with string input
    it('should format sleep result with string input', () => {
      const result = formatToolResultByType('sleep', 'system', true, '1000');
      expect(result).toContain('⏱️ 延迟执行完成');
      expect(result).toContain('**时长:** 1000 毫秒');
    });

    // Test sleep with object input
    it('should format sleep result with object input', () => {
      const result = formatToolResultByType('sleep', 'system', true, { duration: 2000 });
      expect(result).toContain('⏱️ 延迟执行完成');
      expect(result).toContain('**时长:** 2000 毫秒');
    });
  });

  describe('GitHub Tools', () => {
    // Test WebFetchFromGithub with content
    it('should format github result with content', () => {
      const result = formatToolResultByType('WebFetchFromGithub', 'github', true, { content: 'github file content\nline2' });
      expect(result).toContain('🐙 **GitHub文件内容**');
      expect(result).toContain('**行数:** 2');
    });

    // Test WebFetchFromGithub without content
    it('should format github result without content', () => {
      const result = formatToolResultByType('WebFetchFromGithub', 'github', false, { error: 'Not found' });
      expect(result).toContain('```');
      expect(result).toContain('"error": "Not found"');
    });
  });

  describe('Code Analysis Tools', () => {
    // Test hybrid_code_reader with implementation
    it('should format code analysis result with implementation', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, { implementation: 'function test() {}' });
      expect(result).toContain('🔍 **代码分析结果**');
      expect(result).toContain('```typescript');
    });

    // Test hybrid_code_reader with definition
    it('should format code analysis result with definition', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, { definition: 'interface Test {}' });
      expect(result).toContain('🔍 **代码分析结果**');
    });

    // Test hybrid_code_reader with references
    it('should format code analysis result with references', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, { references: 'const test = 1;' });
      expect(result).toContain('🔍 **代码分析结果**');
    });

    // Test hybrid_code_reader without any content
    it('should format code analysis result without content', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', false, { error: 'Not found' });
      expect(result).toContain('```');
      expect(result).toContain('"error": "Not found"');
    });
  });

  describe('Knowledge Tools', () => {
    // Test add_knowledge success
    it('should format add_knowledge success result', () => {
      const result = formatToolResultByType('add_knowledge', 'knowledge', true, { 
        success: true, 
        title: 'Test Knowledge', 
        keywords: ['test', 'knowledge'] 
      });
      expect(result).toContain('📚 **知识添加成功**');
      expect(result).toContain('**标题:** Test Knowledge');
      expect(result).toContain('**关键词:** test, knowledge');
    });

    // Test add_knowledge failure
    it('should format add_knowledge failure result', () => {
      const result = formatToolResultByType('add_knowledge', 'knowledge', false, { 
        success: false, 
        error: 'Invalid content' 
      });
      expect(result).toContain('❌ 知识添加失败');
    });

    // Test get_knowledge_summaries with array
    it('should format get_knowledge_summaries with array', () => {
      const result = formatToolResultByType('get_knowledge_summaries', 'knowledge', true, [
        { title: 'Knowledge 1', keywords: ['k1', 'k2'] },
        { title: 'Knowledge 2', keywords: ['k3'] }
      ]);
      expect(result).toContain('📚 **知识库摘要 (2 项)**');
      expect(result).toContain('- **Knowledge 1** [k1, k2]');
    });

    // Test get_knowledge_summaries with empty array
    it('should format get_knowledge_summaries with empty array', () => {
      const result = formatToolResultByType('get_knowledge_summaries', 'knowledge', true, []);
      expect(result).toBe('知识库为空');
    });

    // Test search_knowledge with results
    it('should format search_knowledge with results', () => {
      const result = formatToolResultByType('search_knowledge', 'knowledge', true, [
        { title: 'Search Result 1', content: 'content 1' },
        { title: 'Search Result 2', content: 'content 2' }
      ]);
      expect(result).toContain('📚 **知识搜索结果 (2 项)**');
      expect(result).toContain('- **Search Result 1**');
    });

    // Test search_knowledge with empty results
    it('should format search_knowledge with empty results', () => {
      const result = formatToolResultByType('search_knowledge', 'knowledge', true, []);
      expect(result).toBe('未找到匹配的知识');
    });
  });

  describe('Search Tools', () => {
    // Test TencentWsaSearch with results
    it('should format search result with results', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, {
        success: true,
        results: [
          { title: 'Result 1', url: 'http://example.com', snippet: 'snippet 1' },
          { title: 'Result 2', url: 'http://example2.com', snippet: 'snippet 2' }
        ]
      });
      expect(result).toContain('🌐 **网络搜索结果 (2 项)**');
      expect(result).toContain('**[Result 1](http://example.com)**');
    });

    // Test TencentWsaSearch with empty results
    it('should format search result with empty results', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, {
        success: true,
        results: []
      });
      expect(result).toBe('未找到搜索结果');
    });

    // Test TencentWsaSearch with error
    it('should format search result with error', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', false, {
        error: 'Search failed'
      });
      expect(result).toBe('未找到搜索结果');
    });
  });

  describe('Other Tools', () => {
    // Test unknown tool type
    it('should format unknown tool type with generic JSON', () => {
      const result = formatToolResultByType('unknown_tool', 'other', true, { data: 'test' });
      expect(result).toContain('```');
      expect(result).toContain('"data": "test"');
    });

    // Test null/undefined result
    it('should handle null result', () => {
      const result = formatToolResultByType('ls', 'filesystem', true, null as any);
      expect(result).toContain('```');
      expect(result).toContain('null');
    });

    // Test empty object result
    it('should handle empty object result', () => {
      const result = formatToolResultByType('ls', 'filesystem', true, {});
      expect(result).toContain('```');
      expect(result).toContain('{}');
    });
  });

  describe('getToolType function', () => {
    it('should return filesystem for file system tools', () => {
      expect(getToolType('ls')).toBe('filesystem');
      expect(getToolType('read_file')).toBe('filesystem');
      expect(getToolType('write_file')).toBe('filesystem');
      expect(getToolType('edit_file')).toBe('filesystem');
      expect(getToolType('glob')).toBe('filesystem');
      expect(getToolType('grep')).toBe('filesystem');
    });

    it('should return system for bash tools', () => {
      expect(getToolType('execute_bash')).toBe('system');
      expect(getToolType('sleep')).toBe('system');
      expect(getToolType('echo')).toBe('system');
    });

    it('should return github for github tool', () => {
      expect(getToolType('WebFetchFromGithub')).toBe('github');
    });

    it('should return code_analysis for code reader', () => {
      expect(getToolType('hybrid_code_reader')).toBe('code_analysis');
    });

    it('should return knowledge for knowledge tools', () => {
      expect(getToolType('add_knowledge')).toBe('knowledge');
      expect(getToolType('get_knowledge_summaries')).toBe('knowledge');
      expect(getToolType('search_knowledge')).toBe('knowledge');
    });

    it('should return search for search tool', () => {
      expect(getToolType('TencentWsaSearch')).toBe('search');
    });

    it('should return task_management for todo tools', () => {
      expect(getToolType('write_todos')).toBe('task_management');
      expect(getToolType('write-subagent-todos')).toBe('task_management');
      expect(getToolType('task')).toBe('task_management');
    });

    it('should return composio for composio tools', () => {
      expect(getToolType('COMPOSIO_SEARCH_TOOLS')).toBe('composio');
    });

    it('should return other for unknown tools', () => {
      expect(getToolType('unknown_tool')).toBe('other');
    });
  });
});