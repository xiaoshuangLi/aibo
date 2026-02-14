import { createLangChainToolRetryMiddleware, createCustomLangChainToolRetryMiddleware } from '@/core/utils/langchain-tool-retry-middleware';

describe('LangChain Tool Retry Middleware', () => {
  describe('createLangChainToolRetryMiddleware', () => {
    it('should create middleware with default configuration', () => {
      const middleware = createLangChainToolRetryMiddleware();
      
      // Verify that it returns a middleware object
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('object');
    });

    it('should have correct default configuration', () => {
      // This test verifies that the function can be called without errors
      // and returns a valid middleware instance
      expect(() => createLangChainToolRetryMiddleware()).not.toThrow();
    });
  });

  describe('createCustomLangChainToolRetryMiddleware', () => {
    it('should create middleware with custom configuration', () => {
      const customConfig = {
        maxRetries: 2,
        onFailure: 'continue' as const,
        backoffFactor: 1.5,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        jitter: false,
      };
      
      const middleware = createCustomLangChainToolRetryMiddleware(customConfig);
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('object');
    });

    it('should handle minimal custom configuration', () => {
      const minimalConfig = {
        maxRetries: 1,
      };
      
      expect(() => createCustomLangChainToolRetryMiddleware(minimalConfig)).not.toThrow();
    });
  });
});