/**
 * 终端适配器 - 实现 I/O 通道接口的终端具体实现
 * 
 * 中文名称：终端适配器
 * 
 * 这是 DefaultIOChannel 的具体实现，专门用于终端环境。
 * 所有原来的终端输出逻辑都移到这里，核心模块不再直接依赖终端 API。
 * 
 * @module terminal-adapter
 */

import readline from 'readline';
import { IOChannel, OutputEvent, OutputEventType } from '@/core/agent/io-channel';
import { styled } from '@/presentation/styling/output-styler';
import { config } from '@/core/config/config';

export class TerminalAdapter implements IOChannel {
  private _rl: readline.Interface | null = null;
  private abortController: AbortController | null = null;
  private isDestroyed = false;
  private listeners: Map<OutputEventType, Set<(data: any) => void>> = new Map();

  // Expose rl for compatibility with existing code that needs direct access
  get rl(): readline.Interface | null {
    return this._rl;
  }

  constructor() {
    this.setupProcessHandlers();
    
    // Initialize readline interface immediately
    this._rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "",
    });
    
    // Set raw mode to capture key combinations
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
  }

  private setupProcessHandlers(): void {
    // 设置进程信号处理器
    process.on('SIGINT', () => {
      if (this.abortController) {
        this.abortController.abort();
      }
    });
    
    process.on('SIGTERM', () => {
      this.destroy();
      process.exit(0);
    });
  }

  setAbortSignal(signal: AbortSignal): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = signal instanceof AbortController ? signal : new AbortController();
    // 如果传入的是 AbortSignal，我们需要创建对应的 controller
    if (!(signal instanceof AbortController)) {
      const controller = new AbortController();
      // 监听外部 signal 的 abort 事件
      if (signal.aborted) {
        controller.abort();
      }
      this.abortController = controller;
    }
  }

  requestUserInput(prompt: string = "\n👤 你: "): void {
    if (this.isDestroyed) {
      throw new Error('Terminal adapter is destroyed');
    }

    this.showPrompt(prompt);
  }

  emit(event: OutputEvent): void {
    if (this.isDestroyed) return;
    
    const { type, data } = event;
    
    switch (type) {
      case 'aiResponse':
        this.handleAIResponse(data);
        break;
      case 'toolCall':
        this.handleToolCall(data);
        break;
      case 'toolResult':
        this.handleToolResult(data);
        break;
      case 'thinkingProcess':
        this.handleThinkingProcess(data);
        break;
      case 'systemMessage':
        this.handleSystemMessage(data);
        break;
      case 'errorMessage':
        this.handleErrorMessage(data);
        break;
      case 'hintMessage':
        this.handleHintMessage(data);
        break;
      case 'streamStart':
        this.handleStreamStart(data);
        break;
      case 'streamChunk':
        this.handleStreamChunk(data);
        break;
      case 'streamEnd':
        this.handleStreamEnd(data);
        break;
      case 'sessionStart':
        this.handleSessionStart(data);
        break;
      case 'sessionEnd':
        this.handleSessionEnd(data);
        break;
      case 'commandExecuted':
        this.handleCommandExecuted(data);
        break;
      case 'rawText':
        this.handleRawText(data);
        break;
      case 'userInputRequest':
        // userInputRequest 通常由 requestUserInput 处理，这里可以忽略
        break;
    }
  }

  private async handleAIResponse(data: { content: string }): Promise<void> {
    if (!data?.content) return;
    process.stdout.write(`\n🤖 ${data.content}`);
  }

  private handleToolCall(data: { name: string; args: any }): void {
    if (!data?.name) return;
    console.log(styled.toolCall(data.name, data.args));
  }

  private handleToolResult(data: { name: string; success: boolean; preview: string }): void {
    if (!data?.name) return;
    console.log(styled.toolResult(data.name, data.success, data.preview));
    console.log('\n');
  }

  private handleThinkingProcess(data: { steps: Array<{ content: string; status?: string }> }): void {
    if (!data?.steps?.length) return;
    
    console.log('\n🧠 AI 深度思考过程:');
    data.steps.forEach(step => {
      let emoji = '💭';
      if (step.status === 'completed') {
        emoji = '✅';
      } else if (step.status === 'in_progress') {
        emoji = '🔄';
      }
      console.log(`\n${emoji} ${step.content}`);
    });
  }

  private handleSystemMessage(data: { message: string }): void {
    if (!data?.message) return;
    console.log(styled.system(data.message));
  }

  private handleErrorMessage(data: { message: string }): void {
    if (!data?.message) return;
    console.log(styled.error(data.message));
  }

  private handleHintMessage(data: { message: string }): void {
    if (!data?.message) return;
    console.log(styled.hint(data.message));
  }

  private async handleStreamStart(data: { initialContent?: string }): Promise<void> {
    if (data?.initialContent) {
      process.stdout.write(`\n🤖 ${data.initialContent}`);
    } else {
      console.log(styled.assistant("..."));
    }
  }

  private async handleStreamChunk(data: { chunk: string }): Promise<void> {
    if (!data?.chunk) return;
    if (this.abortController?.signal.aborted) return;
    process.stdout.write(data.chunk);
  }

  private async handleStreamEnd(data: { finalContent?: string }): Promise<void> {
    if (!this.abortController?.signal.aborted && data?.finalContent && !data.finalContent.trim().endsWith(".")) {
      process.stdout.write(".\n");
    }
  }

  private handleSessionStart(data: { welcomeMessage?: string; modelInfo?: string }): void {
    console.log("=".repeat(70));
    console.log("🚀 AI Assistant 启动成功 | " + (data?.modelInfo || 'Unknown Model'));
    console.log(`📁 工作目录: ${process.cwd()}`);
    console.log(`🛡️  安全模式: ${config.output.verbose ? '详细输出' : '简略输出（自动截断长内容）'}`);
    console.log("⌨️  快捷键: Ctrl+C 强制退出 | 双击空格键语音输入 | /help 查看命令 | /verbose 切换输出模式");
    console.log("=".repeat(70));
  }

  private handleSessionEnd(data: { exitMessage?: string }): void {
    if (data?.exitMessage) {
      console.log(styled.system(data.exitMessage));
    }
    this.destroy();
  }

  private handleCommandExecuted(data: { command: string; result?: any }): void {
    // 命令执行完成，可以显示结果或提示
    if (data?.result?.message) {
      console.log(styled.system(data.result.message));
    }
  }

  private handleRawText(data: { text: string }): void {
    if (data?.text) {
      console.log(data.text);
    }
  }

  on(eventType: OutputEventType, listener: (data: any) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  off(eventType: OutputEventType, listener: (data: any) => void): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  showPrompt(prompt: string = "\n👤 你: "): void {
    if (!this._rl) return;

    // 特殊的"干活"关键词处理
    if (this._rl.line) {
      const max = Math.max(this._rl.line.length - 8, 0);
      if (this._rl.line.slice(max, this._rl.line.length).includes('干活')) {
        const rlRef = this._rl; // Capture reference to avoid null reference in setTimeout
        for (let i = 0; i < this._rl.line.length + 4; i++) {
          setTimeout(() => {
            if (rlRef) {
              rlRef.write('', { name: 'backspace', ctrl: false, meta: false, shift: false });
            }
          }, 10 * i);
        }
      }
    }

    this._rl.setPrompt?.(prompt);
    this._rl.prompt?.();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    
    if (this._rl) {
      this._rl.close();
      this._rl = null;
    }
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.listeners.clear();
    
    // 清理进程监听器（简化处理，实际可能需要更精细的管理）
    // 在测试环境中不退出进程
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  }
}