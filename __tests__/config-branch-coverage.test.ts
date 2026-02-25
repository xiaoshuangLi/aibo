import { config } from '@/core/config/config';

describe('Config Branch Coverage Tests', () => {
  test('should have valid config structure', () => {
    expect(config).toBeDefined();
    expect(config.openai).toBeDefined();
    expect(config.openai.apiKey).toBeDefined();
    expect(config.openai.modelName).toBeDefined();
    expect(config.langgraph).toBeDefined();
    expect(config.langgraph.recursionLimit).toBeDefined();
    expect(config.memory).toBeDefined();
    expect(config.memory.windowSize).toBeDefined();
  });

  test('should handle optional baseURL', () => {
    // baseURL can be undefined, so we just check it exists
    expect(config.openai.baseURL).toBeDefined();
  });
});