import { 
  formatFilesystemResult,
  formatSystemResult,
  formatGithubResult,
  formatCodeAnalysisResult,
  formatKnowledgeResult,
  formatWebFetchResult,
  formatThinkResult
} from '@/presentation/lark/result-formatter';

describe('Tool Result Formatter - Branch Coverage', () => {
  describe('formatFilesystemResult - string results', () => {
    it('should format ls result as file list', () => {
      const result = formatFilesystemResult('ls', '/project/file1.ts\n/project/file2.ts\n/project/file3.ts');
      expect(result).toContain('file1.ts');
      expect(result).toContain('- `');
    });

    it('should format grep result with file path line (ends with :)', () => {
      const grepOutput = 'src/main.ts:\n  10: const x = 1;\n  20: const y = 2;';
      const result = formatFilesystemResult('grep', grepOutput);
      expect(result).toContain('src/main.ts');
    });

    it('should format grep result content line without current file', () => {
      // Content line (starts with space) but no file was set yet
      const grepOutput = '  10: const x = 1;';
      const result = formatFilesystemResult('grep', grepOutput);
      expect(result).toBeDefined();
    });

    it('should format grep result with deepagents format: file path then indented lines', () => {
      const grepOutput = '\nfile.ts:\n  10: const value = 42;';
      const result = formatFilesystemResult('grep', grepOutput);
      expect(result).toContain('file.ts');
    });

    it('should format grep result with more than 10 matches', () => {
      // Use deepagents grep format with multiple file/line entries
      const pairs = Array.from({ length: 15 }, (_, i) => `match_file_${i+1}.ts:\n  1: result`).join('\n');
      const result = formatFilesystemResult('grep', pairs);
      expect(result).toContain('匹配项');
    });

    it('should format write_file string result as success message', () => {
      const result = formatFilesystemResult('write_file', "Successfully wrote to '/path/file.ts'");
      expect(result).toContain('✅');
    });

    it('should format edit_file string result as success message', () => {
      const result = formatFilesystemResult('edit_file', "Successfully replaced 1 occurrence(s) in '/path/file.ts'");
      expect(result).toContain('✅');
    });

    it('should return empty output for empty glob string result', () => {
      const result = formatFilesystemResult('glob', '');
      expect(result).toBe('无内容');
    });
  });

  describe('formatFilesystemResult - JSON results', () => {
    it('should return JSON fallback for glob with non-array object result', () => {
      const result = formatFilesystemResult('glob', { error: 'not found' });
      expect(result).toContain('```json');
    });

    it('should return JSON fallback for glob with empty object result', () => {
      const result = formatFilesystemResult('glob', { pattern: '*.ts' });
      expect(result).toContain('```json');
    });

    it('should format glob "No files found" string result as empty', () => {
      const result = formatFilesystemResult('glob', "No files found matching pattern '*.ts'");
      expect(result).toBe('未找到匹配文件');
    });

    it('should handle grep with more than 10 array items', () => {
      const bigArray = Array.from({ length: 15 }, (_, i) => `match ${i + 1}`);
      const result = formatFilesystemResult('grep', bigArray);
      expect(result).toContain('匹配项');
    });

    it('should return JSON fallback for grep with non-array object result', () => {
      const result = formatFilesystemResult('grep', { error: 'not found' });
      expect(result).toContain('```json');
    });

    it('should return JSON for default case', () => {
      const result = formatFilesystemResult('unknown_fs_tool', { key: 'value' });
      expect(result).toContain('```json');
    });

    it('should handle view_file with no content field (fallback to JSON)', () => {
      const result = formatFilesystemResult('view_file', { success: true, file_path: '/test.ts' });
      expect(result).toContain('```json');
    });

    it('should handle read_file with no content field', () => {
      const result = formatFilesystemResult('read_file', { file_path: '/test.ts' });
      expect(result).toContain('```json');
    });

    it('should handle view_file with success: false', () => {
      const result = formatFilesystemResult('view_file', { success: false, message: 'File not found' });
      expect(result).toContain('❌');
    });
  });

  describe('formatSystemResult - branch coverage', () => {
    it('should format default system tool string with newlines', () => {
      const result = formatSystemResult('custom-tool', 'line1\nline2\nline3');
      expect(result).toContain('```');
    });

    it('should format default system tool string without newlines', () => {
      const result = formatSystemResult('custom-tool', 'single result');
      expect(result).toContain('`single result`');
    });

    it('should format sleep result with duration number', () => {
      const result = formatSystemResult('sleep', { duration: 500 });
      expect(result).toContain('500');
    });

    it('should format sleep result with message string', () => {
      const result = formatSystemResult('sleep', { message: 'Slept for 1000 milliseconds' });
      expect(result).toContain('1000');
    });

    it('should format sleep result with no message and no duration', () => {
      const result = formatSystemResult('sleep', { success: true });
      expect(result).toContain('⏱️');
    });

    it('should format execute_bash with both stdout and stderr', () => {
      const result = formatSystemResult('execute_bash', {
        command: 'ls -la',
        stdout: 'file1.ts\nfile2.ts',
        stderr: 'warning message'
      });
      expect(result).toContain('标准输出');
      expect(result).toContain('标准错误');
    });

    it('should return empty output for execute_bash with no output', () => {
      const result = formatSystemResult('execute_bash', {
        stdout: '(empty)',
        stderr: '(empty)'
      });
      expect(result).toBe('无输出');
    });
  });

  describe('formatGithubResult - branch coverage', () => {
    it('should handle success: false', () => {
      const result = formatGithubResult({ success: false, message: 'Not found' });
      expect(result).toContain('❌');
    });

    it('should handle result with no content (fallback JSON)', () => {
      const result = formatGithubResult({ owner: 'user', repo: 'repo' });
      expect(result).toContain('```json');
    });

    it('should handle github result with path and branch', () => {
      const result = formatGithubResult({
        content: 'const x = 1;',
        path: 'src/index.ts',
        branch: 'main',
        owner: 'user',
        repo: 'repo'
      });
      expect(result).toContain('GitHub');
      expect(result).toContain('src/index.ts');
    });

    it('should handle github result without owner/repo/branch/path', () => {
      const result = formatGithubResult({ content: 'simple content' });
      expect(result).toContain('GitHub');
    });
  });

  describe('formatCodeAnalysisResult - branch coverage', () => {
    it('should handle definition result', () => {
      const result = formatCodeAnalysisResult({ definition: 'function foo() {}' });
      expect(result).toContain('代码分析结果');
    });

    it('should handle references result', () => {
      const result = formatCodeAnalysisResult({ references: 'ref1\nref2' });
      expect(result).toContain('代码分析结果');
    });

    it('should return JSON for result with no known fields', () => {
      const result = formatCodeAnalysisResult({ error: 'not found' });
      expect(result).toContain('```json');
    });
  });

  describe('formatKnowledgeResult - branch coverage', () => {
    it('should handle add_knowledge failure', () => {
      const result = formatKnowledgeResult('add_knowledge', { success: false });
      expect(result).toContain('❌');
    });

    it('should handle get_knowledge_summaries with array result', () => {
      const result = formatKnowledgeResult('get_knowledge_summaries', [
        { title: 'Item 1', keywords: ['kw1'] },
        { title: 'Item 2', keywords: [] }
      ]);
      expect(result).toContain('知识库摘要');
    });

    it('should handle get_knowledge_summaries with empty array', () => {
      const result = formatKnowledgeResult('get_knowledge_summaries', { knowledgeSummaries: [] });
      expect(result).toBe('知识库为空');
    });

    it('should handle get_knowledge_summaries with no summaries field', () => {
      const result = formatKnowledgeResult('get_knowledge_summaries', { error: 'failed' });
      expect(result).toContain('```json');
    });

    it('should handle search_knowledge with array result', () => {
      const result = formatKnowledgeResult('search_knowledge', [
        { title: 'Result 1', content: 'content 1' }
      ]);
      expect(result).toContain('知识搜索结果');
    });

    it('should handle search_knowledge with empty results', () => {
      const result = formatKnowledgeResult('search_knowledge', { knowledgeItems: [] });
      expect(result).toBe('未找到匹配的知识');
    });

    it('should handle search_knowledge with no items field', () => {
      const result = formatKnowledgeResult('search_knowledge', { error: 'failed' });
      expect(result).toContain('```json');
    });

    it('should return JSON for unknown knowledge tool', () => {
      const result = formatKnowledgeResult('unknown_knowledge', { data: 'test' });
      expect(result).toContain('```json');
    });
  });

  describe('formatWebFetchResult - branch coverage', () => {
    it('should handle success: false', () => {
      const result = formatWebFetchResult({ success: false, status: 404, message: 'Not found' });
      expect(result).toContain('❌');
    });

    it('should handle truncated content', () => {
      const result = formatWebFetchResult({
        content: 'page content',
        truncated: true,
        url: 'https://example.com'
      });
      expect(result).toContain('截断');
    });

    it('should handle HTML content type', () => {
      const result = formatWebFetchResult({
        content: '<html>content</html>',
        content_type: 'text/html',
        url: 'https://example.com'
      });
      expect(result).toContain('html');
    });

    it('should return JSON for result with no content field', () => {
      const result = formatWebFetchResult({ url: 'https://example.com' });
      expect(result).toContain('```json');
    });
  });

  describe('formatThinkResult - branch coverage', () => {
    it('should return JSON for result without reasoning field', () => {
      const result = formatThinkResult({ thought: 'no reasoning field' });
      expect(result).toContain('```json');
    });
  });
});
