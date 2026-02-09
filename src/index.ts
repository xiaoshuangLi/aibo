import { config } from './config';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from "@langchain/langgraph";
import { createDeepAgent, FilesystemBackend } from 'deepagents';
import * as os from 'os';
import * as path from 'path';
import readline from 'readline';
import tools from './tools/index';
import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  createConsoleThreadId
} from './interactive-logic';
import { invokeAgent, handleAgentResponse, handleAgentError } from './agent-interaction';
import { styled, createGracefulShutdown, createAskQuestion } from './utils/interactive-utils';
import { structuredLog } from './utils/logging';

/**
 * AI Agent module that provides DeepAgents integration with LangChain.
 * 
 * This module creates and configures an AI agent using DeepAgents framework
 * integrated with LangChain components. It supports configurable AI models,
 * file system operations, and state persistence through checkpointer mechanisms.
 * 
 * @module index
 */

// ==================== 初始化模型 ====================
const model = new ChatOpenAI({
  apiKey: config.openai.apiKey,
  modelName: config.openai.modelName,
  temperature: 0,
  ...(config.openai.baseURL && { 
    configuration: { baseURL: config.openai.baseURL } 
  }),
});

const backend = new FilesystemBackend({
  rootDir: process.cwd(),
  maxFileSizeMb: 1000,
});

// ==================== 创建 Agent ====================
const agent = createDeepAgent({
  model,
  backend,
  systemPrompt: `You are 'LocalAssistant', a helpful AI with FULL local filesystem and terminal access.
  
ENVIRONMENT:
- OS: ${os.platform()} ${os.arch()}
- Node.js: ${process.version}
- Working directory: ${process.cwd()}

RULES:
1. ALWAYS explain actions BEFORE executing tools
2. NEVER run destructive commands (rm -rf, dd, mkfs) without explicit confirmation
3. For file deletions, ALWAYS confirm first
4. Prefer safe commands (ls, cat, pwd) over dangerous ones
5. Output should be CONCISE and ACTION-ORIENTED

FORMAT:
- Start with brief explanation
- Then show tool result (keep output short)
- End with clear next step or conclusion`,
  checkpointer: new MemorySaver(),
  tools,
});

// ==================== 对话模式实现 ====================
export async function startInteractiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "",
  });

  // 会话状态
  const session = {
    threadId: createConsoleThreadId(),
    isRunning: false,
    abortController: null as AbortController | null,
    rl: rl, // Add rl to session for graceful shutdown
  };

  console.log(styled.system("AI Assistant 已启动！输入 'exit' 或 'quit' 退出对话模式。"));
  console.log(styled.hint("你可以问我任何问题，我会尽力帮助你。"));

  // Create graceful shutdown handler using extracted utility
  const gracefulShutdown = createGracefulShutdown(session);

  // Create ask question function using extracted utility
  const askQuestion = createAskQuestion(
    rl,
    session,
    agent
  );

  // 设置退出处理器
  const setupExitHandlers = () => {
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  };

  setupExitHandlers();
  askQuestion();
}

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
export async function main() {
  // 检查是否以交互模式运行（通过命令行参数或环境变量）
  const args = process.argv.slice(2);
  if (args.includes('--interactive') || args.includes('-i') || process.env.AIBO_INTERACTIVE === 'true') {
    await startInteractiveMode();
    return agent;
  }

  try {
    structuredLog('info', 'AI Agent initialized successfully', { component: 'main' });
    return agent;
  } catch (error: any) {
    structuredLog('error', 'Failed to initialize AI Agent', { 
      component: 'main', 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动主函数
if (require.main === module) {
  main().catch(console.error);
}