import { styled } from '@/presentation/lark/styler';

// Mock config
jest.mock('@/core/config', () => ({
  config: {
    lark: {
      interactiveTemplateId: 'test-template-id'
    }
  }
}));

describe('Lark Output Styler', () => {
  describe('assistant', () => {
    it('should format assistant message with template', () => {
      const result = styled.assistant('test message');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('test message');
    });

    it('should handle empty message', () => {
      const result = styled.assistant('');
      expect(result).toContain('无内容');
    });
  });

  describe('toolCall', () => {
    it('should format regular tool call', () => {
      const result = styled.toolCall('test-tool', {param: 'value'});
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('test-tool');
      expect(result).toContain('param');
    });

    it('should format task tool call', () => {
      const result = styled.toolCall('task', {subagent_type: 'coder', description: 'test task'});
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('coder');
      expect(result).toContain('test task');
    });

    it('should handle null args', () => {
      const result = styled.toolCall('test-tool', null);
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('无参数');
    });

    it('should handle string args', () => {
      const result = styled.toolCall('test-tool', 'string arg');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('string arg');
    });
  });

  describe('toolResult', () => {
    it('should format successful tool result', () => {
      const result = styled.toolResult('test-tool', true, '{"stdout": "output"}');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('✅');
      expect(result).toContain('output');
    });

    it('should format failed tool result', () => {
      const result = styled.toolResult('test-tool', false, '{"error": "test error"}');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('❌');
      expect(result).toContain('test error');
    });

    it('should format task result', () => {
      const result = styled.toolResult('子代理任务', true, 'task completed');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('✅');
      expect(result).toContain('task completed');
    });
  });

  describe('system', () => {
    it('should format system message with title and text', () => {
      const result = styled.system('test title', 'test text');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('test title');
      expect(result).toContain('test text');
    });

    it('should format system message with only text', () => {
      const result = styled.system('test text');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('系统消息');
      expect(result).toContain('test text');
    });
  });

  describe('error', () => {
    it('should format error message', () => {
      const result = styled.error('test error');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('❌ 错误消息');
      expect(result).toContain('test error');
    });

    it('should format multiline error message', () => {
      const result = styled.error('line1\nline2');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('```');
      expect(result).toContain('line1');
      expect(result).toContain('line2');
    });
  });

  describe('hint', () => {
    it('should format hint message', () => {
      const result = styled.hint('test hint');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('💡 提示消息');
      expect(result).toContain('test hint');
    });
  });

  describe('truncated', () => {
    it('should return original when within limit', () => {
      const result = styled.truncated('short text', 20);
      expect(result).toBe('short text');
    });

    it('should truncate when exceeding limit', () => {
      const result = styled.truncated('this is a very long text', 10);
      expect(result).toContain('this is a ');
      expect(result).toContain('已截断');
    });
  });

  describe('thinkingProcess', () => {
    it('should handle empty steps', () => {
      const result = styled.thinkingProcess([]);
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('无思考步骤');
    });

    it('should handle single step', () => {
      const result = styled.thinkingProcess([{content: 'thinking step'}]);
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('thinking step');
    });

    it('should handle multiple steps', () => {
      const result = styled.thinkingProcess([{content: 'step1'}, {content: 'step2'}]);
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('step1');
      expect(result).toContain('step2');
    });
  });

  describe('detailedThinkingMode', () => {
    it('should accept custom mode', () => {
      const result = styled.detailedThinkingMode('custom mode');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('custom mode');
    });
    
    it('should use default mode when "干活模式" is provided', () => {
      const result = styled.detailedThinkingMode('干活模式');
      expect(result).toContain('{"msg_type":"interactive"');
      expect(result).toContain('干活模式');
    });
  });

  describe('formatTaskResultPreview', () => {
    it('should handle null result', () => {
      const result = styled.formatTaskResultPreview(null, false);
      expect(result).toContain('任务已完成');
    });

    it('should handle string result', () => {
      const result = styled.formatTaskResultPreview('test result', false);
      expect(result).toContain('test result');
    });

    it('should handle error string result', () => {
      const result = styled.formatTaskResultPreview('Error: test error', false);
      expect(result).toContain('❌');
      expect(result).toContain('Error: test error');
    });

    it('should handle object result with stdout/stderr', () => {
      const result = styled.formatTaskResultPreview({stdout: 'output', stderr: 'error'}, false);
      expect(result).toContain('标准输出');
      expect(result).toContain('标准错误');
    });
  });

  describe('getTaskDisplayName', () => {
    it('should return display name with subagent type', () => {
      const result = styled.getTaskDisplayName('coder');
      expect(result).toBe('🧠 coder 结果');
    });

    it('should return default name without subagent type', () => {
      const result = styled.getTaskDisplayName();
      expect(result).toBe('子代理任务');
    });
  });

  describe('formatToolResultPreview', () => {
    it('should handle null result', () => {
      const result = styled.formatToolResultPreview(null, false);
      expect(result).toContain('无有效结果');
    });

    it('should handle object result with command', () => {
      const result = styled.formatToolResultPreview({command: 'test command'}, false);
      expect(result).toContain('执行命令');
      expect(result).toContain('test command');
    });

    it('should handle object result with stdout/stderr', () => {
      const result = styled.formatToolResultPreview({stdout: 'output', stderr: 'error'}, false);
      expect(result).toContain('标准输出');
      expect(result).toContain('标准错误');
    });
  });
});