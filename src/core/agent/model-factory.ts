import { config } from '@/core/config/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

/**
 * Model factory module that creates LangChain chat model instances.
 *
 * Supports multiple model providers based on the AIBO_MODEL_NAME configuration:
 * - Anthropic Claude models (claude-*): set AIBO_ANTHROPIC_API_KEY
 * - Google Gemini models (gemini-*): set AIBO_GOOGLE_API_KEY
 * - OpenAI models and OpenAI-compatible endpoints (default): set AIBO_OPENAI_API_KEY
 *
 * @module model-factory
 */

/**
 * Creates a LangChain chat model instance based on the configured model name.
 *
 * The model provider is automatically detected from the model name:
 * - Models starting with "claude-" use ChatAnthropic (AIBO_ANTHROPIC_API_KEY)
 * - Models starting with "gemini-" use ChatGoogleGenerativeAI (AIBO_GOOGLE_API_KEY)
 * - All other models use ChatOpenAI (supports custom baseURL for compatible endpoints)
 *
 * @returns A configured LangChain BaseChatModel instance
 */
export function createModel() {
  const modelName = config.openai.modelName;

  if (modelName.startsWith('claude-')) {
    return new ChatAnthropic({
      model: modelName,
      temperature: 0,
      ...(config.anthropic.apiKey && { anthropicApiKey: config.anthropic.apiKey }),
    });
  }

  if (modelName.startsWith('gemini-')) {
    return new ChatGoogleGenerativeAI({
      model: modelName,
      temperature: 0,
      ...(config.google.apiKey && { apiKey: config.google.apiKey }),
    });
  }

  return new ChatOpenAI({
    apiKey: config.openai.apiKey,
    modelName,
    temperature: 0,
    ...(config.openai.baseURL && {
      configuration: { baseURL: config.openai.baseURL },
    }),
  });
}
