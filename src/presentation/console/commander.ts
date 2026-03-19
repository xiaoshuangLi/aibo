import { config } from '@/core/config';
import { styled } from '@/presentation/styling';
import { createConsoleThreadId } from '@/core/utils';
import { SessionManager } from '@/infrastructure/session';
import { getAllKnowledge, addKnowledge } from '@/shared/utils';
import { createVoiceRecognition } from '@/features/voice-input';
import { handleUserInput } from './input';
import { LspClientManager } from '@/infrastructure/code-analysis';
import {
  getAcpSessionState,
  setAcpSessionState,
  clearAcpSessionState,
  getAcpAgentDisplayName,
} from '@/shared/acp-session';

/**
 * Command Handlers module that provides internal command processing functionality.
 * 
 * This module handles all the internal commands available in the interactive mode,
 * such as /help, /clear, /pwd, /ls, /verbose, /new, /voice, and /exit commands.
 * Each command has its own dedicated handler function with proper error handling.
 * 
 * @module commander
 */

/** Built-in ACP-compatible agent names recognised by the /acp command. */
export const KNOWN_ACP_AGENTS = ['codex', 'claude', 'gemini', 'cursor', 'copilot', 'pi', 'openclaw', 'kimi', 'opencode', 'kiro', 'kilocode', 'qwen', 'droid'];

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
   /help                      - 显示此帮助
   /exit                      - 立即退出（任何时刻可用）
   /clear                     - 清屏
   /pwd                       - 显示当前目录
   /ls                        - 列出当前目录
   /verbose                   - 切换详细/简略输出模式
   /new                       - 开始新会话（清除对话历史）
   /compact                   - 压缩对话历史（保留知识库，开始新会话，适合长对话变慢时使用）
   /session                   - 查看会话元数据统计
   /voice                     - 启动语音输入（5秒录音）
   双击空格键                 - 开始/结束语音输入（推荐使用）
   Ctrl+C                     - 强制中断当前操作（任何时刻可用）

🤖 ACP 直传模式命令:
   /acp <代理名>              - 进入 ACP 直传模式（如 /acp codex）
   /acp <代理名> <会话名>     - 进入带命名会话的 ACP 直传模式
   /acp stop                  - 退出 ACP 直传模式（终止 ACP 进程）
   /acp kill                  - 强制终止当前 ACP 进程并退出直传模式
   /acp status                - 查看当前 ACP 直传状态
   代理名支持：${KNOWN_ACP_AGENTS.join(' / ')}
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
 * 处理会话元数据查询命令
 * 
 * 中文名称：处理会话元数据查询命令
 * 
 * 预期行为：
 * - 获取当前会话的AI监控元数据
 * - 如果元数据存在，显示模型使用量统计信息
 * - 如果无元数据，显示提示信息
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功获取元数据并显示信息，返回true
 * 2. 无元数据：显示无数据提示信息，返回true
 * 3. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，用于获取元数据
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 */
export async function handleSessionCommand(session: any): Promise<boolean> {
  const sessionManager = SessionManager.getInstance();
  
  // 获取当前会话的AI监控元数据
  const metadata = sessionManager.getCurrentSessionMetadata();
  if (metadata) {
    // 提取关键信息 - 使用正确的 AITelemetryRecord 结构
    const model = metadata.model_info?.model_name || '未知模型';
    const totalTokens = metadata.token_usage?.total_tokens || 0;
    const promptTokens = metadata.token_usage?.input_tokens || 0;
    const completionTokens = metadata.token_usage?.output_tokens || 0;
    const timestamp = metadata.start_time ? new Date(metadata.start_time).toLocaleString('zh-CN') : '未知时间';
    const sessionId = metadata.metadata?.session_id || '未知会话ID';

    // 格式化Token数量
    const formatTokenWithUnit = (tokenCount: number): string => {
      const originalFormatted = tokenCount.toLocaleString();
      
      if (tokenCount >= 1_000_000) {
        const inMillions = tokenCount / 1_000_000;
        return `${inMillions.toFixed(2)}M (${originalFormatted})`;
      } else if (tokenCount >= 1_000) {
        const inThousands = tokenCount / 1_000;
        return `${inThousands.toFixed(2)}K (${originalFormatted})`;
      } else {
        return originalFormatted;
      }
    };

    console.log(`
📊 会话元数据统计

会话信息
- 会话ID: ${sessionId}
- 时间戳: ${timestamp}

模型使用
- 模型: ${model}
- 总Token数: ${formatTokenWithUnit(totalTokens)}
- 输入Token: ${formatTokenWithUnit(promptTokens)}
- 输出Token: ${formatTokenWithUnit(completionTokens)}
`);
  } else {
    console.log(styled.system("ℹ️ 无会话元数据\n\n当前会话没有可用的元数据信息。"));
  }
  
  return true;
}

/**
 * 处理 ACP 直传模式命令
 *
 * 用法：
 *   /acp <代理名>             进入直传模式（如 /acp codex）
 *   /acp <代理名> <会话名>    进入带命名会话的直传模式
 *   /acp stop | kill         退出直传模式并中止当前 ACP 进程
 *   /acp status              查看当前直传状态
 *
 * @param session - 会话对象
 * @param args    - /acp 后面的参数列表
 */
export async function handleAcpCommand(session: any, args: string[]): Promise<boolean> {
  // /acp stop | off | exit | kill
  if (args.length === 0 || ['stop', 'off', 'exit', 'kill'].includes(args[0])) {
    const current = getAcpSessionState();
    if (!current) {
      console.log(styled.system('ℹ️ ACP 直传模式未激活\n\n当前未处于 ACP 直传模式。'));
      return true;
    }
    // Abort any in-flight ACP execution
    if (session.abortController) {
      session.abortController.abort();
    }
    session.isRunning = false;
    clearAcpSessionState();
    console.log(styled.system(`✅ ACP 直传模式已关闭\n\n已退出对 \`${current.agent}\` 的直传会话，后续消息将重新由 AI 处理。`));
    return true;
  }

  // /acp status
  if (args[0] === 'status') {
    const current = getAcpSessionState();
    if (!current) {
      console.log(styled.system('ℹ️ ACP 直传模式未激活\n\n当前未处于 ACP 直传模式。'));
    } else {
      const sessionInfo = current.sessionName ? `（命名会话: \`${current.sessionName}\`）` : '';
      const cwdInfo = current.cwd ? `\n- 工作目录: \`${current.cwd}\`` : '';
      console.log(styled.system(`🔗 ACP 直传模式已激活\n\n- 代理: \`${current.agent}\`${sessionInfo}${cwdInfo}\n\n输入 \`/acp stop\` 退出直传模式。`));
    }
    return true;
  }

  // /acp <代理名> [会话名]
  const agent = args[0];
  const sessionName = args[1] || undefined;

  if (!KNOWN_ACP_AGENTS.includes(agent)) {
    console.log(styled.error(`⚠️ 未知代理名称: \`${agent}\`\n\n支持的内置代理：${KNOWN_ACP_AGENTS.map(a => `\`${a}\``).join(', ')}`));
    return true;
  }

  setAcpSessionState({ agent, sessionName });

  const displayName = getAcpAgentDisplayName(agent);
  const sessionInfo = sessionName ? `（命名会话: \`${sessionName}\`）` : '';
  console.log(styled.system(`🔗 ACP 直传模式已激活\n\n现在您的消息将直接透传给 \`${displayName}\` ${sessionInfo}，不经过 AI 大模型处理。\n\n输入 \`/acp stop\` 退出直传模式，或 \`/acp status\` 查看状态。`));
  return true;
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
    // Parse command and arguments
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
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
        
      case "/session":
        return await handleSessionCommand(session);
        
      case "/voice":
      case "/speech":
        return await handleVoiceCommand(session, agent);

      case "/acp":
        return await handleAcpCommand(session, args);
        
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