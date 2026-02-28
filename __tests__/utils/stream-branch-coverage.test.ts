import { 
  handleToolResult,
  handleTextToolResult,
  handleAIContent,
  StreamState
} from '@/core/utils/stream';

jest.mock('@/presentation/styling/styler', () => ({
  styled: {}
}));

jest.mock('@/shared/utils/logging', () => ({
  structuredLog: jest.fn()
}));

describe('Stream Handler - Branch Coverage', () => {
  let mockSession: any;
  
  beforeEach(() => {
    const mockEmit = jest.fn().mockResolvedValue(undefined);
    mockSession = {
      adapter: { emit: mockEmit }
    };
    jest.clearAllMocks();
  });

  describe('handleToolResult branches', () => {
    it('should skip when msg has no tool_call_id', () => {
      const state: StreamState = {
        fullResponse: '',
        lastToolCall: null,
        hasDisplayedThinking: false,
        abortSignal: new AbortController().signal
      };
      // Should not throw - just returns
      handleToolResult({}, state, mockSession);
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should skip when signal is aborted', () => {
      const controller = new AbortController();
      controller.abort();
      const state: StreamState = {
        fullResponse: '',
        lastToolCall: { name: 'bash', args: {} },
        hasDisplayedThinking: false,
        abortSignal: controller.signal
      };
      handleToolResult({ tool_call_id: 'id-1', content: 'result' }, state, mockSession);
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should handle JSON result (starts with {)', () => {
      const state: StreamState = {
        fullResponse: '',
        lastToolCall: { name: 'bash', args: { command: 'ls' } },
        hasDisplayedThinking: false,
        abortSignal: new AbortController().signal
      };
      handleToolResult(
        { tool_call_id: 'id-1', content: '{"stdout": "file.txt", "stderr": "(empty)"}' },
        state,
        mockSession
      );
      expect(mockSession.adapter.emit).toHaveBeenCalled();
    });

    it('should handle text result (non-JSON)', () => {
      const state: StreamState = {
        fullResponse: '',
        lastToolCall: { name: 'grep', args: {} },
        hasDisplayedThinking: false,
        abortSignal: new AbortController().signal
      };
      handleToolResult(
        { tool_call_id: 'id-1', content: 'line1\nline2\nline3' },
        state,
        mockSession
      );
      expect(mockSession.adapter.emit).toHaveBeenCalled();
    });
  });

  describe('handleTextToolResult branches', () => {
    it('should handle task tool result with subagent_type', async () => {
      const lastToolCall = { name: 'task', args: { subagent_type: 'coding' } };
      await handleTextToolResult('task completed', lastToolCall, mockSession);
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'toolResult',
          data: expect.objectContaining({ isTaskResult: true })
        })
      );
    });

    it('should handle task tool result without subagent_type', async () => {
      const lastToolCall = { name: 'task', args: {} };
      await handleTextToolResult('done', lastToolCall, mockSession);
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: '子代理任务', isTaskResult: true })
        })
      );
    });

    it('should handle task tool result with error indicator', async () => {
      const lastToolCall = { name: 'task', args: { subagent_type: 'test' } };
      await handleTextToolResult('❌ 失败了', lastToolCall, mockSession);
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: false })
        })
      );
    });

    it('should handle non-task tool result', async () => {
      const lastToolCall = { name: 'bash', args: {} };
      await handleTextToolResult('output text', lastToolCall, mockSession);
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isTextResult: true })
        })
      );
    });
  });

  describe('handleAIContent branches', () => {
    it('should reset fullResponse when content diverges', async () => {
      const state: StreamState = {
        fullResponse: 'previous content',
        lastToolCall: null,
        hasDisplayedThinking: false,
        abortSignal: new AbortController().signal
      };
      // Content doesn't start with fullResponse
      await handleAIContent(
        { content: 'completely different content here' },
        state,
        mockSession
      );
      // After the divergence check, fullResponse should be reset
      expect(mockSession.adapter.emit).toHaveBeenCalled();
    });

    it('should return when content is same length as fullResponse (no new content)', async () => {
      const state: StreamState = {
        fullResponse: 'Hello World',
        lastToolCall: null,
        hasDisplayedThinking: false,
        abortSignal: new AbortController().signal
      };
      // content is exactly same - no new content
      await handleAIContent({ content: 'Hello World' }, state, mockSession);
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should skip when tool_call_id is present', async () => {
      const state: StreamState = {
        fullResponse: '',
        lastToolCall: null,
        hasDisplayedThinking: false,
        abortSignal: new AbortController().signal
      };
      await handleAIContent({ content: 'text', tool_call_id: 'id-1' }, state, mockSession);
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should skip when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const state: StreamState = {
        fullResponse: '',
        lastToolCall: null,
        hasDisplayedThinking: false,
        abortSignal: controller.signal
      };
      await handleAIContent({ content: 'text' }, state, mockSession);
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });
  });
});
