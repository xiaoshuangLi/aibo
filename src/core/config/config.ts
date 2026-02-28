import dotenv from 'dotenv';
import { z } from 'zod';
import { parseInteractionModeFromArgs, parseLarkTypeFromArgs } from '@/cli/utils';

/**
 * Application configuration module that loads and validates environment variables.
 * 
 * This module handles the loading of environment variables from a `.env` file,
 * validates them using Zod schema validation, and provides a typed configuration
 * object for use throughout the application.
 * 
 * @module config
 */

// Load environment variables from .env file
dotenv.config({ quiet: true });

/**
 * Determines the final interaction mode based on CLI args and environment variables.
 * 
 * Priority order:
 * 1. `aibo interact --mode console|lark` subcommand option
 * 2. All four Lark config vars present (AIBO_LARK_APP_ID, AIBO_LARK_APP_SECRET,
 *    AIBO_LARK_RECEIVE_ID, AIBO_LARK_INTERACTIVE_TEMPLATE_ID) → lark mode
 * 3. Default: console mode
 * 
 * @returns {'console' | 'lark'} The resolved interaction mode
 */
function resolveInteractionMode(): 'console' | 'lark' {
  // 1. `aibo interact --mode` takes highest priority
  const cliMode = parseInteractionModeFromArgs();
  if (cliMode !== null) {
    return cliMode;
  }

  // 2. Auto-detect lark mode when all four Lark integration vars are configured
  if (
    process.env.AIBO_LARK_APP_ID &&
    process.env.AIBO_LARK_APP_SECRET &&
    process.env.AIBO_LARK_RECEIVE_ID &&
    process.env.AIBO_LARK_INTERACTIVE_TEMPLATE_ID
  ) {
    return 'lark';
  }

  // 3. Default: console mode
  return 'console';
}

/**
 * Determines the lark interaction type from CLI args.
 *
 * Only effective when the interaction mode is `lark`.
 * Priority order:
 * 1. `aibo interact --type user_chat|group_chat` subcommand option
 * 2. Default: user_chat type
 *
 * @returns {'user_chat' | 'group_chat'} The resolved lark type
 */
function resolveLarkType(): 'user_chat' | 'group_chat' {
  const cliType = parseLarkTypeFromArgs();
  if (cliType !== null) {
    return cliType;
  }
  return 'user_chat';
}


/**
 * 
 * Validates the following environment variables (all prefixed with AIBO_):
 * - AIBO_API_KEY: Unified API key for any model provider (required for cloud providers;
 *   not required for local deployments like Ollama)
 * - AIBO_BASE_URL: Unified base URL for any provider (required for Azure; defaults to http://localhost:11434 for Ollama)
 * - AIBO_MODEL_NAME: AI model name to use (defaults to 'gpt-4o')
 * - AIBO_MODEL_PROVIDER: Explicit provider override (openai|anthropic|google|mistral|groq|ollama|azure).
 *   Auto-detected from model name prefix when omitted.
 * - AIBO_AZURE_API_VERSION: Azure OpenAI API version (only required when using Azure)
 * - AIBO_RECURSION_LIMIT: Maximum recursion depth for LangGraph (defaults to 1000)
 * - AIBO_CHECKPOINTER_TYPE: Type of checkpointing mechanism ('memory' or 'sqlite', defaults to 'memory')
 * - AIBO_MEMORY_WINDOW_SIZE: Size of the conversation memory window (defaults to 5)
 * 
 * @constant {z.ZodObject}
 * @private
 */
const envSchema = z.object({
  AIBO_API_KEY: z.string().optional(),
  AIBO_BASE_URL: z.string().url().optional(),
  // Backward-compatible aliases (AIBO_API_KEY / AIBO_BASE_URL take precedence when both are set)
  AIBO_OPENAI_API_KEY: z.string().optional(),
  AIBO_OPENAI_BASE_URL: z.string().url().optional(),
  AIBO_MODEL_NAME: z.string().min(1).default('gpt-4o'),
  AIBO_MODEL_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'mistral', 'groq', 'ollama', 'azure']).optional(),
  AIBO_AZURE_API_VERSION: z.string().optional(),
  AIBO_RECURSION_LIMIT: z.coerce.number().int().positive().default(1000),
  AIBO_CHECKPOINTER_TYPE: z.enum(['memory', 'sqlite', 'filesystem']).default('memory'),
  AIBO_MEMORY_WINDOW_SIZE: z.coerce.number().int().positive().default(5),
  AIBO_VERBOSE_OUTPUT: z.coerce.boolean().default(false),
  // Tencent Cloud ASR and WSA Configuration
  AIBO_TENCENTCLOUD_APP_ID: z.string().optional(),
  AIBO_TENCENTCLOUD_SECRET_ID: z.string().optional(),
  AIBO_TENCENTCLOUD_SECRET_KEY: z.string().optional(),
  AIBO_TENCENTCLOUD_REGION: z.string().default('ap-guangzhou'),
  // Composio Configuration
  AIBO_COMPOSIO_API_KEY: z.string().min(1).default('test-composio-api-key'),
  AIBO_COMPOSIO_EXTERNAL_USER_ID: z.string().min(1).default('test-external-user-id'),
  // Advanced Subtask Configuration
  AIBO_MAX_CONCURRENT_SUBTASKS: z.coerce.number().int().min(1).max(50).default(5),
  // Special keyword configuration
  AIBO_SPECIAL_KEYWORD: z.string().min(1).default('干活'),
  // Language configuration
  AIBO_LANGUAGE: z.enum(['en', 'zh']).default('en'),
  // Persona / communication style configuration
  AIBO_PERSONA: z.string().default('你的交流风格是魅魔人设：妩媚迷人、温柔体贴、善于撒娇。用甜蜜亲切的语气与用户互动，偶尔使用"主人"等称呼，举止优雅而富有魅力。在保持专业技术能力的同时，让每次对话都充满温情与趣味。'),
  // Lark (Feishu) Configuration
  AIBO_LARK_APP_ID: z.string().optional(),
  AIBO_LARK_APP_SECRET: z.string().optional(),
  AIBO_LARK_RECEIVE_ID: z.string().optional(),
  AIBO_LARK_INTERACTIVE_TEMPLATE_ID: z.string().optional(),
  // Interaction Mode Configuration (for backward compatibility and default resolution)
  AIBO_INTERACTION: z.enum(['console', 'lark']).default('console'),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Resolve the actual interaction mode considering CLI args and env vars
const resolvedInteractionMode = resolveInteractionMode();

// Resolve the lark interaction type from CLI args
const resolvedLarkType = resolveLarkType();

/**
 * Validated application configuration object.
 * 
 * Provides a structured and type-safe way to access configuration values
 * throughout the application. All environment variables are validated
 * at startup and will throw descriptive errors if invalid.
 * 
 * @type {Object}
 * @property {Object} model - Unified model configuration
 * @property {string|undefined} model.apiKey - API key for the model provider (not required for Ollama)
 * @property {string|undefined} model.baseURL - Base URL for the model provider
 * @property {string} model.name - The AI model name to use
 * @property {string|undefined} model.provider - Explicit provider override; auto-detected when omitted
 * @property {string|undefined} model.azureApiVersion - Azure OpenAI API version (Azure only)
 * @property {Object} langgraph - LangGraph-specific configuration
 * @property {number} langgraph.recursionLimit - Maximum recursion depth allowed
 * @property {'memory'|'sqlite'} langgraph.checkpointerType - Type of checkpointing mechanism
 * @property {Object} memory - Memory-related configuration
 * @property {number} memory.windowSize - Size of the conversation memory window
 */
export const config = {
  model: {
    apiKey: env.AIBO_API_KEY ?? env.AIBO_OPENAI_API_KEY,
    baseURL: env.AIBO_BASE_URL ?? env.AIBO_OPENAI_BASE_URL,
    name: env.AIBO_MODEL_NAME,
    provider: env.AIBO_MODEL_PROVIDER,
    azureApiVersion: env.AIBO_AZURE_API_VERSION,
  },
  langgraph: {
    recursionLimit: env.AIBO_RECURSION_LIMIT,
    checkpointerType: env.AIBO_CHECKPOINTER_TYPE,
  },
  memory: {
    windowSize: env.AIBO_MEMORY_WINDOW_SIZE,
  },
  output: {
    verbose: env.AIBO_VERBOSE_OUTPUT,
  },
  tencentCloud: {
    appId: env.AIBO_TENCENTCLOUD_APP_ID,
    secretId: env.AIBO_TENCENTCLOUD_SECRET_ID,
    secretKey: env.AIBO_TENCENTCLOUD_SECRET_KEY,
    region: env.AIBO_TENCENTCLOUD_REGION,
  },
  composio: {
    apiKey: env.AIBO_COMPOSIO_API_KEY,
    externalUserId: env.AIBO_COMPOSIO_EXTERNAL_USER_ID,
  },
  lark: {
    appId: env.AIBO_LARK_APP_ID,
    appSecret: env.AIBO_LARK_APP_SECRET,
    receiveId: env.AIBO_LARK_RECEIVE_ID,
    interactiveTemplateId: env.AIBO_LARK_INTERACTIVE_TEMPLATE_ID,
  },
  advanced: {
    maxConcurrentSubtasks: env.AIBO_MAX_CONCURRENT_SUBTASKS,
  },
  specialKeyword: {
    keyword: env.AIBO_SPECIAL_KEYWORD,
  },
  language: {
    code: env.AIBO_LANGUAGE,
  },
  persona: {
    style: env.AIBO_PERSONA,
  },
  interaction: {
    mode: resolvedInteractionMode,
    larkType: resolvedLarkType,
  },
};