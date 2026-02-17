// jest.setup.ts
process.env.OPENAI_API_KEY = 'test-openai-api-key';
process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
process.env.MODEL_NAME = 'gpt-4o-mini';
process.env.RECURSION_LIMIT = '25';
process.env.CHECKPOINTER_TYPE = 'memory';
process.env.MEMORY_WINDOW_SIZE = '5';
process.env.TENCENTCLOUD_APP_ID = 'test-app-id';
process.env.TENCENTCLOUD_SECRET_ID = 'test-secret-id';
process.env.TENCENTCLOUD_SECRET_KEY = 'test-secret-key';
process.env.TENCENTCLOUD_REGION = 'ap-shanghai';

// Mock console methods to prevent noisy output during tests
// This saves tokens and keeps test output clean
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};