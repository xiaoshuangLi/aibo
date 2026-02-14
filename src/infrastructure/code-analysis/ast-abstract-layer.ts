/**
 * AST抽象层
 * 
 * 中文名称：AST抽象层
 * 
 * 预期行为：
 * - 提供统一的AST接口，屏蔽底层实现细节
 * - 支持LSP和Tree-sitter两种后端
 * - 提供高效的代码结构查询和操作
 * - 实现智能上下文提取和优化
 * - 支持增量式更新和缓存
 * 
 * 行为分支：
 * 1. 双后端支持：根据可用性自动选择LSP或Tree-sitter
 * 2. 智能降级：当首选后端不可用时自动切换到备选后端
 * 3. 上下文优化：提取最小必要上下文，减少token消耗
 * 4. 缓存机制：缓存AST和查询结果以提高性能
 * 5. 增量更新：只在文件修改时重新解析
 * 
 * @class AstAbstractLayer
 */
import path from 'path';
import { LspTool } from '@/infrastructure/code-analysis/lsp-tool';
import { TreeSitterTool } from '@/infrastructure/code-analysis/tree-sitter-tool';
import { SymbolTable, SymbolInfo } from '@/infrastructure/code-analysis/symbol-table';

/**
 * AST抽象层配置
 */
export interface AstAbstractLayerConfig {
  /** 工作目录 */
  workingDirectory: string;
  /** LSP工具实例 */
  lspTool: LspTool;
  /** Tree-sitter工具实例 */
  treeSitterTool: TreeSitterTool;
  /** 符号表实例 */
  symbolTable: SymbolTable;
}

/**
 * 上下文优化选项
 */
export interface ContextOptimizationOptions {
  /** 最大token限制 */
  maxTokens?: number;
  /** 是否只包含公共API */
  publicOnly?: boolean;
  /** 是否包含文档字符串 */
  includeDocumentation?: boolean;
  /** 是否包含类型信息 */
  includeTypeInformation?: boolean;
}

/**
 * 优化后的上下文
 */
export interface OptimizedContext {
  /** 优化后的代码上下文 */
  context: string;
  /** 原始token数量 */
  originalTokens: number;
  /** 优化后token数量 */
  optimizedTokens: number;
  /** 节省比例 */
  savingsPercentage: number;
  /** 使用的技术 */
  technologiesUsed: ('lsp' | 'tree-sitter' | 'symbol-table')[];
}

/**
 * AST抽象层类
 * 
 * 中文名称：AST抽象层类
 * 
 * 提供统一的AST接口和上下文优化功能
 */
export class AstAbstractLayer {
  private config: AstAbstractLayerConfig;
  private cache: Map<string, any> = new Map();

  /**
   * 创建AST抽象层实例
   * @param config 配置
   */
  constructor(config: AstAbstractLayerConfig) {
    this.config = config;
  }

  /**
   * 获取符号定义
   * @param filePath 文件路径
   * @param line 行号
   * @param character 字符位置
   * @returns 定义信息
   */
  async getDefinition(filePath: string, line: number, character: number): Promise<any> {
    const cacheKey = `definition:${filePath}:${line}:${character}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let result;
    const technologiesUsed: ('lsp' | 'tree-sitter' | 'symbol-table')[] = [];

    try {
      // 优先使用LSP
      if (this.config.lspTool.isSupportedFile(filePath)) {
        result = await this.config.lspTool.getDefinition(filePath, line, character);
        technologiesUsed.push('lsp');
      }
    } catch (error) {
      console.warn('LSP definition failed, falling back to Tree-sitter:', error);
    }

    if (!result && this.config.treeSitterTool.isSupportedFile(filePath)) {
      // 降级到Tree-sitter
      try {
        const sourceCode = await this.readFile(filePath);
        const functions = await this.config.treeSitterTool.queryFunctions(filePath);
        // 简化实现，实际需要更精确的位置匹配
        result = functions.find(func => 
          func.startPosition.row <= line && func.endPosition.row >= line
        );
        technologiesUsed.push('tree-sitter');
      } catch (error) {
        console.error('Tree-sitter definition failed:', error);
      }
    }

    if (!result && this.config.symbolTable.isBuiltTable()) {
      // 最后使用符号表
      try {
        const symbols = this.config.symbolTable.getFileSymbols(filePath);
        result = symbols.find(symbol => 
          symbol.location.line === line
        );
        technologiesUsed.push('symbol-table');
      } catch (error) {
        console.error('Symbol table definition failed:', error);
      }
    }

    if (result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * 查找符号引用
   * @param filePath 文件路径
   * @param line 行号
   * @param character 字符位置
   * @returns 引用列表
   */
  async findReferences(filePath: string, line: number, character: number): Promise<any> {
    const cacheKey = `references:${filePath}:${line}:${character}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let result;
    const technologiesUsed: ('lsp' | 'tree-sitter' | 'symbol-table')[] = [];

    try {
      // 优先使用LSP
      if (this.config.lspTool.isSupportedFile(filePath)) {
        result = await this.config.lspTool.findReferences(filePath, line, character);
        technologiesUsed.push('lsp');
      }
    } catch (error) {
      console.warn('LSP references failed, falling back to symbol table:', error);
    }

    if (!result && this.config.symbolTable.isBuiltTable()) {
      // 使用符号表
      try {
        const symbols = this.config.symbolTable.getFileSymbols(filePath);
        const symbol = symbols.find(s => s.location.line === line);
        if (symbol) {
          result = symbol.references;
          technologiesUsed.push('symbol-table');
        }
      } catch (error) {
        console.error('Symbol table references failed:', error);
      }
    }

    if (result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * 获取悬停信息
   * @param filePath 文件路径
   * @param line 行号
   * @param character 字符位置
   * @returns 悬停信息
   */
  async getHover(filePath: string, line: number, character: number): Promise<any> {
    const cacheKey = `hover:${filePath}:${line}:${character}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let result;
    const technologiesUsed: ('lsp' | 'tree-sitter' | 'symbol-table')[] = [];

    try {
      // 优先使用LSP
      if (this.config.lspTool.isSupportedFile(filePath)) {
        result = await this.config.lspTool.getHover(filePath, line, character);
        technologiesUsed.push('lsp');
      }
    } catch (error) {
      console.warn('LSP hover failed:', error);
    }

    if (result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * 读取文件内容
   * @param filePath 文件路径
   * @returns 文件内容
   */
  private async readFile(filePath: string): Promise<string> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    const fs = await import('fs').then(m => m.promises);
    return fs.readFile(absolutePath, 'utf8');
  }

  /**
   * 优化代码上下文
   * @param filePath 文件路径
   * @param options 优化选项
   * @returns 优化后的上下文
   */
  async optimizeContext(filePath: string, options: ContextOptimizationOptions = {}): Promise<OptimizedContext> {
    const cacheKey = `optimize:${filePath}:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const sourceCode = await this.readFile(filePath);
    const originalTokens = this.estimateTokenCount(sourceCode);
    
    let optimizedContext = sourceCode;
    const technologiesUsed: ('lsp' | 'tree-sitter' | 'symbol-table')[] = [];

    // 如果只包含公共API
    if (options.publicOnly) {
      if (this.config.treeSitterTool.isSupportedFile(filePath)) {
        try {
          const publicApi = await this.config.treeSitterTool.extractPublicApi(filePath);
          optimizedContext = publicApi.map(api => api.text).join('\n\n');
          technologiesUsed.push('tree-sitter');
        } catch (error) {
          console.warn('Tree-sitter public API extraction failed:', error);
        }
      }
    }

    // 移除注释和空白（如果需要进一步优化）
    if (optimizedContext.length > (options.maxTokens || Infinity) * 4) { // 粗略估计
      optimizedContext = this.removeCommentsAndWhitespace(optimizedContext);
    }

    const optimizedTokens = this.estimateTokenCount(optimizedContext);
    const savingsPercentage = originalTokens > 0 ? 
      Math.round((1 - optimizedTokens / originalTokens) * 100) : 0;

    const result: OptimizedContext = {
      context: optimizedContext,
      originalTokens,
      optimizedTokens,
      savingsPercentage,
      technologiesUsed
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * 估算token数量（简化实现）
   * @param text 文本
   * @returns token数量
   */
  private estimateTokenCount(text: string): number {
    // 简化实现，实际应用中可以使用更精确的tokenizer
    return Math.ceil(text.length / 4);
  }

  /**
   * 移除注释和多余空白
   * @param code 代码
   * @returns 清理后的代码
   */
  private removeCommentsAndWhitespace(code: string): string {
    // 移除单行注释
    let result = code.replace(/\/\/.*$/gm, '');
    // 移除多行注释
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    // 移除多余空白行
    result = result.replace(/\n\s*\n/g, '\n\n');
    // 移除行首尾空白
    result = result.replace(/^\s+|\s+$/gm, '');
    return result;
  }

  /**
   * 获取文件中的所有符号
   * @param filePath 文件路径
   * @returns 符号列表
   */
  async getFileSymbols(filePath: string): Promise<SymbolInfo[]> {
    if (this.config.symbolTable.isBuiltTable()) {
      return this.config.symbolTable.getFileSymbols(filePath);
    }

    // 构建符号表
    await this.config.symbolTable.build([filePath]);
    return this.config.symbolTable.getFileSymbols(filePath);
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 更新文件缓存
   * @param filePath 文件路径
   */
  invalidateFileCache(filePath: string): void {
    // 清除与该文件相关的所有缓存
    for (const key of this.cache.keys()) {
      if (key.includes(filePath)) {
        this.cache.delete(key);
      }
    }
  }
}