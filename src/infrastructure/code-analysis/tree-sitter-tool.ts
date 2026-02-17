/**
 * Tree-sitter 工具函数
 * 
 * 中文名称：Tree-sitter工具函数
 * 
 * 预期行为：
 * - 提供简化的Tree-sitter接口封装
 * - 处理常见的代码分析任务
 * - 自动管理解析器生命周期
 * - 提供错误处理和降级方案
 * 
 * @module tree-sitter-tool
 */
import fs from 'fs';
import path from 'path';
import { TreeSitterParser } from '@/infrastructure/code-analysis/tree-sitter-parser';
import { AstNodeInfo } from '@/infrastructure/code-analysis/tree-sitter-parser';

/**
 * Tree-sitter工具配置
 */
export interface TreeSitterToolConfig {
  /** 工作目录 */
  workingDirectory: string;
}

/**
 * Tree-sitter工具类
 */
export class TreeSitterTool {
  private parser: TreeSitterParser;
  private config: TreeSitterToolConfig;

  /**
   * 创建Tree-sitter工具实例
   * @param config 配置
   */
  constructor(config: TreeSitterToolConfig) {
    this.config = config;
    this.parser = new TreeSitterParser({
      workingDirectory: config.workingDirectory
    });
  }

  /**
   * 读取文件并解析为AST
   * @param filePath 文件路径
   * @returns AST树
   */
  async parseFile(filePath: string): Promise<any> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.parse(sourceCode, absolutePath);
  }

  /**
   * 查询函数定义
   * @param filePath 文件路径
   * @returns 函数定义列表
   */
  async queryFunctions(filePath: string): Promise<AstNodeInfo[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.queryFunctions(sourceCode, absolutePath);
  }

  /**
   * 查询类定义
   * @param filePath 文件路径
   * @returns 类定义列表
   */
  async queryClasses(filePath: string): Promise<AstNodeInfo[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.queryClasses(sourceCode, absolutePath);
  }

  /**
   * 查询导入语句
   * @param filePath 文件路径
   * @returns 导入语句列表
   */
  async queryImports(filePath: string): Promise<AstNodeInfo[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.queryImports(sourceCode, absolutePath);
  }

  /**
   * 查询接口定义
   * @param filePath 文件路径
   * @returns 接口定义列表
   */
  async queryInterfaces(filePath: string): Promise<AstNodeInfo[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.queryInterfaces(sourceCode, absolutePath);
  }

  /**
   * 查询类型定义
   * @param filePath 文件路径
   * @returns 类型定义列表
   */
  async queryTypeDefinitions(filePath: string): Promise<AstNodeInfo[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.queryTypeDefinitions(sourceCode, absolutePath);
  }

  /**
   * 查询变量声明
   * @param filePath 文件路径
   * @returns 变量声明列表
   */
  async queryVariables(filePath: string): Promise<AstNodeInfo[]> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.queryVariables(sourceCode, absolutePath);
  }

  /**
   * 查询依赖关系（导入和导出语句）
   * @param filePath 文件路径
   * @returns 依赖关系信息
   */
  async queryDependencies(filePath: string): Promise<{ imports: AstNodeInfo[]; exports: AstNodeInfo[] }> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf8');
    return this.parser.queryDependencies(sourceCode, absolutePath);
  }

  /**
   * 提取公共API（接口、类型、导出的函数和类）
   * @param filePath 文件路径
   * @returns 公共API列表
   */
  async extractPublicApi(filePath: string): Promise<AstNodeInfo[]> {
    const [functions, classes, interfaces, types] = await Promise.all([
      this.queryFunctions(filePath),
      this.queryClasses(filePath),
      this.queryInterfaces(filePath),
      this.queryTypeDefinitions(filePath)
    ]);

    // 这里简化处理，实际应用中需要检查是否为导出项
    return [...functions, ...classes, ...interfaces, ...types];
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.parser.cleanup();
  }

  /**
   * 检查文件是否支持Tree-sitter
   * @param filePath 文件路径
   * @returns 是否支持
   */
  isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }
}

export { AstNodeInfo };