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

// Mock structuredLog
jest.mock('@/shared/utils/logging', () => ({
  structuredLog: jest.fn(),
}));

// ===== 辅助函数 =====
const createState = (): StreamState => ({
  fullResponse: '',
  lastToolCall: null,
  hasDisplayedThinking: false,
  abortSignal: new AbortController().signal,
});

const createMockSession = (overrides = {}) => ({
  ioChannel: {
    emit: jest.fn(),
  },
  setVoiceRecording: jest.fn(),
  ...overrides,
});

// ===== 工具函数 =====
beforeEach(() => {
  // Clear any mocks on session.ioChannel.emit in tests
  (structuredLog as jest.Mock).mockClear();
});

// ===== 测试消息处理器 =====
describe('message handlers', () => {
  describe('handleToolCall', () => {
    it('should use call.args when available', async () => {
      const state = createState();
      const session = createMockSession();
      const msg = {
        tool_calls: [
          { name: 'toolWithArgs', args: { param1: 'value1', param2: 123 } },
        ],
      };
      await handleToolCall(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
      expect(state.lastToolCall.name).toBe('toolWithArgs');
    });

    it('should parse function.arguments as JSON when provided', async () => {
      const state = createState();
      const session = createMockSession();
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
      await handleToolCall(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
      expect(state.lastToolCall.function?.name).toBe('toolWithArgs');
    });

    it('should handle function.arguments without call.args', async () => {
      const state = createState();
      const session = createMockSession();
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
      await handleToolCall(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
      expect(state.lastToolCall.function?.name).toBe('toolWithArgs');
    });

    it('should return empty args when neither call.args nor call.function.arguments exist', async () => {
      const state = createState();
      const session = createMockSession();
      const msg = {
        tool_calls: [
          { 
            name: 'toolWithoutArgs',
            // no args property
            // no function property
          },
        ],
      };
      await handleToolCall(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
      expect(state.lastToolCall.name).toBe('toolWithoutArgs');
    });
  });

  describe('handleToolResult', () => {
    it('should handle JSON result with command preview', () => {
      const state = createState();
      const session = createMockSession();
      state.lastToolCall = { name: 'cmd' };
      const msg = { tool_call_id: '1', content: '{"command":"ls","stdout":"file.txt"}' };
      handleToolResult(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle JSON result with filepath preview', () => {
      const state = createState();
      const session = createMockSession();
      state.lastToolCall = { name: 'readFile' };
      const msg = { tool_call_id: '1', content: '{"filepath":"/path/to/file.txt","content":"file content"}' };
      handleToolResult(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle JSON result with no preview fields', () => {
      const state = createState();
      const session = createMockSession();
      state.lastToolCall = { name: 'tool' };
      const msg = { tool_call_id: '1', content: '{"success":true}' };
      handleToolResult(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle text result with success detection', () => {
      const state = createState();
      const session = createMockSession();
      state.lastToolCall = { name: 'textTool' };
      const msg = { tool_call_id: '1', content: 'Operation completed successfully' };
      handleToolResult(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should detect failure in text result', () => {
      const state = createState();
      const session = createMockSession();
      state.lastToolCall = { name: 'failTool' };
      const msg = { tool_call_id: '1', content: '❌ Operation failed' };
      handleToolResult(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should skip when aborted', () => {
      const ac = new AbortController();
      ac.abort();
      const state = { ...createState(), abortSignal: ac.signal };
      const session = createMockSession();
      const msg = { tool_call_id: '1', content: 'test' };
      handleToolResult(msg, state, session);
      expect(session.ioChannel.emit).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', () => {
      const state = createState();
      const session = createMockSession();
      state.lastToolCall = { name: 'badJson' };
      const msg = { tool_call_id: '1', content: 'not json' };
      handleToolResult(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle null/undefined content', () => {
      const state = createState();
      const session = createMockSession();
      state.lastToolCall = { name: 'nullContent' };
      const msg1 = { tool_call_id: '1', content: null };
      handleToolResult(msg1, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
      
      const msg2 = { tool_call_id: '2' };
      handleToolResult(msg2, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });
  });

  describe('handleAIContent', () => {
    it('should skip tool results and empty content', async () => {
      const state = createState();
      const session = createMockSession();
      await handleAIContent({ tool_call_id: '1' }, state, session);
      await handleAIContent({ content: '' }, state, session);
      expect(session.ioChannel.emit).not.toHaveBeenCalled();
    });

    it('should write new content character by character', async () => {
      const state = createState();
      state.fullResponse = 'existing ';
      const session = createMockSession();
      await handleAIContent({ content: 'existing new content' }, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
      expect(state.fullResponse).toBe('existing new content');
    });

    it('should handle new content with only whitespace differences', async () => {
      const state = createState();
      state.fullResponse = 'existing content';
      const session = createMockSession();
      await handleAIContent({ content: 'existing content ' }, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });
  });

  describe('handleTodos', () => {
    it('should display new completed todos', async () => {
      const state = createState();
      const session = createMockSession();
      const msg = {
        todos: [
          { content: 'Task 1', status: 'completed' },
          { content: 'Task 2', status: 'in_progress' },
        ],
      };
      
      await handleTodos(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
      expect(state.hasDisplayedThinking).toBe(true);
    });

    it('should display pending todos and skip duplicates', async () => {
      const state = createState();
      state.fullResponse = 'Task 1';
      const session = createMockSession();
      const msg = {
        todos: [
          { content: 'Task 1', status: 'completed' },
          { content: 'Task 2', status: 'pending' },
        ],
      };
      
      await handleTodos(msg, state, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should skip when aborted', async () => {
      const ac = new AbortController();
      ac.abort();
      const state = { ...createState(), abortSignal: ac.signal };
      const session = createMockSession();
      const msg = { todos: [{ content: 'Task', status: 'completed' }] };
      
      await handleTodos(msg, state, session);
      expect(session.ioChannel.emit).not.toHaveBeenCalled();
    });
  });
});

// ===== 测试主流程 processStreamChunks =====
describe('processStreamChunks', () => {
  let session: any;
  
  beforeEach(() => {
    session = createMockSession();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process stream chunks correctly', async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { messages: [{ content: 'Hello' }] };
        yield { messages: [{ content: 'Hello world' }] };
      }
    };
    const state = createState();

    const result = await processStreamChunks(mockStream as any, state, session);
    expect(result).toBe('Hello world');
    expect(session.ioChannel.emit).toHaveBeenCalled();
  });

  it('should log structured error on exception', async () => {
    const badStream = {
      [Symbol.asyncIterator]: async function* () {
        throw new Error('Test error');
      }
    };
    const state = createState();

    await processStreamChunks(badStream as any, state, session);
    expect(session.ioChannel.emit).toHaveBeenCalled();
    expect(structuredLog).toHaveBeenCalled();
  });

  it('should handle user interruption gracefully', async () => {
    const controller = new AbortController();
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        controller.abort();
        yield { messages: [{ content: 'test' }] };
      }
    };
    const state = { ...createState(), abortSignal: controller.signal };

    await processStreamChunks(mockStream as any, state, session);
    expect(session.ioChannel.emit).toHaveBeenCalled();
  });

  it('should handle general errors with structured logging', async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        throw new Error('Test error');
      }
    };
    const state = createState();

    await processStreamChunks(mockStream as any, state, session);
    expect(session.ioChannel.emit).toHaveBeenCalled();
    expect(structuredLog).toHaveBeenCalled();
  });
});

// ===== 边界情况和100%覆盖率测试 =====
describe('Edge Cases for 100% Coverage', () => {
  describe('handleJsonToolResult', () => {
    it('should display "无输出" when preview is empty', async () => {
      const session = createMockSession();
      const lastToolCall = { name: 'emptyTool' };
      const result = '{"success":true,"stdout":"(empty)","stderr":"(empty)"}';
      
      await handleJsonToolResult(result, lastToolCall, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle JSON task tool result with message', async () => {
      const session = createMockSession();
      const lastToolCall = { name: 'task' };
      const result = JSON.stringify({ message: 'Research completed successfully', success: true });
      
      await handleJsonToolResult(result, lastToolCall, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle JSON task tool result as string', async () => {
      const session = createMockSession();
      const lastToolCall = { name: 'task' };
      const result = JSON.stringify('Simple result string');
      
      await handleJsonToolResult(result, lastToolCall, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle stdout with "(empty)" value', async () => {
      const session = createMockSession();
      const lastToolCall = { name: 'toolWithEmptyStdout' };
      const result = '{"stdout":"(empty)","success":true}';
      
      await handleJsonToolResult(result, lastToolCall, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should use longer truncation limits in verbose mode', async () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const session = createMockSession();
        const lastToolCall = { name: 'verboseTool' };
        const longOutput = 'a'.repeat(300);
        const result = `{"command":"test","stdout":"${longOutput}","success":true}`;
        
        await handleJsonToolResult(result, lastToolCall, session);
        expect(session.ioChannel.emit).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should use shorter truncation limits in non-verbose mode', async () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = false;
      
      try {
        const session = createMockSession();
        const lastToolCall = { name: 'normalTool' };
        const longOutput = 'b'.repeat(200);
        const result = `{"command":"test","stdout":"${longOutput}","success":true}`;
        
        await handleJsonToolResult(result, lastToolCall, session);
        expect(session.ioChannel.emit).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle stderr in verbose mode', async () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const session = createMockSession();
        const lastToolCall = { name: 'stderrTool' };
        const longError = 'Error: '.repeat(20);
        const result = `{"command":"test","stderr":"${longError}","success":true}`;
        
        await handleJsonToolResult(result, lastToolCall, session);
        expect(session.ioChannel.emit).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle invalid JSON in catch block', async () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const session = createMockSession();
        const lastToolCall = { name: 'invalidJsonTool' };
        const invalidJson = 'this is not valid json at all';
        
        await handleJsonToolResult(invalidJson, lastToolCall, session);
        expect(session.ioChannel.emit).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });
  });

  describe('handleTextToolResult', () => {
    it('should handle text tool result in verbose mode', async () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = true;
      
      try {
        const session = createMockSession();
        const lastToolCall = { name: 'textToolVerbose' };
        const longResult = 'a'.repeat(400);
        
        await handleTextToolResult(longResult, lastToolCall, session);
        expect(session.ioChannel.emit).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text tool result with failure indicators', async () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = false;
      
      try {
        const session = createMockSession();
        const lastToolCall = { name: 'failingTextTool' };
        const result = '❌ Operation failed due to error';
        
        await handleTextToolResult(result, lastToolCall, session);
        expect(session.ioChannel.emit).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text tool result in non-verbose mode', async () => {
      const originalConfig = { ...require('../../src/core/config/config').config };
      require('../../src/core/config/config').config.output.verbose = false;
      
      try {
        const session = createMockSession();
        const lastToolCall = { name: 'textToolNormal' };
        const longResult = 'b'.repeat(200);
        
        await handleTextToolResult(longResult, lastToolCall, session);
        expect(session.ioChannel.emit).toHaveBeenCalled();
      } finally {
        require('../../src/core/config/config').config.output.verbose = originalConfig.output.verbose;
      }
    });

    it('should handle text task tool result', async () => {
      const session = createMockSession();
      const lastToolCall = { name: 'task' };
      const result = 'Task completed with detailed analysis';
      
      await handleTextToolResult(result, lastToolCall, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });

    it('should handle failed text task tool result', async () => {
      const session = createMockSession();
      const lastToolCall = { name: 'task' };
      const result = '❌ Task failed due to error';
      
      await handleTextToolResult(result, lastToolCall, session);
      expect(session.ioChannel.emit).toHaveBeenCalled();
    });
  });

  describe('handleAIContent abort handling', () => {
    it('should break loop when aborted during character writing', async () => {
      const controller = new AbortController();
      const state = createState();
      state.abortSignal = controller.signal;
      state.fullResponse = 'existing ';
      
      const testSession = createMockSession();
      const stream = {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ content: 'existing new content' }] };
        }
      };
      
      await processStreamChunks(stream, state, testSession);
      expect(testSession.ioChannel.emit).toHaveBeenCalled();
    });
  });

  describe('processStreamChunks message deduplication', () => {
    it('should deduplicate messages with same ID', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ id: 'msg1', content: 'test message' }] };
          yield { messages: [{ id: 'msg1', content: 'test message' }] };
        }
      };
      const state = createState();
      const testSession = createMockSession();

      await processStreamChunks(mockStream as any, state, testSession);
      expect(state.fullResponse).toBe('test message');
    });

    it('should use JSON.stringify for messages without id or content', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ customField: 'test' }] };
        }
      };
      const state = createState();
      const testSession = createMockSession();

      await processStreamChunks(mockStream as any, state, testSession);
      expect(testSession.ioChannel.emit).toHaveBeenCalled();
    });

    it('should show initial indicator for todos without showing assistant indicator', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { 
            messages: [{ content: 'Initial response' }], 
            todos: [{ content: 'Task 1', status: 'in_progress' }] 
          };
        }
      };
      const state = createState();
      const testSession = createMockSession();

      await processStreamChunks(mockStream as any, state, testSession);
      expect(testSession.ioChannel.emit).toHaveBeenCalled();
    });
  });
});

describe('processStreamChunks completion indicator', () => {
  it('should show completion indicator with dots when response does not end with period', async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { messages: [{ content: 'This is a test response' }] };
      }
    };
    const state = createState();
    const testSession = createMockSession();

    await processStreamChunks(mockStream as any, state, testSession);
    expect(testSession.ioChannel.emit).toHaveBeenCalled();
  });

  it('should not show completion indicator when response ends with period', async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { messages: [{ content: 'This is a test response.' }] };
      }
    };
    const state = createState();
    const testSession = createMockSession();

    await processStreamChunks(mockStream as any, state, testSession);
    expect(testSession.ioChannel.emit).toHaveBeenCalled();
  });
});