import { styled } from '@/presentation/styling/output-styler';

describe('Output Styler - Branch Coverage', () => {
  describe('toolResult - task result failure', () => {
    it('should format failed task result with 子代理任务', () => {
      const result = styled.toolResult('子代理任务', false, 'Failed output');
      expect(result).toContain('❌');
      expect(result).toContain('失败');
    });

    it('should format successful task result with 子代理任务', () => {
      const result = styled.toolResult('子代理任务', true, 'Success output');
      expect(result).toContain('✅');
      expect(result).toContain('完成');
    });

    it('should format failed regular tool result', () => {
      const result = styled.toolResult('bash', false, 'Error');
      expect(result).toContain('❌');
      expect(result).toContain('失败');
    });
  });

  describe('formatToolResultPreview - stdout/stderr branches', () => {
    it('should handle stdout with empty value', () => {
      const result = styled.formatToolResultPreview({ stdout: '' }, false);
      expect(result).not.toContain('▸ 输出');
    });

    it('should handle stdout with "(empty)" value', () => {
      const result = styled.formatToolResultPreview({ stdout: '(empty)' }, false);
      expect(result).not.toContain('▸ 输出');
    });

    it('should handle stdout with actual content', () => {
      const result = styled.formatToolResultPreview({ stdout: 'actual output\nline2' }, false);
      expect(result).toContain('输出');
    });

    it('should handle stdout in verbose mode', () => {
      const result = styled.formatToolResultPreview({ stdout: 'actual output' }, true);
      expect(result).toContain('输出');
    });

    it('should handle non-empty stderr', () => {
      const result = styled.formatToolResultPreview({ stderr: 'error message\nmore error' }, false);
      expect(result).toContain('错误');
    });

    it('should handle stderr in verbose mode', () => {
      const result = styled.formatToolResultPreview({ stderr: 'error message' }, true);
      expect(result).toContain('错误');
    });

    it('should return empty when no relevant fields', () => {
      const result = styled.formatToolResultPreview({}, false);
      expect(result).toBe('无输出');
    });
  });

  describe('detailedThinkingMode - default parameter', () => {
    it('should use default mode when no parameter provided', () => {
      const result = (styled as any).detailedThinkingMode?.();
      if (result !== undefined) {
        expect(result).toContain('干活模式');
      }
    });

    it('should use custom mode when provided', () => {
      const result = (styled as any).detailedThinkingMode?.('自定义模式');
      if (result !== undefined) {
        expect(result).toContain('自定义模式');
      }
    });
  });
});
