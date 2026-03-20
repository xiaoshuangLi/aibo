import { 
  processLarkText, 
  isJsonContent, 
  isErrorContent
} from '@/presentation/lark/shared';

import { 
  getToolType, 
  formatToolResultByType,
  formatStructuredResult
} from '@/presentation/lark/result-formatter';

describe('Tool Result Formatter', () => {

  describe('processLarkText', () => {
    it('should handle empty text', () => {
      const result = processLarkText('');
      expect(result).toBe('');
    });

    it('should escape indentation by default', () => {
      const text = '  indented line\nnormal line';
      const result = processLarkText(text);
      expect(result).toContain('\u200B  indented line');
    });

    it('should not escape indentation when option is false', () => {
      const text = '  indented line\nnormal line';
      const result = processLarkText(text, { escapeIndentation: false });
      expect(result).toBe(text);
    });

    it('should preserve code blocks when option is true', () => {
      const text = 'normal text\n```code block```\nmore text';
      const result = processLarkText(text, { preserveCodeBlocks: true });
      expect(result).toContain('```code block```');
    });
  });

  describe('isJsonContent', () => {
    it('should return true for JSON object', () => {
      expect(isJsonContent('{"key": "value"}')).toBe(true);
    });

    it('should return true for JSON array', () => {
      expect(isJsonContent('["item1", "item2"]')).toBe(true);
    });

    it('should return false for non-JSON content', () => {
      expect(isJsonContent('plain text')).toBe(false);
    });
  });

  describe('isErrorContent', () => {
    it('should return true for error content', () => {
      expect(isErrorContent('Error: something went wrong')).toBe(true);
    });

    it('should return true for exception content', () => {
      expect(isErrorContent('Exception occurred')).toBe(true);
    });

    it('should return true for stderr content', () => {
      expect(isErrorContent('stderr output')).toBe(true);
    });

    it('should return false for normal content', () => {
      expect(isErrorContent('normal output')).toBe(false);
    });
  });

  describe('getToolType', () => {
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
      expect(getToolType('write-subagent-todos')).toBe('task_management');
      expect(getToolType('write_todos')).toBe('task_management');
      expect(getToolType('task')).toBe('task_management');
    });

    it('should return composio for composio tools', () => {
      expect(getToolType('COMPOSIO_SEARCH_TOOLS')).toBe('composio');
    });

    it('should return other for unknown tools', () => {
      expect(getToolType('unknown_tool')).toBe('other');
    });
  });

  describe('formatStructuredResult', () => {
    it('should handle empty array', () => {
      const result = formatStructuredResult([], false);
      expect(result).toContain('空数组');
    });

    it('should handle string array', () => {
      const result = formatStructuredResult(['item1', 'item2'], false);
      expect(result).toContain('结果列表');
      expect(result).toContain('item1');
      expect(result).toContain('item2');
    });

    it('should handle object array', () => {
      const result = formatStructuredResult([{name: 'test'}], false);
      expect(result).toContain('数据表格');
    });

    it('should handle error object', () => {
      const result = formatStructuredResult({error: 'test error'}, false);
      expect(result).toContain('❌');
      expect(result).toContain('test error');
    });

    it('should handle success object', () => {
      const result = formatStructuredResult({success: true, data: 'test'}, false);
      expect(result).toContain('操作成功');
    });

    it('should handle stdout/stderr object', () => {
      const result = formatStructuredResult({stdout: 'output', stderr: 'error'}, false);
      expect(result).toContain('标准输出');
      expect(result).toContain('标准错误');
    });
  });

  describe('formatToolResultByType', () => {
    it('should handle filesystem ls result', () => {
      const result = formatToolResultByType('ls', 'filesystem', true, ['file1', 'file2']);
      expect(result).toContain('file1');
      expect(result).toContain('file2');
    });

    it('should handle filesystem read_file result', () => {
      const result = formatToolResultByType('read_file', 'filesystem', true, {content: 'test content'});
      expect(result).toContain('文件信息');
      expect(result).toContain('test content');
    });

    it('should handle system execute_bash result', () => {
      const result = formatToolResultByType('execute_bash', 'system', true, {stdout: 'output', stderr: 'error'});
      expect(result).toContain('标准输出');
      expect(result).toContain('标准错误');
    });

    it('should handle github result', () => {
      const result = formatToolResultByType('WebFetchFromGithub', 'github', true, {content: 'github content'});
      expect(result).toContain('GitHub 文件内容');
    });

    it('should handle code analysis result', () => {
      const result = formatToolResultByType('hybrid_code_reader', 'code_analysis', true, {implementation: 'code implementation'});
      expect(result).toContain('代码分析结果');
    });

    it('should handle knowledge add_knowledge result', () => {
      const result = formatToolResultByType('add_knowledge', 'knowledge', true, {success: true, title: 'test title'});
      expect(result).toContain('知识添加成功');
    });

    it('should handle search result', () => {
      const result = formatToolResultByType('TencentWsaSearch', 'search', true, {success: true, results: [{title: 'test', url: 'http://test.com', description: 'test desc'}]});
      expect(result).toContain('网络搜索结果');
    });

    it('should handle task management result', () => {
      const todos = [{content: 'test', status: 'completed'}];
      const result = formatToolResultByType('write_todos', 'task_management', true,
        `Updated todo list to ${JSON.stringify(todos)}`
      );
      expect(result).toContain('待办事项已更新');
    });

    it('should handle composio result', () => {
      const result = formatToolResultByType('COMPOSIO_SEARCH_TOOLS', 'composio', true, {data: [{subject: 'test subject'}]});
      expect(result).toContain('SEARCH_TOOLS');
    });

    it('should handle other tool types with stdout/stderr', () => {
      const result = formatToolResultByType('unknown', 'other', true, {stdout: 'output', stderr: 'error'});
      expect(result).toContain('标准输出');
      expect(result).toContain('标准错误');
    });

    it('should handle other tool types with message', () => {
      const result = formatToolResultByType('unknown', 'other', true, {message: 'test message'});
      expect(result).toBe('test message');
    });

    it('should handle other tool types with object', () => {
      const result = formatToolResultByType('unknown', 'other', true, {key: 'value'});
      expect(result).toContain('json');
    });
  });
});