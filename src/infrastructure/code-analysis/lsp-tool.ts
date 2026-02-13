/**
 * LSP工具函数
 * 
 * 中文名称：LSP工具函数
 * 
 * 预期行为：
 * - 提供简化的LSP接口封装
 * - 处理常见的代码分析任务
 * - 自动管理LSP服务器生命周期
 * - 提供错误处理和降级方案
 * 
 * @module lsp-tool
 */
import path from 'path';
import { LspServiceManager } from './lsp-service-manager';
import { Position } from './lsp-client';

/**
 * LSP工具配置
 */
export interface LspToolConfig {
  /** 工作目录 */
  workingDirectory: string;
  /** 超时时间 */
  timeout?: number;
}

/**
 * LSP工具类
 */
export class LspTool {
  private manager: LspServiceManager;
  private config: LspToolConfig;

  /**
   * 创建LSP工具实例
   * @param config 配置
   */
  constructor(config: LspToolConfig) {
    this.config = config;
    this.manager = new LspServiceManager({
      workingDirectory: config.workingDirectory,
      serverTimeout: config.timeout
    });
  }

  /**
   * 获取符号定义的简化接口
   * @param filePath 文件路径
   * @param line 行号（0-based）
   * @param character 字符位置（0-based）
   * @returns 定义信息
   */
  async getDefinition(filePath: string, line: number, character: number): Promise<any> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    return this.manager.getDefinition(absolutePath, { line, character });
  }

  /**
   * 查找符号引用的简化接口
   * @param filePath 文件路径
   * @param line 行号（0-based）
   * @param character 字符位置（0-based）
   * @returns 引用列表
   */
  async findReferences(filePath: string, line: number, character: number): Promise<any> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    return this.manager.findReferences(absolutePath, { line, character });
  }

  /**
   * 获取悬停信息的简化接口
   * @param filePath 文件路径
   * @param line 行号（0-based）
   * @param character 字符位置（0-based）
   * @returns 悬停信息
   */
  async getHover(filePath: string, line: number, character: number): Promise<any> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    return this.manager.getHover(absolutePath, { line, character });
  }

  /**
   * 获取工作区符号
   * @param query 查询字符串
   * @returns 符号列表
   */
  async getWorkspaceSymbols(query: string): Promise<any> {
    return this.manager.getWorkspaceSymbols(query);
  }

  /**
   * 关闭所有LSP服务器
   */
  async shutdown(): Promise<void> {
    await this.manager.shutdownAll();
  }

  /**
   * 检查文件是否支持LSP
   * @param filePath 文件路径
   * @returns 是否支持
   */
  isSupportedFile(filePath: string): boolean {
    return this.manager.isSupportedFile(filePath);
  }
}