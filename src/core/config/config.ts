import dotenv from 'dotenv';
import { z } from 'zod';

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
 * Schema definition for required and optional environment variables.
 * 
 * Validates the following environment variables:
 * - OPENAI_API_KEY: Required OpenAI API key
 * - OPENAI_BASE_URL: Optional custom base URL for OpenAI API (useful for proxies or local deployments)
 * - MODEL_NAME: AI model name to use (defaults to 'gpt-4o')
 * - RECURSION_LIMIT: Maximum recursion depth for LangGraph (defaults to 1000)
 * - CHECKPOINTER_TYPE: Type of checkpointing mechanism ('memory' or 'sqlite', defaults to 'memory')
 * - MEMORY_WINDOW_SIZE: Size of the conversation memory window (defaults to 5)
 * 
 * @constant {z.ZodObject}
 * @private
 */
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().url().optional(),
  MODEL_NAME: z.string().min(1).default('gpt-4o'),
  RECURSION_LIMIT: z.coerce.number().int().positive().default(1000),
  CHECKPOINTER_TYPE: z.enum(['memory', 'sqlite']).default('memory'),
  MEMORY_WINDOW_SIZE: z.coerce.number().int().positive().default(5),
  VERBOSE_OUTPUT: z.coerce.boolean().default(false),
  // Tencent Cloud ASR and WSA Configuration
  TENCENTCLOUD_APP_ID: z.string().optional(),
  TENCENTCLOUD_SECRET_ID: z.string().optional(),
  TENCENTCLOUD_SECRET_KEY: z.string().optional(),
  TENCENTCLOUD_REGION: z.string().default('ap-guangzhou'),
  // Composio Configuration
  COMPOSIO_API_KEY: z.string().min(1).default('test-composio-api-key'),
  COMPOSIO_EXTERNAL_USER_ID: z.string().min(1).default('test-external-user-id'),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

/**
 * Validated application configuration object.
 * 
 * Provides a structured and type-safe way to access configuration values
 * throughout the application. All environment variables are validated
 * at startup and will throw descriptive errors if invalid.
 * 
 * @type {Object}
 * @property {Object} openai - OpenAI-specific configuration
 * @property {string} openai.apiKey - The OpenAI API key (required)
 * @property {string|undefined} openai.baseURL - Optional custom base URL for the OpenAI API
 * @property {string} openai.modelName - The AI model name to use
 * @property {Object} langgraph - LangGraph-specific configuration
 * @property {number} langgraph.recursionLimit - Maximum recursion depth allowed
 * @property {'memory'|'sqlite'} langgraph.checkpointerType - Type of checkpointing mechanism
 * @property {Object} memory - Memory-related configuration
 * @property {number} memory.windowSize - Size of the conversation memory window
 * 
 * @example
 * // Access OpenAI API key
 * const apiKey = config.openai.apiKey;
 * 
 * // Access optional baseURL with fallback
 * const baseUrl = config.openai.baseURL || 'https://api.openai.com/v1';
 */
export const config = {
  openai: {
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    modelName: env.MODEL_NAME,
  },
  langgraph: {
    recursionLimit: env.RECURSION_LIMIT,
    checkpointerType: env.CHECKPOINTER_TYPE,
  },
  memory: {
    windowSize: env.MEMORY_WINDOW_SIZE,
  },
  output: {
    verbose: env.VERBOSE_OUTPUT,
  },
  tencentCloud: {
    appId: env.TENCENTCLOUD_APP_ID,
    secretId: env.TENCENTCLOUD_SECRET_ID,
    secretKey: env.TENCENTCLOUD_SECRET_KEY,
    region: env.TENCENTCLOUD_REGION,
  },
  composio: {
    apiKey: env.COMPOSIO_API_KEY,
    externalUserId: env.COMPOSIO_EXTERNAL_USER_ID,
  },
};