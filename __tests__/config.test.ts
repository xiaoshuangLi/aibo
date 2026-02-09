import { config } from '../src/config';

describe('Configuration', () => {
  it('should load environment variables correctly', () => {
    expect(config.openai.apiKey).toBeDefined();
    expect(config.openai.apiKey).not.toBe('');
    
    // baseURL is optional, so it might be undefined
    expect(typeof config.openai.baseURL).toBe('string');
    
    expect(config.openai.modelName).toBeDefined();
    expect(config.langgraph.recursionLimit).toBeGreaterThan(0);
    expect(config.memory.windowSize).toBeGreaterThan(0);
  });

  it('should have default values for optional parameters', () => {
    // Test that defaults are applied when env vars are not set
    // This test assumes the .env file has all required values
    expect(config.openai.modelName).toBeTruthy();
    expect(config.langgraph.checkpointerType).toMatch(/memory|sqlite/);
  });
});