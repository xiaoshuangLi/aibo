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

// ==================== 内部命令处理器辅助函数 ====================

/**
 * 处理帮助命令
 * 
 * 中文名称：处理帮助命令
 * 
 * 预期行为：
 * - 显示所有可用的内部命令及其说明
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：总是成功显示帮助信息并返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 * 
 * @example
 * ```typescript
 * await handleHelpCommand(); // 显示帮助信息
 * ```
 */
export async function handleHelpCommand(): Promise<boolean> {
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
}

/**
 * 处理清屏命令
 * 
 * 中文名称：处理清屏命令
 * 
 * 预期行为：
 * - 清除控制台屏幕
 * - 显示AI助手标题和当前会话ID
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功清屏并显示标题信息，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，包含threadId属性用于显示当前会话ID
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 * 
 * @example
 * ```typescript
 * await handleClearCommand(session); // 清屏并显示标题
 * ```
 */
export async function handleClearCommand(session: any): Promise<boolean> {
  console.clear();
  console.log("=".repeat(70));
  console.log(`🚀 AI Assistant | 会话 ID: ${session.threadId}`);
  console.log("=".repeat(70));
  return true;
}

/**
 * 处理显示当前目录命令
 * 
 * 中文名称：处理显示当前目录命令
 * 
 * 预期行为：
 * - 获取并显示当前工作目录路径
 * - 使用系统样式格式化输出
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功获取并显示当前目录，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 * 
 * @example
 * ```typescript
 * await handlePwdCommand(); // 显示当前目录
 * ```
 */
export async function handlePwdCommand(): Promise<boolean> {
  console.log(styled.system(`当前目录: ${process.cwd()}`));
  return true;
}

/**
 * 处理列出目录内容命令
 * 
 * 中文名称：处理列出目录内容命令
 * 
 * 预期行为：
 * - 读取当前工作目录的内容
 * - 显示文件和目录列表及总数
 * - 使用系统样式格式化输出
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功读取目录并显示内容列表，返回true
 * 2. 目录读取失败：捕获异常，显示错误信息，但仍返回true
 * 3. 无其他异常：该函数内部处理所有异常，始终返回true
 * 
 * @returns Promise<boolean> - 始终返回true，表示命令处理完成（无论成功或失败）
 * 
 * @example
 * ```typescript
 * await handleLsCommand(); // 列出当前目录内容
 * ```
 */
export async function handleLsCommand(): Promise<boolean> {
  try {
    const files = require("fs").readdirSync(process.cwd());
    console.log(styled.system(`当前目录内容 (${files.length} 项):`));
    console.log(files.map((f: string) => `   ${f}`).join("\n"));
  } catch (e) {
    console.log(styled.error(`目录读取失败: ${(e as Error).message}`));
  }
  return true;
}

/**
 * 处理切换详细输出模式命令
 * 
 * 中文名称：处理切换详细输出模式命令
 * 
 * 预期行为：
 * - 切换配置中的verbose输出模式
 * - 显示当前输出模式状态
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功切换模式并显示状态，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 * 
 * @example
 * ```typescript
 * await handleVerboseCommand(); // 切换输出模式
 * ```
 */
export async function handleVerboseCommand(): Promise<boolean> {
  config.output.verbose = !config.output.verbose;
  console.log(styled.system(`输出模式已切换为: ${config.output.verbose ? '详细模式' : '简略模式（自动截断长内容）'}`));
  return true;
}

/**
 * 处理创建新会话命令
 * 
 * 中文名称：处理创建新会话命令
 * 
 * 预期行为：
 * - 为会话生成新的线程ID
 * - 显示新会话创建成功的消息
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功生成新ID并显示消息，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，其threadId属性将被更新为新的会话ID
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 * 
 * @example
 * ```typescript
 * await handleNewCommand(session); // 创建新会话
 * ```
 */
export async function handleNewCommand(session: any): Promise<boolean> {
  session.threadId = createConsoleThreadId();
  console.log(styled.system(`✅ 已创建新会话 (ID: ${session.threadId})`));
  return true;
}

/**
 * 处理语音输入命令
 * 
 * 中文名称：处理语音输入命令
 * 
 * 预期行为：
 * - 初始化腾讯云ASR语音识别服务
 * - 检查麦克风访问权限
 * - 录制5秒语音并进行识别
 * - 如果识别成功，将结果作为用户输入处理
 * - 返回true表示命令处理完成
 * 
 * 行为分支：
 * 1. 正常情况：成功录制、识别并处理语音输入，返回true
 * 2. 麦克风不可用：显示错误信息，返回true
 * 3. 未识别到有效语音：显示错误信息，返回true
 * 4. 语音识别失败：捕获异常，显示错误信息，返回true
 * 5. 无其他异常：该函数内部处理所有异常，始终返回true
 * 
 * @param session - 会话对象，用于语音识别和用户输入处理
 * @param agent - AI代理实例，用于处理识别后的用户输入
 * @param rl - Readline接口，用于处理用户输入
 * @returns Promise<boolean> - 始终返回true，表示命令处理完成（无论成功或失败）
 * 
 * @example
 * ```typescript
 * await handleVoiceCommand(session, agent, rl); // 启动语音输入
 * ```
 */
export async function handleVoiceCommand(session: any, agent: any, rl: any): Promise<boolean> {
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
}

/**
 * 处理退出命令
 * 
 * 中文名称：处理退出命令
 * 
 * 预期行为：
 * - 显示安全退出消息
 * - 关闭Readline接口
 * - 终止进程（调用process.exit(0)）
 * - 理论上返回true，但实际上不会执行到return语句
 * 
 * 行为分支：
 * 1. 正常情况：显示退出消息，关闭接口，终止进程
 * 2. 无异常情况：该函数不抛出异常，但实际不会返回值
 * 
 * @param rl - Readline接口，将在退出前关闭
 * @returns Promise<boolean> - 理论上返回true，但实际上由于process.exit()调用而不会执行
 * 
 * @example
 * ```typescript
 * await handleExitCommand(rl); // 安全退出程序
 * ```
 */
export async function handleExitCommand(rl: any): Promise<boolean> {
  console.log(styled.system("👋 正在安全退出..."));
  rl.close();
  process.exit(0);
  return true;
}

/**
 * 处理未知命令
 * 
 * 中文名称：处理未知命令
 * 
 * 预期行为：
 * - 显示未知命令错误信息
 * - 提示用户输入/help查看可用命令
 * - 返回true表示命令处理完成
 * 
 * 行为分支：
 * 1. 正常情况：显示错误信息和帮助提示，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param command - 用户输入的未知命令字符串
 * @returns Promise<boolean> - 始终返回true，表示命令处理完成
 * 
 * @example
 * ```typescript
 * await handleUnknownCommand("/unknown"); // 显示未知命令错误
 * ```
 */
export async function handleUnknownCommand(command: string): Promise<boolean> {
  console.log(styled.error(`未知命令: ${command}\n输入 /help 查看可用命令`));
  return true;
}

// ==================== 内部命令处理器 (柯里化) ====================

/**
 * 创建内部命令处理器
 * 
 * 中文名称：创建内部命令处理器
 * 
 * 预期行为：
 * - 接收会话对象和Readline接口作为参数
 * - 返回一个处理内部命令的函数
 * - 根据命令字符串调用相应的命令处理函数
 * 
 * 行为分支：
 * 1. /help命令：调用handleHelpCommand()
 * 2. /clear命令：调用handleClearCommand(session)
 * 3. /pwd命令：调用handlePwdCommand()
 * 4. /ls命令：调用handleLsCommand()
 * 5. /verbose命令：调用handleVerboseCommand()
 * 6. /new命令：调用handleNewCommand(session)
 * 7. /voice或/speech命令：调用handleVoiceCommand(session, agent, rl)
 * 8. /exit、/quit、/q或/stop命令：调用handleExitCommand(rl)
 * 9. 其他未知命令：调用handleUnknownCommand(command)
 * 
 * @param session - 会话对象，包含threadId等会话状态信息
 * @param rl - Readline接口，用于处理用户输入和输出
 * @returns (command: string) => Promise<boolean> - 返回一个接受命令字符串并返回Promise<boolean>的函数
 * 
 * @example
 * ```typescript
 * const handleCommand = createHandleInternalCommand(session, rl);
 * await handleCommand("/help"); // 处理帮助命令
 * ```
 */
export function createHandleInternalCommand(session: any, rl: any): (command: string) => Promise<boolean> {
  return async (command: string): Promise<boolean> => {
    switch (command) {
      case "/help":
        return await handleHelpCommand();
        
      case "/clear":
        return await handleClearCommand(session);
        
      case "/pwd":
        return await handlePwdCommand();
        
      case "/ls":
        return await handleLsCommand();
        
      case "/verbose":
        return await handleVerboseCommand();
        
      case "/new":
        return await handleNewCommand(session);
        
      case "/voice":
      case "/speech":
        return await handleVoiceCommand(session, agent, rl);
        
      case "/exit":
      case "/quit":
      case "/q":
      case "/stop":
        return await handleExitCommand(rl);
        
      default:
        return await handleUnknownCommand(command);
    }
  };
}

// ==================== 语音录制清理函数 ====================

/**
 * 清理语音录制资源
 * 
 * 中文名称：清理语音录制资源
 * 
 * 预期行为：
 * - 检查会话中是否存在活跃的语音ASR实例和录制状态
 * - 如果存在，尝试停止手动录制
 * - 重置会话的语音录制相关状态
 * - 忽略清理过程中可能发生的错误
 * 
 * 行为分支：
 * 1. 有活跃录制：调用stopManualRecording()并忽略可能的错误，然后重置状态
 * 2. 无活跃录制：直接重置状态（isVoiceRecording设为false，voiceASR设为null）
 * 3. 停止录制失败：捕获并忽略错误，仍重置状态
 * 
 * @param session - 会话对象，包含voiceASR和isVoiceRecording属性
 * @returns void - 无返回值
 * 
 * @example
 * ```typescript
 * cleanupVoiceRecording(session); // 清理语音录制资源
 * ```
 */
export function cleanupVoiceRecording(session: any): void {
  if (session.voiceASR && session.isVoiceRecording) {
    try {
      session.voiceASR.stopManualRecording().catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  session.isVoiceRecording = false;
  session.voiceASR = null;
}

// ==================== 退出处理器 (柯里化) ====================

/**
 * 设置退出处理器
 * 
 * 中文名称：设置退出处理器
 * 
 * 预期行为：
 * - 为SIGINT和SIGTERM信号设置进程级退出处理器
 * - 为Readline的SIGINT事件设置交互式退出处理器
 * - 实现双击Ctrl+C快速退出机制
 * - 在退出前清理语音录制资源
 * 
 * 行为分支：
 * 1. SIGINT/SIGTERM信号：清理语音录制并调用优雅关闭处理器
 * 2. Readline SIGINT（Ctrl+C）且有运行中操作：中断当前操作并提示再次Ctrl+C强制退出
 * 3. Readline SIGINT且有语音录制：取消语音录制并显示提示
 * 4. Readline SIGINT且无运行操作：实现双击确认退出（500ms内双击则立即退出，否则提示再次确认）
 * 
 * @param session - 会话对象，包含isRunning、abortController、isVoiceRecording等状态
 * @param rl - Readline接口，用于监听SIGINT事件和关闭接口
 * @param gracefulShutdown - 优雅关闭处理器函数
 * @returns void - 无返回值
 * 
 * @example
 * ```typescript
 * setupExitHandlers(session, rl, gracefulShutdown); // 设置退出处理器
 * ```
 */
export function setupExitHandlers(session: any, rl: any, gracefulShutdown: any): void {
  process.on('SIGINT', () => {
    cleanupVoiceRecording(session);
    gracefulShutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    cleanupVoiceRecording(session);
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
      cleanupVoiceRecording(session);
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
}

// Keyboard event handler for voice input shortcut
let isRecordingShortcutActive = false;
let time = 0;

// Voice recording helper functions

/**
 * 开始语音录制
 * 
 * 中文名称：开始语音录制
 * 
 * 预期行为：
 * - 设置录音快捷键激活状态
 * - 初始化腾讯云ASR实例
 * - 检查麦克风访问权限
 * - 启动手动语音录制
 * - 处理录制过程中的错误
 * 
 * 行为分支：
 * 1. 正常情况：成功初始化ASR并启动录制，显示开始录制消息
 * 2. 麦克风不可用：显示错误信息，重置录制状态，显示提示符
 * 3. 录制启动失败：捕获异常，显示错误信息，重置录制状态，显示提示符
 * 4. 无其他异常：该函数内部处理所有异常，不会向上抛出
 * 
 * @param session - 会话对象，用于存储ASR实例和录制状态
 * @param rl - Readline接口，用于显示提示符
 * @returns Promise<void> - 无返回值的Promise
 * 
 * @example
 * ```typescript
 * await startRecord(session, rl); // 开始语音录制
 * ```
 */
export const startRecord = async (session: any, rl: any): Promise<void> => {
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

/**
 * 停止语音录制
 * 
 * 中文名称：停止语音录制
 * 
 * 预期行为：
 * - 检查录音快捷键是否处于激活状态
 * - 停止手动语音录制
 * - 对录制的音频进行语音识别
 * - 根据识别结果决定如何处理（直接执行或作为输入）
 * - 清理录制资源并显示提示符
 * 
 * 行为分支：
 * 1. 快捷键未激活：直接返回，不执行任何操作
 * 2. 无音频数据：显示"未录制到音频数据"错误
 * 3. 识别成功且包含"干活"关键词：将识别结果与当前输入合并后直接执行
 * 4. 识别成功但不包含"干活"关键词：将识别结果写入Readline输入缓冲区
 * 5. 未识别到有效语音：显示"未识别到有效语音"错误
 * 6. 语音识别失败：捕获异常，显示错误信息
 * 7. 所有情况都会在finally块中清理ASR实例并显示提示符
 * 
 * @param session - 会话对象，包含voiceASR和isVoiceRecording状态
 * @param rl - Readline接口，用于处理输入和显示提示符
 * @param agent - AI代理实例，用于处理包含"干活"关键词的命令
 * @returns Promise<void> - 无返回值的Promise
 * 
 * @example
 * ```typescript
 * await stopRecord(session, rl, agent); // 停止语音录制并处理结果
 * ```
 */
export const stopRecord = async (session: any, rl: any, agent: any): Promise<void> => {
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

          if (result.slice(result.length - 8, result.length).includes('干活')) {
            const content = rl.line + result;

            await handleUserInput(content, session, agent, rl);
          } else {
            // Process the recognized text as user input
            rl.write(result);
            for (let i = 0; i < rl.line.length + 4; i++) {
              setTimeout(() => {
                rl.write('', { name: 'right', ctrl: false, meta: false, shift: false });
              }, 10 * i);
            }
          }
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

/**
 * 键盘按键事件处理器
 * 
 * 中文名称：键盘按键事件处理器
 * 
 * 预期行为：
 * - 监听键盘按键事件
 * - 检测双击空格键（300ms内）
 * - 根据按键状态控制语音录制的开始和停止
 * - 管理录音快捷键的激活状态
 * 
 * 行为分支：
 * 1. 双击空格键且未在录制：调用startRecord()开始录制
 * 2. 双击空格键且正在录制：调用stopRecord()停止录制
 * 3. 非空格键且快捷键激活：调用stopRecord()停止录制
 * 4. 单击空格键：更新时间戳但不触发录制
 * 5. 其他按键：重置时间戳
 * 
 * @param session - 会话对象，传递给录制函数
 * @param rl - Readline接口，传递给录制函数
 * @returns (str: string, key: any) => Promise<void> - 返回一个处理按键事件的异步函数
 * 
 * @example
 * ```typescript
 * process.stdin.on('keypress', onKeypress(session, rl)); // 绑定按键事件
 * ```
 */
export const onKeypress = (session: any, rl: any) => async (str: string, key: any) => {
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
      await startRecord(session, rl);
    } else {
      await stopRecord(session, rl, agent);
    }
  } else if (isRecordingShortcutActive) {
    await stopRecord(session, rl, agent);
  }
}

export const onLine = (session: any, rl: any, handleInternalCommand: any) => async (input: string = '') => {
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
}

// ==================== 对话模式实现 ====================

/**
 * 启动交互模式
 * 
 * 中文名称：启动交互模式
 * 
 * 预期行为：
 * - 创建Readline接口用于处理用户输入
 * - 初始化会话状态对象
 * - 显示欢迎信息和使用说明
 * - 设置优雅关闭处理器
 * - 绑定内部命令处理器
 * - 设置原始输入模式以捕获组合键
 * - 绑定行输入处理器
 * - 绑定键盘按键事件处理器
 * - 设置退出信号处理器
 * - 显示初始提示符
 * 
 * 行为分支：
 * 1. 正常启动：成功初始化所有组件并进入交互循环
 * 2. TTY检测：仅在TTY环境中设置原始输入模式
 * 3. 内部命令处理：以/开头的输入被路由到内部命令处理器
 * 4. 空输入处理：忽略空输入并显示提示符
 * 5. 用户查询处理：非内部命令的输入被作为用户查询处理
 * 6. 语音输入：通过双击空格键触发语音录制和识别
 * 7. 退出处理：通过Ctrl+C或内部退出命令安全退出
 * 
 * @returns Promise<void> - 无返回值的Promise，函数会持续运行直到用户退出
 * 
 * @example
 * ```typescript
 * await startInteractiveMode(); // 启动交互式AI助手
 * ```
 */
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
  rl.on("line", onLine(session, rl, handleInternalCommand));

  process.stdin.on('keypress', onKeypress(session, rl));

  // Setup exit handlers (柯里化)
  setupExitHandlers(session, rl, gracefulShutdown);
  showPrompt(session, rl);
}

/**
 * 创建AI代理实例
 * 
 * 中文名称：创建AI代理实例
 * 
 * 预期行为：
 * - 返回预先配置好的AI代理实例
 * - 代理实例包含以下组件：
 *   - 配置好的ChatOpenAI模型（使用环境变量中的API密钥、基础URL和模型名称）
 *   - 文件系统后端（以当前工作目录为根目录）
 *   - 内存检查点器（用于状态持久化）
 * - 优雅地处理可选配置参数
 * 
 * 行为分支：
 * 1. 正常情况：返回已配置的agent实例
 * 2. 配置错误：如果环境变量无效或依赖项初始化失败，会在main函数中抛出错误
 * 
 * @returns ReturnType<typeof createDeepAgent> - 配置好的DeepAgent实例
 * @throws {Error} 如果环境变量无效或必需的依赖项初始化失败（实际在main函数中处理）
 * 
 * @example
 * ```typescript
 * const agent = createAIAgent();
 * // 使用代理进行AI操作
 * ```
 * 
 * @see {@link config} 了解环境变量配置详情
 * @see {@link main} 了解主执行函数
 */
export function createAIAgent() {
  return agent;
}

/**
 * 主执行函数
 * 
 * 中文名称：主执行函数
 * 
 * 预期行为：
 * - 作为应用程序的主要入口点
 * - 检查是否以交互模式运行（通过命令行参数或环境变量）
 * - 如果是交互模式，启动交互式对话界面
 * - 如果是非交互模式，初始化AI代理并返回
 * - 记录成功的初始化日志
 * - 提供初始化失败的错误处理
 * 
 * 行为分支：
 * 1. 交互模式：当命令行参数包含--interactive/-i或环境变量AIBO_INTERACTIVE为'true'时，调用startInteractiveMode()
 * 2. 非交互模式：初始化AI代理，记录成功日志，返回代理实例
 * 3. 初始化失败：捕获异常，记录错误日志，以退出码1终止进程
 * 4. 脚本执行：当文件直接运行时，自动调用main()并处理错误
 * 
 * @async
 * @returns Promise<ReturnType<typeof createAIAgent>> - 解析为已初始化AI代理的Promise
 * @throws {Error} 如果AI代理初始化因任何原因失败
 * 
 * @example
 * ```typescript
 * // 编程式使用
 * const agent = await main();
 * ```
 * 
 * @example
 * ```bash
 * # 脚本执行（直接运行文件时）
 * # 这将自动调用main()并处理错误
 * ```
 * 
 * @see {@link createAIAgent} 了解代理创建详情
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