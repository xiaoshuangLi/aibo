// Mock dotenv to prevent loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock @langchain/openai
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((opts) => ({
    _modelType: 'openai',
    ...opts,
  })),
}));

// Mock @langchain/anthropic
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation((opts) => ({
    _modelType: 'anthropic',
    ...opts,
  })),
}));

describe('createModel', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      AIBO_OPENAI_API_KEY: 'sk-test-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('creates ChatOpenAI for default gpt-4o model', () => {
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatOpenAI } = require('@langchain/openai');

    const model = createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ modelName: 'gpt-4o', temperature: 0 })
    );
    expect(model._modelType).toBe('openai');
  });

  test('creates ChatOpenAI for gpt-4-turbo model', () => {
    process.env.AIBO_MODEL_NAME = 'gpt-4-turbo';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ modelName: 'gpt-4-turbo', temperature: 0 })
    );
  });

  test('creates ChatAnthropic for claude model', () => {
    process.env.AIBO_MODEL_NAME = 'claude-3-5-sonnet-20241022';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatAnthropic } = require('@langchain/anthropic');

    const model = createModel();

    expect(ChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0,
      })
    );
    expect(model._modelType).toBe('anthropic');
  });

  test('creates ChatAnthropic for any claude- prefixed model', () => {
    process.env.AIBO_MODEL_NAME = 'claude-opus-4-5';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatAnthropic } = require('@langchain/anthropic');

    createModel();

    expect(ChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-5' })
    );
  });

  test('passes baseURL configuration to ChatOpenAI when provided', () => {
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    process.env.AIBO_OPENAI_BASE_URL = 'https://custom-endpoint.example.com/v1';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: { baseURL: 'https://custom-endpoint.example.com/v1' },
      })
    );
  });

  test('does not pass configuration when baseURL is not set', () => {
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    delete process.env.AIBO_OPENAI_BASE_URL;
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    const callArgs = (ChatOpenAI as jest.Mock).mock.calls[0][0];
    expect(callArgs.configuration).toBeUndefined();
  });
});
