import { 
  handleToolCall, 
  handleToolResult, 
  handleJsonToolResult, 
  handleTextToolResult, 
  handleTodos, 
  processStreamChunks,
  StreamState 
} from '@/core/utils/stream-handler';
import { HumanMessage } from "langchain";

// Mock the styled function and other dependencies
jest.mock('@/presentation/styling/output-styler', () => ({
  styled: {
    tool: jest.fn((name, args) => `TOOL: ${name}(${JSON.stringify(args)})`),
    toolResult: jest.fn((result) => `RESULT: ${result}`),
    thinking: jest.fn(() => '🤔 Thinking...'),
    aiResponse: jest.fn((content) => `AI: ${content}`),
    todoList: jest.fn((todos) => `TODO: ${JSON.stringify(todos)}`),
    toolCall: jest.fn((name, args) => `TOOL_CALL: ${name}(${JSON.stringify(args)})`),
    truncated: jest.fn((text, limit) => text.length > limit ? text.substring(0, limit) + '...' : text),
    error: jest.fn((text) => `ERROR: ${text}`),
    assistant: jest.fn((text) => `ASSISTANT: ${text}`)
  }
}));

jest.mock('@/shared/utils/logging', () => ({
  structuredLog: jest.fn()
}));

describe('Stream Handler', () => {
  let mockState: StreamState;
  
  beforeEach(() => {
    mockState = {
      fullResponse: '',
      lastToolCall: null,
      hasDisplayedThinking: false,
      abortSignal: new AbortController().signal
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
      
      handleToolCall(msg, mockState);
      
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
      
      handleToolCall(msg, mockState);
      
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
      
      handleToolCall(msg, mockState);
      
      expect(mockState).toEqual(originalState);
    });
  });

  describe('handleToolResult', () => {
    it('should handle JSON tool result', () => {
      const msg = {
        tool_result: { type: 'json', content: '{"result": "success"}' }
      };
      mockState.lastToolCall = { name: 'testTool' };
      
      handleToolResult(msg, mockState);
      
      // Should not throw error
      expect(() => handleToolResult(msg, mockState)).not.toThrow();
    });

    it('should handle text tool result', () => {
      const msg = {
        tool_result: { type: 'text', content: 'success' }
      };
      mockState.lastToolCall = { name: 'testTool' };
      
      handleToolResult(msg, mockState);
      
      expect(() => handleToolResult(msg, mockState)).not.toThrow();
    });

    it('should handle undefined tool result', () => {
      const msg = {
        tool_result: undefined
      };
      
      expect(() => handleToolResult(msg, mockState)).not.toThrow();
    });
  });

  describe('handleJsonToolResult', () => {
    it('should handle valid JSON result', () => {
      const result = '{"data": "test"}';
      const lastToolCall = { name: 'testTool' };
      
      expect(() => handleJsonToolResult(result, lastToolCall)).not.toThrow();
    });

    it('should handle invalid JSON result', () => {
      const result = 'invalid json';
      const lastToolCall = { name: 'testTool' };
      
      expect(() => handleJsonToolResult(result, lastToolCall)).not.toThrow();
    });
  });

  describe('handleTextToolResult', () => {
    it('should handle text result', () => {
      const result = 'test result';
      const lastToolCall = { name: 'testTool' };
      
      expect(() => handleTextToolResult(result, lastToolCall)).not.toThrow();
    });
  });

  describe('handleTodos', () => {
    it('should handle todos array', () => {
      const msg = { todos: [{ content: 'test todo' }] };
      
      expect(() => handleTodos(msg, mockState)).not.toThrow();
    });

    it('should handle empty todos', () => {
      const msg = { todos: [] };
      
      expect(() => handleTodos(msg, mockState)).not.toThrow();
    });

    it('should handle undefined todos', () => {
      const msg = {};
      
      expect(() => handleTodos(msg, mockState)).not.toThrow();
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
      const session = { threadId: 'test-thread' };
      
      await expect(processStreamChunks(mockStream, mockState, null, userInput))
        .resolves.not.toThrow();
    });
  });
});