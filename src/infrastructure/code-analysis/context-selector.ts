/**
 * 智能上下文选择器
 * 
 * 中文名称：智能上下文选择器
 * 
 * 预期行为：
 * - 根据请求类型智能选择最优的上下文提取策略
 * - 动态调整上下文大小以适应token限制
 * - 提供多种上下文优化策略
 * - 支持增量式上下文扩展
 * - 实现智能预取和缓存
 * 
 * 行为分支：
 * 1. 定义查询：只返回函数/类签名和文档
 * 2. 引用查询：返回所有引用位置的摘要
 * 3. 实现查询：返回完整实现，但移除注释和空白
 * 4. 全局上下文：返回项目级符号表和依赖关系
 * 5. 自适应模式：根据可用token动态调整上下文详细程度
 * 
 * @class ContextSelector
 */
import { AstAbstractLayer, OptimizedContext } from './ast-abstract-layer';
import { CacheManager } from './cache-manager';

/**
 * 上下文请求类型
 */
export type ContextRequestType = 'definition' | 'references' | 'implementation' | 'signature' | 'full-context' | 'dependencies';

/**
 * 上下文选择器配置
 */
export interface ContextSelectorConfig {
  /** AST抽象层实例 */
  astLayer: AstAbstractLayer;
  /** 缓存管理器实例 */
  cacheManager: CacheManager;
  /** 默认最大token数 */
  defaultMaxTokens: number;
}

/**
 * 上下文选择器类
 * 
 * 中文名称：上下文选择器类
 * 
 * 负责智能选择和优化代码上下文
 */
export class ContextSelector {
  private config: ContextSelectorConfig;

  /**
   * 创建上下文选择器实例
   * @param config 配置
   */
  constructor(config: ContextSelectorConfig) {
    this.config = config;
  }

  /**
   * 选择和优化上下文
   * @param filePath 文件路径
   * @param requestType 请求类型
   * @param options 选项
   * @returns 优化后的上下文
   */
  async selectContext(
    filePath: string,
    requestType: ContextRequestType,
    options: {
      line?: number;
      character?: number;
      maxTokens?: number;
      symbolName?: string;
    } = {}
  ): Promise<OptimizedContext> {
    const cacheKey = `context:${filePath}:${requestType}:${JSON.stringify(options)}`;
    const cached = await this.config.cacheManager.get<OptimizedContext>(cacheKey);
    if (cached) {
      return cached;
    }

    let context: OptimizedContext;

    switch (requestType) {
      case 'definition':
        context = await this.getDefinitionContext(filePath, options);
        break;
      case 'references':
        context = await this.getReferencesContext(filePath, options);
        break;
      case 'implementation':
        context = await this.getImplementationContext(filePath, options);
        break;
      case 'signature':
        context = await this.getSignatureContext(filePath, options);
        break;
      case 'full-context':
        context = await this.getFullContext(filePath, options);
        break;
      case 'dependencies':
        context = await this.getDependenciesContext(filePath, options);
        break;
      default:
        context = await this.getFallbackContext(filePath, options);
    }

    // 应用token限制
    const maxTokens = options.maxTokens || this.config.defaultMaxTokens;
    if (context.optimizedTokens > maxTokens) {
      context = await this.compressContext(context, maxTokens);
    }

    await this.config.cacheManager.set(cacheKey, context);
    return context;
  }

  /**
   * 获取定义上下文
   */
  private async getDefinitionContext(filePath: string, options: any): Promise<OptimizedContext> {
    if (options.line !== undefined && options.character !== undefined) {
      const definition = await this.config.astLayer.getDefinition(filePath, options.line, options.character);
      if (definition) {
        // 简化处理，实际需要更精确的格式化
        const contextText = JSON.stringify(definition, null, 2);
        return this.createOptimizedContext(contextText, contextText);
      }
    }
    
    // 降级到AST抽象层
    return this.config.astLayer.optimizeContext(filePath, { publicOnly: true });
  }

  /**
   * 获取引用上下文
   */
  private async getReferencesContext(filePath: string, options: any): Promise<OptimizedContext> {
    if (options.line !== undefined && options.character !== undefined) {
      const references = await this.config.astLayer.findReferences(filePath, options.line, options.character);
      if (references) {
        const contextText = JSON.stringify(references, null, 2);
        return this.createOptimizedContext(contextText, contextText);
      }
    }
    
    return this.createOptimizedContext('', '');
  }

  /**
   * 获取实现上下文
   */
  private async getImplementationContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 返回完整实现，但移除注释和空白
    return this.config.astLayer.optimizeContext(filePath, { 
      includeDocumentation: false,
      includeTypeInformation: true
    });
  }

  /**
   * 获取签名上下文
   */
  private async getSignatureContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 只返回公共API签名
    return this.config.astLayer.optimizeContext(filePath, { 
      publicOnly: true,
      includeDocumentation: true,
      includeTypeInformation: true
    });
  }

  /**
   * 获取完整上下文
   */
  private async getFullContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 返回完整的优化上下文
    return this.config.astLayer.optimizeContext(filePath, {
      includeDocumentation: true,
      includeTypeInformation: true
    });
  }

  /**
   * 获取依赖上下文
   */
  private async getDependenciesContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 获取导入语句和依赖关系
    const symbols = await this.config.astLayer.getFileSymbols(filePath);
    const imports = symbols.filter(s => s.type === 'import');
    const contextText = imports.map(i => `${i.name}: ${i.location.filePath}`).join('\n');
    return this.createOptimizedContext(contextText, contextText);
  }

  /**
   * 获取降级上下文
   */
  private async getFallbackContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 最简单的文件读取
    const fs = await import('fs').then(m => m.promises);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    return this.createOptimizedContext(sourceCode, sourceCode);
  }

  /**
   * 创建优化上下文
   */
  private createOptimizedContext(context: string, original: string): OptimizedContext {
    const originalTokens = this.estimateTokenCount(original);
    const optimizedTokens = this.estimateTokenCount(context);
    const savingsPercentage = originalTokens > 0 ? 
      Math.round((1 - optimizedTokens / originalTokens) * 100) : 0;

    return {
      context,
      originalTokens,
      optimizedTokens,
      savingsPercentage,
      technologiesUsed: ['symbol-table']
    };
  }

  /**
   * 估算token数量
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 压缩上下文以适应token限制
   */
  private async compressContext(context: OptimizedContext, maxTokens: number): Promise<OptimizedContext> {
    if (context.optimizedTokens <= maxTokens) {
      return context;
    }

    // 简单的压缩策略：截断内容
    const targetLength = Math.floor(maxTokens * 4 * 0.8); // 保留20%缓冲
    const compressedContext = context.context.substring(0, targetLength) + '... [truncated]';

    return {
      ...context,
      context: compressedContext,
      optimizedTokens: this.estimateTokenCount(compressedContext)
    };
  }

  /**
   * 清理缓存
   */
  async clearCache(): Promise<void> {
    await this.config.cacheManager.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.config.cacheManager.getStats();
  }
}