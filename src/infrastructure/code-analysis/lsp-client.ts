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

/** Maximum time (ms) to wait for a graceful LSP shutdown response before force-killing. */
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 3000;

/**
 * LSP 客户端核心实现
 */
export class LspClient extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  /** Raw-byte accumulation buffer for the LSP framing layer. */
  private bufferBytes: Buffer = Buffer.alloc(0);
  private nextId: number = 1;
  private responsePromises: Map<number | string, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private initialized: boolean = false;
  /** True once the child process has emitted 'exit' or 'error', regardless of who caused it. */
  private processDead: boolean = false;
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
   *
   * Waits one event-loop tick (setImmediate) before resolving so that a
   * synchronous spawn 'error' event (e.g. binary not found) can be caught
   * and turned into a rejection rather than being swallowed.
   */
  public startProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

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

        // 处理进程错误（binary 不存在等异步错误）
        this.childProcess.on('error', (err: Error) => {
          console.error(`[LSP ERROR] Failed to start process: ${err.message}`);
          this.processDead = true;
          this.initialized = false;
          this.rejectAllPending(err);
          settle(err);
          this.emit('exit', { code: null });
        });

        // 处理进程退出
        this.childProcess.on('exit', (code: number | null) => {
          console.log(`[LSP] Server process exited with code ${code}`);
          this.processDead = true;
          this.initialized = false;
          this.openedDocuments.clear();
          this.documentDiagnostics.clear();
          this.rejectAllPending(new Error(`LSP server process exited with code ${code}`));
          this.emit('exit', { code });
        });

        // Give the event loop one tick so that a synchronous 'error' emission
        // (e.g. ENOENT for the binary) is caught above before we resolve.
        setImmediate(() => settle());
      } catch (error) {
        settle(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * 处理 stdout 数据
   *
   * Bug fix: the LSP Content-Length header is a BYTE count (UTF-8), but
   * JavaScript strings use UTF-16 code-unit indices.  If the message body
   * contains non-ASCII characters (multi-byte in UTF-8, single unit in JS
   * strings) the old string-based slicing was off by the number of extra
   * bytes, silently corrupting the framing for all subsequent messages.
   *
   * Fix: accumulate raw bytes and use byte-offset arithmetic throughout.
   * Only convert to a JS string after isolating the exact body bytes.
   *
   * Additionally, the regex used to require Content-Length to be the only
   * header.  typescript-language-server also sends a Content-Type header;
   * we now find the end of the entire header block via the \r\n\r\n
   * byte boundary instead.
   */
  private handleStdoutData(data: Buffer): void {
    this.bufferBytes = Buffer.concat([this.bufferBytes, data]);

    // Prevent unbounded buffer growth
    if (this.bufferBytes.length > this.config.maxBufferSize!) {
      console.error(`[LSP] Buffer overflow (${this.bufferBytes.length} bytes), resetting buffer`);
      this.bufferBytes = Buffer.alloc(0);
      return;
    }

    while (true) {
      // Locate the end of the HTTP-style header block (\r\n\r\n).
      const headerEnd = this.bufferBytes.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      // Parse headers as ASCII (they are always ASCII in LSP).
      const headerStr = this.bufferBytes.slice(0, headerEnd).toString('ascii');
      const contentLengthMatch = headerStr.match(/Content-Length: (\d+)/);
      if (!contentLengthMatch) {
        // Malformed headers — skip to next potential message.
        console.error('[LSP] Missing Content-Length header, discarding buffer');
        this.bufferBytes = Buffer.alloc(0);
        break;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      // headerEnd points to the start of \r\n\r\n; add 4 bytes to skip it.
      const bodyStart = headerEnd + 4;
      const totalLength = bodyStart + contentLength;

      if (this.bufferBytes.length < totalLength) break;

      // Extract exactly contentLength bytes for the body, then decode as UTF-8.
      const messageBytes = this.bufferBytes.slice(bodyStart, totalLength);
      // Advance the byte buffer before parsing so a JSON error doesn't stall framing.
      this.bufferBytes = this.bufferBytes.slice(totalLength);

      try {
        this.processMessage(JSON.parse(messageBytes.toString('utf-8')));
      } catch (error) {
        console.error(`[LSP] Failed to process message: ${error}`);
      }
    }
  }

  /**
   * 处理接收到的 LSP 消息
   */
  private processMessage(message: LSPMessage): void {
    try {
      if (message.id !== undefined && 'result' in message && !('error' in message)) {
        // 成功响应（result 可以是 null）
        const pending = this.responsePromises.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.responsePromises.delete(message.id);
          pending.resolve(message.result);
        }
      } else if (message.id !== undefined && 'error' in message) {
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
   *
   * The internal timeout is unref()'d so it does NOT keep the Node.js event
   * loop alive.  This prevents Jest (and any long-running process) from
   * hanging after all user-visible work is complete.
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
      // unref() so this timer does NOT keep the Node.js event loop alive.
      const timeout = setTimeout(() => {
        this.responsePromises.delete(id);
        reject(new Error(`LSP request timeout for method: ${method}`));
      }, this.config.timeout).unref();

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
   * 拒绝所有待处理的请求（进程崩溃或退出时使用）
   */
  private rejectAllPending(reason: Error): void {
    for (const [id, pending] of this.responsePromises) {
      clearTimeout(pending.timeout);
      pending.reject(reason);
      this.responsePromises.delete(id);
    }
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
   *
   * Tries a graceful LSP shutdown handshake with a short (3 s) timeout, then
   * unconditionally kills the child process.  This avoids blocking for the
   * full config.timeout (up to 60 s) when the server is slow or already dead.
   */
  public async shutdown(): Promise<void> {
    // Reject all in-flight requests immediately so callers don't wait.
    this.rejectAllPending(new Error('LSP client shutting down'));

    const proc = this.childProcess;
    this.initialized = false;
    this.processDead = true;
    this.childProcess = null;

    if (!proc) {
      return;
    }

    // Attempt a graceful LSP shutdown with a hard 3-second cap.
    try {
      // Temporarily restore state so request() and sendMessage() work.
      this.childProcess = proc;
      this.initialized = true;

      await Promise.race([
        this.request('shutdown').then(() => {
          try { this.notify('exit'); } catch (_) { /* ignore */ }
        }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('LSP shutdown timeout')), GRACEFUL_SHUTDOWN_TIMEOUT_MS).unref()
        )
      ]);
    } catch (_) {
      // Graceful shutdown failed or timed out — fall through to force-kill.
    } finally {
      this.childProcess = null;
      this.initialized = false;
    }

    // Kill the process regardless.
    if (!proc.killed) {
      try { proc.kill(); } catch (_) { /* ignore */ }
    }

    console.log('[LSP] Server shutdown successfully');
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
   *
   * Uses the internal processDead flag rather than ChildProcess.killed because
   * ChildProcess.killed is only true when *we* called kill() — a process that
   * exited on its own keeps killed=false.
   */
  public isRunning(): boolean {
    return !this.processDead && this.childProcess !== null;
  }
}

/**
 * LSP 客户端管理器 - 单例模式，管理全局客户端实例
 */
export class LspClientManager {
  private static clients: Map<string, LspClient> = new Map();
  private static pending: Map<string, Promise<LspClient>> = new Map();

  /**
   * 获取或创建客户端
   *
   * If the cached client for the given directory is no longer running (process
   * died unexpectedly) it is evicted and a fresh client is started.
   */
  static async getClient(
    workingDirectory: string,
    config?: Partial<LspClientConfig>
  ): Promise<LspClient> {
    const key = path.resolve(workingDirectory);

    const existing = this.clients.get(key);
    if (existing) {
      if (existing.isRunning()) {
        return existing;
      }
      // Dead client — remove it so we start fresh below.
      this.clients.delete(key);
    }

    // Avoid duplicate initialization when called concurrently
    const inFlight = this.pending.get(key);
    if (inFlight) {
      return inFlight;
    }

    const initPromise = (async () => {
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
      this.pending.delete(key);

      // Auto-evict this client when the underlying process exits unexpectedly.
      client.once('exit', () => {
        if (this.clients.get(key) === client) {
          this.clients.delete(key);
        }
      });

      return client;
    })();

    this.pending.set(key, initPromise);

    try {
      return await initPromise;
    } catch (error) {
      this.pending.delete(key);
      throw error;
    }
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
    this.pending.delete(key);
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
    this.pending.clear();
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
    this.pending.delete(key);
  }
}