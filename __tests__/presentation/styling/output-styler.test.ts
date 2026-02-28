import { styled } from '@/presentation/styling/styler';

// Mock config
jest.mock('@/core/config', () => ({
  config: {
    output: {
      verbose: false
    }
  }
}));

describe('OutputStyler', () => {
  describe('assistant', () => {
    test('should format assistant message with emoji', () => {
      const result = styled.assistant('Hello world');
      expect(result).toBe('\n🤖 Hello world');
    });
  });

  describe('toolCall', () => {
    test('should format regular tool call', () => {
      const result = styled.toolCall('testTool', { param: 'value' });
      expect(result).toContain('🔧 正在调用工具: testTool');
      expect(result).toContain('参数:');
      expect(result).toContain('"param": "value"');
    });

    test('should format task tool call with subagent type', () => {
      const result = styled.toolCall('task', { 
        subagent_type: 'researcher', 
        description: 'Research AI trends' 
      });
      expect(result).toContain('🧠 正在委派任务给 researcher 代理');
      expect(result).toContain('任务描述: Research AI trends');
    });

    test('should format task tool call without description', () => {
      const result = styled.toolCall('task', { subagent_type: 'researcher' });
      expect(result).toContain('任务描述: 执行复杂任务');
    });
  });

  describe('toolResult', () => {
    test('should format regular tool result success', () => {
      const result = styled.toolResult('testTool', true, 'success preview');
      expect(result).toBe('\n✅ 工具执行 testTool: 成功\nsuccess preview');
    });

    test('should format regular tool result failure', () => {
      const result = styled.toolResult('testTool', false, 'error preview');
      expect(result).toBe('\n❌ 工具执行 testTool: 失败\nerror preview');
    });

    test('should format task tool result with regex match', () => {
      const result = styled.toolResult('子代理任务', true, 'task completed');
      expect(result).toBe('\n✅ 子代理任务: 完成\ntask completed');
    });

    test('should format task tool result with emoji pattern', () => {
      const result = styled.toolResult('🧠 researcher 结果', true, 'research done');
      expect(result).toBe('\n✅ 🧠 researcher 结果: 完成\nresearch done');
    });
  });

  describe('system', () => {
    test('should format system message with emoji', () => {
      const result = styled.system('System message');
      expect(result).toBe('\n⚙️  System message');
    });
  });

  describe('error', () => {
    test('should format error message with emoji', () => {
      const result = styled.error('Error message');
      expect(result).toBe('\n❌ Error message');
    });
  });

  describe('hint', () => {
    test('should format hint message with emoji', () => {
      const result = styled.hint('Hint message');
      expect(result).toBe('\n💡 Hint message');
    });
  });

  describe('formatTaskResultPreview', () => {
    test('should handle object with empty stdout and stderr', () => {
      const result = styled.formatTaskResultPreview({ stdout: "(empty)", stderr: "(empty)" }, false);
      expect(result).toBe('无输出');
    });

    test('should handle object with message', () => {
      const result = styled.formatTaskResultPreview({ message: 'Task result' }, false);
      expect(result).toBe('▸ 结果: Task result');
    });

    test('should handle object without message', () => {
      const result = styled.formatTaskResultPreview({ other: 'data' }, false);
      expect(result).toBe('▸ 任务已完成');
    });

    test('should handle string result', () => {
      const result = styled.formatTaskResultPreview('String result', false);
      expect(result).toBe('▸ 结果: String result');
    });

    test('should handle other types', () => {
      const result = styled.formatTaskResultPreview(123, false);
      expect(result).toBe('▸ 任务已完成');
    });

    test('should truncate long messages in non-verbose mode', () => {
      const longMessage = 'a'.repeat(200);
      const result = styled.formatTaskResultPreview({ message: longMessage }, false);
      expect(result).toContain('... [已截断');
    });

    test('should truncate long messages in verbose mode', () => {
      const longMessage = 'a'.repeat(400);
      const result = styled.formatTaskResultPreview({ message: longMessage }, true);
      expect(result).toContain('... [已截断');
    });
  });

  describe('getTaskDisplayName', () => {
    test('should return display name with subagent type', () => {
      const result = styled.getTaskDisplayName('researcher');
      expect(result).toBe('🧠 researcher 结果');
    });

    test('should return default display name without subagent type', () => {
      const result = styled.getTaskDisplayName();
      expect(result).toBe('子代理任务');
    });
  });

  describe('formatToolResultPreview', () => {
    test('should handle command', () => {
      const result = styled.formatToolResultPreview({ command: 'ls -la' }, false);
      expect(result).toBe('▸ 命令: ls -la');
    });

    test('should handle filepath', () => {
      const result = styled.formatToolResultPreview({ filepath: '/path/to/file' }, false);
      expect(result).toBe('▸ 文件: /path/to/file');
    });

    test('should handle stdout', () => {
      const result = styled.formatToolResultPreview({ stdout: 'output content' }, false);
      expect(result).toContain('▸ 输出: output content');
    });

    test('should handle empty stdout', () => {
      const result = styled.formatToolResultPreview({ stdout: '(empty)' }, false);
      expect(result).toBe('无输出');
    });

    test('should handle stderr', () => {
      const result = styled.formatToolResultPreview({ stderr: 'error content' }, false);
      expect(result).toContain('▸ 错误: error content');
    });

    test('should handle empty stderr', () => {
      const result = styled.formatToolResultPreview({ stderr: '(empty)' }, false);
      expect(result).toBe('无输出');
    });

    test('should handle complex result with command, stdout, and stderr', () => {
      const result = styled.formatToolResultPreview({ 
        command: 'ls -la',
        stdout: 'file1.txt\nfile2.txt',
        stderr: 'warning'
      }, false);
      expect(result).toContain('▸ 命令: ls -la');
      expect(result).toContain('▸ 输出: file1.txt');
      expect(result).toContain('▸ 错误: warning');
    });

    test('should truncate long stdout in non-verbose mode', () => {
      const longOutput = 'a'.repeat(100);
      const result = styled.formatToolResultPreview({ stdout: longOutput }, false);
      expect(result).toContain('... [已截断');
    });

    test('should truncate long stdout in verbose mode', () => {
      const longOutput = 'a'.repeat(300);
      const result = styled.formatToolResultPreview({ stdout: longOutput }, true);
      expect(result).toContain('... [已截断');
    });

    test('should return "无输出" for empty result', () => {
      const result = styled.formatToolResultPreview({}, false);
      expect(result).toBe('无输出');
    });
  });

  describe('truncated', () => {
    test('should return original text when within limit', () => {
      const result = styled.truncated('short text', 20);
      expect(result).toBe('short text');
    });

    test('should truncate text when exceeding limit', () => {
      const result = styled.truncated('long text that exceeds limit', 10);
      expect(result).toContain('... [已截断');
    });

    test('should handle multi-line text truncation', () => {
      const multiLineText = 'line1\nline2\nline3\nline4';
      const result = styled.truncated(multiLineText, 15);
      expect(result).toContain('... [已截断');
      expect(result).toContain('行');
    });

    test('should calculate correct character count', () => {
      const text = 'a'.repeat(100);
      const result = styled.truncated(text, 50);
      expect(result).toContain('[已截断 50 字符');
    });
  });

  describe('thinkingProcess', () => {
    test('should return empty string for empty steps', () => {
      const result = styled.thinkingProcess([]);
      expect(result).toBe('');
    });

    test('should return empty string for null steps', () => {
      const result = styled.thinkingProcess(null as any);
      expect(result).toBe('');
    });

    test('should format single step', () => {
      const result = styled.thinkingProcess([{ content: 'thinking step' }]);
      expect(result).toBe('\n🧠 深度思考过程:\n💭 步骤 1: thinking step');
    });

    test('should format multiple steps', () => {
      const result = styled.thinkingProcess([
        { content: 'step 1' },
        { content: 'step 2', status: 'completed' },
        { content: 'step 3', status: 'in_progress' }
      ]);
      expect(result).toContain('💭 步骤 1: step 1');
      expect(result).toContain('✅ 步骤 2: step 2');
      expect(result).toContain('🔄 步骤 3: step 3');
    });
  });

  describe('detailedThinkingMode', () => {
    test('should format detailed thinking mode with custom mode', () => {
      const result = styled.detailedThinkingMode('research mode');
      expect(result).toBe('\n🔍 进入research mode - 展示完整思考过程...');
    });
    
    test('should format detailed thinking mode with default mode', () => {
      const result = styled.detailedThinkingMode('干活模式');
      expect(result).toBe('\n🔍 进入干活模式 - 展示完整思考过程...');
    });
  });
});