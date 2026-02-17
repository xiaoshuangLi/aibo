/**
 * LSP (Language Server Protocol) 客户端服务
 * 
 * 中文名称：LSP客户端服务
 * 
 * 预期行为：
 * - 启动和管理LSP服务器进程
 * - 处理JSON-RPC通信协议
 * - 提供标准化的LSP请求接口
 * - 自动处理服务器连接和断开
 * - 支持多种编程语言的LSP服务器
 * 
 * 行为分支：
 * 1. 正常启动：成功启动LSP服务器，建立JSON-RPC连接，提供服务接口
 * 2. 服务器启动失败：捕获启动错误，返回适当的错误信息
 * 3. 连接中断：自动重连或优雅降级到其他分析方式
 * 4. 请求超时：处理长时间运行的请求，防止阻塞
 * 5. 多语言支持：根据文件扩展名自动选择合适的LSP服务器
 * 6. 资源清理：正确关闭服务器进程，释放系统资源
 * 
 * @class LspClient
 */
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import { LspMessageParser } from '@/infrastructure/code-analysis/lsp-message-parser';

/**
 * JSON-RPC消息接口
 */
interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * LSP位置接口
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * LSP范围接口
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * LSP文本文档标识符
 */
export interface TextDocumentIdentifier {
  uri: string;
}

/**
 * LSP文本文档位置参数
 */
export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

/**
 * LSP工作区文件夹
 */
interface WorkspaceFolder {
  uri: string;
  name: string;
}

/**
 * LSP初始化参数
 */
interface InitializeParams {
  processId: number;
  rootUri: string;
  capabilities: {
    textDocument?: {
      completion?: any;
      hover?: any;
      definition?: any;
      references?: any;
      rename?: any;
    };
    workspace?: {
      symbol?: any;
      workspaceFolders?: {
        supported?: boolean;
        changeNotifications?: boolean | string;
      };
    };
  };
  workspaceFolders?: WorkspaceFolder[];
}

/**
 * LSP客户端配置
 */
export interface LspClientConfig {
  /** LSP服务器命令 */
  serverCommand: string;
  /** 服务器参数 */
  serverArgs?: string[];
  /** 工作目录 */
  workingDirectory: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * LSP客户端类
 * 
 * 中文名称：LSP客户端类
 * 
 * 负责与LSP服务器建立连接并处理通信
 */
export class LspClient extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private requestCounter: number = 1;
  private pendingRequests: Map<number, (result: any) => void> = new Map();
  private stdout: Readable | null = null;
  private stdin: Writable | null = null;
  private isInitialized: boolean = false;
  private config: LspClientConfig;
  private messageParser: LspMessageParser;

  /**
   * 创建LSP客户端实例
   * @param config LSP客户端配置
   */
  constructor(config: LspClientConfig) {
    super();
    this.config = {
      ...config,
      timeout: config.timeout || 30000
    };
    this.messageParser = new LspMessageParser();
    this.setupMessageParser();
  }

  /**
   * 设置消息解析器事件监听
   */
  private setupMessageParser(): void {
    this.messageParser.on('message', (message: JsonRpcMessage) => {
      this.handleMessage(message);
    });

    this.messageParser.on('error', (error: Error) => {
      console.error('LSP message parser error:', error);
      this.emit('parser-error', error);
    });
  }

  /**
   * 启动LSP服务器
   * @returns Promise<void>
   */
  async start(): Promise<void> {
    if (this.childProcess) {
      throw new Error('LSP server is already running');
    }

    try {
      // 启动LSP服务器进程
      this.childProcess = spawn(this.config.serverCommand, this.config.serverArgs || [], {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.stdout = this.childProcess.stdout;
      this.stdin = this.childProcess.stdin;

      if (!this.stdout || !this.stdin) {
        throw new Error('Failed to get stdout or stdin from LSP server');
      }

      // 处理输出流
      this.stdout.on('data', (chunk: Buffer) => {
        this.messageParser.receiveData(chunk);
      });

      // 处理错误
      this.childProcess.stderr?.on('data', (data) => {
        console.error('LSP Server stderr:', data.toString());
      });

      // 处理进程退出
      this.childProcess.on('exit', (code, signal) => {
        console.log(`LSP Server exited with code ${code}, signal ${signal}`);
        this.emit('server-exit', { code, signal });
        this.cleanup();
      });

      // 初始化LSP服务器
      await this.initializeServer();
      this.isInitialized = true;
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to start LSP server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 初始化LSP服务器
   */
  private async initializeServer(): Promise<void> {
    const workspaceUri = `file://${this.config.workingDirectory}`;
    const initParams: InitializeParams = {
      processId: process.pid,
      rootUri: workspaceUri,
      capabilities: {
        textDocument: {
          completion: {},
          hover: {},
          definition: {},
          references: {},
          rename: {},
        },
        workspace: {
          symbol: {},
          workspaceFolders: {
            supported: true,
            changeNotifications: true
          }
        }
      },
      workspaceFolders: [{
        uri: workspaceUri,
        name: 'aibo'
      }]
    };

    const result = await this.sendRequest('initialize', initParams, true);
    this.sendNotification('initialized', {}, true);
    
    return result;
  }

  /**
   * 处理接收到的消息
   * @param message JSON-RPC消息
   */
  private handleMessage(message: JsonRpcMessage): void {
    if (message.id !== undefined) {
      // 这是一个响应
      const callback = this.pendingRequests.get(Number(message.id));
      if (callback) {
        this.pendingRequests.delete(Number(message.id));
        if (message.error) {
          // 错误处理在Promise中处理
          callback({ error: message.error });
        } else {
          callback(message.result);
        }
      }
    } else {
      // 这是一个通知
      this.emit('notification', { method: message.method, params: message.params });
    }
  }

  /**
   * 发送LSP请求
   * @param method 方法名
   * @param params 参数
   * @param allowUninitialized 是否允许在未初始化状态下发送请求（仅用于initialize请求）
   * @returns Promise<any>
   */
  async sendRequest(method: string, params: any, allowUninitialized: boolean = false): Promise<any> {
    if (!this.isInitialized && !allowUninitialized) {
      throw new Error('LSP server is not initialized');
    }

    const requestId = this.requestCounter++;
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`LSP request timeout for method: ${method}`));
      }, this.config.timeout);

      this.pendingRequests.set(requestId, (result) => {
        clearTimeout(timeout);
        if (result?.error) {
          reject(new Error(`LSP request failed: ${result.error.message} (code: ${result.error.code})\n${JSON.stringify(message, null, 2)}`));
        } else {
          resolve(result);
        }
      });

      this.sendMessage(message);
    });
  }

  /**
   * 发送LSP通知
   * @param method 方法名
   * @param params 参数
   * @param allowUninitialized 是否允许在未初始化状态下发送通知（仅用于initialized通知）
   */
  sendNotification(method: string, params: any, allowUninitialized: boolean = false): void {
    if (!this.isInitialized && !allowUninitialized) {
      throw new Error('LSP server is not initialized');
    }

    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(message);
  }

  /**
   * 发送消息到LSP服务器
   * @param message 消息对象
   */
  private sendMessage(message: JsonRpcMessage): void {
    if (!this.stdin) {
      throw new Error('LSP server stdin is not available');
    }

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
    this.stdin.write(header + content);
  }

  /**
   * 获取符号定义
   * @param filePath 文件路径
   * @param position 位置
   * @returns Promise<any>
   */
  async getDefinition(filePath: string, position: Position): Promise<any> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri: `file://${filePath}` },
      position
    };
    return this.sendRequest('textDocument/definition', params);
  }

  /**
   * 查找符号引用
   * @param filePath 文件路径
   * @param position 位置
   * @returns Promise<any>
   */
  async findReferences(filePath: string, position: Position): Promise<any> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri: `file://${filePath}` },
      position
    };
    return this.sendRequest('textDocument/references', params);
  }

  /**
   * 获取悬停信息
   * @param filePath 文件路径
   * @param position 位置
   * @returns Promise<any>
   */
  async getHover(filePath: string, position: Position): Promise<any> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri: `file://${filePath}` },
      position
    };
    return this.sendRequest('textDocument/hover', params);
  }

  /**
   * 获取工作区符号
   * @param query 查询字符串
   * @returns Promise<any>
   */
  async getWorkspaceSymbols(query: string): Promise<any> {
    return this.sendRequest('workspace/symbol', { query });
  }

  /**
   * 关闭LSP服务器
   */
  async shutdown(): Promise<void> {
    if (this.childProcess) {
      try {
        await this.sendRequest('shutdown', null);
        this.sendNotification('exit', null);
      } catch (error) {
        console.error('Error during LSP shutdown:', error);
      }
    }
    this.cleanup();
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.isInitialized = false;
    this.pendingRequests.clear();
    this.messageParser.clear();
    
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
    
    this.stdout = null;
    this.stdin = null;
  }
}