import readline from 'readline';
import { config } from '@/core/config';
import { createAIAgent } from '@/core/agent/factory';
import { createHandleInternalCommand } from '@/presentation/console/command-handlers';
import { createKeypressHandler } from '@/features/voice-input/manager';
import { handleUserInput } from '@/presentation/console/user-input-handler';
import { TerminalAdapter } from '@/presentation/console/terminal-adapter';
import { Session } from '@/core/agent/session';
import { createConsoleThreadId } from '@/core/utils/interactive-logic';

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
 * @param handleInternalCommand - 内部命令处理器函数
 * @param agent - AI代理实例，用于处理用户查询
 * @returns (input: string) => Promise<void> - 返回一个处理输入行的异步函数
 */
export const onLine = (session: Session, handleInternalCommand: any, agent: any) => async (input: string = '') => {
  const trimmed = input.trim();
  
  // Handle internal commands
  if (trimmed.startsWith("/")) {
    await handleInternalCommand(trimmed);
    session.requestUserInput();
    return;
  }
  
  // Empty input
  if (!trimmed) {
    session.requestUserInput();
    return;
  }
  
  // Save history
  session.addToHistory(trimmed);
  // Handle user query
  await handleUserInput(trimmed, session, agent);
};

// Setup graceful shutdown
export const gracefulShutdown = (session: Session) => {
  if (session.isVoiceRecordingActive()) {
    try {
      session.getVoiceASR()?.stopManualRecording().catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
    session.setVoiceRecording(false, null);
  }
  session.end('SIGINT');
};

export function setupExitHandlers(session: Session, terminalAdapter: TerminalAdapter): void {
  process.on('SIGINT', () => {
    if (session.getVoiceASR() && session.isVoiceRecordingActive()) {
      try {
        session.getVoiceASR().stopManualRecording().catch(() => {});
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    session.setVoiceRecording(false, null)
    gracefulShutdown(session);
  });
  process.on('SIGTERM', () => {
    if (session.getVoiceASR() && session.isVoiceRecordingActive()) {
      try {
        session.getVoiceASR().stopManualRecording();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    session.setVoiceRecording(false, null)
    gracefulShutdown(session);
  });
  
  // Handle Ctrl+C in readline with double-press confirmation
  let lastInterrupt = 0;
  terminalAdapter.rl?.on?.('SIGINT', () => {
    const now = Date.now();

    if (session.isRunning && session.abortController) {
      // Interrupt current operation
      session.abortController.abort();
      session.isRunning = false;
      console.log('\x1b[33m⚠️  正在中断当前操作... (再次 Ctrl+C 强制退出)\x1b[0m');
    } else if (session.isVoiceRecordingActive()) {
      // Stop voice recording if active
      if (session.getVoiceASR() && session.isVoiceRecordingActive()) {
        try {
          session.getVoiceASR().stopManualRecording().catch(() => {});
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      session.setVoiceRecording(false, null)
      console.log('\x1b[36m🎙️ 语音输入已取消\x1b[0m');
      // Show prompt after canceling voice input
      session.requestUserInput();
    } else {
      // Double-press quick exit
      if (now - lastInterrupt < 500) {
        console.log('\x1b[36m\n👋 双击确认，立即退出...\x1b[0m');
        terminalAdapter.rl?.close?.();
        gracefulShutdown(session);
        process.exit(0);
      } else {
        console.log('\x1b[36m\n👋 检测到退出请求 (再次 Ctrl+C 确认退出)\x1b[0m');
        lastInterrupt = now;
      }
    }
  });
}

/**
 * 启动交互模式
 * 
 * 中文名称：启动交互模式
 * 
 * 预期行为：
 * - 创建终端适配器
 * - 初始化会话对象
 * - 获取AI代理实例
 * - 显示欢迎信息
 * - 绑定内部命令处理器
 * - 绑定键盘按键事件处理器
 * - 绑定行输入处理器
 * - 显示初始提示符
 * 
 * 行为分支：
 * 1. 正常启动：成功初始化所有组件并进入交互循环
 * 2. 内部命令处理：以/开头的输入被路由到内部命令处理器
 * 3. 空输入处理：忽略空输入并显示提示符
 * 4. 用户查询处理：非内部命令的输入被作为用户查询处理
 * 5. 语音输入：通过双击空格键触发语音录制和识别
 * 6. 退出处理：通过Ctrl+C或内部退出命令安全退出
 * 
 * @returns Promise<void> - 无返回值的Promise，函数会持续运行直到用户退出
 */
export async function startInteractiveMode() {
  // Create terminal adapter
  const terminalAdapter = new TerminalAdapter();
  const threadId = createConsoleThreadId();
  const session = new Session(terminalAdapter, { threadId });

  // Get AI agent instance
  const agent = await createAIAgent(session);
  
  // Track last interrupt time for double-press confirmation
  let lastInterrupt = 0;

  // Start session (shows welcome message)
  session.start();

  // Handle internal commands
  const handleInternalCommand = createHandleInternalCommand(session, agent);

  // Setup input handler
  // Note: The TerminalAdapter handles readline internally
  // We need to set up the line event listener on the adapter's readline instance
  const rl = terminalAdapter.rl;
  if (rl) {
    // Set stdin to raw mode to capture key combinations
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    rl.on("line", onLine(session, handleInternalCommand, agent));
    
    // Create voice input keypress handler
    const getCurrentInput = () => rl.line || '';
    const onVoiceInputComplete = (recognizedText: string) => {
      rl.prompt();
      // Insert recognized text into readline buffer
      rl.write(recognizedText);
      // Move cursor to end of line
      for (let i = 0; i < rl.line.length + 4; i++) {
        setTimeout(() => {
          rl.write('', { name: 'right', ctrl: false, meta: false, shift: false });
        }, 10 * i);
      }
    };

    const onExecuteCommand = async (command: string) => {
      await handleUserInput(command, session, agent);
    };
    
    const voiceKeypressHandler = createKeypressHandler(
      session,
      getCurrentInput,
      onVoiceInputComplete,
      onExecuteCommand
    );
    
    process.stdin.on('keypress', async (str: string, key: any) => {
      if (session.isRunning) {
        return;
      }

      await voiceKeypressHandler(key.name);
    });
    
    // Handle Ctrl+C in readline with double-press confirmation
    setupExitHandlers(session, terminalAdapter);
  }

  session.requestUserInput();
}