import { 
  escapeLarkIndentation, 
  escapeLarkSpecialChars, 
  processLarkText,
  isErrorContent
} from '@/presentation/lark/shared';

import { 
  formatToolCallArgs
} from '@/presentation/lark/tool-call-formatter';

describe('Tool Call Formatter', () => {
  describe('escapeLarkIndentation', () => {
    it('should add zero-width space to indented lines', () => {
      const input = 'Normal line\n  Indented line\n\tTabbed line\nNo indent';
      const result = escapeLarkIndentation(input);
      
      expect(result).toBe('Normal line\n\u200B  Indented line\n\u200B\tTabbed line\nNo indent');
    });

    it('should handle empty string', () => {
      expect(escapeLarkIndentation('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(escapeLarkIndentation(null as any)).toBe(null as any);
      expect(escapeLarkIndentation(undefined as any)).toBe(undefined as any);
    });
  });

  describe('escapeLarkSpecialChars', () => {
    it('should escape backslashes', () => {
      const input = 'This is a \\test\\ string';
      const result = escapeLarkSpecialChars(input);
      
      expect(result).toBe('This is a \\\\test\\\\ string');
    });

    it('should handle empty string', () => {
      expect(escapeLarkSpecialChars('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(escapeLarkSpecialChars(null as any)).toBe(null as any);
      expect(escapeLarkSpecialChars(undefined as any)).toBe(undefined as any);
    });
  });

  describe('processLarkText', () => {
    it('should process text with default options', () => {
      const input = 'Normal line\n  Indented line\nError occurred';
      const result = processLarkText(input);
      
      expect(result).toBe('Normal line\n\u200B  Indented line\nError occurred');
    });

    it('should preserve code blocks when option is enabled', () => {
      const input = 'Normal text\n```js\nconst x = 1;\n```\nMore text';
      const result = processLarkText(input, { preserveCodeBlocks: true });
      
      expect(result).toBe('Normal text\n```js\nconst x = 1;\n```\nMore text');
    });

    it('should handle text without escaping when options are disabled', () => {
      const input = 'Normal line\n  Indented line\nError occurred';
      const result = processLarkText(input, { 
        escapeIndentation: false, 
        escapeSpecialChars: false 
      });
      
      expect(result).toBe(input);
    });
  });

  describe('isErrorContent', () => {
    it('should detect error content', () => {
      expect(isErrorContent('Error occurred')).toBe(true);
      expect(isErrorContent('Exception thrown')).toBe(true);
      expect(isErrorContent('stderr output')).toBe(true);
      expect(isErrorContent('Error: Something went wrong')).toBe(true);
      expect(isErrorContent('Exception: Invalid input')).toBe(true);
    });

    it('should not detect non-error content', () => {
      expect(isErrorContent('Normal output')).toBe(false);
      expect(isErrorContent('Success')).toBe(false);
      expect(isErrorContent('Info message')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isErrorContent('ERROR occurred')).toBe(true);
      expect(isErrorContent('exception thrown')).toBe(true);
    });
  });

  describe('formatToolCallArgs', () => {
    it('should format task tool call', () => {
      const args = {
        subagent_type: 'researcher',
        description: 'Research the latest developments',
        additional_param: 'value'
      };
      
      const result = formatToolCallArgs('task', JSON.stringify(args));
      expect(result).toContain('**委派给 researcher 代理**');
      expect(result).toContain('Research the latest developments');
      expect(result).toContain('additional_param');
    });

    it('should format ls tool call', () => {
      const result = formatToolCallArgs('ls', JSON.stringify('/test/path'));
      expect(result).toContain('**路径**: `/test/path`');
    });

    it('should format read_file tool call', () => {
      const result = formatToolCallArgs('read_file', JSON.stringify({ file_path: '/test/file.txt' }));
      expect(result).toContain('**文件路径**: `/test/file.txt`');
    });

    it('should format write_file tool call', () => {
      const result = formatToolCallArgs('write_file', JSON.stringify({ 
        file_path: '/test/file.txt', 
        content: 'test content' 
      }));
      expect(result).toContain('**文件路径**: `/test/file.txt`');
      expect(result).toContain('**内容预览**');
    });

    it('should format edit_file tool call', () => {
      const result = formatToolCallArgs('edit_file', JSON.stringify({ 
        file_path: '/test/file.txt',
        old_string: 'old content',
        new_string: 'new content'
      }));
      expect(result).toContain('**文件路径**: `/test/file.txt`');
      expect(result).toContain('**原内容**');
      expect(result).toContain('**新内容**');
    });

    it('should format grep tool call', () => {
      const result = formatToolCallArgs('grep', JSON.stringify({ pattern: 'test', path: '/test' }));
      expect(result).toContain('**搜索模式**: `test`');
      expect(result).toContain('**路径**: `/test`');
    });

    it('should handle unknown tool', () => {
      const result = formatToolCallArgs('unknown_tool', JSON.stringify({ param: 'value' }));
      expect(result).toContain('param');
      expect(result).toContain('value');
    });

    it('should handle null/undefined args', () => {
      expect(formatToolCallArgs('ls', null)).toBe('无参数');
      expect(formatToolCallArgs('ls', undefined)).toBe('无参数');
    });
  });
});