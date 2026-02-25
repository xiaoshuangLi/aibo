/**
 * LSP (Language Server Protocol) 客户端服务
 * 
 * 基于 Tritlo/lsp-mcp 仓库的实现重新编写
 * 移除了所有 MCP 相关代码，专注于纯 LSP 功能
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// LSP 消息接口
interface LSPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

// 诊断信息接口
export interface Diagnostic {
  range: Range;
  severity: number;
  code?: string | number;
  source?: string;
  message: string;
}

// LSP 位置和范围接口
export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

// LSP 客户端配置
export interface LspClientConfig {
  /** LSP 服务器命令 */
  serverCommand: string;
  /** 服务器参数 */
  serverArgs?: string[];
  /** 工作目录 */
  workingDirectory: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 最大缓冲区大小（字节） */
  maxBufferSize?: number;
}

/**
 * LSP 客户端类
 * 负责与 LSP 服务器建立连接并处理通信
 */
export class LspClient {
  private childProcess: ChildProcess | null = null;
  private buffer: string = "";
  private messageQueue: LSPMessage[] = [];
  private nextId: number = 1;
  private responsePromises: Map<string | number, { resolve: Function; reject: Function }> = new Map();
  private initialized: boolean = false;
  private config: LspClientConfig;
  private openedDocuments: Set<string> = new Set();
  private documentVersions: Map<string, number> = new Map();
  private processingQueue: boolean = false;
  private documentDiagnostics: Map<string, Diagnostic[]> = new Map();

  constructor(config: LspClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 10000,
      maxBufferSize: config.maxBufferSize || 10 * 1024 * 1024 // 10MB
    };
  }

  /**
   * 启动 LSP 服务器进程
   */
  public startProcess(): void {
    console.log(`Starting LSP client with binary: ${this.config.serverCommand}`);
    console.log(`Using LSP server arguments: ${this.config.serverArgs?.join(' ') || ''}`);
    
    console.log('Starting LSP process:', this.config.serverCommand, this.config.serverArgs);
    this.childProcess = spawn(this.config.serverCommand, this.config.serverArgs || [], {
      cwd: this.config.workingDirectory,
      stdio: ["pipe", "pipe", "pipe"]
    });

    // 设置事件监听器
    if (this.childProcess.stdout) {
      console.log('Setting up stdout listener');
      this.childProcess.stdout.on("data", (data: Buffer) => {
        console.log('LSP stdout data:', data.toString());
        this.handleData(data);
      });
    } else {
      console.error('stdout is not available');
    }
    
    if (this.childProcess.stderr) {
      console.log('Setting up stderr listener');
      this.childProcess.stderr.on("data", (data: Buffer) => {
        console.error('LSP stderr data:', data.toString());
      });
    } else {
      console.error('stderr is not available');
    }

    this.childProcess.on("close", (code: number) => {
      console.log(`LSP server process exited with code ${code}`);
    });
  }

  /**
   * 处理接收到的数据
   */
  public handleData(data: Buffer): void {
    console.log('Received data from LSP server:', data.toString());
    // 追加新数据到缓冲区
    this.buffer += data.toString();

    // 实现安全限制以防止缓冲区过度增长
    if (this.buffer.length > this.config.maxBufferSize!) {
      console.error(`Buffer size exceeded ${this.config.maxBufferSize} bytes, clearing buffer`);
      this.buffer = this.buffer.substring(this.buffer.length - this.config.maxBufferSize!);
    }

    // 处理完整消息
    while (true) {
      const headerMatch = this.buffer.match(/^Content-Length: (\d+)\r?\n\r?\n/);
      if (!headerMatch) break;

      const contentLength = parseInt(headerMatch[1], 10);
      const headerEnd = headerMatch[0].length;

      // 防止处理过大的消息
      if (contentLength > this.config.maxBufferSize!) {
        console.error(`Received message with content length ${contentLength} exceeds maximum size, skipping`);
        this.buffer = this.buffer.substring(headerEnd + contentLength);
        continue;
      }

      // 检查是否拥有完整消息
      if (this.buffer.length < headerEnd + contentLength) break;

      // 提取消息内容
      const content = this.buffer.substring(headerEnd, headerEnd + contentLength);
      this.buffer = this.buffer.substring(headerEnd + contentLength);

      // 解析消息并添加到队列
      try {
        console.log('Parsing LSP message content:', content);
        const message = JSON.parse(content) as LSPMessage;
        console.log('Parsed LSP message:', JSON.stringify(message, null, 2));
        this.messageQueue.push(message);
        this.processMessageQueue();
      } catch (error) {
        console.error("Failed to parse LSP message:", error);
        console.error("Raw content that failed to parse:", content);
      }
    }
  }

  /**
   * 处理消息队列
   */
  private async processMessageQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.handleMessage(message);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * 处理单个消息
   */
  public async handleMessage(message: LSPMessage): Promise<void> {
    console.log('Received LSP message:', JSON.stringify(message, null, 2));
    
    // 处理响应消息
    if ('id' in message && (message.result !== undefined || message.error !== undefined)) {
      console.log(`Handling response for ID ${message.id}:`, message.result || message.error);
      const promise = this.responsePromises.get(message.id!);
      if (promise) {
        if (message.error) {
          promise.reject(message.error);
        } else {
          promise.resolve(message.result);
        }
        this.responsePromises.delete(message.id!);
      }
    }

    // 处理通知消息
    if ('method' in message && message.id === undefined) {
      console.log(`Received LSP notification: ${message.method}`);
      // 处理诊断通知
      if (message.method === 'textDocument/publishDiagnostics' && message.params) {
        const { uri, diagnostics } = message.params;
        console.log(`Received diagnostics for ${uri}:`, JSON.stringify(diagnostics, null, 2));
        if (uri && Array.isArray(diagnostics)) {
          this.documentDiagnostics.set(uri, diagnostics);
        }
      }
    }
  }

  /**
   * 发送 LSP 请求
   */
  public sendRequest<T>(method: string, params?: any): Promise<T> {
    if (!this.childProcess) {
      return Promise.reject(new Error("LSP process not started. Please call start_lsp first."));
    }

    const id = this.nextId++;
    const request: LSPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    const promise = new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.responsePromises.has(id)) {
          this.responsePromises.delete(id);
          reject(new Error(`Timeout waiting for response to ${method} request`));
        }
      }, this.config.timeout);

      this.responsePromises.set(id, {
        resolve: (result: T) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    });

    const content = JSON.stringify(request);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.childProcess.stdin!.write(header + content);

    return promise;
  }

  /**
   * 发送 LSP 通知
   */
  public sendNotification(method: string, params?: any): void {
    if (!this.childProcess) {
      console.error("LSP process not started. Please call start_lsp first.");
      return;
    }

    const notification: LSPMessage = {
      jsonrpc: "2.0",
      method,
      params
    };

    const content = JSON.stringify(notification);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.childProcess.stdin!.write(header + content);
  }

  /**
   * 初始化 LSP 连接
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!this.childProcess) {
        this.startProcess();
      }

      console.log("Initializing LSP connection...");
      await this.sendRequest("initialize", {
        processId: process.pid,
        rootUri: `file://${path.resolve(this.config.workingDirectory)}`,
        capabilities: {
          textDocument: {
            hover: {
              contentFormat: ["markdown", "plaintext"]
            },
            completion: {
              completionItem: {
                snippetSupport: false
              }
            },
            codeAction: {
              dynamicRegistration: true
            },
            publishDiagnostics: {
              relatedInformation: true,
              versionSupport: false,
              tagSupport: { valueSet: [1, 2] },
              codeDescriptionSupport: true,
              dataSupport: true
            }
          },
          workspace: {
            workspaceFolders: true
          }
        },
        initializationOptions: {
          // TypeScript Language Server specific options
          preferences: {
            includeCompletionsForModuleExports: true,
            includeCompletionsWithInsertText: true,
            includeCompletionsWithSnippetText: false,
            allowIncompleteCompletions: true
          },
          hostInfo: "node",
          // Add TypeScript server path
          tsserver: {
            path: "./node_modules/typescript/lib"
          }
        }
      });

      this.sendNotification("initialized", {});
      this.initialized = true;
      console.log("LSP connection initialized successfully");
    } catch (error) {
      console.error("Failed to initialize LSP connection:", error);
      throw error;
    }
  }

  /**
   * 打开文档
   */
  public async openDocument(filePath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error("LSP client not initialized. Please call start_lsp first.");
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const uri = `file://${absolutePath}`;
    
    // 如果文档已打开，更新内容而不是重新打开
    if (this.openedDocuments.has(uri)) {
      const currentVersion = this.documentVersions.get(uri) || 1;
      const newVersion = currentVersion + 1;
      
      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      this.sendNotification("textDocument/didChange", {
        textDocument: {
          uri,
          version: newVersion
        },
        contentChanges: [{ text: fileContent }]
      });
      
      this.documentVersions.set(uri, newVersion);
      return;
    }

    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    const languageId = this.getLanguageId(absolutePath);
    
    this.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId,
        version: 1,
        text: fileContent
      }
    });

    this.openedDocuments.add(uri);
    this.documentVersions.set(uri, 1);
  }

  /**
   * 关闭文档
   */
  public async closeDocument(filePath: string): Promise<void> {
    if (!this.initialized) {
      throw new Error("LSP client not initialized. Please call start_lsp first.");
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const uri = `file://${absolutePath}`;
    
    if (this.openedDocuments.has(uri)) {
      this.sendNotification("textDocument/didClose", {
        textDocument: { uri }
      });
      
      this.openedDocuments.delete(uri);
      this.documentVersions.delete(uri);
    }
  }

  /**
   * 根据文件扩展名获取语言 ID
   */
  private getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
        return 'typescript';
      case '.tsx':
        return 'typescriptreact';
      case '.js':
        return 'javascript';
      case '.jsx':
        return 'javascriptreact';
      default:
        return 'typescript';
    }
  }

  /**
   * 获取悬停信息
   */
  public async getHover(filePath: string, position: Position): Promise<any> {
    if (!this.initialized) {
      throw new Error("LSP client not initialized. Please call start_lsp first.");
    }

    await this.openDocument(filePath);
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const uri = `file://${absolutePath}`;
    
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position
    };
    
    const result = await this.sendRequest<any>("textDocument/hover", params);
    return result;
  }

  /**
   * 获取代码补全
   */
  async getCompletion(filePath: string, position: Position): Promise<any[]> {
    if (!this.initialized) {
      throw new Error("LSP client not initialized. Please call start_lsp first.");
    }

    await this.openDocument(filePath);
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const uri = `file://${absolutePath}`;
    
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position
    };
    
    const result = await this.sendRequest<any>("textDocument/completion", params);
    
    if (Array.isArray(result)) {
      return result;
    } else if (result?.items && Array.isArray(result.items)) {
      return result.items;
    }
    
    return [];
  }

  /**
   * 获取代码操作
   */
  async getCodeActions(filePath: string, range: Range): Promise<any[]> {
    if (!this.initialized) {
      throw new Error("LSP client not initialized. Please call start_lsp first.");
    }

    await this.openDocument(filePath);
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const uri = `file://${absolutePath}`;
    
    const params = {
      textDocument: { uri },
      range,
      context: {
        diagnostics: []
      }
    };
    
    const result = await this.sendRequest<any>("textDocument/codeAction", params);
    
    if (Array.isArray(result)) {
      return result;
    }
    
    return [];
  }

  /**
   * 获取诊断信息
   */
  async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const uri = `file://${absolutePath}`;
    
    // 确保文档已打开以触发诊断
    await this.openDocument(filePath);
    
    // 给 LSP 服务器更多时间来处理文件并发送诊断
    // TypeScript Language Server 可能需要更长时间来处理复杂的文件
    const maxWaitTime = 10000; // 10秒最大等待时间
    const checkInterval = 200; // 每200ms检查一次
    
    console.log(`Waiting for diagnostics for ${uri} (max ${maxWaitTime}ms)...`);
    
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      // 检查是否已经收到了诊断信息
      const diagnostics = this.documentDiagnostics.get(uri);
      if (diagnostics !== undefined && diagnostics.length > 0) {
        console.log(`Received ${diagnostics.length} diagnostics for ${uri}`);
        return diagnostics;
      }
      
      // 等待一小段时间再检查
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    // 如果超时了，返回空数组（可能没有错误，或者服务器还没处理完）
    console.warn(`Warning: Timeout waiting for diagnostics for ${uri}`);
    console.log(`Current diagnostics cache:`, Array.from(this.documentDiagnostics.entries()));
    return this.documentDiagnostics.get(uri) || [];
  }

  /**
   * 获取所有诊断信息
   */
  getAllDiagnostics(): Map<string, Diagnostic[]> {
    return new Map(this.documentDiagnostics);
  }

  /**
   * 检查文档是否已打开
   */
  isDocumentOpen(uri: string): boolean {
    return this.openedDocuments.has(uri);
  }

  /**
   * 检查 LSP 服务器是否正在运行
   */
  isRunning(): boolean {
    return this.initialized && this.childProcess !== null;
  }

  /**
   * 重启 LSP 服务器
   */
  async restart(): Promise<void> {
    if (this.initialized) {
      try {
        await this.shutdown();
      } catch (error) {
        console.warn("Error shutting down LSP server during restart:", error);
      }
    }

    if (this.childProcess && !this.childProcess.killed) {
      try {
        this.childProcess.kill();
        console.log("Killed existing LSP process");
      } catch (error) {
        console.error("Error killing LSP process:", error);
      }
    }

    // 重置状态
    this.buffer = "";
    this.messageQueue = [];
    this.nextId = 1;
    this.responsePromises.clear();
    this.initialized = false;
    this.openedDocuments.clear();
    this.documentVersions.clear();
    this.processingQueue = false;
    this.documentDiagnostics.clear();

    // 启动新进程
    this.startProcess();
    await this.initialize();
  }

  /**
   * 关闭 LSP 服务器
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      console.log("Shutting down LSP connection...");

      // 关闭所有打开的文档
      for (const uri of this.openedDocuments) {
        try {
          this.sendNotification("textDocument/didClose", {
            textDocument: { uri }
          });
        } catch (error) {
          console.warn(`Error closing document ${uri}:`, error);
        }
      }

      await this.sendRequest("shutdown");
      this.sendNotification("exit");
      this.initialized = false;
      this.openedDocuments.clear();
      console.log("LSP connection shut down successfully");
    } catch (error) {
      console.error("Error shutting down LSP connection:", error);
    }
  }

  /**
   * 发送退出通知
   */
  public exit(): void {
    this.sendNotification("exit");
  }

  /**
   * 获取文档诊断信息
   */
  public getDocumentDiagnostics(uri: string): Diagnostic[] | undefined {
    return this.documentDiagnostics.get(uri);
  }

  /**
   * 获取补全
   */
  public async getCompletions(filePath: string, position: Position): Promise<any> {
    return this.sendRequest("textDocument/completion", {
      textDocument: { uri: filePath },
      position
    });
  }

  /**
   * 获取定义
   */
  public async getDefinition(filePath: string, position: Position): Promise<any> {
    return this.sendRequest("textDocument/definition", {
      textDocument: { uri: filePath },
      position
    });
  }

  /**
   * 获取引用
   */
  public async getReferences(filePath: string, position: Position): Promise<any> {
    return this.sendRequest("textDocument/references", {
      textDocument: { uri: filePath },
      position,
      context: { includeDeclaration: true }
    });
  }

  /**
   * 获取文档符号
   */
  public async getDocumentSymbols(filePath: string): Promise<any> {
    return this.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri: filePath }
    });
  }

  /**
   * 获取工作区符号
   */
  public async getWorkspaceSymbols(query: string): Promise<any> {
    return this.sendRequest("workspace/symbol", {
      query
    });
  }
}

/**
 * LSP 客户端管理器（支持多实例）
 */
export class LspClientManager {
  private static clients: Map<string, LspClient> = new Map();

  /**
   * 获取或创建 LSP 客户端实例
   */
  static async getClient(rootDir: string, config?: LspClientConfig): Promise<LspClient> {
    const normalizedRootDir = path.resolve(rootDir);
    
    if (!this.clients.has(normalizedRootDir)) {
      if (!config) {
        throw new Error('LSP client configuration is required for first initialization');
      }
      const client = new LspClient(config);
      await client.initialize();
      this.clients.set(normalizedRootDir, client);
    }
    
    return this.clients.get(normalizedRootDir)!;
  }

  /**
   * 重启指定根目录的 LSP 客户端
   */
  static async restartClient(rootDir: string, config?: LspClientConfig): Promise<LspClient> {
    const normalizedRootDir = path.resolve(rootDir);
    
    if (this.clients.has(normalizedRootDir)) {
      const client = this.clients.get(normalizedRootDir)!;
      await client.shutdown();
      this.clients.delete(normalizedRootDir);
    }
    
    if (!config) {
      throw new Error('LSP client configuration is required for restart');
    }
    
    const client = new LspClient(config);
    await client.initialize();
    this.clients.set(normalizedRootDir, client);
    return client;
  }

  /**
   * 关闭所有 LSP 客户端
   */
  static async shutdownAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.shutdown().catch(console.error);
    }
    this.clients.clear();
  }
}