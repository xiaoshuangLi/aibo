import { 
  getToolType, 
  formatToolResultByType,
  formatStructuredResult,
  formatWebFetchResult,
  formatThinkResult,
  formatTaskManagementResult
} from '@/presentation/lark/result-formatter';

describe('Tool Result Formatter - Comprehensive Tests', () => {
  
  describe('getToolType', () => {
    it('should return filesystem for ls', () => {
      expect(getToolType('ls')).toBe('filesystem');
    });

    it('should return filesystem for read_file', () => {
      expect(getToolType('read_file')).toBe('filesystem');
    });

    it('should return filesystem for write_file', () => {
      expect(getToolType('write_file')).toBe('filesystem');
    });

    it('should return filesystem for edit_file', () => {
      expect(getToolType('edit_file')).toBe('filesystem');
    });

    it('should return filesystem for glob', () => {
      expect(getToolType('glob')).toBe('filesystem');
    });

    it('should return filesystem for grep', () => {
      expect(getToolType('grep')).toBe('filesystem');
    });

    it('should return system for execute_bash', () => {
      expect(getToolType('execute_bash')).toBe('system');
    });

    it('should return system for sleep', () => {
      expect(getToolType('sleep')).toBe('system');
    });

    it('should return system for echo', () => {
      expect(getToolType('echo')).toBe('system');
    });

    it('should return github for WebFetchFromGithub', () => {
      expect(getToolType('WebFetchFromGithub')).toBe('github');
    });

    it('should return code_analysis for hybrid_code_reader', () => {
      expect(getToolType('hybrid_code_reader')).toBe('code_analysis');
    });

    it('should return knowledge for add_knowledge', () => {
      expect(getToolType('add_knowledge')).toBe('knowledge');
    });

    it('should return knowledge for get_knowledge_summaries', () => {
      expect(getToolType('get_knowledge_summaries')).toBe('knowledge');
    });

    it('should return knowledge for search_knowledge', () => {
      expect(getToolType('search_knowledge')).toBe('knowledge');
    });

    it('should return search for TencentWsaSearch', () => {
      expect(getToolType('TencentWsaSearch')).toBe('search');
    });

    it('should return task_management for write-subagent-todos', () => {
      expect(getToolType('write-subagent-todos')).toBe('task_management');
    });

    it('should return task_management for write_todos', () => {
      expect(getToolType('write_todos')).toBe('task_management');
    });

    it('should return task_management for task', () => {
      expect(getToolType('task')).toBe('task_management');
    });

    it('should return composio for COMPOSIO_ tools', () => {
      expect(getToolType('COMPOSIO_GMAIL_SEND_EMAIL')).toBe('composio');
    });

    it('should return other for unknown tools', () => {
      expect(getToolType('unknown_tool')).toBe('other');
    });
  });

  describe('formatToolResultByType - Filesystem Tools', () => {
    describe('ls tool', () => {
      it('should format string ls result with file list', () => {
        const result = formatToolResultByType('ls', 'filesystem', true, '/file1.txt\n/file2.txt\n/dir1');
        expect(result).toContain('- `/file1.txt`');
        expect(result).toContain('- `/file2.txt`');
        expect(result).toContain('- `/dir1`');
      });

      it('should handle empty ls string result', () => {
        const result = formatToolResultByType('ls', 'filesystem', true, '');
        expect(result).toBe('无内容');
      });

      it('should handle ls string result starting with /', () => {
        const result = formatToolResultByType('ls', 'filesystem', true, '/test/path');
        expect(result).toContain('- `/test/path`');
      });

      it('should format array ls result', () => {
        const result = formatToolResultByType('ls', 'filesystem', true, ['file1.txt', 'file2.txt']);
        expect(result).toContain('- file1.txt');
        expect(result).toContain('- file2.txt');
      });

      it('should handle empty array ls result', () => {
        const result = formatToolResultByType('ls', 'filesystem', true, []);
        expect(result).toBe('目录为空');
      });

      it('should format non-array/object ls result as JSON', () => {
        const result = formatToolResultByType('ls', 'filesystem', true, { files: ['file1.txt'] });
        expect(result).toContain('```json');
        expect(result).toContain('"files"');
      });
    });

    describe('read_file tool', () => {
      it('should format string read_file result', () => {
        const content = 'console.log("hello");\nconst x = 1;';
        const result = formatToolResultByType('read_file', 'filesystem', true, content);
        expect(result).toContain('**文件内容:**');
        expect(result).toContain('2 行');
        expect(result).toContain('console.log("hello");');
      });

      it('should handle empty read_file string result', () => {
        const result = formatToolResultByType('read_file', 'filesystem', true, '');
        expect(result).toBe('无内容');
      });

      it('should format object read_file result with content', () => {
        const result = formatToolResultByType('read_file', 'filesystem', true, { 
          content: 'test content', 
          file_path: '/test/file.js' 
        });
        expect(result).toContain('**文件信息:**');
        expect(result).toContain('1 行');
        expect(result).toContain('test content');
      });

      it('should handle read_file object without content', () => {
        const result = formatToolResultByType('read_file', 'filesystem', true, { error: 'not found' });
        expect(result).toContain('```json');
        expect(result).toContain('"error": "not found"');
      });

      it('should handle read_file object with non-string content', () => {
        // Test with number content
        let result = formatToolResultByType('read_file', 'filesystem', true, { 
          content: 12345, 
          file_path: '/test/file.js' 
        });
        expect(result).toContain('**文件信息:**');
        expect(result).toContain('1 行');
        expect(result).toContain('12345');

        // Test with boolean content
        result = formatToolResultByType('read_file', 'filesystem', true, { 
          content: true, 
          file_path: '/test/file.js' 
        });
        expect(result).toContain('**文件信息:**');
        expect(result).toContain('1 行');
        expect(result).toContain('true');

        // Test with null content
        result = formatToolResultByType('read_file', 'filesystem', true, { 
          content: null, 
          file_path: '/test/file.js' 
        });
        expect(result).toContain('**文件信息:**');
        expect(result).toContain('1 行');
        expect(result).toContain('null');

        // Test with array content
        result = formatToolResultByType('read_file', 'filesystem', true, { 
          content: [1, 2, 3], 
          file_path: '/test/file.js' 
        });
        expect(result).toContain('**文件信息:**');
        expect(result).toContain('1 行');
        expect(result).toContain('1,2,3');
      });
    });

    describe('write_file/edit_file tools', () => {
      it('should format successful write_file result', () => {
        const result = formatToolResultByType('write_file', 'filesystem', true, { 
          success: true, 
          file_path: '/test/file.txt' 
        });
        expect(result).toContain('✅ 文件操作成功');
        expect(result).toContain('**路径:** `/test/file.txt`');
      });

      it('should format failed write_file result', () => {
        const result = formatToolResultByType('write_file', 'filesystem', false, { 
          success: false, 
          error: 'permission denied' 
        });
        expect(result).toContain('❌ 文件操作失败');
        expect(result).toContain('"error": "permission denied"');
      });

      it('should format successful edit_file result', () => {
        const result = formatToolResultByType('edit_file', 'filesystem', true, { 
          success: true, 
          filePath: '/test/file.txt' 
        });
        expect(result).toContain('✅ 文件操作成功');
        expect(result).toContain('**路径:** `/test/file.txt`');
      });
    });

    describe('glob tool', () => {
      it('should format string glob result', () => {
        const result = formatToolResultByType('glob', 'filesystem', true, '/file1.txt\n/file2.js');
        expect(result).toContain('找到 2 个匹配文件:');
        expect(result).toContain('- `/file1.txt`');
        expect(result).toContain('- `/file2.js`');
      });

      it('should handle empty glob string result', () => {
        const result = formatToolResultByType('glob', 'filesystem', true, '');
        expect(result).toBe('无内容');
      });

      it('should format array glob result', () => {
        const result = formatToolResultByType('glob', 'filesystem', true, ['/file1.txt', '/file2.js']);
        expect(result).toContain('找到 2 个匹配文件:');
        expect(result).toContain('- `/file1.txt`');
        expect(result).toContain('- `/file2.js`');
      });

      it('should handle empty array glob result', () => {
        const result = formatToolResultByType('glob', 'filesystem', true, []);
        expect(result).toBe('未找到匹配文件');
      });
    });

    describe('grep tool', () => {
      it('should format string grep result', () => {
        const result = formatToolResultByType('grep', 'filesystem', true, 'match1\nmatch2');
        expect(result).toContain('找到 2 个匹配项:');
        expect(result).toContain('🔹 match1');
        expect(result).toContain('🔹 match2');
      });

      it('should handle empty grep string result', () => {
        const result = formatToolResultByType('grep', 'filesystem', true, '');
        expect(result).toBe('无内容');
      });

      it('should format array grep result', () => {
        const result = formatToolResultByType('grep', 'filesystem', true, ['match1', 'match2']);
        expect(result).toContain('找到 2 个匹配项:');
        expect(result).toContain('- match1');
        expect(result).toContain('- match2');
      });

      it('should handle empty array grep result', () => {
        const result = formatToolResultByType('grep', 'filesystem', true, []);
        expect(result).toBe('未找到匹配内容');
      });
    });
  });

  describe('formatToolResultByType - System Tools', () => {
    describe('execute_bash tool', () => {
      it('should format string execute_bash result', () => {
        const result = formatToolResultByType('execute_bash', 'system', true, 'output line 1\noutput line 2');
        expect(result).toContain('**标准输出:**');
        expect(result).toContain('output line 1');
      });

      it('should handle empty execute_bash string result', () => {
        const result = formatToolResultByType('execute_bash', 'system', true, '');
        expect(result).toBe('无输出');
      });

      it('should format object execute_bash result with stdout', () => {
        const result = formatToolResultByType('execute_bash', 'system', true, { 
          stdout: 'command output', 
          command: 'ls -la' 
        });
        expect(result).toContain('**命令:** `ls -la`');
        expect(result).toContain('**标准输出:**');
        expect(result).toContain('command output');
      });

      it('should format object execute_bash result with stderr', () => {
        const result = formatToolResultByType('execute_bash', 'system', false, { 
          stderr: 'error message', 
          command: 'invalid command' 
        });
        expect(result).toContain('**命令:** `invalid command`');
        expect(result).toContain('**标准错误:**');
        expect(result).toContain('error message');
      });

      it('should handle execute_bash with empty stdout/stderr', () => {
        const result = formatToolResultByType('execute_bash', 'system', true, { 
          stdout: '(empty)', 
          stderr: '(empty)' 
        });
        expect(result).toBe('无输出');
      });
    });

    describe('sleep tool', () => {
      it('should format string sleep result', () => {
        const result = formatToolResultByType('sleep', 'system', true, '1000');
        expect(result).toContain('⏱️ 延迟执行完成');
        expect(result).toContain('**时长:** 1000 毫秒');
      });

      it('should format object sleep result', () => {
        const result = formatToolResultByType('sleep', 'system', true, { duration: 2000 });
        expect(result).toContain('⏱️ 延迟执行完成');
        expect(result).toContain('**时长:** 2000 毫秒');
      });

      it('should handle sleep object with message', () => {
        const result = formatToolResultByType('sleep', 'system', true, { message: 'Slept for 3000ms' });
        expect(result).toContain('⏱️ 延迟执行完成');
        expect(result).toContain('**时长:** 3000 毫秒');
      });
    });

    describe('echo tool', () => {
      it('should format string echo result', () => {
        const result = formatToolResultByType('echo', 'system', true, 'hello world');
        expect(result).toContain('💬 回显内容:');
        expect(result).toContain('hello world');
      });

      it('should format object echo result with echoed field', () => {
        const result = formatToolResultByType('echo', 'system', true, { echoed: 'test message' });
        expect(result).toContain('💬 回显内容:');
        expect(result).toContain('test message');
      });

      it('should format object echo result with message field', () => {
        const result = formatToolResultByType('echo', 'system', true, { message: 'another message' });
        expect(result).toContain('💬 回显内容:');
        expect(result).toContain('another message');
      });
    });
  });

  describe('formatToolResultByType - GitHub Tool', () => {
    it('should format github result with content', () => {
      const result = formatToolResultByType('WebFetchFromGithub', 'github', true, { 
        content: 'console.log("github file");' 
      });
      expect(result).toContain('🐙 **GitHub 文件内容**');
      expect(result).toContain('(1 行)');
      expect(result).toContain('console.log("github file");');
    });

    it('should format github result without content as JSON', () => {
      const result = formatToolResultByType('WebFetchFromGithub', 'github', true, { error: 'not found' });
      expect(result).toContain('```json');
      expect(result).toContain('"error": "not found"');
    });
  });

  describe('formatToolResultByType - Code Analysis Tool', () => {
    it('should format code analysis result with implementation', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, { 
        implementation: 'function test() { return true; }' 
      });
      expect(result).toContain('🔍 **代码分析结果**');
      expect(result).toContain('function test() { return true; }');
    });

    it('should format code analysis result with definition', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, { 
        definition: 'interface Test { prop: string; }' 
      });
      expect(result).toContain('🔍 **代码分析结果**');
      expect(result).toContain('interface Test { prop: string; }');
    });

    it('should format code analysis result with references', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, { 
        references: 'const x = test();' 
      });
      expect(result).toContain('🔍 **代码分析结果**');
      expect(result).toContain('const x = test();');
    });

    it('should format code analysis result without specific fields as JSON', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, { error: 'not found' });
      expect(result).toContain('```json');
      expect(result).toContain('"error": "not found"');
    });
  });

  describe('formatToolResultByType - Knowledge Tools', () => {
    describe('add_knowledge', () => {
      it('should format successful add_knowledge result', () => {
        const result = formatToolResultByType('add_knowledge', 'knowledge', true, { 
          success: true, 
          title: 'Test Knowledge',
          keywords: ['test', 'knowledge'] 
        });
        expect(result).toContain('📚 **知识添加成功**');
        expect(result).toContain('**标题:** Test Knowledge');
        expect(result).toContain('**关键词数量:** 2');
      });

      it('should format failed add_knowledge result', () => {
        const result = formatToolResultByType('add_knowledge', 'knowledge', false, { 
          success: false, 
          error: 'duplicate' 
        });
        expect(result).toContain('❌ 知识添加失败');
        expect(result).toContain('"error": "duplicate"');
      });
    });

    describe('get_knowledge_summaries', () => {
      it('should format array knowledge summaries', () => {
        const result = formatToolResultByType('get_knowledge_summaries', 'knowledge', true, [
          { title: 'Knowledge 1', keywords: ['k1', 'k2'] },
          { title: 'Knowledge 2', keywords: ['k3'] }
        ]);
        expect(result).toContain('📚 **知识库摘要 (2 项)**');
        expect(result).toContain('- **Knowledge 1** [k1, k2]');
        expect(result).toContain('- **Knowledge 2** [k3]');
      });

      it('should handle empty knowledge summaries array', () => {
        const result = formatToolResultByType('get_knowledge_summaries', 'knowledge', true, []);
        expect(result).toBe('知识库为空');
      });

      it('should format non-array knowledge summaries as JSON', () => {
        const result = formatToolResultByType('get_knowledge_summaries', 'knowledge', true, { error: 'not loaded' });
        expect(result).toContain('```json');
        expect(result).toContain('"error": "not loaded"');
      });
    });

    describe('search_knowledge', () => {
      it('should format array search results', () => {
        const result = formatToolResultByType('search_knowledge', 'knowledge', true, [
          { title: 'Result 1', content: 'Content 1' },
          { title: 'Result 2', content: 'Content 2' }
        ]);
        expect(result).toContain('📚 **知识搜索结果 (2 项)**');
        expect(result).toContain('- **Result 1**');
        expect(result).toContain('Content 1');
        expect(result).toContain('- **Result 2**');
        expect(result).toContain('Content 2');
      });

      it('should handle empty search results array', () => {
        const result = formatToolResultByType('search_knowledge', 'knowledge', true, []);
        expect(result).toBe('未找到匹配的知识');
      });

      it('should format non-array search results as JSON', () => {
        const result = formatToolResultByType('search_knowledge', 'knowledge', true, { error: 'search failed' });
        expect(result).toContain('```json');
        expect(result).toContain('"error": "search failed"');
      });
    });
  });

  describe('formatToolResultByType - Search Tool', () => {
    it('should format TencentWsaSearch result with Pages array', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, {
        success: true,
        results: [
          { Title: 'Result 1', Url: 'https://example.com/1', Description: 'Description 1' },
          { Title: 'Result 2', Url: 'https://example.com/2', Description: 'Description 2' }
        ]
      });
      expect(result).toContain('🌐 **网络搜索结果 (2 项)**');
      expect(result).toContain('[Result 1](https://example.com/1)');
      expect(result).toContain('Description 1');
      expect(result).toContain('[Result 2](https://example.com/2)');
      expect(result).toContain('Description 2');
    });

    it('should handle direct array search results', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, [
        { title: 'Direct Result', url: 'https://example.com', description: 'Direct description' }
      ]);
      expect(result).toContain('🌐 **网络搜索结果 (1 项)**');
      expect(result).toContain('[Direct Result](https://example.com)');
      expect(result).toContain('Direct description');
    });

    it('should handle Pages structure in search results', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, {
        Pages: [
          { Name: 'Page Result', Link: 'https://example.com/page', Abstract: 'Page abstract' }
        ]
      });
      expect(result).toContain('🌐 **网络搜索结果 (1 项)**');
      expect(result).toContain('[Page Result](https://example.com/page)');
      expect(result).toContain('Page abstract');
    });

    it('should handle empty search results', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, {
        success: true,
        results: []
      });
      expect(result).toBe('未找到搜索结果');
    });

    it('should handle invalid string as empty search result', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, 'invalid json string');
      expect(result).toBe('未找到搜索结果');
    });
  });

  describe('formatToolResultByType - Task Management Tools', () => {
    it('should format write_todos result with todos array', () => {
      const result = formatToolResultByType('write_todos', 'task_management', true, {
        todos: [
          { content: 'Task 1', status: 'completed' },
          { content: 'Task 2', status: 'in_progress' },
          { content: 'Task 3', status: 'pending' }
        ]
      });
      expect(result).toContain('📋 **待办事项更新 (1/3 完成)**');
      expect(result).toContain('- [✓] Task 1');
      expect(result).toContain('- [🔄] Task 2');
      expect(result).toContain('- [ ] Task 3');
    });

    it('should format write-subagent-todos result', () => {
      const result = formatToolResultByType('write-subagent-todos', 'task_management', true, {
        todos: [
          { content: 'Subagent Task', status: 'completed' }
        ]
      });
      expect(result).toContain('📋 **待办事项更新 (1/1 完成)**');
      expect(result).toContain('- [✓] Subagent Task');
    });

    it('should format task management result without todos as JSON', () => {
      const result = formatToolResultByType('write_todos', 'task_management', true, { message: 'no todos' });
      expect(result).toContain('```json');
      expect(result).toContain('"message": "no todos"');
    });
  });

  describe('formatToolResultByType - Composio Tools', () => {
    it('should format Composio result with data array containing subject/title', () => {
      const result = formatToolResultByType('COMPOSIO_GMAIL_SEND_EMAIL', 'composio', true, {
        data: [
          { subject: 'Email Subject', body: 'Email body content' },
          { title: 'Another Item', content: 'Item content' }
        ]
      });
      expect(result).toContain('🔌 **GMAIL_SEND_EMAIL 结果 (2 项)**');
      expect(result).toContain('- **Email Subject**');
      expect(result).toContain('Email body content');
      expect(result).toContain('- **Another Item**');
      expect(result).toContain('Item content');
    });

    it('should format Composio result with empty data array', () => {
      const result = formatToolResultByType('COMPOSIO_GMAIL_SEND_EMAIL', 'composio', true, {
        data: []
      });
      expect(result).toBe('无数据返回');
    });

    it('should format Composio result with object data', () => {
      const result = formatToolResultByType('COMPOSIO_GMAIL_SEND_EMAIL', 'composio', true, {
        data: { success: true, message: 'sent' }
      });
      expect(result).toContain('🔌 **GMAIL_SEND_EMAIL 结果**');
      expect(result).toContain('"success": true');
      expect(result).toContain('"message": "sent"');
    });

    it('should format Composio result without data as JSON', () => {
      const result = formatToolResultByType('COMPOSIO_GMAIL_SEND_EMAIL', 'composio', true, { error: 'auth failed' });
      expect(result).toContain('```json');
      expect(result).toContain('"error": "auth failed"');
    });
  });

  describe('formatToolResultByType - Default/Other Tools', () => {
    it('should format other tool result with stdout/stderr', () => {
      const result = formatToolResultByType('unknown_tool', 'other', true, {
        stdout: 'standard output',
        stderr: 'standard error'
      });
      expect(result).toContain('**标准输出:**');
      expect(result).toContain('standard output');
      expect(result).toContain('**标准错误:**');
      expect(result).toContain('standard error');
    });

    it('should format other tool result with message', () => {
      const result = formatToolResultByType('unknown_tool', 'other', true, {
        message: 'success message'
      });
      expect(result).toBe('success message');
    });

    it('should format other tool result as JSON for generic objects', () => {
      const result = formatToolResultByType('unknown_tool', 'other', true, {
        custom: 'data',
        value: 123
      });
      expect(result).toContain('```json');
      expect(result).toContain('"custom": "data"');
      expect(result).toContain('"value": 123');
    });

    it('should format string other tool result with error content', () => {
      const result = formatToolResultByType('unknown_tool', 'other', false, 'Error: something went wrong');
      expect(result).toBe('❌ **Error: something went wrong**');
    });

    it('should format string other tool result with normal content', () => {
      const result = formatToolResultByType('unknown_tool', 'other', true, 'normal output');
      expect(result).toBe('`normal output`');
    });

    it('should format multiline string other tool result', () => {
      const result = formatToolResultByType('unknown_tool', 'other', true, 'line 1\nline 2');
      expect(result).toContain('```');
      expect(result).toContain('line 1');
      expect(result).toContain('line 2');
    });
  });

  describe('formatStructuredResult', () => {
    it('should format empty array', () => {
      const result = formatStructuredResult([], false);
      expect(result).toBe("**空数组** ⚪");
    });

    it('should format string array with verbose=true', () => {
      const result = formatStructuredResult(['item1', 'item2'], true);
      expect(result).toContain('📋 **结果列表 (2 项)**:');
      expect(result).toContain('1. `item1`');
      expect(result).toContain('2. `item2`');
    });

    it('should format string array with verbose=false and more than 5 items', () => {
      const result = formatStructuredResult(['1', '2', '3', '4', '5', '6'], false);
      expect(result).toContain('📋 **结果列表 (6 项)**:');
      expect(result).toContain('1. `1`');
      expect(result).toContain('2. `2`');
      expect(result).toContain('3. `3`');
      expect(result).toContain('... 还有 3 项');
    });

    it('should format object array with verbose=true', () => {
      const result = formatStructuredResult([{ name: 'test' }], true);
      expect(result).toContain('📊 **数据表格 (1 行)**:');
      expect(result).toContain('```json');
      expect(result).toContain('"name": "test"');
    });

    it('should format object array with verbose=false and more than 2 items', () => {
      const result = formatStructuredResult([{ a: 1 }, { b: 2 }, { c: 3 }], false);
      expect(result).toContain('📊 **数据表格 (3 行)**:');
      expect(result).toContain('```json');
      expect(result).toContain('"a": 1');
      expect(result).toContain('"b": 2');
      expect(result).toContain('... 还有 1 行');
    });

    it('should format error object with error field', () => {
      const result = formatStructuredResult({ error: 'Something went wrong' }, false);
      expect(result).toBe('❌ **Something went wrong**');
    });

    it('should format error object with message field', () => {
      const result = formatStructuredResult({ message: 'Operation failed' }, false);
      expect(result).toBe('❌ **Operation failed**');
    });

    it('should format multiline error message', () => {
      const result = formatStructuredResult({ error: 'Line 1\nLine 2' }, false);
      expect(result).toContain('❌ **执行错误**:');
      expect(result).toContain('```');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    it('should format success object with success=true and data', () => {
      const result = formatStructuredResult({ success: true, data: 'test data' }, false);
      expect(result).toContain('✅ **操作成功**');
      expect(result).toContain('**数据**: `test data`');
    });

    it('should format success object with success=true and object data', () => {
      const result = formatStructuredResult({ success: true, data: { key: 'value' } }, false);
      expect(result).toContain('✅ **操作成功**');
      expect(result).toContain('```json');
      expect(result).toContain('"key": "value"');
    });

    it('should format success object with success=false', () => {
      const result = formatStructuredResult({ success: false, error: 'failed' }, false);
      expect(result).toBe('❌ **failed**');
    });

    it('should format empty object', () => {
      const result = formatStructuredResult({}, false);
      expect(result).toBe("**空对象** ⚪");
    });

    it('should format object with stdout/stderr', () => {
      const result = formatStructuredResult({ stdout: 'output', stderr: 'error' }, false);
      expect(result).toContain('**标准输出**:');
      expect(result).toContain('`output`');
      expect(result).toContain('**标准错误**:');
      expect(result).toContain('`error`');
    });

    it('should format object with stdout/stderr containing newlines', () => {
      const result = formatStructuredResult({ stdout: 'line1\nline2', stderr: 'err1\nerr2' }, false);
      expect(result).toContain('**标准输出**:');
      expect(result).toContain('```bash');
      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).toContain('**标准错误**:');
      expect(result).toContain('```');
      expect(result).toContain('err1');
      expect(result).toContain('err2');
    });

    it('should format object in verbose mode with all fields', () => {
      const result = formatStructuredResult({ field1: 'value1', field2: 'value2', field3: 'value3', field4: 'value4' }, true);
      expect(result).toContain('```json');
      expect(result).toContain('"field1": "value1"');
      expect(result).toContain('"field2": "value2"');
      expect(result).toContain('"field3": "value3"');
      expect(result).toContain('"field4": "value4"');
    });

    it('should format object in non-verbose mode with first 3 fields', () => {
      const result = formatStructuredResult({ field1: 'value1', field2: 'value2', field3: 'value3', field4: 'value4' }, false);
      expect(result).toContain('**结果对象**:');
      expect(result).toContain('- **field1**: `value1`');
      expect(result).toContain('- **field2**: `value2`');
      expect(result).toContain('- **field3**: `value3`');
      expect(result).toContain('- ... 还有 1 个字段');
    });
  });

  describe('formatToolResultByType - Edge Cases', () => {
    it('should handle null result', () => {
      const result = formatToolResultByType('test_tool', 'other', true, null);
      expect(result).toBe('null');
    });

    it('should handle undefined result', () => {
      const result = formatToolResultByType('test_tool', 'other', true, undefined);
      expect(result).toBe('undefined');
    });

    it('should handle number result', () => {
      const result = formatToolResultByType('test_tool', 'other', true, 42);
      expect(result).toBe('42');
    });

    it('should handle boolean result', () => {
      const result = formatToolResultByType('test_tool', 'other', true, true);
      expect(result).toBe('true');
    });

    it('should handle JSON string that fails to parse', () => {
      const result = formatToolResultByType('test_tool', 'other', true, '{"invalid": json}');
      expect(result).toBe('`{"invalid": json}`');
    });

    it('should handle JSON string that parses successfully', () => {
      const result = formatToolResultByType('test_tool', 'other', true, '{"valid": "json"}');
      expect(result).toContain('```json');
      expect(result).toContain('"valid": "json"');
    });

    it('should handle array JSON string', () => {
      const result = formatToolResultByType('test_tool', 'other', true, '["item1", "item2"]');
      expect(result).toContain('```json');
      expect(result).toContain('"item1"');
      expect(result).toContain('"item2"');
    });
  });

  // ─── Tests for new/actual tool names ────────────────────────────────────────

  describe('getToolType - new tool names', () => {
    it('should return filesystem for view_file', () => {
      expect(getToolType('view_file')).toBe('filesystem');
    });
    it('should return filesystem for glob_files', () => {
      expect(getToolType('glob_files')).toBe('filesystem');
    });
    it('should return filesystem for grep_files', () => {
      expect(getToolType('grep_files')).toBe('filesystem');
    });
    it('should return web for web_fetch', () => {
      expect(getToolType('web_fetch')).toBe('web');
    });
    it('should return thinking for think', () => {
      expect(getToolType('think')).toBe('thinking');
    });
    it('should return task_management for read-subagent-todos', () => {
      expect(getToolType('read-subagent-todos')).toBe('task_management');
    });
  });

  describe('formatToolResultByType - view_file tool (actual name)', () => {
    it('should format successful view_file result with content', () => {
      const result = formatToolResultByType('view_file', 'filesystem', true, {
        success: true,
        file_path: '/src/index.ts',
        total_lines: 50,
        start_line: 1,
        end_line: 50,
        content: 'const x = 1;'
      });
      expect(result).toContain('`/src/index.ts`');
      expect(result).toContain('共 50 行');
      expect(result).toContain('const x = 1;');
    });

    it('should format view_file result with line range', () => {
      const result = formatToolResultByType('view_file', 'filesystem', true, {
        success: true,
        file_path: '/src/index.ts',
        total_lines: 100,
        start_line: 10,
        end_line: 20,
        content: 'some code'
      });
      expect(result).toContain('第 10–20 行 / 共 100 行');
    });

    it('should format failed view_file result', () => {
      const result = formatToolResultByType('view_file', 'filesystem', false, {
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'File not found: /missing.ts'
      });
      expect(result).toContain('❌');
      expect(result).toContain('File not found');
    });

    it('should handle view_file object with non-string content', () => {
      // Test with number content
      let result = formatToolResultByType('view_file', 'filesystem', true, {
        success: true,
        file_path: '/src/index.ts',
        total_lines: 1,
        start_line: 1,
        end_line: 1,
        content: 12345
      });
      expect(result).toContain('`/src/index.ts`');
      expect(result).toContain('共 1 行');
      expect(result).toContain('12345');

      // Test with boolean content
      result = formatToolResultByType('view_file', 'filesystem', true, {
        success: true,
        file_path: '/src/index.ts',
        total_lines: 1,
        start_line: 1,
        end_line: 1,
        content: false
      });
      expect(result).toContain('`/src/index.ts`');
      expect(result).toContain('共 1 行');
      expect(result).toContain('false');

      // Test with null content
      result = formatToolResultByType('view_file', 'filesystem', true, {
        success: true,
        file_path: '/src/index.ts',
        total_lines: 1,
        start_line: 1,
        end_line: 1,
        content: null
      });
      expect(result).toContain('`/src/index.ts`');
      expect(result).toContain('共 1 行');
      expect(result).toContain('null');

      // Test with array content
      result = formatToolResultByType('view_file', 'filesystem', true, {
        success: true,
        file_path: '/src/index.ts',
        total_lines: 1,
        start_line: 1,
        end_line: 1,
        content: [1, 2, 3]
      });
      expect(result).toContain('`/src/index.ts`');
      expect(result).toContain('共 1 行');
      expect(result).toContain('1,2,3');
    });
  });

  describe('formatToolResultByType - glob_files tool (actual name)', () => {
    it('should format successful glob_files result', () => {
      const result = formatToolResultByType('glob_files', 'filesystem', true, {
        success: true,
        pattern: '**/*.ts',
        cwd: '/src',
        count: 3,
        files: ['a.ts', 'b.ts', 'c.ts']
      });
      expect(result).toContain('找到 3 个匹配文件');
      expect(result).toContain('`**/*.ts`');
      expect(result).toContain('- `a.ts`');
    });

    it('should format glob_files result with no matches', () => {
      const result = formatToolResultByType('glob_files', 'filesystem', true, {
        success: true,
        pattern: '**/*.xyz',
        count: 0,
        files: []
      });
      expect(result).toContain('未找到匹配模式');
    });

    it('should format failed glob_files result', () => {
      const result = formatToolResultByType('glob_files', 'filesystem', false, {
        success: false,
        error: 'INVALID_PATTERN',
        pattern: '?!'
      });
      expect(result).toContain('❌');
    });
  });

  describe('formatToolResultByType - grep_files tool (actual name)', () => {
    it('should format successful grep_files result', () => {
      const result = formatToolResultByType('grep_files', 'filesystem', true, {
        success: true,
        pattern: 'export',
        include: '**/*.ts',
        count: 2,
        truncated: false,
        results: [
          { file: 'src/a.ts', line: 5, content: 'export const foo = 1;' },
          { file: 'src/b.ts', line: 12, content: 'export default class Bar {}' }
        ]
      });
      expect(result).toContain('找到 2 个匹配项');
      expect(result).toContain('`export`');
      expect(result).toContain('`src/a.ts`');
      expect(result).toContain('第 5 行');
      expect(result).toContain('export const foo = 1;');
    });

    it('should format grep_files result with no matches', () => {
      const result = formatToolResultByType('grep_files', 'filesystem', true, {
        success: true,
        pattern: 'nonexistent',
        count: 0,
        truncated: false,
        results: []
      });
      expect(result).toContain('未找到匹配模式');
    });

    it('should format truncated grep_files result', () => {
      const results = Array.from({ length: 11 }, (_, i) => ({
        file: `file${i}.ts`,
        line: i + 1,
        content: `content ${i}`
      }));
      const result = formatToolResultByType('grep_files', 'filesystem', true, {
        success: true,
        pattern: 'test',
        count: 500,
        truncated: true,
        results
      });
      expect(result).toContain('⚠️ 结果已截断');
    });
  });

  describe('formatToolResultByType - write_file result (actual format)', () => {
    it('should format write_file created result with lines_written', () => {
      const result = formatToolResultByType('write_file', 'filesystem', true, {
        success: true,
        action: 'created',
        file_path: '/src/new.ts',
        lines_written: 42
      });
      expect(result).toContain('✅ 文件操作成功');
      expect(result).toContain('新建');
      expect(result).toContain('`/src/new.ts`');
      expect(result).toContain('**写入行数:** 42');
    });

    it('should format edit_file result with lines_removed and lines_added', () => {
      const result = formatToolResultByType('edit_file', 'filesystem', true, {
        success: true,
        action: 'edited',
        file_path: '/src/existing.ts',
        lines_removed: 3,
        lines_added: 5
      });
      expect(result).toContain('✅ 文件操作成功');
      expect(result).toContain('编辑');
      expect(result).toContain('-3');
      expect(result).toContain('+5');
    });
  });

  describe('formatWebFetchResult', () => {
    it('should format successful web_fetch result', () => {
      const result = formatWebFetchResult({
        success: true,
        url: 'https://example.com',
        status: 200,
        content_type: 'text/html',
        content_length: 100,
        truncated: false,
        content: '<html>hello</html>'
      });
      expect(result).toContain('🌐 **网页内容**');
      expect(result).toContain('https://example.com');
      expect(result).toContain('<html>hello</html>');
    });

    it('should show truncated warning when content is truncated', () => {
      const result = formatWebFetchResult({
        success: true,
        url: 'https://example.com',
        status: 200,
        content_type: 'text/plain',
        truncated: true,
        content: 'long content...'
      });
      expect(result).toContain('⚠️ 内容已截断');
    });

    it('should format failed web_fetch result', () => {
      const result = formatWebFetchResult({
        success: false,
        url: 'https://example.com',
        status: 404,
        error: 'NOT_FOUND',
        message: 'Page not found'
      });
      expect(result).toContain('❌ **网页获取失败**');
      expect(result).toContain('404');
      expect(result).toContain('Page not found');
    });
  });

  describe('formatThinkResult', () => {
    it('should format think result with reasoning', () => {
      const result = formatThinkResult({
        type: 'thinking',
        reasoning: 'I need to consider all the options before proceeding.',
        note: 'This is internal reasoning.'
      });
      expect(result).toContain('💭 **思考过程**');
      expect(result).toContain('I need to consider all the options');
    });

    it('should fallback to JSON for think result without reasoning', () => {
      const result = formatThinkResult({ type: 'thinking', note: 'no reasoning' });
      expect(result).toContain('```json');
    });
  });

  describe('formatTaskManagementResult - read-subagent-todos', () => {
    it('should format read-subagent-todos result with todos', () => {
      const result = formatTaskManagementResult('read-subagent-todos', {
        success: true,
        todos: [
          { content: 'Code the feature', status: 'completed', subagent_type: 'coder' },
          { content: 'Write tests', status: 'in_progress', subagent_type: 'testing' },
          { content: 'Review docs', status: 'pending', subagent_type: 'documentation' }
        ],
        total: 3
      });
      expect(result).toContain('📋 **待办事项 (1/3 完成)**');
      expect(result).toContain('[✓]');
      expect(result).toContain('`coder`');
      expect(result).toContain('[🔄]');
      expect(result).toContain('`testing`');
    });

    it('should handle empty read-subagent-todos list', () => {
      const result = formatTaskManagementResult('read-subagent-todos', {
        success: true,
        todos: [],
        total: 0
      });
      expect(result).toContain('📋 **待办事项列表为空**');
    });
  });

  describe('formatToolResultByType - web and thinking types', () => {
    it('should handle web_fetch via formatToolResultByType', () => {
      const result = formatToolResultByType('web_fetch', 'web', true, {
        success: true,
        url: 'https://example.com',
        status: 200,
        content_type: 'text/plain',
        truncated: false,
        content: 'hello world'
      });
      expect(result).toContain('🌐 **网页内容**');
      expect(result).toContain('hello world');
    });

    it('should handle think via formatToolResultByType', () => {
      const result = formatToolResultByType('think', 'thinking', true, {
        type: 'thinking',
        reasoning: 'Step 1: analyze the problem.',
        note: 'internal'
      });
      expect(result).toContain('💭 **思考过程**');
      expect(result).toContain('Step 1');
    });

    it('should handle knowledge actual tool output for get_knowledge_summaries', () => {
      const result = formatToolResultByType('get_knowledge_summaries', 'knowledge', true, {
        success: true,
        knowledgeSummaries: [
          { title: 'Item 1', keywords: ['a', 'b'] },
          { title: 'Item 2', keywords: [] }
        ],
        total: 2
      });
      expect(result).toContain('📚 **知识库摘要 (2 项)**');
      expect(result).toContain('- **Item 1** [a, b]');
    });

    it('should handle knowledge actual tool output for search_knowledge', () => {
      const result = formatToolResultByType('search_knowledge', 'knowledge', true, {
        success: true,
        message: '搜索完成，找到 1 个匹配项',
        knowledgeItems: [
          { title: 'Found Item', content: 'Details about it' }
        ],
        total: 1
      });
      expect(result).toContain('📚 **知识搜索结果 (1 项)**');
      expect(result).toContain('**Found Item**');
      expect(result).toContain('Details about it');
    });

    it('should handle add_knowledge actual tool output', () => {
      const result = formatToolResultByType('add_knowledge', 'knowledge', true, {
        success: true,
        message: '知识项已成功添加到知识库',
        title: 'New Knowledge',
        keywordCount: 3
      });
      expect(result).toContain('📚 **知识添加成功**');
      expect(result).toContain('**标题:** New Knowledge');
      expect(result).toContain('**关键词数量:** 3');
    });

    it('should handle sleep actual tool output', () => {
      const result = formatToolResultByType('sleep', 'system', true, {
        success: true,
        message: 'Slept for 1000 milliseconds'
      });
      expect(result).toContain('⏱️ 延迟执行完成');
      expect(result).toContain('1000');
    });
  });
});