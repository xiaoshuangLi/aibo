import { config } from '@/core/config/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';

/**
 * Model factory module that creates LangChain chat model instances.
 *
 * Supports multiple model providers based on the AIBO_MODEL_NAME configuration:
 * - Anthropic Claude models (claude-*)
 * - OpenAI models and OpenAI-compatible endpoints (default)
 *
 * @module model-factory
 */

/**
 * Creates a LangChain chat model instance based on the configured model name.
 *
 * The model provider is automatically detected from the model name:
 * - Models starting with "claude-" use ChatAnthropic
 * - All other models use ChatOpenAI (supports custom baseURL for compatible endpoints)
 *
 * @returns A configured LangChain BaseChatModel instance
 */
export function createModel() {
  const modelName = config.openai.modelName;

  if (modelName.startsWith('claude-')) {
    // ChatAnthropic reads the API key from the ANTHROPIC_API_KEY environment variable by default.
    return new ChatAnthropic({
      model: modelName,
      temperature: 0,
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
