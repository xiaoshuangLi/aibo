import { config } from '@/core/config';
import { styled } from '@/presentation/styling';
import { createConsoleThreadId } from '@/core/utils';
import { SessionManager } from '@/infrastructure/session';
import { getAllKnowledge, addKnowledge } from '@/shared/utils';
import { createVoiceRecognition } from '@/features/voice-input';
import { handleUserInput } from './input';
import { LspClientManager } from '@/infrastructure/code-analysis';

/**
 * Command Handlers module that provides internal command processing functionality.
 * 
 * This module handles all the internal commands available in the interactive mode,
 * such as /help, /clear, /pwd, /ls, /verbose, /new, /voice, and /exit commands.
 * Each command has its own dedicated handler function with proper error handling.
 * 
 * @module commander
 */

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
   /compact     - 压缩对话历史（保留知识库，开始新会话，适合长对话变慢时使用）
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
 * 处理压缩对话命令（对标 Claude Code /compact）
 *
 * 中文名称：处理压缩对话命令
 *
 * 预期行为：
 * - 将当前会话的知识库内容迁移到新会话中
 * - 开始一个全新的会话（清除大量消息历史以提升速度）
 * - 显示迁移后的知识库摘要，方便用户了解哪些上下文被保留
 *
 * 行为分支：
 * 1. 有知识库内容：迁移所有知识项到新会话，并显示摘要
 * 2. 无知识库内容：直接创建新会话，提示用户可以用 add_knowledge 保存重要上下文
 * 3. 无异常情况：该函数不抛出异常，始终返回true
 *
 * @param session - 会话对象，其threadId将被更新为新的会话ID
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 *
 * @example
 * ```typescript
 * await handleCompactCommand(session); // 压缩对话，保留知识库
 * ```
 */
export async function handleCompactCommand(session: any): Promise<boolean> {
  try {
    // 1. Capture all knowledge from the current session before resetting
    const savedKnowledge = getAllKnowledge();

    // 2. Create a fresh session (clears message history → speeds up responses)
    const sessionManager = SessionManager.getInstance();
    session.threadId = sessionManager.clearCurrentSession();

    // 3. Re-populate the knowledge base in the new session
    for (const item of savedKnowledge) {
      addKnowledge(item.content, item.title, item.keywords);
    }

    // 4. Show a summary so the user knows what was preserved
    if (savedKnowledge.length > 0) {
      const titles = savedKnowledge.map((k: any) => `     • ${k.title}`).join('\n');
      console.log(styled.system(
        `✅ 对话已压缩 — 新会话 ID: ${session.threadId}\n` +
        `📚 已将 ${savedKnowledge.length} 条知识项迁移到新会话:\n${titles}\n` +
        `💡 提示：在新会话中直接描述你的当前目标，AI 会从知识库中获取上下文继续工作。`
      ));
    } else {
      console.log(styled.system(
        `✅ 对话已压缩 — 新会话 ID: ${session.threadId}\n` +
        `📭 知识库为空，未迁移任何内容。\n` +
        `💡 提示：使用 add_knowledge 工具保存重要的项目背景或目标，下次压缩时可自动保留。`
      ));
    }
  } catch (error) {
    console.log(styled.error(`❌ 压缩失败: ${(error as Error).message}`));
  }

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
  const sessionManager = SessionManager.getInstance();
  session.threadId = sessionManager.clearCurrentSession();
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
export async function handleVoiceCommand(session: any, agent: any): Promise<boolean> {
  try {
    console.log(styled.system("🎙️ 启动语音输入模式..."));
    console.log(styled.system("🗣️ 请开始说话（5秒内）..."));
    
    const asr = createVoiceRecognition();
    if (!asr.canRecord()) {
      console.log(styled.error("❌ 无法访问麦克风，请确保已安装音频录制工具（如 sox）并授予麦克风权限"));
      return true;
    }
    
    const result = await asr.recognizeSpeech(5000);
    if (result) {
      console.log(styled.system(`🎯 识别结果: "${result}"`));
      // 将识别结果作为用户输入处理
      await handleUserInput(result, session, agent);
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
export async function handleExitCommand(session: any): Promise<boolean> {
  console.log(styled.system("👋 正在安全退出..."));
  
  // Close readline interface if available (for backward compatibility with tests)
  if (session.rl && typeof session.rl.close === 'function') {
    session.rl.close();
  }
  
  // End the session properly
  session.end();
  await LspClientManager.shutdownAll();
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
export function createHandleInternalCommand(session: any, agent: any): (command: string) => Promise<boolean> {
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
        
      case "/compact":
        return await handleCompactCommand(session);
        
      case "/voice":
      case "/speech":
        return await handleVoiceCommand(session, agent);
        
      case "/exit":
      case "/quit":
      case "/q":
      case "/stop":
        return await handleExitCommand(session);
        
      default:
        return await handleUnknownCommand(command);
    }
  };
}