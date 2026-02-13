// Mock dotenv to prevent it from loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

import { config } from '../src/core/config/Config';

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
    // 设置必要的环境变量
    process.env.OPENAI_API_KEY = 'sk-test12345678901234567890123456789012';
    
    // 重新导入配置模块
    const { config: testConfig } = require('../src/core/config/Config');
    
    expect(testConfig.openai.apiKey).toBe('sk-test12345678901234567890123456789012');
    expect(testConfig.openai.modelName).toBe('gpt-4o'); // 默认值
    expect(testConfig.langgraph.recursionLimit).toBe(1000); // 默认值
    expect(testConfig.langgraph.checkpointerType).toBe('memory'); // 默认值
    expect(testConfig.memory.windowSize).toBe(5); // 默认值
    expect(testConfig.output.verbose).toBe(false); // 默认值
  });

  test('should use custom environment variables when provided', () => {
    process.env.OPENAI_API_KEY = 'sk-custom12345678901234567890123456789012';
    process.env.OPENAI_BASE_URL = 'https://custom-api.example.com/v1';
    process.env.MODEL_NAME = 'gpt-4-turbo';
    process.env.RECURSION_LIMIT = '500';
    process.env.CHECKPOINTER_TYPE = 'sqlite';
    process.env.MEMORY_WINDOW_SIZE = '10';
    process.env.VERBOSE_OUTPUT = 'true';
    
    const { config: testConfig } = require('../src/core/config/Config');
    
    expect(testConfig.openai.apiKey).toBe('sk-custom12345678901234567890123456789012');
    expect(testConfig.openai.baseURL).toBe('https://custom-api.example.com/v1');
    expect(testConfig.openai.modelName).toBe('gpt-4-turbo');
    expect(testConfig.langgraph.recursionLimit).toBe(500);
    expect(testConfig.langgraph.checkpointerType).toBe('sqlite');
    expect(testConfig.memory.windowSize).toBe(10);
    expect(testConfig.output.verbose).toBe(true);
  });

  test('should throw error when required OPENAI_API_KEY is missing', () => {
    delete process.env.OPENAI_API_KEY;
    
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
  });

  test('should throw error when OPENAI_API_KEY is empty', () => {
    process.env.OPENAI_API_KEY = '';
    
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
  });

  test('should validate OPENAI_BASE_URL format', () => {
    process.env.OPENAI_API_KEY = 'sk-test12345678901234567890123456789012';
    process.env.OPENAI_BASE_URL = 'not-a-url';
    
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
  });

  test('should accept valid OPENAI_BASE_URL', () => {
    process.env.OPENAI_API_KEY = 'sk-test12345678901234567890123456789012';
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
    
    const { config: testConfig } = require('../src/core/config/Config');
    
    expect(testConfig.openai.baseURL).toBe('https://api.openai.com/v1');
  });

  test('should validate RECURSION_LIMIT as positive integer', () => {
    process.env.OPENAI_API_KEY = 'sk-test12345678901234567890123456789012';
    process.env.RECURSION_LIMIT = '0';
    
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
    
    process.env.RECURSION_LIMIT = '-100';
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
    
    process.env.RECURSION_LIMIT = 'abc';
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
  });

  test('should validate MEMORY_WINDOW_SIZE as positive integer', () => {
    process.env.OPENAI_API_KEY = 'sk-test12345678901234567890123456789012';
    process.env.MEMORY_WINDOW_SIZE = '0';
    
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
  });

  test('should validate CHECKPOINTER_TYPE enum values', () => {
    process.env.OPENAI_API_KEY = 'sk-test12345678901234567890123456789012';
    process.env.CHECKPOINTER_TYPE = 'invalid';
    
    expect(() => {
      require('../src/core/config/Config');
    }).toThrow();
    
    process.env.CHECKPOINTER_TYPE = 'memory';
    const { config: testConfig1 } = require('../src/core/config/Config');
    expect(testConfig1.langgraph.checkpointerType).toBe('memory');
    
    // 重置模块缓存
    jest.resetModules();
    process.env.CHECKPOINTER_TYPE = 'sqlite';
    const { config: testConfig2 } = require('../src/core/config/Config');
    expect(testConfig2.langgraph.checkpointerType).toBe('sqlite');
  });
});