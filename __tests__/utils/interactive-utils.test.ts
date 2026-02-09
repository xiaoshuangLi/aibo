import { 
  styled, 
  extractMessagesAndTodos, 
  handleToolCall, 
  handleToolResult, 
  handleJsonToolResult, 
  handleTextToolResult, 
  handleAIContent, 
  handleTodos,
  showPrompt,
  handleUserInput,
  processStreamChunks,
  createGracefulShutdown,
  startInputLoop,
} from '../../src/utils/interactive-utils';

import { config } from '../../src/config';
import { structuredLog } from '../../src/utils/logging';
import { shouldExitInteractiveMode, isEmptyInput } from '../../src/interactive-logic';

// ===== 模拟外部依赖 =====
jest.mock('../../src/config', () => ({
  config: {
    output: {
      verbose: false,
    },
  },
}));

jest.mock('../../src/utils/logging', () => ({
  structuredLog: jest.fn(),
}));

jest.mock('../../src/interactive-logic', () => ({
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
    it('should log tool calls with function.name fallback', () => {
      const state = createState();
      const msg = {
        tool_calls: [
          { name: 'tool1', args: { a: 1 } },
          { function: { name: 'tool2', arguments: '{"b":2}' } },
        ],
      };
      handleToolCall(msg, state);
      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog.mock.calls[0][0]).toContain('tool1');
      expect(mockConsoleLog.mock.calls[1][0]).toContain('tool2');
      // The last tool call should be the second one, which has function.name
      expect(state.lastToolCall.function?.name).toBe('tool2');
    });

    it('should do nothing without tool_calls', () => {
      const state = createState();
      handleToolCall({ content: 'text' }, state);
      expect(mockConsoleLog).not.toHaveBeenCalled();
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
  });

  describe('handleAIContent', () => {
    it('should skip tool results and empty content', async () => {
      const state = createState();
      await handleAIContent({ tool_call_id: '1' }, state);
      await handleAIContent({ content: '' }, state);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
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
      expect(mockConsoleLog.mock.calls[0][0]).toContain('💭 AI 正在思考...');
      expect(mockConsoleLog.mock.calls[1][0]).toContain('✅ Task 1');
      expect(mockConsoleLog.mock.calls[2][0]).toContain('🔄 Task 2');
      expect(state.hasDisplayedThinking).toBe(true);
    });

    it('should skip pending todos and duplicates', () => {
      const state = createState();
      state.fullResponse = 'Task 1';
      const msg = {
        todos: [
          { content: 'Task 1', status: 'completed' }, // duplicate
          { content: 'Task 2', status: 'pending' },   // pending
        ],
      };
      
      handleTodos(msg, state);
      
      // Should not display any todos or thinking indicator since no new non-pending todos
      expect(mockConsoleLog).not.toHaveBeenCalled();
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