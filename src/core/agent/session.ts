/**
 * 会话类 - 包含 IOChannel 的完整会话管理
 * 
 * 中文名称：会话类
 * 
 * 负责管理完整的会话生命周期，包括状态管理、I/O 操作和资源清理。
 * 
 * @module session
 */

import { IOChannel } from './io-channel';
import { createConsoleThreadId } from '@/core/utils/interactive-logic';
import { config } from '@/core/config/config';
import { SessionManager } from '@/infrastructure/session/session-manager';

export interface SessionOptions {
  threadId?: string;
  modelInfo?: string;
}

export class Session {
  public readonly threadId: string;
  public isRunning: boolean = false;
  public abortController: AbortController | null = null;
  private ioChannel: IOChannel;
  private commandHistory: string[] = [];
  private historyIndex: number = 0;
  private isVoiceRecording: boolean = false;
  private voiceASR: any | null = null;
  private modelInfo: string;

  constructor(ioChannel: IOChannel, options: SessionOptions = {}) {
    this.ioChannel = ioChannel;
    
    // 如果提供了 threadId，使用它；否则使用会话管理器的当前会话
    if (options.threadId) {
      this.threadId = options.threadId;
    } else {
      const sessionManager = SessionManager.getInstance();
      this.threadId = sessionManager.getCurrentSessionId();
    }
    
    this.modelInfo = options.modelInfo || config.openai.modelName;
    
    // 设置中止信号
    this.abortController = new AbortController();
    this.ioChannel.setAbortSignal(this.abortController.signal);
  }

  /**
   * 开始会话
   */
  async start(): Promise<void> {
    await this.ioChannel.emit({
      type: 'sessionStart',
      data: { modelInfo: this.modelInfo },
      timestamp: Date.now()
    });
  }

  /**
   * 结束会话
   */
  async end(exitMessage: string = "再见！"): Promise<void> {
    // 自动生成当前会话的元数据文件
    try {
      const sessionManager = SessionManager.getInstance();
      sessionManager.generateSessionMetadata(this.threadId);
      console.log(`✅ 会话元数据已生成: .data/sessions/${this.threadId}/metadata.json`);
    } catch (error) {
      console.warn(`⚠️ 生成会话元数据时发生警告:`, error);
    }

    await this.ioChannel.emit({
      type: 'sessionEnd',
      data: { exitMessage },
      timestamp: Date.now()
    });
    
    this.ioChannel.destroy();
  }

  /**
   * 请求用户输入
   */
  requestUserInput(prompt?: string) {
    if (this.isRunning) {
      return;
    }

    return this.ioChannel.requestUserInput(prompt);
  }

  /**
   * 添加命令到历史记录
   */
  addToHistory(command: string): void {
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;
  }

  /**
   * 获取命令历史
   */
  getCommandHistory(): string[] {
    return [...this.commandHistory];
  }

  /**
   * 设置语音录制状态
   */
  setVoiceRecording(isRecording: boolean, voiceASR: any | null = null): void {
    this.isVoiceRecording = isRecording;
    this.voiceASR = voiceASR;
  }

  /**
   * 检查是否正在语音录制
   */
  isVoiceRecordingActive(): boolean {
    return this.isVoiceRecording;
  }

  /**
   * 获取语音 ASR 实例
   */
  getVoiceASR(): any | null {
    return this.voiceASR;
  }

  /**
   * 记录工具调用
   */
  logToolCall(name: string, args: any): void {
    this.ioChannel.emit({
      type: 'toolCall',
      data: { name, args },
      timestamp: Date.now()
    });
  }

  /**
   * 记录工具结果
   */
  logToolResult(name: string, success: boolean, preview: string): void {
    this.ioChannel.emit({
      type: 'toolResult',
      data: { name, success, preview },
      timestamp: Date.now()
    });
  }

  /**
   * 记录思考过程
   */
  logThinkingProcess(steps: Array<{ content: string; status?: string }>): void {
    this.ioChannel.emit({
      type: 'thinkingProcess',
      data: { steps },
      timestamp: Date.now()
    });
  }

  /**
   * 流式输出 AI 内容
   */
  async streamAIContent(content: string, isInitial: boolean, isFinal: boolean): Promise<void> {
    if (isInitial && !content) {
      // 发送初始状态，让 TerminalAdapter 处理显示
      await this.ioChannel.emit({
        type: 'streamStart',
        data: { placeholder: "..." },
        timestamp: Date.now()
      });
      return;
    }
    
    if (content) {
      // For streaming, we need to handle it differently
      // Since we're using events, we'll send the content as a stream chunk
      this.ioChannel.emit({
        type: 'streamChunk',
        data: { chunk: content },
        timestamp: Date.now()
      });
    }
    
    if (isFinal && content && !content.trim().endsWith(".")) {
      // Add ellipsis for final content
      this.ioChannel.emit({
        type: 'streamEnd',
        data: { finalContent: content },
        timestamp: Date.now()
      });
    }
  }

  /**
   * 记录系统消息
   */
  logSystemMessage(message: string): void {
    this.ioChannel.emit({
      type: 'systemMessage',
      data: { message },
      timestamp: Date.now()
    });
  }

  /**
   * 记录错误消息
   */
  logErrorMessage(message: string): void {
    this.ioChannel.emit({
      type: 'errorMessage',
      data: { message },
      timestamp: Date.now()
    });
  }

  /**
   * 记录原始文本
   */
  logRawText(text: string): void {
    this.ioChannel.emit({
      type: 'rawText',
      data: { text },
      timestamp: Date.now()
    });
  }

  /**
   * 销毁会话
   */
  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.ioChannel.destroy();
  }
}