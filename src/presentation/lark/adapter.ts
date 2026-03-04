/**
 * 飞书(Lark)适配器 - 实现适配器接口的飞书具体实现
 * 
 * 中文名称：飞书适配器
 * 
 * 这是 DefaultAdapter 的具体实现，专门用于飞书环境。
 * 所有原来的终端输出逻辑都移到这里，核心模块不再直接依赖飞书 API。
 * 
 * @module adapter
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { DefaultAdapter, OutputEvent, OutputEventType } from '@/core/agent/adapter';
import { config } from '@/core/config';
import { SessionManager } from '@/infrastructure/session';

import { styled } from './styler';

// 飞书配置类型
interface LarkConfig {
  appId?: string;
  appSecret?: string;
  receiveId?: string;
}

// 用户消息回调类型
type UserMessageCallback = (message: string) => void;

export class LarkAdapter extends DefaultAdapter {
  private client: lark.Client;
  private wsClient: lark.WSClient;
  private abortSignal: AbortSignal | null = null;
  private isDestroyed = false;
  private userMessageCallback: UserMessageCallback | null = null;
  private chatId: string | null = null;
  
  // 存储待处理的消息队列（用于处理并发消息）
  private messageQueue: Array<{ content: string; chatId: string }> = [];
  private isProcessingQueue = false;

  // 工具进度流缓冲区（用于批量发送实时进度消息）
  private progressBuffer: string = '';
  private progressToolName: string = '';
  private progressFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly PROGRESS_FLUSH_INTERVAL = 3000; // 3 秒
  private static readonly PROGRESS_FLUSH_SIZE = 800;      // 超过 800 字符立即发送

  constructor(chatId?: string) {
    super();
    
    // 验证环境变量
    const larkConfig = this.getLarkConfig();
    if (!larkConfig.appId || !larkConfig.appSecret) {
      throw new Error('Missing required Lark environment variables: AIBO_LARK_APP_ID and AIBO_LARK_APP_SECRET');
    }

    // 存储群聊 ID（chat 模式下使用）
    this.chatId = chatId ?? null;

    // 初始化飞书客户端
    this.client = new lark.Client({
      appId: larkConfig.appId,
      appSecret: larkConfig.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });

    // 初始化WebSocket客户端（用于长连接接收事件）
    this.wsClient = new lark.WSClient({
      appId: larkConfig.appId,
      appSecret: larkConfig.appSecret,
      loggerLevel: lark.LoggerLevel.info,
    });

    // 注册事件监听器
    this.setupEventListeners();
    
    // 启动长连接
    this.startLongConnection();
  }

  /**
   * 获取飞书配置
   */
  private getLarkConfig(): LarkConfig {
    return config.lark;
  }

  /**
   * 设置用户消息回调函数
   */
  setUserMessageCallback(callback: UserMessageCallback): void {
    this.userMessageCallback = callback;
    // 处理在回调注册之前已入队的消息
    this.processMessageQueue();
  }

  /**
   * 注册事件监听器
   */
  private setupEventListeners(): void {
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
    this.on('toolProgress', this.handleToolProgress.bind(this));
  }

  /**
   * 启动长连接接收事件
   */
  private startLongConnection(): void {
    try {
      this.wsClient.start({
        eventDispatcher: new lark.EventDispatcher({}).register({
          'im.message.receive_v1': async (data) => {
            await this.handleUserMessage(data);
            return { code: 0, msg: 'success' };
          }
        })
      });
      
      console.log('✅ 飞书长连接已启动，等待用户消息...');
    } catch (error) {
      console.error('❌ 启动飞书长连接失败:', error);
      throw error;
    }
  }

  /**
   * 处理用户消息
   */
  private async handleUserMessage(data: any): Promise<void> {
    try {
      const { message } = data;
      const { chat_id: msgChatId, chat_type: chatType, content } = message;

      // 消息过滤：
      // - 有 chatId 时，只处理相同群聊的消息
      // - 无 chatId 时，只处理直接发给机器人的私信（p2p）消息
      if (this.chatId !== null) {
        if (msgChatId !== this.chatId) {
          return;
        }
      } else {
        if (chatType !== 'p2p') {
          return;
        }
      }

      // 解析消息内容
      let messageContent = '';
      try {
        const contentObj = JSON.parse(content);
        messageContent = contentObj.text || '';
      } catch (parseError) {
        messageContent = content;
      }

      if (!messageContent.trim()) {
        return;
      }

      // 如果有用户消息回调，立即调用
      if (this.userMessageCallback) {
        this.userMessageCallback(messageContent);
      } else {
        // 如果没有回调，将消息加入队列
        this.messageQueue.push({ content: messageContent, chatId: msgChatId });
        this.processMessageQueue();
      }
    } catch (error) {
      console.error('❌ 处理用户消息失败:', error);
    }
  }

  /**
   * 处理消息队列
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0 || !this.userMessageCallback) {
      return;
    }

    this.isProcessingQueue = true;
    
    try {
      while (this.messageQueue.length > 0 && this.userMessageCallback) {
        const message = this.messageQueue.shift()!;
        console.log(`📨 收到队列消息: ${message.content}`);
        this.userMessageCallback(message.content);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * 发送消息到指定接收ID
   */
  async sendMessage(content: string, msgType: string = 'text'): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Lark adapter is destroyed');
    }

    const larkConfig = this.getLarkConfig();

    // chat 模式：发送到群聊；user 模式：发送到用户
    const isChatMode = this.chatId !== null;
    const targetReceiveId = isChatMode ? this.chatId! : larkConfig.receiveId;
    const receiveIdType = isChatMode ? 'chat_id' : 'user_id';

    if (!targetReceiveId) {
      console.warn('⚠️ 无法发送消息：没有设置接收ID');
      return;
    }

    const create = (text: any = '') => {
      const more = (() => {
        const content = JSON.stringify({ text });
        const base = { content };

        try {
          const got = JSON.parse(text);

          return got.msg_type ? got : base;
        } catch (e) {
          return base;
        }
      })();

      return this.client.im.message.create({
        params: {
          receive_id_type: receiveIdType,
        },
        data: {
          msg_type: 'text',
          receive_id: targetReceiveId,
          ...more
        },
      })
    };

    try {
      // 飞书支持多行文本，直接发送格式化后的内容
      await create(content);
    } catch (error) {
      const errorData = (error as any).response?.data;
      console.error('❌ 发送消息失败:', errorData);
      console.error('📃 发送消息内容:', (error as any).response?.config?.data);
      const errorJson = JSON.stringify(errorData ?? String(error), null, 2);
      const errorContent = `\`\`\`json\n${errorJson}\n\`\`\``;
      await create(styled.system('❌ 发送消息失败', errorContent));
    }
  }

  /**
   * 请求用户输入（在飞书环境中，这主要是设置状态）
   */
  async requestUserInput(prompt: string = "请发送您的消息"): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Lark adapter is destroyed');
    }
    
    // 在飞书中，我们不需要主动请求输入，用户会通过消息发送
    // 但我们可以发送一个提示消息
    if (prompt && prompt.trim()) {
      await this.sendMessage(prompt);
    }
  }

  /**
   * 设置中断信号
   */
  setAbortSignal(signal: AbortSignal): void {
    this.abortSignal = signal;
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    
    this.isDestroyed = true;

    // Clear any pending progress flush timer
    if (this.progressFlushTimer) {
      clearTimeout(this.progressFlushTimer);
      this.progressFlushTimer = null;
    }
    
    // 关闭WebSocket连接
    try {
      // 注意：WSClient可能没有显式的close方法，连接会在进程退出时自动关闭
      console.log('🔌 飞书适配器已销毁');
    } catch (error) {
      console.error('❌ 销毁飞书适配器时出错:', error);
    }
  }

  // 素材多维表格 token 缓存（跳过重复的查找/创建步骤）
  private bitableToken: string | null = null;

  /**
   * 上传图片并返回临时访问地址
   * 完整流程：
   * 1. 查找或创建「素材库」文件夹，获取 token
   * 2. 在文件夹内查找或创建「素材多维表格」多维表格，获取 app_token
   * 3. 将 base64 图片上传到多维表格，获取 fileToken
   * 4. 获取素材临时下载链接并返回
   */
  async uploadImage(base64: string): Promise<string> {
    // 如果已有缓存的 bitable token，直接跳过步骤 1、2
    if (!this.bitableToken) {
      const folderToken = await this.getOrCreateAssetLibraryFolder();
      this.bitableToken = await this.getOrCreateAssetBitable(folderToken);
    }

    const fileToken = await this.uploadImageToBitable(base64, this.bitableToken);
    return this.getTmpDownloadUrl(fileToken);
  }

  /**
   * 在根目录中查找名为「素材库」的文件夹；如果不存在则创建。
   * 返回文件夹的 token。
   */
  private async getOrCreateAssetLibraryFolder(): Promise<string> {
    const FOLDER_NAME = '【素材库】';
    let pageToken: string | undefined;

    do {
      const resp = await (this.client.drive.v1.file as any).list({
        params: {
          page_size: 200,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      });

      const files: Array<{ token: string; name: string; type: string }> = resp?.data?.files ?? [];
      for (const file of files) {
        if (file.type === 'folder' && file.name === FOLDER_NAME) {
          return file.token;
        }
      }

      pageToken = resp?.data?.has_more ? resp?.data?.next_page_token : undefined;
    } while (pageToken);

    // 未找到，创建新文件夹
    const createResp = await (this.client.drive.v1.file as any).createFolder({
      data: {
        name: FOLDER_NAME,
        folder_token: '',
      },
    });

    const token: string | undefined = createResp?.data?.token;
    if (!token) {
      throw new Error(`创建「${FOLDER_NAME}」文件夹失败，响应: ${JSON.stringify(createResp)}`);
    }
    return token;
  }

  /**
   * 在指定文件夹中查找名为「素材多维表格」的多维表格；如果不存在则创建。
   * 返回多维表格的 app_token。
   */
  private async getOrCreateAssetBitable(folderToken: string): Promise<string> {
    const BITABLE_NAME = '【素材多维表格】';
    let pageToken: string | undefined;

    do {
      const resp = await (this.client.drive.v1.file as any).list({
        params: {
          page_size: 200,
          folder_token: folderToken,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      });

      const files: Array<{ token: string; name: string; type: string }> = resp?.data?.files ?? [];
      for (const file of files) {
        if (file.type === 'bitable' && file.name === BITABLE_NAME) {
          return file.token;
        }
      }

      pageToken = resp?.data?.has_more ? resp?.data?.next_page_token : undefined;
    } while (pageToken);

    // 未找到，创建新多维表格
    const createResp = await (this.client.bitable.v1.app as any).create({
      data: {
        name: BITABLE_NAME,
        folder_token: folderToken,
      },
    });

    const appToken: string | undefined = createResp?.data?.app?.app_token;
    if (!appToken) {
      throw new Error(`创建「${BITABLE_NAME}」多维表格失败，响应: ${JSON.stringify(createResp)}`);
    }
    return appToken;
  }

  /**
   * 将 base64 编码的图片上传到指定多维表格，返回 fileToken。
   */
  private async uploadImageToBitable(base64: string, appToken: string): Promise<string> {
    const imageBuffer = Buffer.from(base64, 'base64');
    const fileName = `image_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;

    const resp = await (this.client.drive.v1.media as any).uploadAll({
      data: {
        file_name: fileName,
        parent_type: 'bitable_file',
        parent_node: appToken,
        size: imageBuffer.length,
        file: imageBuffer,
      },
    });

    const fileToken: string | undefined = resp?.file_token;
    if (!fileToken) {
      throw new Error(`上传图片到多维表格失败，响应: ${JSON.stringify(resp)}`);
    }
    return fileToken;
  }

  /**
   * 通过 fileToken 获取素材临时下载链接。
   */
  private async getTmpDownloadUrl(fileToken: string): Promise<string> {
    const resp = await (this.client.drive.v1.media as any).batchGetTmpDownloadUrl({
      params: {
        file_tokens: [fileToken],
      },
    });

    const urls: Array<{ file_token: string; tmp_download_url: string }> = resp?.data?.tmp_download_urls ?? [];
    const entry = urls.find(u => u.file_token === fileToken);
    if (!entry?.tmp_download_url) {
      throw new Error(`获取素材临时下载链接失败，响应: ${JSON.stringify(resp)}`);
    }
    return entry.tmp_download_url;
  }

  // 事件处理器方法
  private async handleAIResponse(data: { content: string }): Promise<void> {
    if (!data?.content) return;
    // 使用富文本格式化 AI 响应
    const formattedContent = styled.assistant(data.content);
    await this.sendMessage(formattedContent);
  }

  private async handleToolCall(data: { name: string; args: any }): Promise<void> {
    if (!data?.name) return;
    
    // 使用富文本格式化工具调用信息
    const toolCallMessage = styled.toolCall(data.name, data.args);
    await this.sendMessage(toolCallMessage);
  }

  private async handleToolResult(data: any): Promise<void> {
    if (!data?.name) return;

    // Flush any buffered progress output before showing the final result
    await this.flushProgressBuffer();
    
    // 如果已经有 preview 字段，直接使用（向后兼容）
    if (data.preview !== undefined) {
      // 在 Lark 模式下，确保 preview 内容不被截断
      const toolResultMessage = styled.toolResult(data.name, data.success, data.preview);
      await this.sendMessage(toolResultMessage);
      return;
    }
    
    // 处理新的数据结构 - Lark 模式下绝不截断任何内容
    let preview = "";
    
    // 特别处理 task 工具的结果
    if (data.isTaskResult) {
      const type = data.name.includes('结果') ? data.name : '子代理任务';
      if (typeof data.result === 'string' && data.result.includes('▸ 结果:')) {
        preview = data.result;
      } else {
        // Lark 模式下不截断，直接显示完整内容
        preview = `▸ 结果: ${data.result}`;
      }
      
      const toolResultMessage = styled.toolResult(type, data.success, preview);
      await this.sendMessage(toolResultMessage);
      return;
    }
    
    // 处理文本结果 - Lark 模式下不截断
    if (data.isTextResult) {
      preview = data.result; // 直接使用完整内容，不截断
      const toolResultMessage = styled.toolResult(data.name, data.success, preview);
      await this.sendMessage(toolResultMessage);
      return;
    }
    
    // 处理 JSON 结果 - 优先使用新的 JSON 格式化器
    if (data.isJsonResult && data.result) {
      const parsed = data.result;
      
      // 特别处理 task 工具的 JSON 结果
      if (data.name === '子代理任务' || data.name === 'task') {
        if (parsed.message) {
          preview = `▸ 结果: ${parsed.message}`; // 不截断
        } else if (typeof parsed === 'string') {
          preview = `▸ 结果: ${parsed}`; // 不截断
        } else {
          preview = `▸ 任务已完成`;
        }
        
        const toolResultMessage = styled.toolResult('子代理任务', data.success, preview);
        await this.sendMessage(toolResultMessage);
        return;
      }
      
      // 尝试将任何对象都用 JSON 格式化器处理
      if (typeof parsed === 'object' && parsed !== null) {
        try {
          // 使用标准 JSON 格式化（不截断）
          preview = JSON.stringify(parsed, null, 2);
        } catch (error) {
          // 如果格式化失败，使用完整 JSON 字符串（不截断）
          preview = JSON.stringify(parsed, null, 2);
        }
      } else if (typeof parsed === 'string') {
        // 尝试解析字符串是否为 JSON
        try {
          const jsonStringParsed = JSON.parse(parsed);
          if (typeof jsonStringParsed === 'object' && jsonStringParsed !== null) {
            preview = JSON.stringify(jsonStringParsed, null, 2);
          } else {
            preview = parsed; // 直接使用完整字符串
          }
        } catch (error) {
          // 不是 JSON 字符串，直接使用完整内容
          preview = parsed;
        }
      } else {
        // 其他类型，转换为字符串（不截断）
        preview = String(parsed);
      }
      
      const toolResultMessage = styled.toolResult(data.name || "unknown", data.success, preview || "无输出");
      await this.sendMessage(toolResultMessage);
      return;
    }
    
    // 处理原始结果字符串 - Lark 模式下绝不截断
    if (data.result) {
      // 检查是否是 JSON 字符串
      if (typeof data.result === 'string') {
        try {
          const parsedJson = JSON.parse(data.result);
          if (typeof parsedJson === 'object' && parsedJson !== null) {
            preview = JSON.stringify(parsedJson, null, 2);
          } else {
            preview = data.result; // 完整字符串，不截断
          }
        } catch (error) {
          // 不是 JSON，使用完整内容
          preview = data.result;
        }
      } else {
        // 非字符串类型，转换为完整字符串
        preview = String(data.result);
      }
      const toolResultMessage = styled.toolResult(data.name || "unknown", data.success, preview);
      await this.sendMessage(toolResultMessage);
    }
  }

  private async handleThinkingProcess(data: { steps: Array<{ content: string; status?: string }> }): Promise<void> {
    if (!data?.steps?.length) return;
    
    // 使用富文本格式化思考过程
    const thinkingMessage = styled.thinkingProcess(data.steps);
    await this.sendMessage(thinkingMessage);
  }

  private async handleSystemMessage(data: { message: string }): Promise<void> {
    if (!data?.message) return;
    const systemMessage = styled.system(data.message);
    await this.sendMessage(systemMessage);
  }

  private async handleErrorMessage(data: { message: string }): Promise<void> {
    if (!data?.message) return;
    const errorMessage = styled.error(data.message);
    await this.sendMessage(errorMessage);
  }

  private async handleHintMessage(data: { message: string }): Promise<void> {
    if (!data?.message) return;
    const hintMessage = styled.hint(data.message);
    await this.sendMessage(hintMessage);
  }

  private async handleStreamStart(data: { initialContent?: string }): Promise<void> {
    if (data?.initialContent) {
      const formattedContent = styled.assistant(data.initialContent);
      await this.sendMessage(formattedContent);
    } else {
      const formattedContent = styled.assistant("...");
      await this.sendMessage(formattedContent);
    }
  }

  private async handleStreamChunk(data: { chunk: string }): Promise<void> {
    if (!data?.chunk) return;
    if (this.abortSignal?.aborted) return;
    await this.sendMessage(styled.assistant(data.chunk));
  }

  private async handleStreamEnd(data: { finalContent?: string }): Promise<void> {
    // 流结束不需要特殊处理，飞书会自动显示完整消息
  }

  private async handleSessionStart(data: { welcomeMessage?: string; modelInfo?: string; session?: any }): Promise<void> {
    let sessionMessage = `✨ **基本信息**
• 模型: ${data?.modelInfo || '未知模型'}
• 工作目录: \`${process.cwd()}\`

🚀 **快速开始**
• 输入 \`/help\` 查看所有可用命令
• 直接描述您的需求，我会帮您完成
• 支持文件操作、代码分析、知识管理等功能
`;
    
    // 对于 session start 消息，使用系统消息样式
    await this.sendMessage(styled.system('🤖 AIBO 助手已启动', sessionMessage));
  }

  private async handleSessionEnd(data: { message: string }): Promise<void> {
    if (!data?.message) return;
    await this.sendMessage(styled.assistant(data.message));
  }

  private async handleCommandExecuted(data: { command: string; result?: any }): Promise<void> {
    // 命令执行完成，可以显示结果或提示
    if (data?.result?.message) {
      await this.sendMessage(styled.system(data.result.message));
    }
  }

  private async handleRawText(data: { text: string }): Promise<void> {
    if (data?.text) {
      await this.sendMessage(styled.system('📃 原始文本', data.text));
    }
  }

  /**
   * 处理工具执行过程中的实时输出
   * 使用缓冲机制防止消息频率过高：
   * - 超过 PROGRESS_FLUSH_SIZE 字符时立即发送
   * - 否则等待 PROGRESS_FLUSH_INTERVAL 毫秒后批量发送
   */
  private async handleToolProgress(data: { toolName: string; chunk: string }): Promise<void> {
    if (!data?.chunk) return;

    this.progressToolName = data.toolName;
    this.progressBuffer += data.chunk;

    if (this.progressBuffer.length >= LarkAdapter.PROGRESS_FLUSH_SIZE) {
      await this.flushProgressBuffer();
    } else {
      this.scheduleProgressFlush();
    }
  }

  private scheduleProgressFlush(): void {
    if (this.progressFlushTimer) return;
    this.progressFlushTimer = setTimeout(async () => {
      this.progressFlushTimer = null;
      await this.flushProgressBuffer();
    }, LarkAdapter.PROGRESS_FLUSH_INTERVAL);
  }

  private async flushProgressBuffer(): Promise<void> {
    if (!this.progressBuffer.trim()) {
      this.progressBuffer = '';
      return;
    }

    if (this.progressFlushTimer) {
      clearTimeout(this.progressFlushTimer);
      this.progressFlushTimer = null;
    }

    const content = this.progressBuffer;
    this.progressBuffer = '';

    const message = styled.system(
      `⏳ ${this.progressToolName} 进行中`,
      `\`\`\`\n${content}\n\`\`\``,
    );

    await this.sendMessage(message);
  }
}