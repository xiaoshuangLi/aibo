import { config } from './config';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from "@langchain/langgraph";
import { createDeepAgent, FilesystemBackend } from 'deepagents';
import * as os from 'os';
import * as path from 'path';
import readline from 'readline';
import tools from './tools/index';
import { ENHANCED_SYSTEM_PROMPT } from './enhanced-system-prompt';
import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  createConsoleThreadId,
  isValidThreadId,
} from './interactive-logic';
import { invokeAgent, handleAgentResponse, handleAgentError } from './agent-interaction';
import { styled, createGracefulShutdown, handleUserInput, showPrompt } from './utils/interactive-utils';
import { structuredLog } from './utils/logging';
import { TencentASR, createTencentASR } from './utils/tencent-asr';

// Enable keyboard event emission
readline.emitKeypressEvents(process.stdin);

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
export const model = new ChatOpenAI({
  apiKey: config.openai.apiKey,
  modelName: config.openai.modelName,
  temperature: 0,
  ...(config.openai.baseURL && { 
    configuration: { baseURL: config.openai.baseURL } 
  }),
});

export const backend = new FilesystemBackend({
  rootDir: process.cwd(),
  maxFileSizeMb: 1000,
});

// ==================== 创建 Agent ====================
export const agent = createDeepAgent({
  model,
  backend,
  systemPrompt: ENHANCED_SYSTEM_PROMPT,
  checkpointer: new MemorySaver(),
  tools,
});

// ==================== 内部命令处理器 (柯里化) ====================
export const createHandleInternalCommand = (session: any, rl: any) => {
  return async (command: string): Promise<boolean> => {
    switch (command) {
      case "/help":
        console.log(`
🔧 可用命令:
   /help        - 显示此帮助
   /exit        - 立即退出（任何时刻可用）
   /clear       - 清屏
   /pwd         - 显示当前目录
   /ls          - 列出当前目录
   /verbose     - 切换详细/简略输出模式
   /new         - 开始新会话（清除对话历史）
   /voice       - 启动语音输入（5秒录音）
   双击空格键   - 开始/结束语音输入（推荐使用）
   Ctrl+C       - 强制中断当前操作（任何时刻可用）
`);
        return true;
        
      case "/clear":
        console.clear();
        console.log("=".repeat(70));
        console.log(`🚀 AI Assistant | 会话 ID: ${session.threadId}`);
        console.log("=".repeat(70));
        return true;
        
      case "/pwd":
        console.log(styled.system(`当前目录: ${process.cwd()}`));
        return true;
        
      case "/ls":
        try {
          const files = require("fs").readdirSync(process.cwd());
          console.log(styled.system(`当前目录内容 (${files.length} 项):`));
          console.log(files.map((f: string) => `   ${f}`).join("\n"));
        } catch (e) {
          console.log(styled.error(`目录读取失败: ${(e as Error).message}`));
        }
        return true;
        
      case "/verbose":
        config.output.verbose = !config.output.verbose;
        console.log(styled.system(`输出模式已切换为: ${config.output.verbose ? '详细模式' : '简略模式（自动截断长内容）'}`));
        return true;
        
      case "/new":
        session.threadId = createConsoleThreadId();
        console.log(styled.system(`✅ 已创建新会话 (ID: ${session.threadId})`));
        return true;
        
      case "/voice":
      case "/speech":
        try {
          console.log(styled.system("🎙️ 启动语音输入模式..."));
          console.log(styled.system("🗣️ 请开始说话（5秒内）..."));
          
          const asr = createTencentASR();
          if (!asr.canRecord()) {
            console.log(styled.error("❌ 无法访问麦克风，请确保已安装音频录制工具（如 sox）并授予麦克风权限"));
            return true;
          }
          
          const result = await asr.recognizeSpeech(5000);
          if (result) {
            console.log(styled.system(`🎯 识别结果: "${result}"`));
            // 将识别结果作为用户输入处理
            await handleUserInput(result, session, agent, rl);
            return true;
          } else {
            console.log(styled.error("❌ 未识别到有效语音"));
            return true;
          }
        } catch (error) {
          console.log(styled.error(`❌ 语音识别失败: ${(error as Error).message}`));
          return true;
        }
        
      case "/exit":
      case "/quit":
      case "/q":
      case "/stop":
        console.log(styled.system("👋 正在安全退出..."));
        rl.close();
        process.exit(0);
        return true;
        
      default:
        console.log(styled.error(`未知命令: ${command}\n输入 /help 查看可用命令`));
        return true;
    }
  };
};

// ==================== 退出处理器 (柯里化) ====================
export const setupExitHandlers = (session: any, rl: any, gracefulShutdown: any) => {
  // Cleanup function for voice recording
  const cleanupVoiceRecording = () => {
    if (session.voiceASR && session.isVoiceRecording) {
      try {
        session.voiceASR.stopManualRecording().catch(() => {});
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    session.isVoiceRecording = false;
    session.voiceASR = null;
  };

  process.on('SIGINT', () => {
    cleanupVoiceRecording();
    gracefulShutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    cleanupVoiceRecording();
    gracefulShutdown('SIGTERM');
  });
  
  // Handle Ctrl+C in readline with double-press confirmation
  let lastInterrupt = 0;
  rl.on('SIGINT', () => {
    const now = Date.now();
    
    if (session.isRunning && session.abortController) {
      // Interrupt current operation
      session.abortController.abort();
      console.log(styled.system("\n⚠️  正在中断当前操作... (再次 Ctrl+C 强制退出)"));
    } else if (session.isVoiceRecording) {
      // Stop voice recording if active
      cleanupVoiceRecording();
      console.log(styled.system("\n🎙️ 语音输入已取消"));
      showPrompt(session, rl);
    } else {
      // Double-press quick exit
      if (now - lastInterrupt < 500) {
        console.log(styled.system("\n👋 双击确认，立即退出..."));
        rl.close();
        process.exit(0);
      } else {
        console.log(styled.system("\n👋 检测到退出请求 (再次 Ctrl+C 确认退出)"));
        lastInterrupt = now;
      }
    }
  });
};

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
    commandHistory: [] as string[],
    historyIndex: 0,
    isVoiceRecording: false,
    voiceASR: null as TencentASR | null,
  };

  console.log("=".repeat(70));
  console.log("🚀 AI Assistant 启动成功 | " + config.openai.modelName);
  console.log(`📁 工作目录: ${process.cwd()}`);
  console.log(`🛡️  安全模式: ${config.output.verbose ? '详细输出' : '简略输出（自动截断长内容）'}`);
  console.log("⌨️  快捷键: Ctrl+C 强制退出 | 双击空格键语音输入 | /help 查看命令 | /verbose 切换输出模式");
  console.log("=".repeat(70));

  // Create graceful shutdown handler using extracted utility
  const gracefulShutdown = createGracefulShutdown(session);

  // Handle internal commands (柯里化)
  const handleInternalCommand = createHandleInternalCommand(session, rl);

  // Set stdin to raw mode to capture key combinations
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Setup input handler
  rl.on("line", async (input = '') => {
    const trimmed = input.trim();
    
    // Handle internal commands
    if (trimmed.startsWith("/")) {
      await handleInternalCommand(trimmed);
      showPrompt(session, rl);
      return;
    }
    
    // Empty input
    if (!trimmed) {
      showPrompt(session, rl);
      return;
    }
    
    // Save history
    session.commandHistory.push(trimmed);
    session.historyIndex = session.commandHistory.length;
    // Handle user query
    await handleUserInput(trimmed, session, agent, rl);
  });

  // Keyboard event handler for voice input shortcut
  let isRecordingShortcutActive = false;

  const startRecord = async () => {
    isRecordingShortcutActive = true;
    try {
      console.log('\n🎙️ 开始语音输入... (再次双击空格键结束)');
      session.isVoiceRecording = true;
      session.voiceASR = createTencentASR();
      
      if (!session.voiceASR.canRecord()) {
        console.log(styled.error('❌ 无法访问麦克风，请确保已安装音频录制工具（如 sox）并授予麦克风权限'));
        session.isVoiceRecording = false;
        session.voiceASR = null;
        isRecordingShortcutActive = false;
        showPrompt(session, rl);
        return;
      }
      
      await session.voiceASR.startManualRecording();
    } catch (error) {
      console.log(styled.error(`❌ 语音输入启动失败: ${(error as Error).message}`));
      session.isVoiceRecording = false;
      session.voiceASR = null;
      isRecordingShortcutActive = false;
      showPrompt(session, rl);
    }
  };

  const stopRecord = async () => {
    if (!isRecordingShortcutActive) {
      return;
    }
    // Key released or different key pressed - stop recording
    // Also stop if any modifier key is released
    isRecordingShortcutActive = false;
    if (session.voiceASR && session.isVoiceRecording) {
      try {
        const audioBuffer = await session.voiceASR.stopManualRecording();
        session.isVoiceRecording = false;
        
        if (audioBuffer) {
          const result = await session.voiceASR.recognizeManualRecording(audioBuffer);
          if (result) {
            console.log(styled.system(`🎯 识别结果: "${result}"`));

            if (result.endsWith('立即执行')) {
              // Process the recognized text as user input
              rl.write(result);
              for (let i = 0; i < rl.line.length + 4; i++) {
                setTimeout(() => {
                  rl.write('', { name: 'right', ctrl: false, meta: false, shift: false });
                }, 10 * i);
              }
            } else {
              const content = rl.line + result;

              await handleUserInput(content, session, agent, rl);
            }

            // Process the recognized text as user input
            rl.write(result);
            for (let i = 0; i < rl.line.length + 4; i++) {
              setTimeout(() => {
                rl.write('', { name: 'right', ctrl: false, meta: false, shift: false });
              }, 10 * i);
            }
            // 
            return;
          } else {
            console.log(styled.error('❌ 未识别到有效语音'));
          }
        } else {
          console.log(styled.error('❌ 未录制到音频数据'));
        }
      } catch (error) {
        console.log(styled.error(`❌ 语音识别失败: ${(error as Error).message}`));
      } finally {
        session.voiceASR = null;
        showPrompt(session, rl);
      }
    }
  };

  let time = 0;
  
  process.stdin.on('keypress', async (str, key) => {
    const now = Date.now();
    const isSpace = key.name === 'space';

    let isDoubleSpace = false;

    if (isSpace) {
      if (time) {
        const gap = now - time;

        if (gap < 300) {
          isDoubleSpace = true;
        } else {
          time = now;
        }
      } else {
        time = now;
      }
    } else {
      time = 0;
    }

    if (isDoubleSpace) {
      // Key pressed down - start recording
      if (!isRecordingShortcutActive && !session.isVoiceRecording) {
        startRecord();
      } else {
        stopRecord();
      }
    } else if (isRecordingShortcutActive) {
      stopRecord();
    }
  });

  // Setup exit handlers (柯里化)
  setupExitHandlers(session, rl, gracefulShutdown);
  showPrompt(session, rl);
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