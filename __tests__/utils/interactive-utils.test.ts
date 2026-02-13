import { styled } from '../../src/presentation/styling/output-styler';
import { extractMessagesAndTodos } from '../../src/core/agent/message-processor';
import { 
  handleToolCall, 
  handleToolResult, 
  handleJsonToolResult, 
  handleTextToolResult, 
  handleAIContent, 
  handleTodos,
  processStreamChunks,
  StreamState
} from '../../src/core/agent/stream-handler';
import { 
  showPrompt,
  handleUserInput,
  startInputLoop,
  Session
} from '../../src/presentation/console/user-input-handler';
import { createGracefulShutdown } from '../../src/core/session/graceful-shutdown';

import { HumanMessage } from 'langchain';
import { config } from '../../src/core/config/config';
import { structuredLog } from '../../src/shared/utils/logging';
import { shouldExitInteractiveMode, isEmptyInput } from '../../src/core/session/interactive-logic';

// ===== 模拟外部依赖 =====
jest.mock('../../src/core/config/Config', () => ({
  config: {
    output: {
      verbose: false,
    },
  },
}));

const setVerboseMode = (verbose: boolean) => {
  jest.mocked(require('../../src/core/config/Config')).config.output.verbose = verbose;
};

jest.mock('../../src/shared/utils/logging', () => ({
  structuredLog: jest.fn(),
}));

jest.mock('../../src/core/session/interactive-logic', () => ({
  shouldExitInteractiveMode: jest.fn(),
  isEmptyInput: jest.fn(),
  createConsoleThreadId: jest.fn(),
}));

const createState = (): any => ({
  fullResponse: '',
  lastToolCall: null,
  hasDisplayedThinking: false,
  abortSignal: new AbortController().signal,
});

// ===== 工具函数 =====
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation();
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

beforeEach(() => {
  mockConsoleLog.mockClear();
  mockConsoleError.mockClear();
  mockStdoutWrite.mockClear();
  (structuredLog as jest.Mock).mockClear();
  (shouldExitInteractiveMode as jest.Mock).mockReset();
  (isEmptyInput as jest.Mock).mockReset();
});

// ===== 测试 styled 工具函数 =====
describe('styled utilities', () => {
  it('should format assistant message', () => {
    expect(styled.assistant('hello')).toBe('\n🤖 hello');
  });

  it('should format tool call with args', () => {
    const output = styled.toolCall('search', { q: 'jest' });
    expect(output).toContain('🔧 正在调用工具: search');
    expect(output).toContain('"q": "jest"');
  });

  it('should format task tool call with friendly message', () => {
    const output = styled.toolCall('task', { 
      subagent_type: 'general-purpose', 
      description: 'Research and analyze data' 
    });
    expect(output).toContain('🧠 正在委派任务给 general-purpose 代理');
    expect(output).toContain('任务描述: Research and analyze data');
  });

  it('should format task tool call without description', () => {
    const output = styled.toolCall('task', { 
      subagent_type: 'general-purpose' 
    });
    expect(output).toContain('🧠 正在委派任务给 general-purpose 代理');
    expect(output).toContain('任务描述: 执行复杂任务');
  });

  it('should format tool result with success', () => {
    const output = styled.toolResult('search', true, 'result');
    expect(output).toContain('✅');
    expect(output).toContain('成功');
  });

  it('should format tool result with failure', () => {
    const output = styled.toolResult('search', false, 'error');
    expect(output).toContain('❌');
    expect(output).toContain('失败');
  });

  it('should truncate long text', () => {
    const longText = 'a'.repeat(200);
    const truncated = styled.truncated(longText, 100);
    expect(truncated).toContain('...');
    expect(truncated).toContain('[已截断 100 字符]');
  });

  it('should not truncate short text', () => {
    const shortText = 'hello';
    expect(styled.truncated(shortText, 100)).toBe(shortText);
  });
});

// ===== 测试 extractMessagesAndTodos =====
describe('extractMessagesAndTodos', () => {
  it('should return messages when input is array', () => {
    const result = extractMessagesAndTodos([{ role: 'user', content: 'hi' }]);
    expect(result.messages).toHaveLength(1);
    expect(result.todos).toHaveLength(0);
  });

  it('should extract from model_request.messages', () => {
    const chunk = { model_request: { messages: [{ content: 'm1' }] } };
    const result = extractMessagesAndTodos(chunk);
    expect(result.messages).toHaveLength(1);
  });

  it('should extract todos from todoListMiddleware', () => {
    const chunk = {
      'todoListMiddleware.after_model': {
        messages: [{ content: 'm1' }],
        todos: [{ content: 'todo1', status: 'completed' }],
      },
    };
    const result = extractMessagesAndTodos(chunk);
    expect(result.todos).toHaveLength(1);
  });

  it('should extract todos from message.todos when top-level todos empty', () => {
    const chunk = {
      messages: [
        { content: 'm1', todos: [{ content: 'todo1', status: 'completed' }] },
        { content: 'm2' },
      ],
    };
    const result = extractMessagesAndTodos(chunk);
    expect(result.todos).toHaveLength(1);
    expect(result.todos[0].content).toBe('todo1');
  });

  it('should return empty arrays for invalid input', () => {
    expect(extractMessagesAndTodos(null)).toEqual({ messages: [], todos: [] });
    expect(extractMessagesAndTodos('string')).toEqual({ messages: [], todos: [] });
    expect(extractMessagesAndTodos(123)).toEqual({ messages: [], todos: [] });
  });

  it('should return empty arrays when no message sources match', () => {
    const chunk = { someOtherProperty: 'value' };
    const result = extractMessagesAndTodos(chunk);
    expect(result).toEqual({ messages: [], todos: [] });
  });

  it('should prioritize message sources in correct order', () => {
    const chunk = {
      model_request: { messages: [{ content: 'from model_request' }] },
      messages: [{ content: 'fallback' }],
    };
    const result = extractMessagesAndTodos(chunk);
    expect(result.messages[0].content).toBe('from model_request');
  });
});

// ===== 测试消息处理函数 =====
describe('message handlers', () => {
  describe('handleToolCall', () => {
    it('should use call.args when available', () => {
      const state = createState();
      const msg = {
        tool_calls: [
          { name: 'toolWithArgs', args: { param1: 'value1', param2: 123 } },
        ],
      };
      handleToolCall(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('toolWithArgs')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"param1": "value1"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"param2": 123')
      );
      expect(state.lastToolCall.name).toBe('toolWithArgs');
    });

    it('should parse function.arguments as JSON when provided', () => {
      const state = createState();
      const msg = {
        tool_calls: [
          { 
            function: { 
              name: 'toolWithArgs', 
              arguments: '{"param1":"value1","param2":123}' 
            } 
          },
        ],
      };
      handleToolCall(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('toolWithArgs')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"param1": "value1"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"param2": 123')
      );
      expect(state.lastToolCall.function?.name).toBe('toolWithArgs');
    });

    it('should handle function.arguments without call.args', () => {
      const state = createState();
      const msg = {
        tool_calls: [
          { 
            // no name property, only function
            function: { 
              name: 'toolWithArgs', 
              arguments: '{"param1":"value1"}' 
            } 
          },
        ],
      };
      handleToolCall(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('toolWithArgs')
      );
      expect(state.lastToolCall.function?.name).toBe('toolWithArgs');
    });

    it('should return empty args when neither call.args nor call.function.arguments exist', () => {
      const state = createState();
      const msg = {
        tool_calls: [
          { 
            name: 'toolWithoutArgs',
            // no args property
            // no function property
          },
        ],
      };
      handleToolCall(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('toolWithoutArgs')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('参数: {}')
      );
      expect(state.lastToolCall.name).toBe('toolWithoutArgs');
    });
  });

  describe('handleToolResult', () => {
    it('should handle JSON result with command preview', () => {
      const state = createState();
      state.lastToolCall = { name: 'cmd' };
      const msg = { tool_call_id: '1', content: '{"command":"ls","stdout":"file.txt"}' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ 工具执行 cmd: 成功')
      );
      // Just verify that some output was logged
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle JSON result with filepath preview', () => {
      const state = createState();
      state.lastToolCall = { name: 'readFile' };
      const msg = { tool_call_id: '1', content: '{"filepath":"/path/to/file.txt","content":"file content"}' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ 工具执行 readFile: 成功')
      );
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle JSON result with no preview fields', () => {
      const state = createState();
      state.lastToolCall = { name: 'tool' };
      // Create a JSON that has no command, filepath, stdout, or stderr
      const msg = { tool_call_id: '1', content: '{"success":true}' };
      handleToolResult(msg, state);
      // This should go to the catch block and show the full JSON
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('{"success":true}')
      );
    });

    it('should handle text result with success detection', () => {
      const state = createState();
      state.lastToolCall = { name: 'textTool' };
      const msg = { tool_call_id: '1', content: 'Operation completed successfully' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ 工具执行 textTool: 成功')
      );
    });

    it('should detect failure in text result', () => {
      const state = createState();
      state.lastToolCall = { name: 'failTool' };
      const msg = { tool_call_id: '1', content: '❌ Operation failed' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ 工具执行 failTool: 失败')
      );
    });

    it('should skip when aborted', () => {
      const ac = new AbortController();
      ac.abort();
      const state = { ...createState(), abortSignal: ac.signal };
      const msg = { tool_call_id: '1', content: 'test' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', () => {
      const state = createState();
      state.lastToolCall = { name: 'badJson' };
      const msg = { tool_call_id: '1', content: 'not json' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ 工具执行 badJson: 成功')
      );
    });

    it('should handle null/undefined content', () => {
      const state = createState();
      state.lastToolCall = { name: 'nullContent' };
      const msg1 = { tool_call_id: '1', content: null };
      handleToolResult(msg1, state);
      // Should handle null content as empty string
      expect(mockConsoleLog).toHaveBeenCalled();
      
      const msg2 = { tool_call_id: '2' }; // no content property
      handleToolResult(msg2, state);
      // Should handle undefined content as empty string
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('handleAIContent', () => {
    it('should skip tool results and empty content', async () => {
      const state = createState();
      await handleAIContent({ tool_call_id: '1' }, state);
      await handleAIContent({ content: '' }, state);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });

    it('should skip when current content is shorter than or equal to full response', async () => {
      const state = createState();
      state.fullResponse = 'This is the full response';
      await handleAIContent({ content: 'shorter' }, state);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
      
      // Test equal length
      await handleAIContent({ content: 'This is the full response' }, state);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });

    it('should skip when new content is empty', async () => {
      const state = createState();
      state.fullResponse = 'existing content';
      await handleAIContent({ content: 'existing content' }, state);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });

    it('should write new content character by character', async () => {
      const state = createState();
      state.fullResponse = 'existing ';
      const originalSetTimeout = global.setTimeout;
      (global as any).setTimeout = jest.fn().mockImplementation((callback, delay) => {
        if (typeof callback === 'function') {
          callback();
        }
        return 0 as any;
      });
      
      try {
        await handleAIContent({ content: 'existing new content' }, state);
        expect(state.fullResponse).toBe('existing new content');
        // Should have written each character of "new content"
        expect(mockStdoutWrite).toHaveBeenCalledTimes(11); // "new content" has 11 characters
      } finally {
        (global as any).setTimeout = originalSetTimeout;
      }
    });

    it('should handle new content that is exactly the same length', async () => {
      const state = createState();
      state.fullResponse = 'existing content';
      await handleAIContent({ content: 'existing content' }, state);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });

    it('should handle new content with only whitespace differences', async () => {
      const state = createState();
      state.fullResponse = 'existing content';
      await handleAIContent({ content: 'existing content ' }, state);
      // Should write the extra space
      expect(mockStdoutWrite).toHaveBeenCalledWith(' ');
    });
  });

  describe('handleTodos', () => {
    it('should display new completed todos', () => {
      const state = createState();
      const msg = {
        todos: [
          { content: 'Task 1', status: 'completed' },
          { content: 'Task 2', status: 'in_progress' },
        ],
      };
      
      handleTodos(msg, state);
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(3); // Thinking indicator + 2 todos
      expect(mockConsoleLog.mock.calls[0][0]).toContain('🧠 AI 深度思考过程:');
      expect(mockConsoleLog.mock.calls[1][0]).toContain('✅ Task 1');
      expect(mockConsoleLog.mock.calls[2][0]).toContain('🔄 Task 2');
      expect(state.hasDisplayedThinking).toBe(true);
    });

    it('should display pending todos and skip duplicates', () => {
      const state = createState();
      state.fullResponse = 'Task 1';
      const msg = {
        todos: [
          { content: 'Task 1', status: 'completed' }, // duplicate
          { content: 'Task 2', status: 'pending' },   // pending - now should be displayed
        ],
      };
      
      handleTodos(msg, state);
      
      // Should display thinking indicator + 1 pending todo
      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog.mock.calls[0][0]).toContain('🧠 AI 深度思考过程:');
      expect(mockConsoleLog.mock.calls[1][0]).toContain('💭 Task 2');
    });

    it('should skip when aborted', () => {
      const ac = new AbortController();
      ac.abort();
      const state = { ...createState(), abortSignal: ac.signal };
      const msg = { todos: [{ content: 'Task', status: 'completed' }] };
      
      handleTodos(msg, state);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });
});

// ===== 测试主流程 processStreamChunks =====
describe('processStreamChunks', () => {
  it('should skip already processed messages', async () => {
    const state = createState();
    const stream = {
      [Symbol.asyncIterator]: async function* () {
        const msg = { content: 'test', _processed: true };
        yield [msg];
      },
    };
    
    const rl = { question: jest.fn() };
    
    await processStreamChunks(stream, state, rl as any);
    
    // No assistant indicator should show since no new messages
    expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('🤖 ...'));
  });

  it('should log structured error on exception', async () => {
    const state = createState();
    const badStream = {
      [Symbol.asyncIterator]: async function* () {
        yield [{ content: 'ok' }];
        throw new Error('Test error');
      },
    };
    
    const rl = { question: jest.fn() };
    
    await processStreamChunks(badStream, state, rl as any);
    
    expect(structuredLog).toHaveBeenCalledWith(
      'error',
      'Interactive mode error',
      expect.objectContaining({ error: 'Test error' })
    );
  });
});

// ===== 测试交互循环与公共 API =====
describe('interactive loop & public API', () => {
  beforeEach(() => {
    // 使用类型安全的方式来 mock setTimeout
    (global as any).setTimeout = jest.fn().mockImplementation(originalSetTimeout) as unknown as typeof setTimeout;
    (global as any).clearTimeout = jest.fn().mockImplementation(originalClearTimeout) as unknown as typeof clearTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  describe('handleUserInput', () => {
    it('should exit on exit command', () => {
      const rl = { close: jest.fn() };
      (shouldExitInteractiveMode as jest.Mock).mockReturnValue(true);
      
      handleUserInput('exit', {} as any, {} as any, rl as any);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('⚙️  再见！'));
      expect(rl.close).toHaveBeenCalled();
    });

    it('should skip empty input and show prompt', () => {
      const rl = { setPrompt: jest.fn(), prompt: jest.fn() };
      (isEmptyInput as jest.Mock).mockReturnValue(true);
      
      handleUserInput('', { isRunning: false, rl } as any, {} as any, rl as any);
      
      expect(rl.prompt).toHaveBeenCalled();
    });

    it('should process valid input and show next prompt', async () => {
      const rl = { setPrompt: jest.fn(), prompt: jest.fn() };
      (isEmptyInput as jest.Mock).mockReturnValue(false);
      (shouldExitInteractiveMode as jest.Mock).mockReturnValue(false);
      
      const mockAgent = {
        stream: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield [{ content: 'response' }];
          },
        }),
      };
      
      const session = {
        threadId: 'test-thread',
        isRunning: false,
        abortController: null,
        rl,
      };
      
      await handleUserInput('hello', session, mockAgent as any, rl as any);
      
      expect(session.isRunning).toBe(false);
      expect(rl.prompt).toHaveBeenCalled();
      expect(mockAgent.stream).toHaveBeenCalledWith(
        { messages: [{ role: 'user', content: 'hello' }] },
        expect.objectContaining({ configurable: { thread_id: 'test-thread' } })
      );
    });
  });

  describe('createGracefulShutdown', () => {
    it('should abort running operation without exiting', () => {
      const rl = { close: jest.fn() };
      const session = { isRunning: true, rl };
      const shutdown = createGracefulShutdown(session);
      
      shutdown('SIGINT');
      
      expect(session.isRunning).toBe(false);
      expect(rl.close).not.toHaveBeenCalled();
      expect(structuredLog).toHaveBeenCalledWith(
        'info',
        '收到 SIGINT 信号，正在中断当前操作...'
      );
    });

    it('should exit when not running', () => {
      const rl = { close: jest.fn() };
      const session = { isRunning: false, rl };
      const shutdown = createGracefulShutdown(session);
      
      // Mock process.exit to avoid actual exit
      const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      
      shutdown('SIGTERM');
      
      expect(rl.close).toHaveBeenCalled();
      expect(exitMock).toHaveBeenCalledWith(0);
      expect(structuredLog).toHaveBeenCalledWith(
        'info',
        '收到 SIGTERM 信号，正在退出...'
      );
      
      exitMock.mockRestore();
    });
  });

  describe('showPrompt', () => {
    it('should set prompt when not running', () => {
      const rl = { setPrompt: jest.fn(), prompt: jest.fn() };
      const session = { isRunning: false };
      
      showPrompt(session, rl as any);
      
      expect(rl.setPrompt).toHaveBeenCalledWith('\n👤 You: ');
      expect(rl.prompt).toHaveBeenCalled();
    });

    it('should skip prompt when running', () => {
      const rl = { setPrompt: jest.fn(), prompt: jest.fn() };
      const session = { isRunning: true };
      
      showPrompt(session, rl as any);
      
      expect(rl.setPrompt).not.toHaveBeenCalled();
      expect(rl.prompt).not.toHaveBeenCalled();
    });
  });

  describe('processStreamChunks error handling', () => {
    it('should handle user interruption gracefully', async () => {
      // Create an aborted signal
      const controller = new AbortController();
      controller.abort();
      const state = createState();
      state.abortSignal = controller.signal;
      const rl = { question: jest.fn() };

      // Mock the stream to throw an error that would be caught
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ content: 'test' }] };
        }
      };

      await processStreamChunks(mockStream as any, state, rl as any);
      
      // The function should complete without throwing
      expect(true).toBe(true);
    });

    it('should handle general errors with structured logging', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Test error');
        }
      };
      const state = createState();
      const rl = { question: jest.fn() };

      await processStreamChunks(mockStream as any, state, rl as any);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('发生错误: Test error')
      );
      expect(structuredLog).toHaveBeenCalledWith(
        'error',
        'Interactive mode error',
        expect.objectContaining({
          component: 'interactive',
          error: 'Test error'
        })
      );
    });
  });
});

// Simple test to improve coverage of interactive-utils.ts
describe('Interactive Utils Basic Coverage', () => {
  test('styled functions should exist and be callable', () => {
    expect(typeof styled.assistant).toBe('function');
    expect(typeof styled.toolCall).toBe('function');
    expect(typeof styled.toolResult).toBe('function');
    expect(typeof styled.system).toBe('function');
    expect(typeof styled.error).toBe('function');
    expect(typeof styled.hint).toBe('function');
    
    // Call them to ensure they don't throw
    expect(() => styled.assistant('test')).not.toThrow();
    expect(() => styled.toolCall('test', {})).not.toThrow();
    expect(() => styled.toolResult('test', true, 'test')).not.toThrow();
    expect(() => styled.system('test')).not.toThrow();
    expect(() => styled.error('test')).not.toThrow();
    expect(() => styled.hint('test')).not.toThrow();
  });
});

// ===== 测试 startInputLoop =====
describe('startInputLoop', () => {
  let mockRl: any;
  let mockAgent: any;
  let session: any;

  beforeEach(() => {
    mockRl = {
      question: jest.fn(),
      close: jest.fn(),
    };
    mockAgent = {
      stream: jest.fn(),
    };
    session = {
      threadId: 'test-thread',
      isRunning: false,
      abortController: null,
    };
  });

  it('should exit when shouldExitInteractiveMode returns true', async () => {
    (shouldExitInteractiveMode as jest.Mock).mockReturnValue(true);
    mockRl.question.mockImplementation((prompt: string, callback: (input: string) => void) => {
      callback('/exit');
    });

    await startInputLoop(session, mockAgent, mockRl);
    
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('再见！'));
    expect(mockRl.close).toHaveBeenCalled();
    expect(mockAgent.stream).not.toHaveBeenCalled();
  });

  it('should skip empty input and continue loop', async () => {
    // We'll test this by mocking the loop to run only twice
    (shouldExitInteractiveMode as jest.Mock)
      .mockReturnValueOnce(false) // first input not exit
      .mockReturnValueOnce(true); // second input is exit
    (isEmptyInput as jest.Mock).mockReturnValueOnce(true); // first input is empty
    
    let callCount = 0;
    mockRl.question.mockImplementation((prompt: string, callback: (input: string) => void) => {
      if (callCount === 0) {
        callback(''); // empty input
      } else {
        callback('/exit'); // exit command
      }
      callCount++;
    });

    await startInputLoop(session, mockAgent, mockRl);
    
    expect(mockRl.question).toHaveBeenCalledTimes(2);
    expect(mockAgent.stream).not.toHaveBeenCalled();
  });

  it('should process valid input and call agent.stream', async () => {
    // First call: process input, second call: exit
    (shouldExitInteractiveMode as jest.Mock)
      .mockReturnValueOnce(false) // first input is not exit command
      .mockReturnValueOnce(true); // second input is exit command
    (isEmptyInput as jest.Mock).mockReturnValue(false);
    
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { messages: [] };
      }
    };
    
    let callCount = 0;
    mockRl.question.mockImplementation((prompt: string, callback: (input: string) => void) => {
      if (callCount === 0) {
        callCount++;
        callback('hello world');
      } else {
        callback('/exit');
      }
    });
    
    mockAgent.stream.mockResolvedValue(mockStream);
    
    await startInputLoop(session, mockAgent, mockRl);
    
    expect(mockAgent.stream).toHaveBeenCalledWith(
      { messages: [{ role: "user", content: "hello world" }] },
      expect.objectContaining({
        configurable: { thread_id: 'test-thread' },
        recursionLimit: Infinity,
      })
    );
    expect(session.isRunning).toBe(false); // should be cleaned up
    expect(session.abortController).toBeNull(); // should be cleaned up
  });

  it('should handle session cleanup in finally block even if stream throws', async () => {
    (shouldExitInteractiveMode as jest.Mock)
      .mockReturnValueOnce(false) // first input is not exit command
      .mockReturnValueOnce(true); // second input is exit command
    (isEmptyInput as jest.Mock).mockReturnValue(false);
    
    mockRl.question.mockImplementation((prompt: string, callback: (input: string) => void) => {
      callback('test input');
    });
    
    mockAgent.stream.mockRejectedValue(new Error('Stream error'));
    
    // Mock question to exit on second call
    let callCount = 0;
    const originalQuestion = mockRl.question;
    mockRl.question = jest.fn().mockImplementation((prompt: string, callback: (input: string) => void) => {
      if (callCount === 0) {
        callCount++;
        callback('test input');
      } else {
        callback('/exit');
      }
    });
    
    await startInputLoop(session, mockAgent, mockRl);
    
    expect(session.isRunning).toBe(false);
    expect(session.abortController).toBeNull();
    
    // Restore
    mockRl.question = originalQuestion;
  });
});

// ===== 额外的边界情况测试以达到100%覆盖率 =====
describe('Edge Cases for 100% Coverage', () => {
  describe('handleJsonToolResult', () => {
    it('should display "无输出" when preview is empty', () => {
      const lastToolCall = { name: 'emptyTool' };
      // Create a result with no command, no filepath, and empty stdout/stderr
      const result = '{"success":true,"stdout":"(empty)","stderr":"(empty)"}';
      
      handleJsonToolResult(result, lastToolCall);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('无输出')
      );
    });

    it('should handle JSON task tool result with message', () => {
      const lastToolCall = { name: 'task' };
      const result = JSON.stringify({ message: 'Research completed successfully', success: true });
      
      handleJsonToolResult(result, lastToolCall);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ 工具执行 子代理任务: 成功')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('▸ 结果: Research completed successfully')
      );
    });

    it('should handle JSON task tool result as string', () => {
      const lastToolCall = { name: 'task' };
      const result = JSON.stringify('Simple result string');
      
      handleJsonToolResult(result, lastToolCall);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ 工具执行 子代理任务: 成功')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('▸ 结果: Simple result string')
      );
    });

    it('should handle stdout with "(empty)" value', () => {
      const lastToolCall = { name: 'toolWithEmptyStdout' };
      const result = '{"command":"test","stdout":"(empty)"}';
      
      handleJsonToolResult(result, lastToolCall);
      
      // Should not include stdout in preview since it's "(empty)"
      const logCall = mockConsoleLog.mock.calls.find(call => 
        call[0].includes('toolWithEmptyStdout') && !call[0].includes('输出:')
      );
      expect(logCall).toBeTruthy();
    });

    it('should use longer truncation limits in verbose mode', () => {
      // Set verbose mode
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'verboseTool' };
        const longOutput = 'a'.repeat(300);
        const result = `{"command":"test","stdout":"${longOutput}"}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        // In verbose mode, the full log should contain the tool name and truncated output
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('verboseTool')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[已截断')
        );
        // The truncation limit should be 300 for the catch block or 200 for stdout
        // Since we have valid JSON with stdout, it should use 200 limit
        const logCall = mockConsoleLog.mock.calls.find(call => 
          call[0].includes('verboseTool') && call[0].includes('[已截断')
        );
        expect(logCall).toBeTruthy();
      } finally {
        // Restore original config
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should use shorter truncation limits in non-verbose mode', () => {
      // Ensure non-verbose mode
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'normalTool' };
        const longOutput = 'a'.repeat(200);
        const result = `{"command":"test","stdout":"${longOutput}"}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        // In non-verbose mode, the log should contain truncated output
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('normalTool')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[已截断')
        );
        const logCall = mockConsoleLog.mock.calls.find(call => 
          call[0].includes('normalTool') && call[0].includes('[已截断')
        );
        expect(logCall).toBeTruthy();
      } finally {
        // Restore original config
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle stderr in verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'stderrTool' };
        const longError = 'b'.repeat(150);
        const result = `{"command":"test","stderr":"${longError}"}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('stderrTool')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('错误:')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[已截断')
        );
      } finally {
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle invalid JSON in catch block', () => {
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'invalidJson' };
        const invalidJson = 'this is not valid json at all';
        
        handleJsonToolResult(invalidJson, lastToolCall);
        
        // Should go to catch block and show truncated result
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('invalidJson')
        );
        // In verbose mode, truncation limit is 300, so short string won't be truncated
        // But we should still verify it goes to catch block
        expect(mockConsoleLog).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });
  });

  describe('processStreamChunks message deduplication', () => {
    it('should skip HumanMessage instances during deduplication', async () => {
      const state = createState();
      const humanMsg = new HumanMessage({ content: 'user message' });
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [humanMsg];
        },
      };
      const rl = { question: jest.fn() };
      
      await processStreamChunks(stream, state, rl as any);
      
      // HumanMessage should be filtered out, so no assistant indicator should show
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('🤖 ...'));
    });

    it('should deduplicate messages with same ID', async () => {
      const state = createState();
      const msg = { id: 'test-id', content: 'test message' };
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          // Yield the same message twice
          yield [msg];
          yield [msg];
        },
      };
      const rl = { question: jest.fn() };
      
      await processStreamChunks(stream, state, rl as any);
      
      // Should only process the message once, so assistant indicator should show once
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🤖 ...'));
      // The message content should only be processed once
      expect(state.fullResponse).toBe('test message');
    });

    it('should deduplicate messages with same content substring', async () => {
      const state = createState();
      const msg1 = { content: 'This is a very long message that will be truncated to 50 characters for deduplication purposes' };
      const msg2 = { content: 'This is a very long message that will be truncated to 50 characters for deduplication purposes and more' };
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [msg1];
          yield [msg2]; // Same first 50 chars, should be deduplicated
        },
      };
      const rl = { question: jest.fn() };
      
      await processStreamChunks(stream, state, rl as any);
      
      // Should only process the first message
      expect(state.fullResponse).toBe(msg1.content);
    });
  });

  describe('showPrompt', () => {
    it('should handle "干活" keyword in input line', () => {
      const rl = { 
        setPrompt: jest.fn(), 
        prompt: jest.fn(),
        write: jest.fn(), // Add write method
        line: '让我们开始干活吧'
      };
      const session = { isRunning: false };
      
      // Mock setTimeout to capture the backspace calls immediately
      const originalSetTimeout = global.setTimeout;
      (global as any).setTimeout = jest.fn().mockImplementation((callback, delay) => {
        if (typeof callback === 'function') {
          callback();
        }
        return 0 as any;
      });
      
      try {
        showPrompt(session, rl as any);
        
        // Should have called rl.write multiple times for backspacing
        expect(rl.write).toHaveBeenCalled();
        expect(rl.setPrompt).toHaveBeenCalledWith('\n👤 You: ');
        expect(rl.prompt).toHaveBeenCalled();
      } finally {
        (global as any).setTimeout = originalSetTimeout;
      }
    });

    it('should not trigger backspace for lines without "干活"', () => {
      const rl = { 
        setPrompt: jest.fn(), 
        prompt: jest.fn(),
        write: jest.fn(), // Add write method
        line: 'normal input'
      };
      const session = { isRunning: false };
      
      const originalSetTimeout = global.setTimeout;
      (global as any).setTimeout = jest.fn().mockImplementation((callback, delay) => {
        if (typeof callback === 'function') {
          callback();
        }
        return 0 as any;
      });
      
      try {
        showPrompt(session, rl as any);
        
        // Should not have called rl.write for backspacing
        expect(rl.write).not.toHaveBeenCalled();
        expect(rl.setPrompt).toHaveBeenCalledWith('\n👤 You: ');
        expect(rl.prompt).toHaveBeenCalled();
      } finally {
        (global as any).setTimeout = originalSetTimeout;
      }
    });
  });
});

// ===== 新增测试用例以达到100%覆盖率 =====
describe('Missing Coverage Tests', () => {
  describe('handleJsonToolResult edge cases', () => {
    it('should handle stdout with non-empty content', () => {
      const state = createState();
      state.lastToolCall = { name: 'testTool' };
      const msg = { tool_call_id: '1', content: '{"command":"ls","stdout":"single file output"}' };
      
      handleToolResult(msg, state);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('testTool')
      );
      // Just verify that some output was logged (don't check specific format)
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle stderr with non-empty content', () => {
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'errorTool' };
        const result = '{"command":"invalid","stderr":"Error: command not found"}';
        
        handleJsonToolResult(result, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('errorTool')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('▸ 错误:')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Error: command not found')
        );
      } finally {
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle stderr with verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'verboseErrorTool' };
        const longError = 'a'.repeat(150);
        const result = `{"command":"test","stderr":"${longError}"}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('verboseErrorTool')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('▸ 错误:')
        );
        // Should be truncated with verbose limit of 100
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('[已截断')
        );
      } finally {
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });
  });

  describe('handleTextToolResult', () => {
    it('should handle text tool result in verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'textToolVerbose' };
        const longResult = 'a'.repeat(400); // Longer than verbose limit of 300
        
        handleTextToolResult(longResult, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('textToolVerbose')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('✅')
        );
        // handleTextToolResult does not truncate text results, so no [已截断] expected
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining(longResult)
        );
      } finally {
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text tool result with failure indicators', () => {
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'failingTextTool' };
        const result = '❌ Operation failed due to error';
        
        handleTextToolResult(result, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('failingTextTool')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('❌')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('失败')
        );
      } finally {
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text tool result in non-verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/Config').config };
      require('../../src/core/config/Config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'textToolNormal' };
        const longResult = 'b'.repeat(200); // Longer than normal limit of 150
        
        handleTextToolResult(longResult, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('textToolNormal')
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('✅')
        );
        // handleTextToolResult does not truncate text results, so no [已截断] expected
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining(longResult)
        );
      } finally {
        require('../../src/core/config/Config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text task tool result', () => {
      const lastToolCall = { name: 'task' };
      const result = 'Task completed with detailed analysis';
      
      handleTextToolResult(result, lastToolCall);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ 工具执行 子代理任务: 成功')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task completed with detailed analysis')
      );
    });

    it('should handle failed text task tool result', () => {
      const lastToolCall = { name: 'task' };
      const result = '❌ Task failed due to error';
      
      handleTextToolResult(result, lastToolCall);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ 工具执行 子代理任务: 失败')
      );
    });
  });

  describe('handleAIContent abort handling', () => {
    it('should break loop when aborted during character writing', async () => {
      const controller = new AbortController();
      const state = createState();
      state.abortSignal = controller.signal;
      state.fullResponse = 'existing ';
      
      // Abort after first character
      let charCount = 0;
      const originalSetTimeout = global.setTimeout;
      (global as any).setTimeout = jest.fn().mockImplementation((callback, delay) => {
        charCount++;
        if (charCount === 1) {
          controller.abort(); // Abort after first character
        }
        if (typeof callback === 'function') {
          callback();
        }
        return 0 as any;
      });
      
      try {
        await handleAIContent({ content: 'existing new content' }, state);
        
        // Should have written only the first character before aborting
        expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
        expect(mockStdoutWrite).toHaveBeenCalledWith('n'); // first char of "new content"
        expect(state.fullResponse).toBe('existing new content'); // state still updated
      } finally {
        (global as any).setTimeout = originalSetTimeout;
      }
    });
  });

  describe('processStreamChunks message deduplication', () => {
    it('should use JSON.stringify for messages without id or content', async () => {
      const state = createState();
      const msg = { someProp: 'value', nested: { deep: 'object' } }; // no id, no content
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [msg];
        },
      };
      const rl = { question: jest.fn() };
      
      await processStreamChunks(stream, state, rl as any);
      
      // Should process the message using JSON.stringify as messageId
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🤖 ...'));
    });

    it('should show initial indicator for todos without showing assistant indicator', async () => {
      const state = createState();
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            messages: [{ content: 'processing' }],
            todos: [{ content: 'Task 1', status: 'completed' }]
          };
        },
      };
      const rl = { question: jest.fn() };
      
      await processStreamChunks(stream, state, rl as any);
      
      // Should show thinking indicator but not assistant indicator
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🧠 AI 深度思考过程:'));
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('🤖 ...'));
    });
  });
});

describe('processStreamChunks completion indicator', () => {
  it('should show completion indicator with dots when response does not end with period', async () => {
    const state = createState();
    const stream = {
      [Symbol.asyncIterator]: async function* () {
        yield [{ content: 'This is a response' }];
      },
    };
    const rl = { question: jest.fn() };
    
    // Mock setTimeout to immediately resolve for the dots
    const originalSetTimeout = global.setTimeout;
    (global as any).setTimeout = jest.fn().mockImplementation((callback, delay) => {
      if (typeof callback === 'function') {
        callback();
      }
      return 0 as any;
    });
    
    try {
      await processStreamChunks(stream, state, rl as any);
      
      // The response content should be written
      expect(state.fullResponse).toBe('This is a response');
      
      // The completion indicator should be three dots followed by newline
      const writeCalls = mockStdoutWrite.mock.calls.map(call => call[0]);
      const lastThreeWrites = writeCalls.slice(-3);
      expect(lastThreeWrites).toEqual(['.', '.', '.\n']);
    } finally {
      (global as any).setTimeout = originalSetTimeout;
    }
  });

    it('should not show completion indicator when response ends with period', async () => {
      const state = createState();
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [{ content: 'This is a response.' }];
        },
      };
      const rl = { question: jest.fn() };
      
      const originalSetTimeout = global.setTimeout;
      (global as any).setTimeout = jest.fn().mockImplementation((callback, delay) => {
        if (typeof callback === 'function') {
          callback();
        }
        return 0 as any;
      });
      
      try {
        await processStreamChunks(stream, state, rl as any);
        
        // The response content should be written character by character
        expect(state.fullResponse).toBe('This is a response.');
        
        // But the completion indicator (three dots at the end) should not be shown
        // Check that we don't have the specific pattern of three dots followed by newline
        const writeCalls = mockStdoutWrite.mock.calls.map(call => call[0]);
        const lastThreeWrites = writeCalls.slice(-3);
        // The completion indicator would be ['.', '.', '.\n']
        // So check that this pattern doesn't exist at the end
        expect(lastThreeWrites).not.toEqual(['.', '.', '.\n']);
      } finally {
        (global as any).setTimeout = originalSetTimeout;
      }
    });

    it('should not show completion indicator when aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const state = createState();
      state.abortSignal = controller.signal;
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [{ content: 'This is a response' }];
        },
      };
      const rl = { question: jest.fn() };
      
      await processStreamChunks(stream, state, rl as any);
      
      // Should not have written any dots due to abort
      expect(mockStdoutWrite).not.toHaveBeenCalledWith('.');
    });
  });
;
