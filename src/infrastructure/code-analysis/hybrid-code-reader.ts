/**
 * 混合代码读取器
 * 
 * 中文名称：混合代码读取器
 * 
 * 预期行为：
 * - 集成LSP、Tree-sitter和符号表技术
 * - 提供统一的代码读取接口
 * - 实现智能上下文选择和优化
 * - 支持缓存和性能优化
 * - 提供完整的错误处理和降级方案
 * 
 * 行为分支：
 * 1. 正常操作：使用最优技术栈提供高效代码分析
 * 2. 技术降级：当首选技术不可用时自动切换到备选方案
 * 3. 缓存命中：直接返回缓存结果，避免重复计算
 * 4. 错误处理：优雅处理各种错误情况并提供有用信息
 * 5. 资源管理：正确清理和释放系统资源
 * 
 * @class HybridCodeReader
 */
import path from 'path';
import { LspTool, LspToolConfig } from '@/infrastructure/code-analysis/lsp-tool';
import { TreeSitterTool, TreeSitterToolConfig } from '@/infrastructure/code-analysis/tree-sitter-tool';
import { SymbolTable, SymbolTableConfig } from '@/infrastructure/code-analysis/symbol-table';
import { AstAbstractLayer, AstAbstractLayerConfig } from '@/infrastructure/code-analysis/ast-abstract-layer';
import { CacheManager, CacheConfig } from '@/infrastructure/code-analysis/cache-manager';
import { ContextSelector, ContextSelectorConfig, ContextRequestType } from '@/infrastructure/code-analysis/context-selector';

/**
 * 混合代码读取器配置
 */
export interface HybridCodeReaderConfig {
  /** 工作目录 */
  workingDirectory: string;
  /** LSP工具配置 */
  lspToolConfig?: Partial<LspToolConfig>;
  /** Tree-sitter工具配置 */
  treeSitterToolConfig?: Partial<TreeSitterToolConfig>;
  /** 缓存配置 */
  cacheConfig?: Partial<CacheConfig>;
  /** 默认最大token数 */
  defaultMaxTokens?: number;
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
 * 混合代码读取器选项
 */
export interface HybridCodeReaderOptions {
  /** 文件路径 */
  filePath: string;
  /** 请求类型 */
  requestType: ContextRequestType;
  /** 符号名称（可选） */
  symbolName?: string;
  /** 位置信息（可选） */
  position?: { line: number; character: number };
  /** Token限制 */
  maxTokens?: number;
}

/**
 * 混合代码读取器类
 * 
 * 中文名称：混合代码读取器类
 * 
 * 提供统一的混合代码读取接口
 */
export class HybridCodeReader {
  private config: HybridCodeReaderConfig;
  private lspTool: LspTool;
  private treeSitterTool: TreeSitterTool;
  private symbolTable: SymbolTable;
  private astLayer: AstAbstractLayer;
  private cacheManager: CacheManager;
  private contextSelector: ContextSelector;

  /**
   * 创建混合代码读取器实例
   * @param config 配置
   */
  constructor(config: HybridCodeReaderConfig) {
    this.config = {
      ...config,
      defaultMaxTokens: config.defaultMaxTokens || 2000
    };

    // 初始化各个组件
    this.lspTool = new LspTool({
      workingDirectory: this.config.workingDirectory,
      ...(this.config.lspToolConfig || {})
    });

    this.treeSitterTool = new TreeSitterTool({
      workingDirectory: this.config.workingDirectory,
      ...(this.config.treeSitterToolConfig || {})
    });

    this.cacheManager = new CacheManager({
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      cacheDirectory: path.join(this.config.workingDirectory, '.cache', 'code-analysis'),
      defaultTtl: 30 * 60 * 1000, // 30分钟
      enableFileCache: true,
      ...(this.config.cacheConfig || {})
    });

    this.symbolTable = new SymbolTable({
      workingDirectory: this.config.workingDirectory,
      lspTool: this.lspTool,
      treeSitterTool: this.treeSitterTool
    });

    this.astLayer = new AstAbstractLayer({
      workingDirectory: this.config.workingDirectory,
      lspTool: this.lspTool,
      treeSitterTool: this.treeSitterTool,
      symbolTable: this.symbolTable
    });

    this.contextSelector = new ContextSelector({
      astLayer: this.astLayer,
      cacheManager: this.cacheManager,
      defaultMaxTokens: this.config.defaultMaxTokens || 2000
    });
  }

  /**
   * 获取优化的代码上下文
   * @param options 读取选项
   * @returns 优化后的上下文
   */
  async getOptimizedContext(options: HybridCodeReaderOptions): Promise<OptimizedContext> {
    const absolutePath = path.isAbsolute(options.filePath) ? 
      options.filePath : 
      path.join(this.config.workingDirectory, options.filePath);

    return this.contextSelector.selectContext(
      absolutePath,
      options.requestType,
      {
        line: options.position?.line,
        character: options.position?.character,
        maxTokens: options.maxTokens,
        symbolName: options.symbolName
      }
    );
  }

  /**
   * 获取符号定义
   * @param filePath 文件路径
   * @param symbolName 符号名称
   * @returns 定义信息
   */
  async getSymbolDefinition(filePath: string, symbolName: string): Promise<string> {
    const context = await this.getOptimizedContext({
      filePath,
      requestType: 'definition',
      symbolName
    });
    return context.context;
  }

  /**
   * 获取符号引用
   * @param filePath 文件路径
   * @param position 位置
   * @returns 引用列表
   */
  async findReferences(filePath: string, position: { line: number; character: number }): Promise<string[]> {
    const context = await this.getOptimizedContext({
      filePath,
      requestType: 'references',
      position
    });
    // 简化处理，实际需要解析JSON
    return context.context ? [context.context] : [];
  }

  /**
   * 构建符号表
   * @param filePaths 文件路径列表
   */
  async buildSymbolTable(filePaths: string[]): Promise<void> {
    await this.symbolTable.build(filePaths);
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    await this.contextSelector.clearCache();
    this.astLayer.clearCache();
  }

  /**
   * 关闭所有资源
   */
  async shutdown(): Promise<void> {
    await this.lspTool.shutdown();
    this.treeSitterTool.cleanup();
    await this.clearCache();
  }

  /**
   * 检查文件是否支持
   * @param filePath 文件路径
   * @returns 是否支持
   */
  isSupportedFile(filePath: string): boolean {
    return this.lspTool.isSupportedFile(filePath) || this.treeSitterTool.isSupportedFile(filePath);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.contextSelector.getCacheStats();
  }
}