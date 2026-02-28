import { config } from '@/core/config';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatMistralAI } from '@langchain/mistralai';
import { ChatGroq } from '@langchain/groq';
import { ChatOllama } from '@langchain/ollama';

/**
 * Model factory module that creates LangChain chat model instances.
 *
 * All providers use two unified parameters:
 * - AIBO_API_KEY   — API key (not required for Ollama)
 * - AIBO_BASE_URL  — custom base URL (required for Azure; defaults to
 *                    http://localhost:11434 for Ollama)
 *
 * The provider is resolved in this priority order:
 * 1. AIBO_MODEL_PROVIDER — explicit override
 * 2. Model name prefix   — claude-* / gemini-* / mistral-* / mixtral-* / codestral-*
 * 3. openai              — default fallback
 *
 * Supported providers and example model names:
 * - openai    : gpt-4o, gpt-4-turbo, o1, o3-mini
 * - anthropic : claude-3-5-sonnet-20241022, claude-opus-4
 * - google    : gemini-2.0-flash, gemini-1.5-pro
 * - mistral   : mistral-large-latest, mixtral-8x7b-instruct, codestral-latest
 * - groq      : llama-3.3-70b-versatile, gemma2-9b-it  (set AIBO_MODEL_PROVIDER=groq)
 * - ollama    : llama3, qwen2, mistral            (set AIBO_MODEL_PROVIDER=ollama)
 * - azure     : your-deployment-name              (set AIBO_MODEL_PROVIDER=azure)
 *
 * @module model
 */

/** Detect provider from model name prefix when no explicit provider is set. */
function detectProvider(modelName: string): string {
  if (modelName.startsWith('claude-')) return 'anthropic';
  if (modelName.startsWith('gemini-')) return 'google';
  if (
    modelName.startsWith('mistral-') ||
    modelName.startsWith('mixtral-') ||
    modelName.startsWith('codestral-')
  ) return 'mistral';
  return 'openai';
}

/**
 * Creates a LangChain chat model instance based on the configured model and provider.
 *
 * @returns A configured LangChain BaseChatModel instance
 */
export function createModel() {
  const { name: modelName, provider: explicitProvider, apiKey, baseURL, azureApiVersion } = config.model;
  const provider = explicitProvider ?? detectProvider(modelName);

  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({
        model: modelName,
        temperature: 0,
        ...(apiKey && { anthropicApiKey: apiKey }),
      });

    case 'google':
      return new ChatGoogleGenerativeAI({
        model: modelName,
        temperature: 0,
        ...(apiKey && { apiKey }),
      });

    case 'mistral':
      return new ChatMistralAI({
        model: modelName,
        temperature: 0,
        ...(apiKey && { apiKey }),
      });

    case 'groq':
      return new ChatGroq({
        model: modelName,
        temperature: 0,
        ...(apiKey && { apiKey }),
      });

    case 'ollama':
      return new ChatOllama({
        model: modelName,
        temperature: 0,
        baseUrl: baseURL ?? 'http://localhost:11434',
      });

    case 'azure':
      return new AzureChatOpenAI({
        model: modelName,
        temperature: 0,
        ...(apiKey && { azureOpenAIApiKey: apiKey }),
        ...(baseURL && { azureOpenAIBasePath: baseURL }),
        azureOpenAIApiVersion: azureApiVersion ?? '2024-02-15-preview',
      });

    case 'openai':
    default:
      return new ChatOpenAI({
        model: modelName,
        temperature: 0,
        ...(apiKey && { apiKey }),
        ...(baseURL && { configuration: { baseURL } }),
      });
  }
}
