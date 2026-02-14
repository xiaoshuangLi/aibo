/**
 * LSP服务管理器
 * 
 * 中文名称：LSP服务管理器
 * 
 * 预期行为：
 * - 根据文件扩展名自动选择合适的LSP服务器
 * - 管理多个LSP服务器实例的生命周期
 * - 提供统一的LSP接口
 * - 处理服务器启动、停止和错误恢复
 * - 缓存服务器实例以提高性能
 * 
 * 行为分支：
 * 1. 支持的语言：TypeScript/JavaScript使用typescript-language-server，其他语言可扩展
 * 2. 服务器缓存：相同工作目录的服务器实例会被缓存复用
 * 3. 错误处理：服务器启动失败时提供降级方案
 * 4. 资源管理：自动清理未使用的服务器实例
 * 5. 并发支持：支持同时处理多个LSP请求
 * 
 * @class LspServiceManager
 */
import path from 'path';
import { LspClient, LspClientConfig, Position } from '@/infrastructure/code-analysis/lsp-client';

/**
 * 支持的语言映射
 */
const LANGUAGE_SERVER_MAP: Record<string, { command: string; args?: string[] }> = {
  '.ts': { command: 'typescript-language-server', args: ['--stdio'] },
  '.tsx': { command: 'typescript-language-server', args: ['--stdio'] },
  '.js': { command: 'typescript-language-server', args: ['--stdio'] },
  '.jsx': { command: 'typescript-language-server', args: ['--stdio'] }
};

/**
 * LSP服务管理器配置
 */
export interface LspServiceManagerConfig {
  /** 工作目录 */
  workingDirectory: string;
  /** 服务器超时时间 */
  serverTimeout?: number;
}

/**
 * LSP服务管理器类
 * 
 * 中文名称：LSP服务管理器类
 * 
 * 负责管理不同语言的LSP服务器实例
 */
export class LspServiceManager {
  private config: LspServiceManagerConfig;
  private serverInstances: Map<string, LspClient> = new Map();
  private activeRequests: Set<string> = new Set();

  /**
   * 创建LSP服务管理器实例
   * @param config 配置
   */
  constructor(config: LspServiceManagerConfig) {
    this.config = {
      ...config,
      serverTimeout: config.serverTimeout || 30000
    };
  }

  /**
   * 获取文件扩展名
   * @param filePath 文件路径
   * @returns 扩展名
   */
  private getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * 获取LSP服务器配置
   * @param filePath 文件路径
   * @returns LSP服务器配置
   */
  private getServerConfig(filePath: string): LspClientConfig | null {
    const ext = this.getFileExtension(filePath);
    const serverInfo = LANGUAGE_SERVER_MAP[ext];
    
    if (!serverInfo) {
      return null;
    }

    return {
      serverCommand: serverInfo.command,
      serverArgs: serverInfo.args,
      workingDirectory: this.config.workingDirectory,
      timeout: this.config.serverTimeout
    };
  }

  /**
   * 获取或创建LSP客户端
   * @param filePath 文件路径
   * @returns LSP客户端
   */
  private async getOrCreateLspClient(filePath: string): Promise<LspClient | null> {
    const serverConfig = this.getServerConfig(filePath);
    if (!serverConfig) {
      return null;
    }

    const cacheKey = `${serverConfig.serverCommand}-${this.config.workingDirectory}`;
    
    if (this.serverInstances.has(cacheKey)) {
      return this.serverInstances.get(cacheKey)!;
    }

    try {
      const client = new LspClient(serverConfig);
      await client.start();
      this.serverInstances.set(cacheKey, client);
      return client;
    } catch (error) {
      console.error(`Failed to create LSP client for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 获取符号定义
   * @param filePath 文件路径
   * @param position 位置
   * @returns 定义信息
   */
  async getDefinition(filePath: string, position: Position): Promise<any> {
    const client = await this.getOrCreateLspClient(filePath);
    if (!client) {
      throw new Error(`No LSP server available for file: ${filePath}`);
    }

    const requestId = `${filePath}:${position.line}:${position.character}:definition`;
    if (this.activeRequests.has(requestId)) {
      throw new Error('Request already in progress');
    }

    this.activeRequests.add(requestId);
    try {
      return await client.getDefinition(filePath, position);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 查找符号引用
   * @param filePath 文件路径
   * @param position 位置
   * @returns 引用列表
   */
  async findReferences(filePath: string, position: Position): Promise<any> {
    const client = await this.getOrCreateLspClient(filePath);
    if (!client) {
      throw new Error(`No LSP server available for file: ${filePath}`);
    }

    const requestId = `${filePath}:${position.line}:${position.character}:references`;
    if (this.activeRequests.has(requestId)) {
      throw new Error('Request already in progress');
    }

    this.activeRequests.add(requestId);
    try {
      return await client.findReferences(filePath, position);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 获取悬停信息
   * @param filePath 文件路径
   * @param position 位置
   * @returns 悬停信息
   */
  async getHover(filePath: string, position: Position): Promise<any> {
    const client = await this.getOrCreateLspClient(filePath);
    if (!client) {
      throw new Error(`No LSP server available for file: ${filePath}`);
    }

    const requestId = `${filePath}:${position.line}:${position.character}:hover`;
    if (this.activeRequests.has(requestId)) {
      throw new Error('Request already in progress');
    }

    this.activeRequests.add(requestId);
    try {
      return await client.getHover(filePath, position);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 获取工作区符号
   * @param query 查询字符串
   * @returns 符号列表
   */
  async getWorkspaceSymbols(query: string): Promise<any> {
    // 使用TypeScript服务器作为默认
    const dummyPath = path.join(this.config.workingDirectory, 'dummy.ts');
    const client = await this.getOrCreateLspClient(dummyPath);
    if (!client) {
      throw new Error('No LSP server available for workspace symbols');
    }

    const requestId = `workspace:symbols:${query}`;
    if (this.activeRequests.has(requestId)) {
      throw new Error('Request already in progress');
    }

    this.activeRequests.add(requestId);
    try {
      return await client.getWorkspaceSymbols(query);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 关闭所有LSP服务器
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [key, client] of this.serverInstances) {
      shutdownPromises.push(client.shutdown().catch(error => {
        console.error(`Error shutting down LSP server ${key}:`, error);
      }));
    }
    
    await Promise.all(shutdownPromises);
    this.serverInstances.clear();
    this.activeRequests.clear();
  }

  /**
   * 检查是否支持指定文件
   * @param filePath 文件路径
   * @returns 是否支持
   */
  isSupportedFile(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return LANGUAGE_SERVER_MAP.hasOwnProperty(ext);
  }
}