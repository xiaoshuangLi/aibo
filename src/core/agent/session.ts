/**
 * 会话类 - 包含 Adapter 的完整会话管理
 * 
 * 中文名称：会话类
 * 
 * 负责管理完整的会话生命周期，包括状态管理、I/O 操作和资源清理。
 * 
 * @module session
 */

import { Adapter } from './adapter';
import { createConsoleThreadId } from '@/core/utils';
import { config } from '@/core/config';
import { SessionManager } from '@/infrastructure/session';

export interface SessionOptions {
  threadId?: string;
  modelInfo?: string;
}

export class Session {
  public threadId: string;
  public isRunning: boolean = false;
  public abortController: AbortController | null = null;
  private adapter: Adapter;
  private commandHistory: string[] = [];
  private historyIndex: number = 0;
  private isVoiceRecording: boolean = false;
  private voiceASR: any | null = null;
  private modelInfo: string;

  constructor(adapter: Adapter, options: SessionOptions = {}) {
    this.adapter = adapter;
    
    // 如果提供了 threadId，使用它；否则使用会话管理器的当前会话
    if (options.threadId) {
      this.threadId = options.threadId;
    } else {
      const sessionManager = SessionManager.getInstance();
      this.threadId = sessionManager.getCurrentSessionId();
    }
    
    this.modelInfo = options.modelInfo || config.model.name;
    
    // 设置中止信号
    this.abortController = new AbortController();
    this.adapter.setAbortSignal(this.abortController.signal);
  }

  /**
   * 开始会话
   */
  async start(): Promise<void> {
    await this.adapter.emit({
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

    await this.adapter.emit({
      type: 'sessionEnd',
      data: { exitMessage },
      timestamp: Date.now()
    });
    
    this.adapter.destroy();
  }

  /**
   * 请求用户输入
   */
  requestUserInput(prompt?: string) {
    if (this.isRunning) {
      return;
    }

    return this.adapter.requestUserInput(prompt);
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
   * 记录工具执行过程中的实时输出
   */
  logToolProgress(toolName: string, chunk: string): void {
    this.adapter.emit({
      type: 'toolProgress',
      data: { toolName, chunk },
      timestamp: Date.now()
    });
  }

  /**
   * 记录工具调用
   */
  logToolCall(name: string, args: any): void {
    this.adapter.emit({
      type: 'toolCall',
      data: { name, args },
      timestamp: Date.now()
    });
  }

  /**
   * 记录工具结果
   */
  logToolResult(name: string, success: boolean, preview: string): void {
    this.adapter.emit({
      type: 'toolResult',
      data: { name, success, preview },
      timestamp: Date.now()
    });
  }

  /**
   * 记录思考过程
   */
  logThinkingProcess(steps: Array<{ content: string; status?: string }>): void {
    this.adapter.emit({
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
      await this.adapter.emit({
        type: 'streamStart',
        data: { placeholder: "..." },
        timestamp: Date.now()
      });
      return;
    }
    
    if (content) {
      // For streaming, we need to handle it differently
      // Since we're using events, we'll send the content as a stream chunk
      this.adapter.emit({
        type: 'streamChunk',
        data: { chunk: content },
        timestamp: Date.now()
      });
    }
    
    if (isFinal && content && !content.trim().endsWith(".")) {
      // Add ellipsis for final content
      this.adapter.emit({
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
    this.adapter.emit({
      type: 'systemMessage',
      data: { message },
      timestamp: Date.now()
    });
  }

  /**
   * 记录 ACP 直传响应。
   * 在 Lark 界面中会以 "🔗 ACP [agentName]" 为标题展示，
   * 视觉上区分透传消息与普通 AI 回复。
   *
   * @param agentName - ACP 代理名称（如 "codex"、"claude"）
   * @param response  - 编程工具返回的响应内容
   */
  logAcpResponse(agentName: string, response: string): void {
    this.adapter.emit({
      type: 'acpResponse',
      data: { agentName, response },
      timestamp: Date.now(),
    });
  }

  /**
   * 记录错误消息
   */
  logErrorMessage(message: string): void {
    this.adapter.emit({
      type: 'errorMessage',
      data: { message },
      timestamp: Date.now()
    });
  }

  /**
   * 记录原始文本
   */
  logRawText(text: string): void {
    this.adapter.emit({
      type: 'rawText',
      data: { text },
      timestamp: Date.now()
    });
  }

  /**
   * 设置中断控制器并同步到适配器
   */
  setAbortController(controller: AbortController): void {
    this.abortController = controller;
    this.adapter.setAbortSignal(controller.signal);
  }

  /**
   * 上传图片并返回临时访问地址
   * @param base64 图片的 base64 编码
   * @returns 上传后的图片临时访问地址
   */
  async uploadImage(base64: string): Promise<string> {
    const uploaded = await this.adapter.uploadImage(base64);

    const message = `上传生成：\`${uploaded}\``;

    this.adapter.emit({
      type: 'systemMessage',
      data: { message },
      timestamp: Date.now()
    });

    return uploaded;
  }

  /**
   * 销毁会话
   */
  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.adapter.destroy();
  }
}