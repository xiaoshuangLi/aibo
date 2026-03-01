// jest.setup.ts
process.env.AIBO_OPENAI_API_KEY = 'test-openai-api-key';
process.env.AIBO_OPENAI_BASE_URL = 'https://api.openai.com/v1';
process.env.AIBO_MODEL_NAME = 'gpt-4o-mini';
process.env.AIBO_RECURSION_LIMIT = '25';
process.env.AIBO_CHECKPOINTER_TYPE = 'memory';
process.env.AIBO_TENCENTCLOUD_APP_ID = 'test-app-id';
process.env.AIBO_TENCENTCLOUD_SECRET_ID = 'test-secret-id';
process.env.AIBO_TENCENTCLOUD_SECRET_KEY = 'test-secret-key';
process.env.AIBO_TENCENTCLOUD_REGION = 'ap-shanghai';

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