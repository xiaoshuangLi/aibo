import dotenv from 'dotenv';
import { z } from 'zod';
import { Command } from 'commander';

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
 * Parses command line arguments using Commander.js to determine interaction mode.
 * 
 * Priority order:
 * 1. --interaction=console|lark (highest priority)
 * 2. --interactive or -i (equivalent to --interaction=console)
 * 3. Environment variable AIBO_INTERACTION
 * 4. Default value 'console'
 * 
 * @returns {'console' | 'lark' | null} The interaction mode or null if not specified via CLI
 */
function parseInteractionModeFromArgs(): 'console' | 'lark' | null {
  const program = new Command();
  
  // Define the --interaction option with choices
  program
    .option('--interaction <mode>', 'Set interaction mode', 'console')
    .option('-i, --interactive', 'Enable interactive console mode')
    .allowUnknownOption(); // Allow other unknown options to pass through
  
  // Parse the arguments (skip the first two which are node and script path)
  program.parse(process.argv);
  const options = program.opts();
  
  // Check if --interactive or -i was provided (this should take precedence)
  if (options.interactive) {
    return 'console';
  }
  
  // Check if --interaction was explicitly provided
  // We need to check if the option was actually passed, not just the default value
  const rawArgs = process.argv.slice(2);
  const hasInteractionArg = rawArgs.some(arg => arg.startsWith('--interaction='));
  
  if (hasInteractionArg) {
    const mode = options.interaction;
    if (mode === 'console' || mode === 'lark') {
      return mode;
    }
    // If invalid mode is provided, we'll let it fall through to env/default
    // and potentially show a warning later if needed
  }
  
  return null; // No relevant CLI argument specified
}

/**
 * Determines the final interaction mode based on CLI args and environment variables.
 * 
 * Priority order:
 * 1. Command line arguments (--interaction, --interactive, -i)
 * 2. AIBO_LARK_MODE environment variable (for backward compatibility)
 * 3. AIBO_INTERACTION environment variable
 * 4. Default value 'console'
 * 
 * @returns {'console' | 'lark'} The resolved interaction mode
 */
function resolveInteractionMode(): 'console' | 'lark' {
  // First, check command line arguments (highest priority)
  const cliMode = parseInteractionModeFromArgs();
  if (cliMode !== null) {
    return cliMode;
  }
  
  // Second, check AIBO_LARK_MODE for backward compatibility
  if (process.env.AIBO_LARK_MODE === 'true') {
    return 'lark';
  }
  
  // Third, fall back to AIBO_INTERACTION environment variable or default
  return process.env.AIBO_INTERACTION === 'lark' ? 'lark' : 'console';
}

/**
 * Schema definition for required and optional environment variables.
 * 
 * Validates the following environment variables (all prefixed with AIBO_):
 * - AIBO_OPENAI_API_KEY: Required OpenAI API key
 * - AIBO_OPENAI_BASE_URL: Optional custom base URL for OpenAI API (useful for proxies or local deployments)
 * - AIBO_MODEL_NAME: AI model name to use (defaults to 'gpt-4o')
 * - AIBO_RECURSION_LIMIT: Maximum recursion depth for LangGraph (defaults to 1000)
 * - AIBO_CHECKPOINTER_TYPE: Type of checkpointing mechanism ('memory' or 'sqlite', defaults to 'memory')
 * - AIBO_MEMORY_WINDOW_SIZE: Size of the conversation memory window (defaults to 5)
 * 
 * @constant {z.ZodObject}
 * @private
 */
const envSchema = z.object({
  AIBO_OPENAI_API_KEY: z.string().min(1),
  AIBO_OPENAI_BASE_URL: z.string().url().optional(),
  AIBO_ANTHROPIC_API_KEY: z.string().optional(),
  AIBO_GOOGLE_API_KEY: z.string().optional(),
  AIBO_MODEL_NAME: z.string().min(1).default('gpt-4o'),
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

// Resolve the actual interaction mode considering CLI args
const resolvedInteractionMode = resolveInteractionMode();

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
    apiKey: env.AIBO_OPENAI_API_KEY,
    baseURL: env.AIBO_OPENAI_BASE_URL,
    modelName: env.AIBO_MODEL_NAME,
  },
  anthropic: {
    apiKey: env.AIBO_ANTHROPIC_API_KEY,
  },
  google: {
    apiKey: env.AIBO_GOOGLE_API_KEY,
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
  },
};