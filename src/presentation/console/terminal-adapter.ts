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
import { DefaultIOChannel, OutputEvent, OutputEventType } from '@/core/agent/io-channel';
import { styled } from '@/presentation/styling/output-styler';
import { config } from '@/core/config/config';

export class TerminalAdapter extends DefaultIOChannel {
  private _rl: readline.Interface | null = null;
  private abortController: AbortController | null = null;
  private isDestroyed = false;

  // Expose rl for compatibility with existing code that needs direct access
  get rl(): readline.Interface | null {
    return this._rl;
  }

  constructor() {
    super(); // Call parent constructor
    
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
    
    this.on('aiResponse', this.handleAIResponse.bind(this));
    this.on('toolCall', this.handleToolCall.bind(this));
    this.on('toolResult', this.handleToolResult.bind(this));
    this.on('thinkingProcess', this.handleThinkingProcess.bind(this));
    this.on('systemMessage', this.handleSystemMessage.bind(this));
    this.on('errorMessage', this.handleErrorMessage.bind(this));
    this.on('hintMessage', this.handleHintMessage.bind(this));
    this.on('streamStart', this.handleStreamStart.bind(this));
    this.on('streamChunk', this.handleStreamChunk.bind(this));
    this.on('streamEnd', this.handleStreamEnd.bind(this));
    this.on('sessionStart', this.handleSessionStart.bind(this));
    this.on('sessionEnd', this.handleSessionEnd.bind(this));
    this.on('commandExecuted', this.handleCommandExecuted.bind(this));
    this.on('rawText', this.handleRawText.bind(this));
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

  async requestUserInput(prompt: string = "\n👤 你: "): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Terminal adapter is destroyed');
    }

    this.showPrompt(prompt);
  }

  private async handleAIResponse(data: { content: string }): Promise<void> {
    if (!data?.content) return;
    
    // 实现打字机效果
    const verbose = config.output.verbose;
    const delay = verbose ? 5 : 15;
    
    for (const char of data.content) {
      if (this.abortController?.signal.aborted) break;
      process.stdout.write(char);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private handleToolCall(data: { name: string; args: any }): void {
    if (!data?.name) return;
    console.log(styled.toolCall(data.name, data.args));
  }

  private handleToolResult(data: any): void {
    if (!data?.name) return;
    
    // 如果已经有 preview 字段，进行截断处理（向后兼容）
    if (data.preview !== undefined) {
      const verbose = config.output.verbose;
      const truncateLimit = verbose ? 300 : 150;
      const truncatedPreview = styled.truncated(data.preview, truncateLimit);
      console.log(styled.toolResult(data.name, data.success, truncatedPreview));
      return;
    }
    
    // 处理新的数据结构
    let preview = "";
    const verbose = config.output.verbose;
    
    // 特别处理 task 工具的结果
    if (data.isTaskResult) {
      const type = data.name.includes('结果') ? data.name : '子代理任务';
      if (typeof data.result === 'string' && data.result.includes('▸ 结果:')) {
        preview = data.result;
      } else {
        preview = `▸ 结果: ${styled.truncated(data.result, verbose ? 300 : 150)}`;
      }
      
      console.log(styled.toolResult(type, data.success, preview));
      return;
    }
    
    // 处理文本结果
    if (data.isTextResult) {
      preview = styled.truncated(data.result, verbose ? 300 : 150);
      console.log(styled.toolResult(data.name, data.success, preview));
      return;
    }
    
    // 处理 JSON 结果
    if (data.isJsonResult && data.result) {
      const parsed = data.result;
      
      // 特别处理 task 工具的 JSON 结果
      if (data.name === '子代理任务' || data.name === 'task') {
        if (parsed.message) {
          preview = `▸ 结果: ${styled.truncated(parsed.message, verbose ? 300 : 150)}`;
        } else if (typeof parsed === 'string') {
          preview = `▸ 结果: ${styled.truncated(parsed, verbose ? 300 : 150)}`;
        } else {
          preview = `▸ 任务已完成`;
        }
        
        console.log(styled.toolResult('子代理任务', data.success, preview));
        return;
      }
      
      if (parsed.command) {
        preview = `▸ 命令: ${styled.truncated(parsed.command, 80)}`;
      } else if (parsed.filepath) {
        preview = `▸ 文件: ${parsed.filepath}`;
      }
      
      if (parsed.stdout) {
        const out = String(parsed.stdout).trim();
        if (out && out !== "(empty)") {
          preview += `\n▸ 输出: ${styled.truncated(out.split('\n')[0] || out, verbose ? 200 : 80)}`;
        }
      }
      
      if (parsed.stderr?.trim() !== "(empty)") {
        preview += `\n▸ 错误: ${styled.truncated(parsed.stderr.split('\n')[0], verbose ? 100 : 60)}`;
      }
      
      console.log(styled.toolResult(data.name || "unknown", data.success, preview || "无输出"));
      return;
    }
    
    // 处理原始结果字符串
    if (data.result) {
      preview = styled.truncated(data.result, verbose ? 300 : 150);
      console.log(styled.toolResult(data.name || "unknown", data.success, preview));
    }
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
      process.stdout.write("\n\n");
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

  showPrompt(prompt: string = "\n👤 你: "): void {
    if (!this._rl) return;

    // 特殊的关键词处理
    if (this._rl.line) {
      const max = Math.max(this._rl.line.length - 8, 0);
      if (this._rl.line.slice(max, this._rl.line.length).includes(config.specialKeyword.keyword)) {
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
    
    super.destroy();
    
    // 清理进程监听器（简化处理，实际可能需要更精细的管理）
    // 在测试环境中不退出进程
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  }
}