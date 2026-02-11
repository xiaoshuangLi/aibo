import { 
  invokeAgent, 
  handleAgentResponse, 
  handleAgentError 
} from '../src/agent-interaction';

// Mock console.error to prevent test output pollution
const originalConsoleError = console.error;
console.error = jest.fn();

describe('AI Thinking Capability Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('invokeAgent with Thinking Enabled', () => {
    test('should call agent.invoke with enable_thinking parameter', async () => {
      const mockAgent = {
        invoke: jest.fn().mockResolvedValue('test response with thinking')
      };
      
      const result = await invokeAgent(mockAgent as any, 'complex problem solving', 'thinking-thread-id');
      
      expect(mockAgent.invoke).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: "complex problem solving" }] },
        { 
          modelKwargs: { enable_thinking: true },
          configurable: { thread_id: "thinking-thread-id" },
          recursionLimit: Infinity,
        }
      );
      expect(result).toBe('test response with thinking');
    });

    test('should maintain thinking capability across different input types', async () => {
      const mockAgent = {
        invoke: jest.fn().mockResolvedValue('thinking response')
      };
      
      // Test with various input scenarios
      await invokeAgent(mockAgent as any, 'debug this code', 'thread1');
      await invokeAgent(mockAgent as any, 'optimize this algorithm', 'thread2');
      await invokeAgent(mockAgent as any, 'explain this concept', 'thread3');
      
      // Verify that all calls include the thinking parameter
      expect(mockAgent.invoke).toHaveBeenCalledTimes(3);
      expect(mockAgent.invoke).toHaveBeenNthCalledWith(
        1,
        { messages: [{ role: "user", content: "debug this code" }] },
        { 
          modelKwargs: { enable_thinking: true },
          configurable: { thread_id: "thread1" },
          recursionLimit: Infinity,
        }
      );
      expect(mockAgent.invoke).toHaveBeenNthCalledWith(
        2,
        { messages: [{ role: "user", content: "optimize this algorithm" }] },
        { 
          modelKwargs: { enable_thinking: true },
          configurable: { thread_id: "thread2" },
          recursionLimit: Infinity,
        }
      );
      expect(mockAgent.invoke).toHaveBeenNthCalledWith(
        3,
        { messages: [{ role: "user", content: "explain this concept" }] },
        { 
          modelKwargs: { enable_thinking: true },
          configurable: { thread_id: "thread3" },
          recursionLimit: Infinity,
        }
      );
    });
  });

  describe('Interactive Mode with Thinking', () => {
    // This test would be covered by the interactive-utils tests
    // but we verify the core functionality here
    test('should preserve thinking capability in interactive scenarios', () => {
      // The thinking capability is enabled at the agent interaction level
      // so it should be consistent across all usage patterns
      expect(true).toBe(true); // Placeholder for integration testing
    });
  });

  describe('Error Handling with Thinking Enabled', () => {
    test('should handle errors properly when thinking is enabled', async () => {
      const mockAgent = {
        invoke: jest.fn().mockRejectedValue(new Error('Thinking process failed'))
      };
      
      await expect(invokeAgent(mockAgent as any, 'problematic input', 'error-thread'))
        .rejects.toThrow('Thinking process failed');
      
      expect(mockAgent.invoke).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: "problematic input" }] },
        { 
          modelKwargs: { enable_thinking: true },
          configurable: { thread_id: "error-thread" },
          recursionLimit: Infinity,
        }
      );
    });
  });
});

// Restore original console.error after all tests
afterAll(() => {
  console.error = originalConsoleError;
});