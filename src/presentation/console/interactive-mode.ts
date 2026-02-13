import readline from 'readline';
import { config } from '../../core/config/config';
import { createAIAgent } from '../../core/agent/agent-factory';
import { createHandleInternalCommand } from './command-handlers';
import { onKeypress } from '../../features/voice-input/voice-input-manager';
import { createSessionState, setupExitHandlers, createGracefulShutdownHandler } from '../../core/session/session-manager';
import { handleUserInput, showPrompt } from '../console/user-input-handler';

/**
 * Interactive Mode module that orchestrates the main interactive conversation interface.
 * 
 * This module provides the main entry point for the interactive mode, handling user input,
 * command processing, voice input integration, and session management. It coordinates
 * between various subsystems to provide a seamless interactive experience.
 * 
 * @module interactive-mode
 */

/**
 * 处理行输入事件
 * 
 * 中文名称：处理行输入事件
 * 
 * 预期行为：
 * - 处理用户输入的文本行
 * - 识别内部命令（以/开头）并路由到命令处理器
 * - 处理空输入并显示提示符
 * - 保存用户输入到命令历史
 * - 将非命令输入作为用户查询处理
 * 
 * 行为分支：
 * 1. 内部命令：以/开头的输入被路由到内部命令处理器
 * 2. 空输入：忽略空输入并显示提示符
 * 3. 用户查询：非命令输入被添加到历史记录并作为用户查询处理
 * 
 * @param session - 会话对象，包含threadId、commandHistory等状态
 * @param rl - Readline接口，用于显示提示符
 * @param handleInternalCommand - 内部命令处理器函数
 * @param agent - AI代理实例，用于处理用户查询
 * @returns (input: string) => Promise<void> - 返回一个处理输入行的异步函数
 * 
 * @example
 * ```typescript
 * const onLineHandler = onLine(session, rl, handleInternalCommand, agent);
 * rl.on('line', onLineHandler); // 绑定行输入处理器
 * ```
 */
export const onLine = (session: any, rl: any, handleInternalCommand: any, agent: any) => async (input: string = '') => {
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
};

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

  // Get AI agent instance
  const agent = createAIAgent();

  // Create session state
  const session = createSessionState(rl);

  console.log("=".repeat(70));
  console.log("🚀 AI Assistant 启动成功 | " + config.openai.modelName);
  console.log(`📁 工作目录: ${process.cwd()}`);
  console.log(`🛡️  安全模式: ${config.output.verbose ? '详细输出' : '简略输出（自动截断长内容）'}`);
  console.log("⌨️  快捷键: Ctrl+C 强制退出 | 双击空格键语音输入 | /help 查看命令 | /verbose 切换输出模式");
  console.log("=".repeat(70));

  // Create graceful shutdown handler
  const gracefulShutdown = createGracefulShutdownHandler(session);

  // Handle internal commands
  const handleInternalCommand = createHandleInternalCommand(session, rl, agent);

  // Set stdin to raw mode to capture key combinations
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Setup input handler
  rl.on("line", onLine(session, rl, handleInternalCommand, agent));

  process.stdin.on('keypress', onKeypress(session, rl, agent));

  // Setup exit handlers
  setupExitHandlers(session, rl, gracefulShutdown);
  showPrompt(session, rl);
}