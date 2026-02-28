import { createLangChainToolRetryMiddleware, createCustomLangChainToolRetryMiddleware, enhancedErrorHandler } from '@/core/middlewares';

describe('LangChainToolRetryMiddleware - Coverage Tests', () => {
  it('should create middleware successfully with default configuration', () => {
    const middleware = createLangChainToolRetryMiddleware();
    expect(middleware).toBeDefined();
  });

  it('should cover enhancedErrorHandler function with standard error', () => {
    const testError = new Error('Test error message');
    testError.name = 'TestError';
    testError.stack = 'Test stack trace';
    
    const result = enhancedErrorHandler(testError);
    expect(result).toContain('Test error message');
    expect(result).toContain('TestError');
    expect(result).toContain('Test stack trace');
  });

  it('should handle error without name', () => {
    const testError = new Error('Test error message');
    delete (testError as any).name;
    testError.stack = 'Test stack trace';
    
    const result = enhancedErrorHandler(testError);
    expect(result).toContain('Test error message');
    expect(result).toContain('Error'); // default name
    expect(result).toContain('Test stack trace');
  });

  it('should handle error without message', () => {
    const testError = new Error();
    testError.name = 'TestError';
    testError.stack = 'Test stack trace';
    
    const result = enhancedErrorHandler(testError);
    expect(result).toContain('Unknown error');
    expect(result).toContain('TestError');
    expect(result).toContain('Test stack trace');
  });

  it('should handle error without stack trace', () => {
    const testError = new Error('Test error message');
    testError.name = 'TestError';
    delete (testError as any).stack;
    
    const result = enhancedErrorHandler(testError);
    expect(result).toContain('Test error message');
    expect(result).toContain('TestError');
    expect(result).toContain('No stack trace available');
  });

  it('should create custom middleware with custom configuration', () => {
    const customConfig = {
      maxRetries: 2,
      backoffFactor: 1.5,
      initialDelayMs: 500,
      maxDelayMs: 5000,
      jitter: false,
      onFailure: (error: Error) => `Custom error: ${error.message}`
    };
    
    const middleware = createCustomLangChainToolRetryMiddleware(customConfig);
    expect(middleware).toBeDefined();
  });
});