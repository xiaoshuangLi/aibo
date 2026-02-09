import { invokeAgent, handleAgentResponse, handleAgentError } from '../src/agent-interaction';

// Mock console methods
const originalConsoleError = console.error;
const mockConsoleError = jest.fn();
console.error = mockConsoleError;

describe('Agent Interaction Utilities', () => {
  afterEach(() => {
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  describe('invokeAgent', () => {
    test('should throw error for invalid agent', async () => {
      await expect(invokeAgent(null, 'test', 'thread-123')).rejects.toThrow('Invalid agent provided');
      await expect(invokeAgent({}, 'test', 'thread-123')).rejects.toThrow('Invalid agent provided');
    });

    test('should throw error for invalid input', async () => {
      const mockAgent = { invoke: jest.fn() };
      await expect(invokeAgent(mockAgent, '', 'thread-123')).rejects.toThrow('Input must be a non-empty string');
      await expect(invokeAgent(mockAgent, '   ', 'thread-123')).rejects.toThrow('Input must be a non-empty string');
      await expect(invokeAgent(mockAgent, null as any, 'thread-123')).rejects.toThrow('Input must be a non-empty string');
    });

    test('should throw error for invalid threadId', async () => {
      const mockAgent = { invoke: jest.fn() };
      await expect(invokeAgent(mockAgent, 'test', '')).rejects.toThrow('Thread ID must be a non-empty string');
      await expect(invokeAgent(mockAgent, 'test', '   ')).rejects.toThrow('Thread ID must be a non-empty string');
      await expect(invokeAgent(mockAgent, 'test', null as any)).rejects.toThrow('Thread ID must be a non-empty string');
    });

    test('should call agent.invoke with correct parameters', async () => {
      const mockInvoke = jest.fn().mockResolvedValue('test response');
      const mockAgent = { invoke: mockInvoke };
      
      const result = await invokeAgent(mockAgent, 'hello world', 'thread-123');
      
      expect(mockInvoke).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: "hello world" }] },
        { 
          configurable: { thread_id: "thread-123" },
          recursionLimit: Infinity,
        }
      );
      expect(result).toBe('test response');
    });
  });

  describe('handleAgentResponse', () => {
    test('should return string responses as-is', () => {
      expect(handleAgentResponse('hello')).toBe('hello');
      expect(handleAgentResponse('')).toBe('');
    });

    test('should stringify object responses', () => {
      const obj = { message: 'test', value: 42 };
      const expected = JSON.stringify(obj, null, 2);
      expect(handleAgentResponse(obj)).toBe(expected);
    });

    test('should handle null and undefined', () => {
      expect(handleAgentResponse(null)).toBe('null');
      expect(handleAgentResponse(undefined)).toBe('undefined');
    });

    test('should convert other types to string', () => {
      expect(handleAgentResponse(42)).toBe('42');
      expect(handleAgentResponse(true)).toBe('true');
      expect(handleAgentResponse(false)).toBe('false');
    });
  });

  describe('handleAgentError', () => {
    test('should format error messages correctly', () => {
      const error = new Error('Test error message');
      const result = handleAgentError(error, { component: 'interactive' });
      
      expect(result).toBe('发生错误: Test error message');
      expect(mockConsoleError).toHaveBeenCalledWith('[interactive] Agent interaction error:', 'Test error message');
    });

    test('should handle errors without message property', () => {
      const result = handleAgentError({ someProp: 'value' }, { component: 'test' });
      expect(result).toBe('发生错误: Unknown error occurred');
    });

    test('should handle null/undefined errors', () => {
      const result1 = handleAgentError(null, { component: 'test' });
      const result2 = handleAgentError(undefined, { component: 'test' });
      
      expect(result1).toBe('发生错误: Unknown error occurred');
      expect(result2).toBe('发生错误: Unknown error occurred');
    });

    test('should log detailed info in non-production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Detailed error');
      (error as any).stack = 'Stack trace here';
      
      handleAgentError(error, { component: 'test', extra: 'info' });
      
      // Should log stack and context in development
      expect(mockConsoleError).toHaveBeenCalledTimes(3); // error message + stack + context
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should not log detailed info in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Production error');
      (error as any).stack = 'Stack trace here';
      
      handleAgentError(error, { component: 'test', extra: 'info' });
      
      // Should only log error message in production
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});