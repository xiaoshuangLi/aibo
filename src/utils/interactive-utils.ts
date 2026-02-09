/**
 * Interactive mode utility functions for AI Assistant.
 */

import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  createConsoleThreadId
} from '../interactive-logic';
import { structuredLog } from './logging';

/**
 * Styled output formatting functions for interactive mode.
 */
export const styled = {
  assistant: (text: string) => `\n🤖 ${text}`,
  toolCall: (name: string, args: any) => `\n🔧 正在调用工具: ${name}\n   参数: ${JSON.stringify(args, null, 2).split('\n').map(l => '   ' + l).join('\n').trim()}`,
  toolResult: (name: string, success: boolean, preview: string) => 
    `\n${success ? '✅' : '❌'} 工具执行 ${name}: ${success ? '成功' : '失败'}\n${preview}`,
  system: (text: string) => `\n⚙️  ${text}`,
  error: (text: string) => `\n❌ ${text}`,
  hint: (text: string) => `\n💡 ${text}`,
  truncated: (original: string, limit: number) => 
    original.length > limit ? original.substring(0, limit) + `... [已截断 ${original.length - limit} 字符]` : original,
};

/**
 * Handles user input processing for interactive mode.
 * Uses converged dependencies (styled, structuredLog, interactive logic functions).
 */
export async function handleUserInput(
  input: string,
  session: { 
    threadId: string; 
    isRunning: boolean; 
    abortController: AbortController | null 
  },
  agent: any,
  rl: any
) {
  session.isRunning = true;
  try {
    console.log(styled.system("正在思考..."));
    
    // Initialize required state for todoListMiddleware
    const initialState = {
      todos: []
    };

    const response = await (agent as any).invoke(
      { messages: [{ role: "user", content: input }] },
      { 
        configurable: { thread_id: session.threadId },
        signal: session.abortController?.signal,
        recursionLimit: Infinity,
      }
    );

    if (typeof response === 'string') {
      console.log(styled.assistant(response));
    } else if (response && typeof response === 'object') {
      // 处理可能的复杂响应
      console.log(styled.assistant(JSON.stringify(response, null, 2)));
    }
  } catch (error: any) {
    console.log(styled.error(`发生错误: ${error.message}`));
    structuredLog('error', 'Interactive mode error', { 
      component: 'interactive', 
      error: error.message,
      stack: error.stack 
    });
  } finally {
    session.isRunning = false;
    // Continue asking questions
    rl.question("\n👤 你: ", async (nextInput: string) => {
      if (shouldExitInteractiveMode(nextInput)) {
        console.log(styled.system("再见！"));
        rl.close();
        return;
      }
      if (isEmptyInput(nextInput)) {
        // Handle empty input recursively
        rl.question("\n👤 你: ", async (retryInput: string) => {
          await handleUserInput(retryInput, session, agent, rl);
        });
      } else {
        await handleUserInput(nextInput, session, agent, rl);
      }
    });
  }
}

/**
 * Creates a graceful shutdown handler for interactive mode.
 * 
 * @param session - Session state object containing isRunning flag and rl interface
 * @returns Shutdown handler function that can be used with process signals
 */
export const createGracefulShutdown = (
  session: { isRunning: boolean; rl: any }
) => {
  return (signal: string) => {
    if (session.isRunning) {
      structuredLog('info', `收到 ${signal} 信号，正在中断当前操作...`);
      session.isRunning = false;
      // Note: AbortController is not actually used in current implementation
      // but kept for future extensibility
    } else {
      structuredLog('info', `收到 ${signal} 信号，正在退出...`);
      session.rl.close();
      process.exit(0);
    }
  };
};

/**
 * Creates an ask question function for interactive mode.
 * Uses converged dependencies (styled, interactive logic functions).
 * 
 * @param rl - Readline interface
 * @param session - Session state object
 * @param agent - AI agent instance
 * @returns Ask question function that handles user input
 */
export const createAskQuestion = (
  rl: any,
  session: { 
    threadId: string; 
    isRunning: boolean; 
    abortController: AbortController | null 
  },
  agent: any
) => {
  return () => {
    if (!session.isRunning) {
      rl.question("\n👤 你: ", async (input: string) => {
        if (shouldExitInteractiveMode(input)) {
          console.log(styled.system("再见！"));
          rl.close();
          return;
        }

        if (isEmptyInput(input)) {
          rl.question("\n👤 你: ", async (newInput: string) => {
            // Recursive call with new input
            if (shouldExitInteractiveMode(newInput)) {
              console.log(styled.system("再见！"));
              rl.close();
              return;
            }
            if (isEmptyInput(newInput)) {
              // If still empty, ask again
              rl.question("\n👤 你: ", async (finalInput: string) => {
                await handleUserInput(finalInput, session, agent, rl);
              });
            } else {
              await handleUserInput(newInput, session, agent, rl);
            }
          });
          return;
        }

        await handleUserInput(input, session, agent, rl);
      });
    }
  };
};