// Mock dotenv to prevent loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock all LangChain provider packages
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((opts) => ({ _modelType: 'openai', ...opts })),
  AzureChatOpenAI: jest.fn().mockImplementation((opts) => ({ _modelType: 'azure', ...opts })),
}));
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation((opts) => ({ _modelType: 'anthropic', ...opts })),
}));
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation((opts) => ({ _modelType: 'google', ...opts })),
}));
jest.mock('@langchain/mistralai', () => ({
  ChatMistralAI: jest.fn().mockImplementation((opts) => ({ _modelType: 'mistral', ...opts })),
}));
jest.mock('@langchain/groq', () => ({
  ChatGroq: jest.fn().mockImplementation((opts) => ({ _modelType: 'groq', ...opts })),
}));
jest.mock('@langchain/ollama', () => ({
  ChatOllama: jest.fn().mockImplementation((opts) => ({ _modelType: 'ollama', ...opts })),
}));

describe('createModel', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Auto-detection from model name prefix ──────────────────────────────────

  test('creates ChatOpenAI for gpt-4o (default)', () => {
    process.env.AIBO_API_KEY = 'sk-test';
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model');
    const { ChatOpenAI } = require('@langchain/openai');

    const model = createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o', temperature: 0 }));
    expect(model._modelType).toBe('openai');
  });

  test('creates ChatAnthropic for claude- prefix', () => {
    process.env.AIBO_API_KEY = 'sk-ant-test';
    process.env.AIBO_MODEL_NAME = 'claude-3-5-sonnet-20241022';
    const { createModel } = require('@/core/agent/model');
    const { ChatAnthropic } = require('@langchain/anthropic');

    const model = createModel();

    expect(ChatAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-sonnet-20241022', anthropicApiKey: 'sk-ant-test', temperature: 0 })
    );
    expect(model._modelType).toBe('anthropic');
  });

  test('creates ChatGoogleGenerativeAI for gemini- prefix', () => {
    process.env.AIBO_API_KEY = 'AIzaSy-test';
    process.env.AIBO_MODEL_NAME = 'gemini-2.0-flash';
    const { createModel } = require('@/core/agent/model');
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

    const model = createModel();

    expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash', apiKey: 'AIzaSy-test', temperature: 0 })
    );
    expect(model._modelType).toBe('google');
  });

  test('creates ChatMistralAI for mistral- prefix', () => {
    process.env.AIBO_API_KEY = 'mistral-test';
    process.env.AIBO_MODEL_NAME = 'mistral-large-latest';
    const { createModel } = require('@/core/agent/model');
    const { ChatMistralAI } = require('@langchain/mistralai');

    const model = createModel();

    expect(ChatMistralAI).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'mistral-large-latest', temperature: 0 })
    );
    expect(model._modelType).toBe('mistral');
  });

  test('creates ChatMistralAI for mixtral- prefix', () => {
    process.env.AIBO_MODEL_NAME = 'mixtral-8x7b-instruct';
    const { createModel } = require('@/core/agent/model');
    const { ChatMistralAI } = require('@langchain/mistralai');

    createModel();

    expect(ChatMistralAI).toHaveBeenCalledWith(expect.objectContaining({ model: 'mixtral-8x7b-instruct' }));
  });

  test('creates ChatMistralAI for codestral- prefix', () => {
    process.env.AIBO_MODEL_NAME = 'codestral-latest';
    const { createModel } = require('@/core/agent/model');
    const { ChatMistralAI } = require('@langchain/mistralai');

    createModel();

    expect(ChatMistralAI).toHaveBeenCalledWith(expect.objectContaining({ model: 'codestral-latest' }));
  });

  // ── Explicit provider override ─────────────────────────────────────────────

  test('creates ChatGroq when AIBO_MODEL_PROVIDER=groq', () => {
    process.env.AIBO_API_KEY = 'gsk-test';
    process.env.AIBO_MODEL_NAME = 'llama-3.3-70b-versatile';
    process.env.AIBO_MODEL_PROVIDER = 'groq';
    const { createModel } = require('@/core/agent/model');
    const { ChatGroq } = require('@langchain/groq');

    const model = createModel();

    expect(ChatGroq).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'llama-3.3-70b-versatile', apiKey: 'gsk-test', temperature: 0 })
    );
    expect(model._modelType).toBe('groq');
  });

  test('creates ChatOllama when AIBO_MODEL_PROVIDER=ollama (default baseUrl)', () => {
    process.env.AIBO_MODEL_NAME = 'llama3';
    process.env.AIBO_MODEL_PROVIDER = 'ollama';
    const { createModel } = require('@/core/agent/model');
    const { ChatOllama } = require('@langchain/ollama');

    const model = createModel();

    expect(ChatOllama).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'llama3', baseUrl: 'http://localhost:11434', temperature: 0 })
    );
    expect(model._modelType).toBe('ollama');
  });

  test('creates ChatOllama with custom AIBO_BASE_URL', () => {
    process.env.AIBO_MODEL_NAME = 'llama3';
    process.env.AIBO_MODEL_PROVIDER = 'ollama';
    process.env.AIBO_BASE_URL = 'http://myserver:11434';
    const { createModel } = require('@/core/agent/model');
    const { ChatOllama } = require('@langchain/ollama');

    createModel();

    expect(ChatOllama).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'http://myserver:11434' }));
  });

  test('creates AzureChatOpenAI when AIBO_MODEL_PROVIDER=azure', () => {
    process.env.AIBO_API_KEY = 'azure-test-key';
    process.env.AIBO_BASE_URL = 'https://my-instance.openai.azure.com';
    process.env.AIBO_MODEL_NAME = 'my-deployment';
    process.env.AIBO_MODEL_PROVIDER = 'azure';
    process.env.AIBO_AZURE_API_VERSION = '2024-05-01-preview';
    const { createModel } = require('@/core/agent/model');
    const { AzureChatOpenAI } = require('@langchain/openai');

    const model = createModel();

    expect(AzureChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'my-deployment',
        azureOpenAIApiKey: 'azure-test-key',
        azureOpenAIBasePath: 'https://my-instance.openai.azure.com',
        azureOpenAIApiVersion: '2024-05-01-preview',
      })
    );
    expect(model._modelType).toBe('azure');
  });

  test('AIBO_MODEL_PROVIDER overrides auto-detection (e.g. groq running a mistral- model)', () => {
    process.env.AIBO_API_KEY = 'gsk-test';
    process.env.AIBO_MODEL_NAME = 'mistral-saba-v1';
    process.env.AIBO_MODEL_PROVIDER = 'groq';
    const { createModel } = require('@/core/agent/model');
    const { ChatGroq } = require('@langchain/groq');

    createModel();

    expect(ChatGroq).toHaveBeenCalledWith(expect.objectContaining({ model: 'mistral-saba-v1' }));
  });

  // ── Unified AIBO_API_KEY and AIBO_BASE_URL ─────────────────────────────────

  test('passes AIBO_API_KEY to ChatOpenAI', () => {
    process.env.AIBO_API_KEY = 'sk-unified-key';
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-unified-key' }));
  });

  test('passes AIBO_BASE_URL as configuration.baseURL to ChatOpenAI', () => {
    process.env.AIBO_BASE_URL = 'https://custom-endpoint.example.com/v1';
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: { baseURL: 'https://custom-endpoint.example.com/v1' } })
    );
  });

  test('no configuration.baseURL when neither AIBO_BASE_URL nor AIBO_OPENAI_BASE_URL is set', () => {
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    const callArgs = (ChatOpenAI as jest.Mock).mock.calls[0][0];
    expect(callArgs.configuration).toBeUndefined();
  });

  // ── Backward compatibility: AIBO_OPENAI_API_KEY / AIBO_OPENAI_BASE_URL ─────

  test('AIBO_OPENAI_API_KEY works as fallback when AIBO_API_KEY is not set', () => {
    process.env.AIBO_OPENAI_API_KEY = 'sk-legacy-key';
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-legacy-key' }));
  });

  test('AIBO_OPENAI_BASE_URL works as fallback when AIBO_BASE_URL is not set', () => {
    process.env.AIBO_OPENAI_BASE_URL = 'https://legacy-endpoint.example.com/v1';
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: { baseURL: 'https://legacy-endpoint.example.com/v1' } })
    );
  });

  test('AIBO_API_KEY takes precedence over AIBO_OPENAI_API_KEY', () => {
    process.env.AIBO_API_KEY = 'sk-new-key';
    process.env.AIBO_OPENAI_API_KEY = 'sk-legacy-key';
    process.env.AIBO_MODEL_NAME = 'gpt-4o';
    const { createModel } = require('@/core/agent/model');
    const { ChatOpenAI } = require('@langchain/openai');

    createModel();

    expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-new-key' }));
  });
});

