import { 
  formatFilesystemToolCall,
  formatSystemToolCall,
  formatDefaultToolCall,
  formatWebFetchToolCall,
  formatThinkToolCall
} from '@/presentation/lark/call-formatter';

describe('Tool Call Formatter - Branch Coverage', () => {
  describe('formatFilesystemToolCall - uncovered branches', () => {
    it('should format write_file args as string', () => {
      const result = formatFilesystemToolCall('write_file', '/path/to/file.ts');
      expect(result).toContain('/path/to/file.ts');
    });

    it('should format glob args as string', () => {
      const result = formatFilesystemToolCall('glob', '**/*.ts');
      expect(result).toContain('**/*.ts');
    });

    it('should format glob with object args (break to default)', () => {
      // After break, falls to default handler
      const result = formatFilesystemToolCall('glob', null);
      expect(result).toBe('无参数');
    });

    it('should format grep_files with break to default', () => {
      const result = formatFilesystemToolCall('grep_files', null);
      expect(result).toBe('无参数');
    });

    it('should handle default formatter - string with newlines', () => {
      const result = formatFilesystemToolCall('unknown-fs', 'line1\nline2\nline3');
      expect(result).toContain('```');
    });

    it('should handle default formatter - string without newlines', () => {
      const result = formatFilesystemToolCall('unknown-fs', 'single line');
      expect(result).toBe('`single line`');
    });

    it('should handle default formatter - empty string', () => {
      const result = formatFilesystemToolCall('unknown-fs', '   ');
      expect(result).toBe('空参数');
    });

    it('should handle default formatter - object', () => {
      const result = formatFilesystemToolCall('unknown-fs', { key: 'value' });
      expect(result).toContain('```json');
    });

    it('should handle default formatter - non-string non-object', () => {
      const result = formatFilesystemToolCall('unknown-fs', 42);
      expect(result).toBe('`42`');
    });
  });

  describe('formatSystemToolCall - uncovered branches', () => {
    it('should handle execute_bash with string args', () => {
      const result = formatSystemToolCall('execute_bash', 'ls -la');
      expect(result).toContain('ls -la');
    });

    it('should handle sleep with number args', () => {
      const result = formatSystemToolCall('sleep', 1000);
      expect(result).toContain('1000');
    });

    it('should handle sleep with null/fallthrough to default', () => {
      const result = formatSystemToolCall('sleep', null);
      expect(result).toBe('无参数');
    });

    it('should handle echo with string args', () => {
      const result = formatSystemToolCall('echo', 'hello world');
      expect(result).toContain('hello world');
    });

    it('should handle echo with null/fallthrough to default', () => {
      const result = formatSystemToolCall('echo', null);
      expect(result).toBe('无参数');
    });

    it('should handle default system tool with multiline string', () => {
      const result = formatSystemToolCall('custom-sys', 'line1\nline2');
      expect(result).toContain('```');
    });

    it('should handle default system tool with single line string', () => {
      const result = formatSystemToolCall('custom-sys', 'single');
      expect(result).toBe('`single`');
    });

    it('should handle default system tool with object', () => {
      const result = formatSystemToolCall('custom-sys', { key: 'value' });
      expect(result).toContain('```json');
    });

    it('should handle default system tool with number', () => {
      const result = formatSystemToolCall('custom-sys', 42);
      expect(result).toBe('`42`');
    });
  });

  describe('formatDefaultToolCall - uncovered branches', () => {
    it('should handle JSON string args', () => {
      const result = formatDefaultToolCall('{"key": "value"}');
      expect(result).toContain('```json');
    });

    it('should handle multiline non-JSON string', () => {
      const result = formatDefaultToolCall('line1\nline2\nline3');
      expect(result).toContain('```');
    });

    it('should handle non-string non-object (number)', () => {
      const result = formatDefaultToolCall(42);
      expect(result).toBe('`42`');
    });

    it('should handle null args', () => {
      const result = formatDefaultToolCall(null);
      expect(result).toBe('无参数');
    });
  });

  describe('formatWebFetchToolCall - uncovered branches', () => {
    it('should handle string URL', () => {
      const result = formatWebFetchToolCall('https://example.com');
      expect(result).toContain('example.com');
    });

    it('should handle non-string non-object args', () => {
      const result = formatWebFetchToolCall(42);
      expect(result).toBe('`42`');
    });

    it('should handle null args', () => {
      const result = formatWebFetchToolCall(null);
      expect(result).toBe('无参数');
    });

    it('should handle object with timeout and max_length', () => {
      const result = formatWebFetchToolCall({ url: 'https://example.com', timeout: 5000, max_length: 1000 });
      expect(result).toContain('超时');
      expect(result).toContain('最大长度');
    });
  });

  describe('formatThinkToolCall - uncovered branches', () => {
    it('should handle null args', () => {
      const result = formatThinkToolCall(null);
      expect(result).toBe('无参数');
    });

    it('should handle string reasoning', () => {
      const result = formatThinkToolCall('thinking about the problem');
      expect(result).toContain('推理过程');
    });

    it('should handle long string reasoning (more than 5 lines)', () => {
      const longReasoning = Array.from({ length: 8 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result = formatThinkToolCall(longReasoning);
      expect(result).toContain('8 行');
    });

    it('should handle long object reasoning (more than 5 lines)', () => {
      const longReasoning = Array.from({ length: 8 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result = formatThinkToolCall({ reasoning: longReasoning });
      expect(result).toContain('8 行');
    });

    it('should return JSON for object without reasoning', () => {
      const result = formatThinkToolCall({ thought: 'just thinking' });
      expect(result).toContain('```json');
    });
  });
});
