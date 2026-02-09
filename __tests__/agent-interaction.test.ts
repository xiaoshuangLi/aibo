import { 
  invokeAgent, 
  handleAgentResponse, 
  handleAgentError 
} from '../src/agent-interaction';

// Mock console.error to prevent test output pollution
const originalConsoleError = console.error;
console.error = jest.fn();

describe('Agent Interaction Utilities', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('invokeAgent', () => {
    test('should call agent.invoke with correct parameters', async () => {
      const mockAgent = {
        invoke: jest.fn().mockResolvedValue('test response')
      };
      
      const result = await invokeAgent(mockAgent as any, 'test input', 'test-thread-id');
      
      expect(mockAgent.invoke).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: "test input" }] },
        { 
          configurable: { thread_id: "test-thread-id" },
          recursionLimit: Infinity,
        }
      );
      expect(result).toBe('test response');
    });

    test('should throw error for invalid agent', async () => {
      await expect(invokeAgent(null as any, 'test', 'thread')).rejects.toThrow('Invalid agent provided');
      await expect(invokeAgent({} as any, 'test', 'thread')).rejects.toThrow('Invalid agent provided');
      await expect(invokeAgent({ invoke: 'not-a-function' } as any, 'test', 'thread')).rejects.toThrow('Invalid agent provided');
    });

    test('should throw error for empty input', async () => {
      const mockAgent = { invoke: jest.fn() };
      await expect(invokeAgent(mockAgent as any, '', 'thread')).rejects.toThrow('Input must be a non-empty string');
      await expect(invokeAgent(mockAgent as any, '   ', 'thread')).rejects.toThrow('Input must be a non-empty string');
    });

    test('should throw error for empty thread ID', async () => {
      const mockAgent = { invoke: jest.fn() };
      await expect(invokeAgent(mockAgent as any, 'test', '')).rejects.toThrow('Thread ID must be a non-empty string');
      await expect(invokeAgent(mockAgent as any, 'test', '   ')).rejects.toThrow('Thread ID must be a non-empty string');
    });
  });

  describe('handleAgentResponse', () => {
    test('should return string as-is for string input', () => {
      expect(handleAgentResponse('hello world')).toBe('hello world');
    });

    test('should stringify objects', () => {
      const obj = { message: 'hello', status: 'success' };
      expect(handleAgentResponse(obj)).toBe(JSON.stringify(obj, null, 2));
    });

    test('should handle arrays', () => {
      const arr = ['item1', 'item2'];
      expect(handleAgentResponse(arr)).toBe(JSON.stringify(arr, null, 2));
    });

    test('should convert other types to string', () => {
      expect(handleAgentResponse(123)).toBe('123');
      expect(handleAgentResponse(true)).toBe('true');
      expect(handleAgentResponse(null)).toBe('null');
      expect(handleAgentResponse(undefined)).toBe('undefined');
    });
  });

  describe('handleAgentError', () => {
    beforeEach(() => {
      // Reset NODE_ENV for each test
      delete process.env.NODE_ENV;
    });

    test('should format error message correctly', () => {
      const error = new Error('Test error message');
      const result = handleAgentError(error, { component: 'test-component' });
      
      expect(result).toBe('发生错误: Test error message');
      expect(console.error).toHaveBeenCalledWith('[test-component] Agent interaction error:', 'Test error message');
    });

    test('should handle error without message', () => {
      const result = handleAgentError({} as any);
      expect(result).toBe('发生错误: Unknown error occurred');
    });

    test('should log detailed info in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Detailed error');
      (error as any).stack = 'Stack trace here';
      
      handleAgentError(error, { component: 'test', extra: 'info' });
      
      expect(console.error).toHaveBeenCalledWith('Error stack:', 'Stack trace here');
      expect(console.error).toHaveBeenCalledWith('Error context:', { component: 'test', extra: 'info' });
    });

    test('should not log detailed info in production environment', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Production error');
      (error as any).stack = 'Stack trace here';
      
      handleAgentError(error, { component: 'test', extra: 'info' });
      
      // Should only log the basic error message, not stack or context
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('[test] Agent interaction error:', 'Production error');
    });
  });
});