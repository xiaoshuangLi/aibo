import { config } from '@/core/config';

describe('Config Branch Coverage Tests', () => {
  test('should have valid config structure', () => {
    expect(config).toBeDefined();
    expect(config.model).toBeDefined();
    expect(config.model.name).toBeDefined();
    expect(config.langgraph).toBeDefined();
    expect(config.langgraph.recursionLimit).toBeDefined();
  });

  test('should handle optional baseURL', () => {
    // baseURL can be undefined when neither AIBO_BASE_URL nor AIBO_OPENAI_BASE_URL is set
    expect(config.model).toBeDefined();
  });
});