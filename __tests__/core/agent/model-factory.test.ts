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

// Mock @langchain/google-genai
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation((opts) => ({
    _modelType: 'google',
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

  test('passes AIBO_ANTHROPIC_API_KEY to ChatAnthropic when set', () => {
    process.env.AIBO_MODEL_NAME = 'claude-3-5-sonnet-20241022';
    process.env.AIBO_ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatAnthropic } = require('@langchain/anthropic');

    createModel();

    expect(ChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ anthropicApiKey: 'sk-ant-test-key' })
    );
  });

  test('does not pass anthropicApiKey when AIBO_ANTHROPIC_API_KEY is not set', () => {
    process.env.AIBO_MODEL_NAME = 'claude-3-5-sonnet-20241022';
    delete process.env.AIBO_ANTHROPIC_API_KEY;
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatAnthropic } = require('@langchain/anthropic');

    createModel();

    const callArgs = (ChatAnthropic as jest.Mock).mock.calls[0][0];
    expect(callArgs.anthropicApiKey).toBeUndefined();
  });

  test('creates ChatGoogleGenerativeAI for gemini model', () => {
    process.env.AIBO_MODEL_NAME = 'gemini-2.0-flash';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

    const model = createModel();

    expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash', temperature: 0 })
    );
    expect(model._modelType).toBe('google');
  });

  test('creates ChatGoogleGenerativeAI for any gemini- prefixed model', () => {
    process.env.AIBO_MODEL_NAME = 'gemini-1.5-pro';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

    createModel();

    expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-1.5-pro' })
    );
  });

  test('passes AIBO_GOOGLE_API_KEY to ChatGoogleGenerativeAI when set', () => {
    process.env.AIBO_MODEL_NAME = 'gemini-2.0-flash';
    process.env.AIBO_GOOGLE_API_KEY = 'AIzaSy-test-key';
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

    createModel();

    expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'AIzaSy-test-key' })
    );
  });

  test('does not pass apiKey to ChatGoogleGenerativeAI when AIBO_GOOGLE_API_KEY is not set', () => {
    process.env.AIBO_MODEL_NAME = 'gemini-2.0-flash';
    delete process.env.AIBO_GOOGLE_API_KEY;
    const { createModel } = require('@/core/agent/model-factory');
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

    createModel();

    const callArgs = (ChatGoogleGenerativeAI as jest.Mock).mock.calls[0][0];
    expect(callArgs.apiKey).toBeUndefined();
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
