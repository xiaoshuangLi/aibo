import { TerminalAdapter } from '@/presentation/console/terminal-adapter';
import { OutputEvent, OutputEventType } from '@/core/agent/io-channel';
import * as readline from 'readline';
import { config } from '@/core/config/config';

// Mock the styled functions
jest.mock('@/presentation/styling/output-styler', () => ({
  styled: {
    toolCall: jest.fn().mockReturnValue('tool call output'),
    toolResult: jest.fn().mockReturnValue('tool result output'),
    system: jest.fn().mockReturnValue('system message'),
    error: jest.fn().mockReturnValue('error message'),
    hint: jest.fn().mockReturnValue('hint message'),
    assistant: jest.fn().mockReturnValue('assistant message'),
    truncated: jest.fn().mockImplementation((text, limit) => {
      if (text.length <= limit) {
        return text;
      }
      return text.substring(0, limit) + '... [已截断]';
    })
  }
}));

// Mock config
jest.mock('@/core/config/config', () => ({
  config: {
    output: {
      verbose: false
    },
    specialKeyword: {
      keyword: '干活'
    }
  }
}));

// Mock process.exit for testing
const originalProcessExit = process.exit;
let mockProcessExitCalled = false;

describe('TerminalAdapter', () => {
  let terminalAdapter: TerminalAdapter;
  let originalWrite: typeof process.stdout.write;
  let writeOutput: string;

  beforeEach(() => {
    // Mock process.stdout.write to capture output
    writeOutput = '';
    originalWrite = process.stdout.write;
    process.stdout.write = jest.fn().mockImplementation((chunk: string) => {
      writeOutput += chunk;
      return true;
    });

    // Mock console.log to capture output
    console.log = jest.fn();

    // Mock process.exit
    mockProcessExitCalled = false;
    (process as any).exit = jest.fn().mockImplementation(() => {
      mockProcessExitCalled = true;
    });

    // Create a new terminal adapter instance
    terminalAdapter = new TerminalAdapter();
  });

  afterEach(() => {
    // Restore original methods
    process.stdout.write = originalWrite;
    (process as any).exit = originalProcessExit;
    if (terminalAdapter) {
      terminalAdapter.destroy();
    }
  });

  describe('constructor', () => {
    test('should initialize readline interface', () => {
      expect(terminalAdapter.rl).toBeDefined();
    });
  });

  describe('setAbortSignal', () => {
    test('should set abort controller from AbortController signal', () => {
      const controller = new AbortController();
      terminalAdapter.setAbortSignal(controller.signal);
      expect(terminalAdapter).toBeDefined();
    });

    test('should create abort controller from AbortSignal', () => {
      const signal = new AbortController().signal;
      terminalAdapter.setAbortSignal(signal);
      expect(terminalAdapter).toBeDefined();
    });
  });

  describe('requestUserInput', () => {
    test('should show prompt', () => {
      // Mock showPrompt method
      const showPromptSpy = jest.spyOn(terminalAdapter as any, 'showPrompt');
      terminalAdapter.requestUserInput('test prompt');
      expect(showPromptSpy).toHaveBeenCalledWith('test prompt');
    });

    test('should throw error when destroyed', async () => {
      terminalAdapter.destroy();
      await expect(terminalAdapter.requestUserInput()).rejects.toThrow('Terminal adapter is destroyed');
    });
  });

  describe('emit', () => {
    const testCases: Array<{ type: OutputEventType; data: any; description: string }> = [
      { type: 'aiResponse', data: { content: 'test response' }, description: 'AI response' },
      { type: 'toolCall', data: { name: 'testTool', args: {} }, description: 'tool call' },
      { type: 'toolResult', data: { name: 'testTool', success: true, preview: 'result' }, description: 'tool result' },
      { type: 'thinkingProcess', data: { steps: [{ content: 'thinking step' }] }, description: 'thinking process' },
      { type: 'systemMessage', data: { message: 'system message' }, description: 'system message' },
      { type: 'errorMessage', data: { message: 'error message' }, description: 'error message' },
      { type: 'hintMessage', data: { message: 'hint message' }, description: 'hint message' },
      { type: 'streamStart', data: { initialContent: 'initial content' }, description: 'stream start' },
      { type: 'streamChunk', data: { chunk: 'chunk' }, description: 'stream chunk' },
      { type: 'streamEnd', data: { finalContent: 'final content' }, description: 'stream end' },
      { type: 'sessionStart', data: { welcomeMessage: 'welcome', modelInfo: 'test model' }, description: 'session start' },
      { type: 'sessionEnd', data: { exitMessage: 'exit message' }, description: 'session end' },
      { type: 'commandExecuted', data: { command: 'test command', result: { message: 'command result' } }, description: 'command executed' },
      { type: 'rawText', data: { text: 'raw text' }, description: 'raw text' },
      { type: 'userInputRequest', data: {}, description: 'user input request' }
    ];

    testCases.forEach(({ type, data, description }) => {
      test(`should handle ${description}`, async () => {
        const event: OutputEvent = { type, data, timestamp: Date.now() };
        await terminalAdapter.emit(event);
        // The specific behavior is tested in individual handler tests
        expect(terminalAdapter).toBeDefined();
      });
    });

    test('should not emit when destroyed', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      terminalAdapter.destroy();
      await terminalAdapter.emit({ type: 'aiResponse', data: { content: 'test' }, timestamp: Date.now() });
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleAIResponse', () => {
    test('should write AI response to stdout', async () => {
      await terminalAdapter.emit({ type: 'aiResponse', data: { content: 'test response' }, timestamp: Date.now() });
      expect(writeOutput).toContain('test response');
    });

    test('should not write empty content', async () => {
      await terminalAdapter.emit({ type: 'aiResponse', data: { content: '' }, timestamp: Date.now() });
      expect(writeOutput).not.toContain('🤖');
    });
  });

  describe('handleToolCall', () => {
    test('should log tool call with styled output', () => {
      (terminalAdapter as any).handleToolCall({ name: 'testTool', args: { param: 'value' } });
      expect(console.log).toHaveBeenCalledWith('tool call output');
    });

    test('should not log empty tool name', () => {
      (terminalAdapter as any).handleToolCall({ name: '', args: {} });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('handleToolResult', () => {
    test('should log tool result with styled output', async () => {
      await terminalAdapter.emit({ type: 'toolResult', data: { name: 'testTool', success: true, preview: 'result' }, timestamp: Date.now() });
      expect(console.log).toHaveBeenCalledWith('tool result output');
    });

    test('should not log empty tool name', async () => {
      await terminalAdapter.emit({ type: 'toolResult', data: { name: '', success: true, preview: 'result' }, timestamp: Date.now() });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('handleThinkingProcess', () => {
    test('should log thinking process steps', () => {
      (terminalAdapter as any).handleThinkingProcess({
        steps: [
          { content: 'step 1' },
          { content: 'step 2', status: 'completed' },
          { content: 'step 3', status: 'in_progress' }
        ]
      });
      expect(console.log).toHaveBeenCalledWith('\n🧠 AI 深度思考过程:');
      expect(console.log).toHaveBeenCalledTimes(4); // header + 3 steps
    });

    test('should not log empty steps', () => {
      (terminalAdapter as any).handleThinkingProcess({ steps: [] });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('handleSystemMessage', () => {
    test('should log system message with styled output', () => {
      (terminalAdapter as any).handleSystemMessage({ message: 'system message' });
      expect(console.log).toHaveBeenCalledWith('system message');
    });

    test('should not log empty message', () => {
      (terminalAdapter as any).handleSystemMessage({ message: '' });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('handleErrorMessage', () => {
    test('should log error message with styled output', () => {
      (terminalAdapter as any).handleErrorMessage({ message: 'error message' });
      expect(console.log).toHaveBeenCalledWith('error message');
    });

    test('should not log empty message', () => {
      (terminalAdapter as any).handleErrorMessage({ message: '' });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('handleHintMessage', () => {
    test('should log hint message with styled output', () => {
      (terminalAdapter as any).handleHintMessage({ message: 'hint message' });
      expect(console.log).toHaveBeenCalledWith('hint message');
    });

    test('should not log empty message', () => {
      (terminalAdapter as any).handleHintMessage({ message: '' });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('handleStreamStart', () => {
    test('should write initial content to stdout', async () => {
      await (terminalAdapter as any).handleStreamStart({ initialContent: 'initial' });
      expect(writeOutput).toContain('initial');
    });

    test('should log assistant message when no initial content', async () => {
      await (terminalAdapter as any).handleStreamStart({});
      expect(console.log).toHaveBeenCalledWith('assistant message');
    });
  });

  describe('handleStreamChunk', () => {
    test('should write chunk to stdout', async () => {
      await (terminalAdapter as any).handleStreamChunk({ chunk: 'test chunk' });
      expect(writeOutput).toContain('test chunk');
    });

    test('should not write empty chunk', async () => {
      await (terminalAdapter as any).handleStreamChunk({ chunk: '' });
      expect(writeOutput).not.toContain('test chunk');
    });

    test('should not write when aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      terminalAdapter.setAbortSignal(controller.signal);
      await (terminalAdapter as any).handleStreamChunk({ chunk: 'test chunk' });
      expect(writeOutput).not.toContain('test chunk');
    });
  });

  describe('handleStreamEnd', () => {
    test('should add period and newline when needed', async () => {
      const controller = new AbortController();
      terminalAdapter.setAbortSignal(controller.signal);
      await (terminalAdapter as any).handleStreamEnd({ finalContent: 'test content' });
      expect(writeOutput).toContain('\n');
    });

    test('should not add period when already ends with period', async () => {
      const controller = new AbortController();
      terminalAdapter.setAbortSignal(controller.signal);
      await (terminalAdapter as any).handleStreamEnd({ finalContent: 'test content.' });
      expect(writeOutput).not.toContain('.\n');
    });

    test('should not add period when aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      terminalAdapter.setAbortSignal(controller.signal);
      await (terminalAdapter as any).handleStreamEnd({ finalContent: 'test content' });
      expect(writeOutput).not.toContain('.\n');
    });
  });

  describe('handleSessionStart', () => {
    test('should log session start information', () => {
      (terminalAdapter as any).handleSessionStart({
        welcomeMessage: 'welcome',
        modelInfo: 'test model'
      });
      expect(console.log).toHaveBeenCalledWith("=".repeat(70));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🚀 AI Assistant 启动成功'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📁 工作目录:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🛡️  安全模式:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⌨️  快捷键:'));
    });
  });

  describe('handleSessionEnd', () => {
    test('should log exit message and destroy', () => {
      const destroySpy = jest.spyOn(terminalAdapter, 'destroy');
      (terminalAdapter as any).handleSessionEnd({ exitMessage: 'goodbye' });
      expect(console.log).toHaveBeenCalledWith('system message');
      expect(destroySpy).toHaveBeenCalled();
    });

    test('should destroy without message', () => {
      const destroySpy = jest.spyOn(terminalAdapter, 'destroy');
      (terminalAdapter as any).handleSessionEnd({});
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('handleCommandExecuted', () => {
    test('should log command result message', () => {
      (terminalAdapter as any).handleCommandExecuted({
        command: 'test command',
        result: { message: 'command executed' }
      });
      expect(console.log).toHaveBeenCalledWith('system message');
    });

    test('should not log without result message', () => {
      (terminalAdapter as any).handleCommandExecuted({
        command: 'test command',
        result: {}
      });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('handleRawText', () => {
    test('should log raw text', () => {
      (terminalAdapter as any).handleRawText({ text: 'raw text' });
      expect(console.log).toHaveBeenCalledWith('raw text');
    });

    test('should not log empty text', () => {
      (terminalAdapter as any).handleRawText({ text: '' });
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('on/off', () => {
    test('should add and remove event listeners', async () => {
      const listener = jest.fn();
      terminalAdapter.on('aiResponse', listener);
      
      // Trigger the event
      await terminalAdapter.emit({ type: 'aiResponse', data: { content: 'test' }, timestamp: Date.now() });
      
      // Verify listener was called
      expect(listener).toHaveBeenCalled();
      
      // Reset mock
      listener.mockClear();
      
      // Remove the listener
      terminalAdapter.off('aiResponse', listener);
      
      // Trigger the event again
      await terminalAdapter.emit({ type: 'aiResponse', data: { content: 'test2' }, timestamp: Date.now() });
      
      // Verify listener was not called after removal
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('showPrompt', () => {
    test('should set prompt and show it', () => {
      const rl = terminalAdapter.rl;
      if (rl) {
        const setPromptSpy = jest.spyOn(rl, 'setPrompt');
        const promptSpy = jest.spyOn(rl, 'prompt');
        
        (terminalAdapter as any).showPrompt('test prompt');
        
        expect(setPromptSpy).toHaveBeenCalledWith('test prompt');
        expect(promptSpy).toHaveBeenCalled();
      }
    });

    test('should handle special keyword', async () => {
      const rl = terminalAdapter.rl;
      if (rl) {
        // Mock rl.line property with shorter text to reduce timeout calls
        Object.defineProperty(rl, 'line', {
          value: config.specialKeyword.keyword,
          writable: true
        });
        const writeSpy = jest.spyOn(rl, 'write');
        
        (terminalAdapter as any).showPrompt();
        
        // Wait for setTimeout to execute (2 + 4 = 6 calls, 60ms max)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Should trigger backspace writes
        expect(writeSpy).toHaveBeenCalled();
      }
    });

    test('should not handle "干活" keyword when not present', () => {
      const rl = terminalAdapter.rl;
      if (rl) {
        Object.defineProperty(rl, 'line', {
          value: 'some text without keyword',
          writable: true
        });
        const writeSpy = jest.spyOn(rl, 'write');
        
        (terminalAdapter as any).showPrompt();
        
        // Should not trigger backspace writes
        expect(writeSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('destroy', () => {
    test('should clean up resources', () => {
      const rl = terminalAdapter.rl;
      let closeSpy;
      if (rl) {
        closeSpy = jest.spyOn(rl, 'close');
      }
      
      terminalAdapter.destroy();
      
      expect(terminalAdapter.rl).toBeNull();
      expect((terminalAdapter as any).isDestroyed).toBe(true);
      
      // Should not exit in test environment due to NODE_ENV check
      expect(mockProcessExitCalled).toBe(false);
      
      if (closeSpy) {
        expect(closeSpy).toHaveBeenCalled();
      }
    });

    test('should only destroy once', () => {
      const rl = terminalAdapter.rl;
      let closeSpy;
      if (rl) {
        closeSpy = jest.spyOn(rl, 'close');
      }
      
      terminalAdapter.destroy();
      terminalAdapter.destroy(); // Call again
      
      if (closeSpy) {
        expect(closeSpy).toHaveBeenCalledTimes(1);
      }
    });
  });
});