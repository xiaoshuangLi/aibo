import { config } from './config';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from "@langchain/langgraph";
import { createDeepAgent, FilesystemBackend } from 'deepagents';

/**
 * AI Agent module that provides DeepAgents integration with LangChain.
 * 
 * This module creates and configures an AI agent using DeepAgents framework
 * integrated with LangChain components. It supports configurable AI models,
 * file system operations, and state persistence through checkpointer mechanisms.
 * 
 * @module index
 */

/**
 * Creates and configures an AI agent instance.
 * 
 * Initializes a DeepAgent with the following components:
 * - Configured ChatOpenAI model with API key, base URL, and model name from environment variables
 * - FilesystemBackend for file operations with current working directory as root
 * - MemorySaver checkpointer for state persistence
 * 
 * The function handles optional configuration parameters gracefully, only applying
 * them when they are provided in the environment variables.
 * 
 * @returns {ReturnType<typeof createDeepAgent>} A configured DeepAgent instance
 * @throws {Error} If environment variables are invalid or required dependencies fail to initialize
 * 
 * @example
 * const agent = createAIAgent();
 * // Use the agent for AI operations
 * 
 * @see {@link config} for environment variable configuration details
 * @see {@link main} for the main execution function
 */
export function createAIAgent() {
  // Build ChatOpenAI configuration
  const chatConfig: any = {
    openAIApiKey: config.openai.apiKey,
    modelName: config.openai.modelName,
    temperature: 0,
  };

  // Only add baseURL if it's provided
  if (config.openai.baseURL) {
    chatConfig.configuration = {
      baseURL: config.openai.baseURL,
    };
  }

  const checkpointer = new MemorySaver();
  const model = new ChatOpenAI(chatConfig);

  const backend = new FilesystemBackend({
    rootDir: process.cwd(),
    maxFileSizeMb: 1000,
  });

  const agent = createDeepAgent({
    model,
    backend,
    checkpointer,
    // Add other createDeepAgent configuration as needed
  });

  return agent;
}

/**
 * Main execution function that initializes and returns the AI agent.
 * 
 * This function serves as the primary entry point for the application.
 * It creates an AI agent instance, logs successful initialization,
 * and provides error handling for initialization failures.
 * 
 * The function is designed to be called directly when the module is executed
 * as a script, or imported and called programmatically by other modules.
 * 
 * @async
 * @returns {Promise<ReturnType<typeof createAIAgent>>} A promise that resolves to the initialized AI agent
 * @throws {Error} If AI agent initialization fails for any reason
 * 
 * @example
 * // Programmatic usage
 * const agent = await main();
 * 
 * @example
 * // Script execution (when file is run directly)
 * // This will automatically call main() and handle errors
 * 
 * @see {@link createAIAgent} for agent creation details
 */
// Main execution function
export async function main() {
  try {
    const agent = createAIAgent();
    console.log('AI Agent initialized successfully');
    // Add your main logic here
    return agent;
  } catch (error) {
    console.error('Failed to initialize AI agent:', error);
    throw error;
  }
}

// Only run main if this file is executed directly
// Use a more compatible approach for Jest testing
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}