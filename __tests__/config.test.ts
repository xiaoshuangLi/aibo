// Mock dotenv to prevent it from loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

import { config } from '@/core/config';

describe('Configuration Module', () => {
  // 保存原始环境变量
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 清理环境变量
    jest.resetModules();
    process.env = {};
    // Reset dotenv mock
    (require('dotenv').config as jest.Mock).mockClear();
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  test('should load required environment variables correctly', () => {
    // AIBO_API_KEY is optional (Ollama doesn't need one), so any value works
    process.env.AIBO_API_KEY = 'sk-test-key';
    
    // 重新导入配置模块
    const { config: testConfig } = require('../src/core/config');
    
    expect(testConfig.model.apiKey).toBe('sk-test-key');
    expect(testConfig.model.name).toBe('gpt-4o'); // 默认值
    expect(testConfig.langgraph.recursionLimit).toBe(1000); // 默认值
    expect(testConfig.langgraph.checkpointerType).toBe('memory'); // 默认值
    expect(testConfig.memory.windowSize).toBe(5); // 默认值
    expect(testConfig.output.verbose).toBe(false); // 默认值
    expect(testConfig.persona.style).toContain('魅魔'); // 默认魅魔人设
  });

  test('should use custom environment variables when provided', () => {
    process.env.AIBO_API_KEY = 'sk-custom-key';
    process.env.AIBO_BASE_URL = 'https://custom-api.example.com/v1';
    process.env.AIBO_MODEL_NAME = 'gpt-4-turbo';
    process.env.AIBO_RECURSION_LIMIT = '500';
    process.env.AIBO_CHECKPOINTER_TYPE = 'sqlite';
    process.env.AIBO_MEMORY_WINDOW_SIZE = '10';
    process.env.AIBO_VERBOSE_OUTPUT = 'true';
    
    const { config: testConfig } = require('../src/core/config');
    
    expect(testConfig.model.apiKey).toBe('sk-custom-key');
    expect(testConfig.model.baseURL).toBe('https://custom-api.example.com/v1');
    expect(testConfig.model.name).toBe('gpt-4-turbo');
    expect(testConfig.langgraph.recursionLimit).toBe(500);
    expect(testConfig.langgraph.checkpointerType).toBe('sqlite');
    expect(testConfig.memory.windowSize).toBe(10);
    expect(testConfig.output.verbose).toBe(true);
  });

  test('should work without AIBO_API_KEY (e.g. for Ollama)', () => {
    delete process.env.AIBO_API_KEY;
    process.env.AIBO_MODEL_NAME = 'llama3';
    process.env.AIBO_MODEL_PROVIDER = 'ollama';

    const { config: testConfig } = require('../src/core/config');

    expect(testConfig.model.apiKey).toBeUndefined();
    expect(testConfig.model.name).toBe('llama3');
    expect(testConfig.model.provider).toBe('ollama');
  });

  test('should throw error when AIBO_BASE_URL has invalid format', () => {
    process.env.AIBO_BASE_URL = 'not-a-url';
    
    expect(() => {
      require('../src/core/config');
    }).toThrow();
  });

  test('should accept valid AIBO_BASE_URL', () => {
    process.env.AIBO_BASE_URL = 'https://api.openai.com/v1';
    
    const { config: testConfig } = require('../src/core/config');
    
    expect(testConfig.model.baseURL).toBe('https://api.openai.com/v1');
  });

  test('should validate AIBO_RECURSION_LIMIT as positive integer', () => {
    process.env.AIBO_RECURSION_LIMIT = '0';
    
    expect(() => {
      require('../src/core/config');
    }).toThrow();
    
    process.env.AIBO_RECURSION_LIMIT = '-100';
    expect(() => {
      require('../src/core/config');
    }).toThrow();
    
    process.env.AIBO_RECURSION_LIMIT = 'abc';
    expect(() => {
      require('../src/core/config');
    }).toThrow();
  });

  test('should validate AIBO_MEMORY_WINDOW_SIZE as positive integer', () => {
    process.env.AIBO_MEMORY_WINDOW_SIZE = '0';
    
    expect(() => {
      require('../src/core/config');
    }).toThrow();
  });

  test('should validate AIBO_CHECKPOINTER_TYPE enum values', () => {
    process.env.AIBO_CHECKPOINTER_TYPE = 'invalid';
    
    expect(() => {
      require('../src/core/config');
    }).toThrow();
    
    process.env.AIBO_CHECKPOINTER_TYPE = 'memory';
    const { config: testConfig1 } = require('../src/core/config');
    expect(testConfig1.langgraph.checkpointerType).toBe('memory');
    
    // 重置模块缓存
    jest.resetModules();
    process.env.AIBO_CHECKPOINTER_TYPE = 'sqlite';
    const { config: testConfig2 } = require('../src/core/config');
    expect(testConfig2.langgraph.checkpointerType).toBe('sqlite');
  });

  test('should use default 魅魔 persona when AIBO_PERSONA is not set', () => {
    delete process.env.AIBO_PERSONA;

    const { config: testConfig } = require('../src/core/config');

    expect(testConfig.persona.style).toContain('魅魔');
  });

  test('should use custom persona when AIBO_PERSONA is provided', () => {
    process.env.AIBO_PERSONA = '你是一个严肃的助手，回答简洁直接。';

    const { config: testConfig } = require('../src/core/config');

    expect(testConfig.persona.style).toBe('你是一个严肃的助手，回答简洁直接。');
  });

  test('AIBO_OPENAI_API_KEY is accepted as backward-compatible alias for AIBO_API_KEY', () => {
    process.env.AIBO_OPENAI_API_KEY = 'sk-legacy-key';

    const { config: testConfig } = require('../src/core/config');

    expect(testConfig.model.apiKey).toBe('sk-legacy-key');
  });

  test('AIBO_API_KEY takes precedence over AIBO_OPENAI_API_KEY', () => {
    process.env.AIBO_API_KEY = 'sk-new-key';
    process.env.AIBO_OPENAI_API_KEY = 'sk-legacy-key';

    const { config: testConfig } = require('../src/core/config');

    expect(testConfig.model.apiKey).toBe('sk-new-key');
  });

  test('AIBO_OPENAI_BASE_URL is accepted as backward-compatible alias for AIBO_BASE_URL', () => {
    process.env.AIBO_OPENAI_BASE_URL = 'https://legacy-endpoint.example.com/v1';

    const { config: testConfig } = require('../src/core/config');

    expect(testConfig.model.baseURL).toBe('https://legacy-endpoint.example.com/v1');
  });

  test('AIBO_BASE_URL takes precedence over AIBO_OPENAI_BASE_URL', () => {
    process.env.AIBO_BASE_URL = 'https://new-endpoint.example.com/v1';
    process.env.AIBO_OPENAI_BASE_URL = 'https://legacy-endpoint.example.com/v1';

    const { config: testConfig } = require('../src/core/config');

    expect(testConfig.model.baseURL).toBe('https://new-endpoint.example.com/v1');
  });
});