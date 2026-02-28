import { TerminalAdapter } from '@/presentation/console/terminal-adapter';
import { OutputEvent } from '@/core/agent/adapter';

// Mock the styled functions
jest.mock('@/presentation/styling/output-styler', () => ({
  styled: {
    toolCall: jest.fn().mockReturnValue('tool call output'),
    toolResult: jest.fn().mockReturnValue('tool result output'),
    system: jest.fn().mockReturnValue('system message'),
    error: jest.fn().mockReturnValue('error message'),
    hint: jest.fn().mockReturnValue('hint message'),
    assistant: jest.fn().mockReturnValue('assistant message'),
    truncated: jest.fn().mockImplementation((text: string, limit: number) => {
      if (typeof text !== 'string') return String(text ?? '');
      return text.length <= limit ? text : text.substring(0, limit) + '...';
    })
  }
}));

// Mock config
jest.mock('@/core/config', () => ({
  config: {
    output: { verbose: false },
    specialKeyword: { keyword: '干活' }
  }
}));

describe('TerminalAdapter - handleToolResult Branch Coverage', () => {
  let adapter: TerminalAdapter;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new TerminalAdapter();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    adapter.destroy();
    consoleSpy.mockRestore();
  });

  const emitToolResult = async (data: any) => {
    await adapter.emit({ type: 'toolResult', data, timestamp: Date.now() } as OutputEvent);
  };

  it('should handle toolResult with preview field (legacy format)', async () => {
    await emitToolResult({ name: 'testTool', success: true, preview: 'output text' });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isTaskResult flag - result includes ▸ 结果:', async () => {
    await emitToolResult({
      name: '子代理任务',
      success: true,
      isTaskResult: true,
      result: '▸ 结果: some output'
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isTaskResult flag - result is a plain string', async () => {
    await emitToolResult({
      name: '子代理任务',
      success: true,
      isTaskResult: true,
      result: 'plain result string'
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isTextResult flag', async () => {
    await emitToolResult({
      name: 'grep',
      success: true,
      isTextResult: true,
      result: 'some grep output'
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isJsonResult and task tool with message', async () => {
    await emitToolResult({
      name: '子代理任务',
      success: true,
      isJsonResult: true,
      result: { message: 'Task completed successfully' }
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isJsonResult and task tool with string result', async () => {
    await emitToolResult({
      name: 'task',
      success: true,
      isJsonResult: true,
      result: 'simple string'
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isJsonResult and task tool with object (no message)', async () => {
    await emitToolResult({
      name: 'task',
      success: true,
      isJsonResult: true,
      result: { stdout: 'something' }
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isJsonResult and non-task tool with command', async () => {
    await emitToolResult({
      name: 'bash',
      success: true,
      isJsonResult: true,
      result: { command: 'ls -la', stdout: 'file1\nfile2', stderr: '(empty)' }
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isJsonResult and non-task tool with filepath', async () => {
    await emitToolResult({
      name: 'view-file',
      success: true,
      isJsonResult: true,
      result: { filepath: '/src/index.ts', stdout: '', stderr: '(empty)' }
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isJsonResult and stdout only', async () => {
    await emitToolResult({
      name: 'bash',
      success: true,
      isJsonResult: true,
      result: { stdout: 'output line 1\noutput line 2', stderr: '(empty)' }
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with isJsonResult and stderr', async () => {
    await emitToolResult({
      name: 'bash',
      success: false,
      isJsonResult: true,
      result: { stderr: 'some error message\ndetails', stdout: '(empty)' }
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle toolResult with raw result string (no flags)', async () => {
    await emitToolResult({
      name: 'view-file',
      success: true,
      result: 'raw file content'
    });
    expect(consoleSpy).toHaveBeenCalledWith('tool result output');
  });

  it('should handle verbose mode in toolResult preview', async () => {
    // Test verbose=true path
    jest.resetModules();
    jest.doMock('@/core/config', () => ({
      config: {
        output: { verbose: true },
        specialKeyword: { keyword: '干活' }
      }
    }));
    jest.doMock('@/presentation/styling/output-styler', () => ({
      styled: {
        toolCall: jest.fn().mockReturnValue('tool call output'),
        toolResult: jest.fn().mockReturnValue('tool result output'),
        system: jest.fn().mockReturnValue('system message'),
        error: jest.fn().mockReturnValue('error message'),
        hint: jest.fn().mockReturnValue('hint message'),
        assistant: jest.fn().mockReturnValue('assistant message'),
        truncated: jest.fn().mockImplementation((text: string, limit: number) => {
          return typeof text === 'string' ? text : String(text ?? '');
        })
      }
    }));
    const { TerminalAdapter: VerboseAdapter } = require('@/presentation/console/terminal-adapter');
    const verboseAdapter = new VerboseAdapter();
    const verboseConsoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    await verboseAdapter.emit({
      type: 'toolResult',
      data: { name: 'testTool', success: true, preview: 'result text' },
      timestamp: Date.now()
    });
    
    verboseAdapter.destroy();
    verboseConsoleSpy.mockRestore();
  });
});
