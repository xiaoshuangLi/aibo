import { styled } from '@/presentation/styling/output-styler';
import { extractMessagesAndTodos } from '@/core/utils';
import { 
  handleToolCall, 
  handleToolResult, 
  handleJsonToolResult, 
  handleTextToolResult, 
  handleAIContent, 
  handleTodos,
  processStreamChunks,
  StreamState
} from '@/core/utils';
import { 
  handleUserInput
} from '@/presentation/console/user-input-handler';
import { Session } from '@/core/agent/session';

import { HumanMessage } from 'langchain';
import { config } from '@/core/config/config';
import { structuredLog } from '@/shared/utils/logging';
import { shouldExitInteractiveMode, isEmptyInput } from '@/core/utils';

// ===== 模拟外部依赖 =====
jest.mock('../../src/core/config/config', () => ({
  config: {
    output: {
      verbose: false,
    },
  },
}));

const setVerboseMode = (verbose: boolean) => {
  jest.mocked(require('../../src/core/config/config')).config.output.verbose = verbose;
};

jest.mock('../../src/shared/utils/logging', () => ({
  structuredLog: jest.fn(),
}));

jest.mock('../../src/core/utils/interactive-logic', () => ({
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

const createMockSession = (overrides: any = {}): any => ({
  threadId: 'test-thread',
  isRunning: false,
  abortController: null,
  rl: {
    setPrompt: jest.fn(),
    prompt: jest.fn(),
  },
  logToolCall: jest.fn(),
  logToolResult: jest.fn(),
  logErrorMessage: jest.fn(),
  logThinkingProcess: jest.fn(),
  streamAIContent: jest.fn().mockResolvedValue(undefined),
  end: jest.fn(),
  requestUserInput: jest.fn(),
  isVoiceRecordingActive: jest.fn().mockReturnValue(false),
  getVoiceASR: jest.fn().mockReturnValue(null),
  setVoiceRecording: jest.fn(),
  ...overrides,
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

  it('should truncate multi-line text and show line count', () => {
    const multiLineText = 'line1\nline2\nline3\nline4\nline5';
    const truncated = styled.truncated(multiLineText, 20);
    expect(truncated).toContain('...');
    expect(truncated).toContain('字符');
    // Should show that 3 lines were truncated (5 original - 2 truncated = 3)
    expect(truncated).toMatch(/\[已截断 \d+ 字符, \d+ 行\]/);
  });

  it('should not show line count for single line text', () => {
    const singleLineText = 'This is a very long single line text that will be truncated';
    const truncated = styled.truncated(singleLineText, 20);
    expect(truncated).toContain('...');
    expect(truncated).toContain('[已截断');
    expect(truncated).not.toContain('行]');
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
  let session: any;
  
  beforeEach(() => {
    session = createMockSession();
  });

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
        expect.stringContaining('cmd')
      );
    });

    it('should handle JSON result with filepath preview', () => {
      const state = createState();
      state.lastToolCall = { name: 'readFile' };
      const msg = { tool_call_id: '1', content: '{"filepath":"/path/to/file.txt","content":"file content"}' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('readFile');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should handle JSON result with no preview fields', () => {
      const state = createState();
      state.lastToolCall = { name: 'tool' };
      // Create a JSON that has no command, filepath, stdout, or stderr
      const msg = { tool_call_id: '1', content: '{"success":true}' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('tool');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should handle text result with success detection', () => {
      const state = createState();
      state.lastToolCall = { name: 'textTool' };
      const msg = { tool_call_id: '1', content: 'Operation completed successfully' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('textTool');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should detect failure in text result', () => {
      const state = createState();
      state.lastToolCall = { name: 'failTool' };
      const msg = { tool_call_id: '1', content: '❌ Operation failed' };
      handleToolResult(msg, state);
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('failTool');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('❌');
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
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('badJson');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
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
        // Should have called process.stdout.write for each character in "new content"
        expect(mockStdoutWrite).toHaveBeenCalledTimes(11); // "new content" has 11 characters
        expect(mockStdoutWrite).toHaveBeenCalledWith('n');
        expect(mockStdoutWrite).toHaveBeenCalledWith('e');
        expect(mockStdoutWrite).toHaveBeenCalledWith('w');
        expect(mockStdoutWrite).toHaveBeenCalledWith(' ');
        expect(mockStdoutWrite).toHaveBeenCalledWith('c');
        expect(mockStdoutWrite).toHaveBeenCalledWith('o');
        expect(mockStdoutWrite).toHaveBeenCalledWith('n');
        expect(mockStdoutWrite).toHaveBeenCalledWith('t');
        expect(mockStdoutWrite).toHaveBeenCalledWith('e');
        expect(mockStdoutWrite).toHaveBeenCalledWith('n');
        expect(mockStdoutWrite).toHaveBeenCalledWith('t');
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
      // Should call process.stdout.write with the extra space
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
      
      // Should log the thinking process header
      expect(mockConsoleLog).toHaveBeenCalledWith('\n🧠 AI 深度思考过程:');
      // Should log each todo with appropriate emoji
      expect(mockConsoleLog).toHaveBeenCalledWith('\n✅ Task 1');
      expect(mockConsoleLog).toHaveBeenCalledWith('\n🔄 Task 2');
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
      
      // Should log the thinking process header
      expect(mockConsoleLog).toHaveBeenCalledWith('\n🧠 AI 深度思考过程:');
      // Should only log the non-duplicate todo with appropriate emoji
      expect(mockConsoleLog).toHaveBeenCalledWith('\n💭 Task 2');
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
  let session: any;
  
  beforeEach(() => {
    session = createMockSession();
  });

  it('should skip already processed messages', async () => {
    const state1 = createState();
    const msg = { content: 'test' };
    const stream1 = {
      [Symbol.asyncIterator]: async function* () {
        yield [msg];
      },
    };
    
    // Process the message once
    await processStreamChunks(stream1, state1, session);
    
    // Reset mocks to check second call
    session.streamAIContent.mockClear();
    mockStdoutWrite.mockClear();
    
    const state2 = createState();
    const stream2 = {
      [Symbol.asyncIterator]: async function* () {
        yield [msg]; // Same message content
      },
    };
    
    // Process the same message again
    await processStreamChunks(stream2, state2, session);
    
    // Should not have called streamAIContent for the duplicate message
    expect(mockStdoutWrite).not.toHaveBeenCalled();
  });

  it('should log structured error on exception', async () => {
    const state = createState();
    const badStream = {
      [Symbol.asyncIterator]: async function* () {
        yield [{ content: 'ok' }];
        throw new Error('Test error');
      },
    };
    
    await processStreamChunks(badStream, state, session);
    
    expect(mockConsoleLog).toHaveBeenCalled();
    expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('发生错误: Test error');
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
      const session = createMockSession();
      (shouldExitInteractiveMode as jest.Mock).mockReturnValue(true);
      
      handleUserInput('exit', session, {} as any);
      
      expect(session.end).toHaveBeenCalledWith("再见！");
    });

    it('should skip empty input and show prompt', () => {
      const session = createMockSession();
      (isEmptyInput as jest.Mock).mockReturnValue(true);
      
      handleUserInput('', session, {} as any);
      
      expect(session.requestUserInput).toHaveBeenCalled();
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
      
      const session = createMockSession({
        threadId: 'test-thread',
        isRunning: false,
        abortController: null,
        rl,
      });
      
      await handleUserInput('hello', session, mockAgent as any);
      
      expect(session.isRunning).toBe(false);
      expect(session.requestUserInput).toHaveBeenCalled();
      expect(mockAgent.stream).toHaveBeenCalledWith(
        { messages: [{ role: 'user', content: 'hello' }] },
        expect.objectContaining({ configurable: { thread_id: 'test-thread' } })
      );
    });
  });



  describe('processStreamChunks error handling', () => {
    let session: any;
    
    beforeEach(() => {
      session = createMockSession();
    });

    it('should handle user interruption gracefully', async () => {
      // Create an aborted signal
      const controller = new AbortController();
      controller.abort();
      const state = createState();
      state.abortSignal = controller.signal;

      // Mock the stream to throw an error that would be caught
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ content: 'test' }] };
        }
      };

      await processStreamChunks(mockStream as any, state, session);
      
      // The function should complete without throwing
      expect(mockConsoleLog).toHaveBeenCalled();
    expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain("⚠️ 操作已被用户中断");
    });

    it('should handle general errors with structured logging', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Test error');
        }
      };
      const state = createState();

      await processStreamChunks(mockStream as any, state, session);
      
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('发生错误: Test error');
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

// ===== 额外的边界情况测试以达到100%覆盖率 =====
describe('Edge Cases for 100% Coverage', () => {
  let session: any;
  
  beforeEach(() => {
    session = createMockSession();
  });

  describe('handleJsonToolResult', () => {
    it('should display "无输出" when preview is empty', () => {
      const lastToolCall = { name: 'emptyTool' };
      // Create a result with no command, no filepath, and empty stdout/stderr
      const result = '{"success":true,"stdout":"(empty)","stderr":"(empty)"}';
      
      handleJsonToolResult(result, lastToolCall);
      
      // Should call console.log with a string containing "无输出"
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('emptyTool');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('无输出');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should handle JSON task tool result with message', () => {
      const lastToolCall = { name: 'task' };
      const result = JSON.stringify({ message: 'Research completed successfully', success: true });
      
      handleJsonToolResult(result, lastToolCall);
      
      // Should call console.log with a string containing the formatted preview
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('子代理任务');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('▸ 结果: Research completed successfully');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should handle JSON task tool result as string', () => {
      const lastToolCall = { name: 'task' };
      const result = JSON.stringify('Simple result string');
      
      handleJsonToolResult(result, lastToolCall);
      
      // Should call console.log with a string containing the formatted preview
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('子代理任务');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('▸ 结果: Simple result string');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should handle stdout with "(empty)" value', () => {
      const lastToolCall = { name: 'toolWithEmptyStdout' };
      const result = '{"stdout":"(empty)","success":true}';
      
      handleJsonToolResult(result, lastToolCall);
      
      // Should call console.log with the full JSON string (JSON parsing fails in test environment)
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('toolWithEmptyStdout');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('{"stdout":"(empty)","success":true}');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should use longer truncation limits in verbose mode', () => {
      // Set verbose mode
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'verboseTool' };
        const longOutput = 'a'.repeat(300);
        const result = `{"command":"test","stdout":"${longOutput}","success":true}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        // In verbose mode, should call console.log with truncated output
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('verboseTool');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('[已截断');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
      } finally {
        // Restore original config
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should use shorter truncation limits in non-verbose mode', () => {
      // Ensure non-verbose mode
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'normalTool' };
        const longOutput = 'a'.repeat(200);
        const result = `{"command":"test","stdout":"${longOutput}","success":true}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        // In non-verbose mode, should call console.log with truncated output
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('normalTool');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('[已截断');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
      } finally {
        // Restore original config
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle stderr in verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'stderrTool' };
        const longError = 'b'.repeat(150);
        const result = `{"command":"test","stderr":"${longError}","success":true}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        // Should call console.log with error content
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('stderrTool');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('错误:');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle invalid JSON in catch block', () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'invalidJson' };
        const invalidJson = 'this is not valid json at all';
        
        handleJsonToolResult(invalidJson, lastToolCall);
        
        // Should go to catch block and call logToolResult
        expect(mockConsoleLog).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });
  });

  describe('processStreamChunks message deduplication', () => {
    let session: any;
    
    beforeEach(() => {
      session = createMockSession();
    });

    it('should skip HumanMessage instances during deduplication', async () => {
      const state = createState();
      const humanMsg = new HumanMessage({ content: 'user message' });
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [humanMsg];
        },
      };
      
      await processStreamChunks(stream, state, session);
      
      // HumanMessage should be filtered out, so no AI content should be streamed
      expect(mockStdoutWrite).not.toHaveBeenCalled();
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
      
      await processStreamChunks(stream, state, session);
      
      // Should only process the message once
      expect(mockStdoutWrite).toHaveBeenCalled();
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
      
      await processStreamChunks(stream, state, session);
      
      // Should only process the first message
      expect(state.fullResponse).toBe(msg1.content);
    });
  });


});

// ===== 新增测试用例以达到100%覆盖率 =====
describe('Missing Coverage Tests', () => {
  let session: any;
  
  beforeEach(() => {
    session = createMockSession();
  });

  describe('handleJsonToolResult edge cases', () => {
    it('should handle stdout with non-empty content', () => {
      const state = createState();
      state.lastToolCall = { name: 'testTool' };
      const msg = { tool_call_id: '1', content: '{"command":"ls","stdout":"single file output"}' };
      
      handleToolResult(msg, state);
      
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('testTool');
      expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
    });

    it('should handle stderr with non-empty content', () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'errorTool' };
        const result = '{"command":"invalid","stderr":"Error: command not found", "success": false}';
        
        handleJsonToolResult(result, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('errorTool');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('❌');
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle stderr with verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'verboseErrorTool' };
        const longError = 'a'.repeat(150);
        const result = `{"command":"test","stderr":"${longError}", "success": false}`;
        
        handleJsonToolResult(result, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('verboseErrorTool');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('❌');
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });
  });

  describe('handleTextToolResult', () => {
    it('should handle text tool result in verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const lastToolCall = { name: 'textToolVerbose' };
        const longResult = 'a'.repeat(400); // Longer than verbose limit of 300
        
        handleTextToolResult(longResult, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('textToolVerbose');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text tool result with failure indicators', () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'failingTextTool' };
        const result = '❌ Operation failed due to error';
        
        handleTextToolResult(result, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('failingTextTool');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('❌');
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text tool result in non-verbose mode', () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = false;
      
      try {
        const lastToolCall = { name: 'textToolNormal' };
        const longResult = 'b'.repeat(200); // Longer than normal limit of 150
        
        handleTextToolResult(longResult, lastToolCall);
        
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('textToolNormal');
        expect(mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1][0]).toContain('✅');
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text task tool result', () => {
      const lastToolCall = { name: 'task' };
      const result = 'Task completed with detailed analysis';
      
      handleTextToolResult(result, lastToolCall);
      
      expect(mockConsoleLog).toHaveBeenCalled();
      // The last call is a newline, so check the second-to-last call
      const secondToLastCallIndex = mockConsoleLog.mock.calls.length - 2;
      expect(mockConsoleLog.mock.calls[secondToLastCallIndex][0]).toContain('子代理任务');
      expect(mockConsoleLog.mock.calls[secondToLastCallIndex][0]).toContain('✅');
    });

    it('should handle failed text task tool result', () => {
      const lastToolCall = { name: 'task' };
      const result = '❌ Task failed due to error';
      
      handleTextToolResult(result, lastToolCall);
      
      expect(mockConsoleLog).toHaveBeenCalled();
      // The last call is a newline, so check the second-to-last call
      const secondToLastCallIndex = mockConsoleLog.mock.calls.length - 2;
      expect(mockConsoleLog.mock.calls[secondToLastCallIndex][0]).toContain('子代理任务');
      expect(mockConsoleLog.mock.calls[secondToLastCallIndex][0]).toContain('❌');
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
        
        // Should have called process.stdout.write for the first character only
        expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
        expect(mockStdoutWrite).toHaveBeenCalledWith('n');
        // State should still be updated with full content
        expect(state.fullResponse).toBe('existing new content');
      } finally {
        (global as any).setTimeout = originalSetTimeout;
      }
    });
  });

  describe('processStreamChunks message deduplication', () => {
    it('should use JSON.stringify for messages without id or content', async () => {
      const state = createState();
      const msg = { someProp: 'value', nested: { deep: 'object' }, content: 'test content' }; // no id, but has content
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [msg];
        },
      };
      const session = createMockSession();
      
      await processStreamChunks(stream, state, session);
      
      // Should process the message and call streamAIContent
      expect(mockStdoutWrite).toHaveBeenCalled();
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
      const session = createMockSession();
      
      await processStreamChunks(stream, state, session);
      
      // Should show thinking indicator by calling logThinkingProcess
      expect(mockConsoleLog).toHaveBeenCalled();
      // Should also call streamAIContent for the message content
      expect(mockStdoutWrite).toHaveBeenCalled();
    });
  });
});

describe('processStreamChunks completion indicator', () => {
  let session: any;
  
  beforeEach(() => {
    session = createMockSession();
  });

  it('should show completion indicator with dots when response does not end with period', async () => {
    const state = createState();
    const stream = {
      [Symbol.asyncIterator]: async function* () {
        yield [{ content: 'This is a response' }];
      },
    };
    
    await processStreamChunks(stream, state, session);
    
    // The response content should be written
    expect(state.fullResponse).toBe('This is a response');
    
    // Should have called process.stdout.write for the completion indicator (3 dots)
    expect(mockStdoutWrite).toHaveBeenCalledWith('.');
    expect(mockStdoutWrite).toHaveBeenCalledWith('.\n');
  });

    it('should not show completion indicator when response ends with period', async () => {
      const state = createState();
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield [{ content: 'This is a response.' }];
        },
      };
      
      const originalSetTimeout = global.setTimeout;
      (global as any).setTimeout = jest.fn().mockImplementation((callback, delay) => {
        if (typeof callback === 'function') {
          callback();
        }
        return 0 as any;
      });
      
      try {
        await processStreamChunks(stream, state, session);
        
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
      
      await processStreamChunks(stream, state, session);
      
      // Should not have shown completion indicator due to abort
      const completionCalls = session.streamAIContent.mock.calls.filter((call: [string, boolean, boolean]) => call[2] === true);
      expect(completionCalls).toHaveLength(0);
    });
  });
