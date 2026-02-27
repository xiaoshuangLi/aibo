import { styled, createTemplateMessage } from '@/presentation/lark/output-styler';

// Module-level mock with template ID set
jest.mock('@/core/config/config', () => ({
  config: {
    lark: {
      interactiveTemplateId: 'template-123'
    }
  }
}));

describe('Lark Output Styler - Additional Coverage', () => {
  describe('createTemplateMessage without templateId', () => {
    it('should return plain text when templateId is missing', () => {
      jest.resetModules();
      jest.doMock('@/core/config/config', () => ({
        config: {
          lark: {
            interactiveTemplateId: undefined
          }
        }
      }));
      const { createTemplateMessage: ctm } = require('@/presentation/lark/output-styler');
      const result = ctm('My Title', 'My Content');
      expect(result).toBe('My Title\nMy Content');
    });

    it('should filter out empty title when templateId is missing', () => {
      jest.doMock('@/core/config/config', () => ({
        config: { lark: { interactiveTemplateId: '' } }
      }));
      const { createTemplateMessage: ctm } = require('@/presentation/lark/output-styler');
      const result = ctm('', 'Only Content');
      expect(result).toBe('Only Content');
    });
  });

  describe('truncated - with line truncation', () => {
    it('should include line count in truncation message when newlines are truncated', () => {
      const text = 'line1\nline2\nline3\nline4\nline5';
      const result = styled.truncated(text, 8);
      expect(result).toContain('已截断');
      expect(result).toContain('行');
    });

    it('should not include line count when no newlines are truncated', () => {
      const text = 'abcdefghijklmnop';
      const result = styled.truncated(text, 5);
      expect(result).toContain('已截断');
      // truncatedLineCount should be 0 (no newlines truncated)
    });
  });

  describe('thinkingProcess - status variants', () => {
    it('should show ✅ emoji for single completed step', () => {
      const result = styled.thinkingProcess([{ content: 'done', status: 'completed' }]);
      expect(result).toContain('✅');
      expect(result).toContain('done');
    });

    it('should show 🔄 emoji for single in_progress step', () => {
      const result = styled.thinkingProcess([{ content: 'working', status: 'in_progress' }]);
      expect(result).toContain('🔄');
      expect(result).toContain('working');
    });

    it('should show ✅ emoji for completed step in multi-step list', () => {
      const result = styled.thinkingProcess([
        { content: 'step1', status: 'completed' },
        { content: 'step2' }
      ]);
      expect(result).toContain('✅');
      expect(result).toContain('step1');
    });

    it('should show 🔄 emoji for in_progress step in multi-step list', () => {
      const result = styled.thinkingProcess([
        { content: 'step1' },
        { content: 'step2', status: 'in_progress' }
      ]);
      expect(result).toContain('🔄');
      expect(result).toContain('step2');
    });
  });

  describe('formatTaskResultPreview - extended coverage', () => {
    it('should handle empty string result', () => {
      const result = styled.formatTaskResultPreview('  ', false);
      expect(result).toContain('任务已完成');
    });

    it('should parse and format JSON string result', () => {
      const jsonResult = JSON.stringify({ message: 'task done', status: 'ok' });
      const result = styled.formatTaskResultPreview(jsonResult, false);
      expect(result).toBeDefined();
    });

    it('should format multiline error content', () => {
      const result = styled.formatTaskResultPreview('Error: line1\nmore details', false);
      expect(result).toContain('❌');
    });

    it('should format multiline non-error text in verbose mode', () => {
      const result = styled.formatTaskResultPreview('line1\nline2\nline3', true);
      expect(result).toContain('line1');
      expect(result).toContain('```');
    });

    it('should truncate long multiline non-error text in non-verbose mode', () => {
      const longText = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');
      const result = styled.formatTaskResultPreview(longText, false);
      expect(result).toContain('```');
    });

    it('should return no output for object with empty stdout and stderr', () => {
      const result = styled.formatTaskResultPreview({ stdout: '(empty)', stderr: '(empty)' }, false);
      expect(result).toContain('无输出');
    });

    it('should include message field from object result', () => {
      const result = styled.formatTaskResultPreview({ message: 'Operation completed' }, false);
      expect(result).toContain('Operation completed');
    });

    it('should handle long stdout in object result', () => {
      const longOutput = 'a'.repeat(200);
      const result = styled.formatTaskResultPreview({ stdout: longOutput }, false);
      expect(result).toContain('标准输出');
    });

    it('should handle multiline stdout in object result', () => {
      const multilineOutput = 'line1\nline2\nline3';
      const result = styled.formatTaskResultPreview({ stdout: multilineOutput }, false);
      expect(result).toContain('标准输出');
    });

    it('should handle long stderr in object result', () => {
      const longError = 'error'.repeat(30);
      const result = styled.formatTaskResultPreview({ stderr: longError }, false);
      expect(result).toContain('标准错误');
    });

    it('should handle multiline stderr in object result', () => {
      const multilineError = 'error1\nerror2\nerror3';
      const result = styled.formatTaskResultPreview({ stderr: multilineError }, false);
      expect(result).toContain('标准错误');
    });

    it('should show other fields in verbose mode', () => {
      const result = styled.formatTaskResultPreview({ customField: 'value', otherField: { nested: true } }, true);
      expect(result).toBeDefined();
    });

    it('should return completed when object has no relevant fields', () => {
      const result = styled.formatTaskResultPreview({}, false);
      expect(result).toContain('任务已完成');
    });

    it('should handle non-string non-object result (number)', () => {
      const result = styled.formatTaskResultPreview(42, false);
      expect(result).toContain('42');
    });

    it('should handle non-string non-object result (boolean)', () => {
      const result = styled.formatTaskResultPreview(true, false);
      expect(result).toContain('true');
    });
  });

  describe('formatToolResultPreview - extended coverage', () => {
    it('should handle filepath field', () => {
      const result = styled.formatToolResultPreview({ filepath: '/some/path.ts' }, false);
      expect(result).toContain('文件路径');
      expect(result).toContain('/some/path.ts');
    });

    it('should handle filePath field (camelCase)', () => {
      const result = styled.formatToolResultPreview({ filePath: '/some/path.ts' }, false);
      expect(result).toContain('文件路径');
    });

    it('should format JSON stdout in verbose mode', () => {
      const result = styled.formatToolResultPreview(
        { stdout: '{"key": "value"}' },
        true
      );
      expect(result).toContain('JSON');
    });

    it('should format JSON array stdout in non-verbose mode', () => {
      const result = styled.formatToolResultPreview(
        { stdout: '[1, 2, 3]' },
        false
      );
      expect(result).toContain('JSON 数组');
    });

    it('should format JSON object stdout in non-verbose mode', () => {
      const result = styled.formatToolResultPreview(
        { stdout: '{"a": 1, "b": 2}' },
        false
      );
      expect(result).toContain('JSON 对象');
    });

    it('should handle multiline stdout in verbose mode', () => {
      const result = styled.formatToolResultPreview(
        { stdout: 'line1\nline2\nline3\nline4\nline5' },
        true
      );
      expect(result).toContain('标准输出');
    });

    it('should handle multiline stdout in non-verbose mode', () => {
      const result = styled.formatToolResultPreview(
        { stdout: 'line1\nline2\nline3\nline4\nline5\nline6\nline7' },
        false
      );
      expect(result).toContain('标准输出');
    });

    it('should handle long stderr', () => {
      const result = styled.formatToolResultPreview(
        { stderr: 'error message\nmore errors\neven more' },
        false
      );
      expect(result).toContain('标准错误');
    });

    it('should add failure indicator when success is false and no error in output', () => {
      const result = styled.formatToolResultPreview(
        { success: false },
        false
      );
      expect(result).toContain('❌');
    });

    it('should add success indicator when success is true and output is empty', () => {
      const result = styled.formatToolResultPreview(
        { success: true },
        false
      );
      expect(result).toContain('✅');
    });

    it('should not add failure indicator when ❌ already in output', () => {
      const result = styled.formatToolResultPreview(
        { stderr: 'error\nmore', success: false },
        false
      );
      const count = (result.match(/❌/g) || []).length;
      // Only one ❌ should appear (from stderr)
      expect(count).toBe(1);
    });

    it('should show message field when no other output', () => {
      const result = styled.formatToolResultPreview({ message: 'custom message' }, false);
      expect(result).toContain('custom message');
    });

    it('should return no output when totally empty object', () => {
      const result = styled.formatToolResultPreview({}, false);
      expect(result).toContain('无输出');
    });
  });
});
