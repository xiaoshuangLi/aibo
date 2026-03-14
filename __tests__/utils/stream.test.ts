import { 
  handleToolCall, 
  handleToolResult, 
  handleJsonToolResult, 
  handleTextToolResult, 
  handleTodos, 
  processStreamChunks,
  StreamState 
} from '@/core/utils/stream';
import { HumanMessage } from "langchain";

// Mock dependencies (stream-handler no longer uses styled directly)
jest.mock('@/presentation/styling/styler', () => ({
  styled: {}
}));

jest.mock('@/shared/utils/logging', () => ({
  structuredLog: jest.fn()
}));

jest.mock('@/infrastructure/session', () => ({
  SessionManager: {
    getInstance: () => ({
      clearCurrentSession: jest.fn().mockReturnValue('new-thread-id')
    })
  }
}));

describe('Stream Handler', () => {
  let mockState: StreamState;
  let mockSession: any;
  
  beforeEach(() => {
    mockState = {
      fullResponse: '',
      lastToolCall: null,
      hasDisplayedThinking: false,
      abortSignal: new AbortController().signal
    };
    
    mockSession = {
      ioChannel: {
        emit: jest.fn(),
        requestUserInput: jest.fn(),
        setAbortSignal: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        destroy: jest.fn()
      }
    };
  });

  describe('handleToolCall', () => {
    it('should handle tool call with valid parameters', () => {
      const msg = {
        tool_calls: [{
          name: 'testTool',
          args: { param: 'value' }
        }]
      };
      
      handleToolCall(msg, mockState, mockSession);
      
      expect(mockState.lastToolCall).toEqual(msg.tool_calls[0]);
    });

    it('should handle tool call with JSON string arguments', () => {
      const msg = {
        tool_calls: [{
          name: 'testTool',
          function: {
            arguments: '{"param": "value"}'
          }
        }]
      };
      
      handleToolCall(msg, mockState, mockSession);
      
      expect(mockState.lastToolCall).toEqual({
        name: 'testTool',
        function: {
          arguments: '{"param": "value"}'
        }
      });
    });

    it('should do nothing when no tool calls', () => {
      const msg = { content: 'test' };
      const originalState = { ...mockState };
      
      handleToolCall(msg, mockState, mockSession);
      
      expect(mockState).toEqual(originalState);
    });
  });

  describe('handleToolResult', () => {
    it('should handle JSON tool result', () => {
      const msg = {
        tool_result: { type: 'json', content: '{"result": "success"}' }
      };
      mockState.lastToolCall = { name: 'testTool' };
      
      handleToolResult(msg, mockState, mockSession);
      
      // Should not throw error
      expect(() => handleToolResult(msg, mockState, mockSession)).not.toThrow();
    });

    it('should handle text tool result', () => {
      const msg = {
        tool_result: { type: 'text', content: 'success' }
      };
      mockState.lastToolCall = { name: 'testTool' };
      
      handleToolResult(msg, mockState, mockSession);
      
      expect(() => handleToolResult(msg, mockState, mockSession)).not.toThrow();
    });

    it('should handle undefined tool result', () => {
      const msg = {
        tool_result: undefined
      };
      
      expect(() => handleToolResult(msg, mockState, mockSession)).not.toThrow();
    });
  });

  describe('handleJsonToolResult', () => {
    it('should handle valid JSON result', () => {
      const result = '{"data": "test"}';
      const lastToolCall = { name: 'testTool' };
      
      expect(() => handleJsonToolResult(result, lastToolCall, mockSession)).not.toThrow();
    });

    it('should handle invalid JSON result', () => {
      const result = 'invalid json';
      const lastToolCall = { name: 'testTool' };
      
      expect(() => handleJsonToolResult(result, lastToolCall, mockSession)).not.toThrow();
    });
  });

  describe('handleTextToolResult', () => {
    it('should handle text result', () => {
      const result = 'test result';
      const lastToolCall = { name: 'testTool' };
      
      expect(() => handleTextToolResult(result, lastToolCall, mockSession)).not.toThrow();
    });
  });

  describe('handleTodos', () => {
    it('should handle todos array', () => {
      const msg = { todos: [{ content: 'test todo' }] };
      
      expect(() => handleTodos(msg, mockState, mockSession)).not.toThrow();
    });

    it('should handle empty todos', () => {
      const msg = { todos: [] };
      
      expect(() => handleTodos(msg, mockState, mockSession)).not.toThrow();
    });

    it('should handle undefined todos', () => {
      const msg = {};
      
      expect(() => handleTodos(msg, mockState, mockSession)).not.toThrow();
    });
  });

  describe('processStreamChunks', () => {
    it('should process stream chunks without error', async () => {
      // Create a proper async iterable mock
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ content: 'test' }] };
        }
      };
      
      const userInput = 'test input';
      const session = { 
        threadId: 'test-thread',
        ioChannel: {
          emit: jest.fn(),
          requestUserInput: jest.fn(),
          setAbortSignal: jest.fn(),
          on: jest.fn(),
          off: jest.fn(),
          destroy: jest.fn()
        }
      };
      
      await expect(processStreamChunks(mockStream, mockState, session, userInput))
        .resolves.not.toThrow();
    });

    it('should auto-reset session on systemPrompt/systemMessage conflict error', async () => {
      const emitMock = jest.fn().mockResolvedValue(undefined);
      const session: any = {
        threadId: 'old-thread-id',
        adapter: { emit: emitMock }
      };

      const conflictError = new Error(
        'Cannot change both systemPrompt and systemMessage in the same request.'
      );

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          throw conflictError;
        }
      };

      const result = await processStreamChunks(mockStream, mockState, session, 'hello');

      // Session threadId should be updated to the new value returned by clearCurrentSession
      expect(session.threadId).toBe('new-thread-id');

      // Should emit an error message informing the user about the reset
      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'errorMessage',
          data: expect.objectContaining({
            message: expect.stringContaining('已自动重置会话')
          })
        })
      );

      // Should return the (empty) full response without re-throwing
      expect(result).toBe('');
    });
  });
});
