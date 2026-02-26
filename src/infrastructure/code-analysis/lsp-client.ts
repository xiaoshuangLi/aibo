/**
 * LSP (Language Server Protocol) 客户端服务 - 完整重构版本
 * 
 * 基于 typescript-language-server 的完整实现
 * 直接通过 stdio 与 LSP 服务器进程交互
 * 不依赖 MCP，提供完整的 LSP 功能支持
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * LSP 协议相关类型定义
 */
interface LSPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface Diagnostic {
  range: Range;
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
  relatedInformation?: any[];
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: number;
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface Hover {
  contents: string | { language: string; value: string } | Array<string | { language: string; value: string }>;
  range?: Range;
}

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  textEdit?: any;
  additionalTextEdits?: any[];
  commitCharacters?: string[];
}

export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  edit?: any;
  command?: any;
}

export interface SymbolInformation {
  name: string;
  kind: number;
  deprecated?: boolean;
  location: Location;
  containerName?: string;
}

export interface Definition {
  uri: string;
  range: Range;
}

export interface References {
  uri: string;
  range: Range;
}

/**
 * LSP 客户端配置
 */
export interface LspClientConfig {
  serverCommand: string;
  serverArgs?: string[];
  workingDirectory: string;
  timeout?: number;
  maxBufferSize?: number;
}

/**
 * LSP 客户端核心实现
 */
export class LspClient extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private buffer: string = '';
  private nextId: number = 1;
  private responsePromises: Map<number | string, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private initialized: boolean = false;
  private config: LspClientConfig;
  private openedDocuments: Map<string, { uri: string; version: number; text: string }> = new Map();
  private documentDiagnostics: Map<string, Diagnostic[]> = new Map();
  private messageHandlers: Map<string, (params: any) => void> = new Map();

  constructor(config: LspClientConfig) {
    super();
    this.config = {
      ...config,
      timeout: config.timeout || 30000,
      maxBufferSize: config.maxBufferSize || 50 * 1024 * 1024
    };

    // 注册默认的消息处理器
    this.registerMessageHandlers();
  }

  /**
   * 注册消息处理器
   */
  private registerMessageHandlers(): void {
    // 处理诊断信息
    this.messageHandlers.set('textDocument/publishDiagnostics', (params: any) => {
      const fileUri = params.uri;
      this.documentDiagnostics.set(fileUri, params.diagnostics || []);
      this.emit('diagnostics', { uri: fileUri, diagnostics: params.diagnostics });
    });

    // 处理日志消息
    this.messageHandlers.set('window/logMessage', (params: any) => {
      console.log(`[LSP ${params.type}] ${params.message}`);
    });

    // 处理显示消息
    this.messageHandlers.set('window/showMessage', (params: any) => {
      console.log(`[LSP MESSAGE] ${params.message}`);
    });
  }

  /**
   * 启动 LSP 服务器进程
   */
  public startProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[LSP] Starting server: ${this.config.serverCommand}`);
        console.log(`[LSP] Arguments: ${(this.config.serverArgs || []).join(' ')}`);
        console.log(`[LSP] Working directory: ${this.config.workingDirectory}`);

        this.childProcess = spawn(
          this.config.serverCommand,
          this.config.serverArgs || ['--stdio'],
          {
            cwd: this.config.workingDirectory,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
          }
        );

        // 处理 stdout（接收来自 LSP 服务器的消息）
        if (this.childProcess.stdout) {
          this.childProcess.stdout.on('data', (data: Buffer) => {
            this.handleStdoutData(data);
          });
        }

        // 处理 stderr（日志和错误）
        if (this.childProcess.stderr) {
          this.childProcess.stderr.on('data', (data: Buffer) => {
            console.error(`[LSP STDERR] ${data.toString()}`);
          });
        }

        // 处理进程错误
        this.childProcess.on('error', (err: Error) => {
          console.error(`[LSP ERROR] Failed to start process: ${err.message}`);
          reject(err);
        });

        // 处理进程退出
        this.childProcess.on('exit', (code: number | null) => {
          console.log(`[LSP] Server process exited with code ${code}`);
          this.initialized = false;
          this.emit('exit', { code });
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 处理 stdout 数据
   */
  private handleStdoutData(data: Buffer): void {
    this.buffer += data.toString('utf-8');

    while (true) {
      const headerMatch = this.buffer.match(/^Content-Length: (\d+)\r\n\r\n/);
      if (!headerMatch) {
        break;
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const headerLength = headerMatch[0].length;
      const totalLength = headerLength + contentLength;

      if (this.buffer.length < totalLength) {
        break;
      }

      try {
        const message = this.buffer.substring(headerLength, totalLength);
        this.buffer = this.buffer.substring(totalLength);
        this.processMessage(JSON.parse(message));
      } catch (error) {
        console.error(`[LSP] Failed to process message: ${error}`);
        this.buffer = this.buffer.substring(1);
      }
    }
  }

  /**
   * 处理接收到的 LSP 消息
   */
  private processMessage(message: LSPMessage): void {
    try {
      if (message.id !== undefined && message.result !== undefined) {
        // 响应消息
        const pending = this.responsePromises.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.responsePromises.delete(message.id);
          pending.resolve(message.result);
        }
      } else if (message.id !== undefined && message.error !== undefined) {
        // 错误响应
        const pending = this.responsePromises.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.responsePromises.delete(message.id);
          pending.reject(new Error(`LSP Error: ${message.error.message}`));
        }
      } else if (message.method) {
        // 来自服务器的请求或通知
        if (message.id !== undefined) {
          // 需要响应的请求
          this.handleServerRequest(message);
        } else {
          // 通知消息（无 id）
          const handler = this.messageHandlers.get(message.method);
          if (handler) {
            handler(message.params || {});
          }
        }
      }
    } catch (error) {
      console.error(`[LSP] Error processing message: ${error}`);
    }
  }

  /**
   * 处理来自服务器的请求
   */
  private handleServerRequest(message: LSPMessage): void {
    // 通常这些是像 workspace/applyEdit 这样的请求
    // 对于现在，我们只是响应 OK
    this.sendMessage({
      jsonrpc: '2.0',
      id: message.id,
      result: null
    });
  }

  /**
   * 发��消息给 LSP 服务器
   */
  private sendMessage(message: LSPMessage): void {
    if (!this.childProcess || !this.childProcess.stdin) {
      throw new Error('LSP server process is not running');
    }

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content, 'utf-8')}\r\n\r\n`;

    try {
      this.childProcess.stdin.write(header + content, 'utf-8');
    } catch (error) {
      console.error(`[LSP] Failed to send message: ${error}`);
      throw error;
    }
  }

  /**
   * 发送请求并等待响应
   */
  private async request<T = any>(method: string, params?: any): Promise<T> {
    if (!this.initialized && method !== 'initialize') {
      throw new Error('LSP server not initialized. Call initialize() first');
    }

    const id = this.nextId++;
    const message: LSPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responsePromises.delete(id);
        reject(new Error(`LSP request timeout for method: ${method}`));
      }, this.config.timeout);

      this.responsePromises.set(id, { resolve, reject, timeout });

      try {
        this.sendMessage(message);
      } catch (error) {
        clearTimeout(timeout);
        this.responsePromises.delete(id);
        reject(error);
      }
    });
  }

  /**
   * 发送通知（不需要响应的消息）
   */
  private notify(method: string, params?: any): void {
    const message: LSPMessage = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(message);
  }

  /**
   * 初始化 LSP 服务器
   */
  public async initialize(): Promise<void> {
    const response = await this.request('initialize', {
      processId: process.pid,
      rootPath: this.config.workingDirectory,
      rootUri: this.filePathToUri(this.config.workingDirectory),
      capabilities: {
        textDocument: {
          synchronization: { didSave: true },
          completion: {},
          hover: {},
          definition: {},
          references: {},
          documentSymbol: {},
          codeAction: {},
          codeLens: {},
          formatting: {},
          rangeFormatting: {},
          onTypeFormatting: {},
          rename: {},
          publishDiagnostics: { relatedInformation: true }
        },
        workspace: {
          workspaceFolders: true,
          didChangeConfiguration: true,
          symbol: {}
        }
      }
    });

    this.initialized = true;
    this.notify('initialized', {});
    console.log('[LSP] Server initialized successfully');
  }

  /**
   * 打开文档
   */
  public async openDocument(filePath: string): Promise<void> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    // 检查文件是否已打开
    if (this.openedDocuments.has(uri)) {
      console.log(`[LSP] Document already open: ${uri}`);
      return;
    }

    // 读取文件内容
    const text = fs.readFileSync(absolutePath, 'utf-8');
    const languageId = this.getLanguageId(absolutePath);

    this.notify('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version: 1,
        text
      }
    });

    this.openedDocuments.set(uri, {
      uri,
      version: 1,
      text
    });

    console.log(`[LSP] Document opened: ${uri}`);
  }

  /**
   * 更新文档内容（发送 didChange 通知）
   */
  public async updateDocument(filePath: string, newText: string): Promise<void> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    const existing = this.openedDocuments.get(uri);
    if (!existing) {
      throw new Error(`Document not open: ${filePath}. Call openDocument first.`);
    }

    const newVersion = existing.version + 1;

    this.notify('textDocument/didChange', {
      textDocument: { uri, version: newVersion },
      contentChanges: [{ text: newText }]
    });

    this.openedDocuments.set(uri, {
      uri,
      version: newVersion,
      text: newText
    });

    console.log(`[LSP] Document updated: ${uri}`);
  }

  /**
   * 关闭文档
   */
  public async closeDocument(filePath: string): Promise<void> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    if (!this.openedDocuments.has(uri)) {
      console.log(`[LSP] Document not open: ${uri}`);
      return;
    }

    this.notify('textDocument/didClose', {
      textDocument: { uri }
    });

    this.openedDocuments.delete(uri);
    this.documentDiagnostics.delete(uri);

    console.log(`[LSP] Document closed: ${uri}`);
  }

  /**
   * 获取悬停信息
   */
  public async getHover(filePath: string, position: Position): Promise<Hover | null> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    return this.request('textDocument/hover', {
      textDocument: { uri },
      position
    });
  }

  /**
   * 获取代码补全
   */
  public async getCompletion(filePath: string, position: Position): Promise<CompletionItem[]> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    const result = await this.request('textDocument/completion', {
      textDocument: { uri },
      position
    });

    if (Array.isArray(result)) {
      return result;
    } else if (result && result.items) {
      return result.items;
    }

    return [];
  }

  /**
   * 获取代码操作
   */
  public async getCodeActions(filePath: string, range: Range): Promise<CodeAction[]> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    const result = await this.request('textDocument/codeAction', {
      textDocument: { uri },
      range,
      context: { diagnostics: this.documentDiagnostics.get(uri) || [] }
    });

    return result || [];
  }

  /**
   * 获取定义
   */
  public async getDefinition(filePath: string, position: Position): Promise<Definition[]> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    const result = await this.request('textDocument/definition', {
      textDocument: { uri },
      position
    });

    if (Array.isArray(result)) {
      return result;
    } else if (result) {
      return [result];
    }

    return [];
  }

  /**
   * 获取引用
   */
  public async getReferences(filePath: string, position: Position): Promise<References[]> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    const result = await this.request('textDocument/references', {
      textDocument: { uri },
      position,
      context: { includeDeclaration: true }
    });

    return result || [];
  }

  /**
   * 获取诊断信息
   */
  public getDiagnostics(filePath: string): Diagnostic[] {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);
    return this.documentDiagnostics.get(uri) || [];
  }

  /**
   * 获取所有诊断信息
   */
  public getAllDiagnostics(): Map<string, Diagnostic[]> {
    return new Map(this.documentDiagnostics);
  }

  /**
   * 获取文档符号
   */
  public async getDocumentSymbols(filePath: string): Promise<SymbolInformation[]> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    const result = await this.request('textDocument/documentSymbol', {
      textDocument: { uri }
    });

    return result || [];
  }

  /**
   * 格式化文档
   */
  public async formatDocument(filePath: string): Promise<any[]> {
    const absolutePath = this.resolveFilePath(filePath);
    const uri = this.filePathToUri(absolutePath);

    const result = await this.request('textDocument/formatting', {
      textDocument: { uri },
      options: {
        tabSize: 2,
        insertSpaces: true,
        trimTrailingWhitespace: true,
        insertFinalNewline: true
      }
    });

    return result || [];
  }

  /**
   * 获取工作区符号
   */
  public async getWorkspaceSymbols(query: string): Promise<SymbolInformation[]> {
    const result = await this.request('workspace/symbol', { query });
    return result || [];
  }

  /**
   * 关闭 LSP 服务器
   */
  public async shutdown(): Promise<void> {
    try {
      await this.request('shutdown');
      this.notify('exit');

      if (this.childProcess) {
        this.childProcess.kill();
      }

      this.initialized = false;
      console.log('[LSP] Server shutdown successfully');
    } catch (error) {
      console.error(`[LSP] Error during shutdown: ${error}`);
      if (this.childProcess) {
        this.childProcess.kill(9);
      }
    }
  }

  /**
   * 工具方法：将文件路径转换为 URI
   */
  private filePathToUri(filePath: string): string {
    const normalized = path.normalize(filePath).replace(/\\/g, '/');
    return `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
  }

  /**
   * 工具方法：解析文件路径
   */
  private resolveFilePath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.join(this.config.workingDirectory, filePath);
  }

  /**
   * 工具方法：根据文件扩展名获取语言 ID
   */
  private getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.json': 'json',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.sh': 'shellscript'
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * 检查服务器是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 检查服务器是否正在运行
   */
  public isRunning(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }
}

/**
 * LSP 客户端管理器 - 单例模式，管理全局客户端实例
 */
export class LspClientManager {
  private static clients: Map<string, LspClient> = new Map();

  /**
   * 获取或创建客户端
   */
  static async getClient(
    workingDirectory: string,
    config?: Partial<LspClientConfig>
  ): Promise<LspClient> {
    const key = path.resolve(workingDirectory);

    if (!this.clients.has(key)) {
      const fullConfig: LspClientConfig = {
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: key,
        timeout: 30000,
        maxBufferSize: 50 * 1024 * 1024,
        ...config
      };

      const client = new LspClient(fullConfig);
      await client.startProcess();
      await client.initialize();

      this.clients.set(key, client);
    }

    return this.clients.get(key)!;
  }

  /**
   * 重启客户端
   */
  static async restartClient(
    workingDirectory: string,
    config?: Partial<LspClientConfig>
  ): Promise<LspClient> {
    const key = path.resolve(workingDirectory);

    const existingClient = this.clients.get(key);
    if (existingClient) {
      try {
        await existingClient.shutdown();
      } catch (error) {
        console.error(`[LSP] Error shutting down existing client: ${error}`);
      }
    }

    this.clients.delete(key);
    return this.getClient(workingDirectory, config);
  }

  /**
   * 获取所有客户端
   */
  static getAllClients(): Map<string, LspClient> {
    return new Map(this.clients);
  }

  /**
   * 关闭所有客户端
   */
  static async shutdownAll(): Promise<void> {
    for (const [, client] of this.clients) {
      try {
        await client.shutdown();
      } catch (error) {
        console.error(`[LSP] Error shutting down client: ${error}`);
      }
    }
    this.clients.clear();
  }

  /**
   * 删除特定客户端
   */
  static async removeClient(workingDirectory: string): Promise<void> {
    const key = path.resolve(workingDirectory);
    const client = this.clients.get(key);

    if (client) {
      try {
        await client.shutdown();
      } catch (error) {
        console.error(`[LSP] Error shutting down client: ${error}`);
      }
      this.clients.delete(key);
    }
  }
}