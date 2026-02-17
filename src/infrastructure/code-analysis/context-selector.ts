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
import { AstAbstractLayer, OptimizedContext } from '@/infrastructure/code-analysis/ast-abstract-layer';
import { CacheManager } from '@/infrastructure/code-analysis/cache-manager';
import { TokenCounter } from '@/infrastructure/code-analysis/token-counter';
import { DependencyAnalyzer } from '@/infrastructure/code-analysis/dependency-analyzer';

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
      try {
        const definition = await this.config.astLayer.getDefinition(filePath, options.line, options.character);
        if (definition) {
          // 格式化为人类可读的定义信息
          const contextText = this.formatDefinitionContext(definition);
          return this.createOptimizedContext(contextText, contextText);
        }
      } catch (error) {
        console.warn('Failed to get definition from AST layer, falling back to symbol table:', error);
        // Continue to symbol name lookup or fallback
      }
    }
    
    // 如果有符号名称，尝试直接从AST中提取完整的定义
    if (options.symbolName) {
      try {
        // 获取所有符号
        const symbols = await this.config.astLayer.getFileSymbols(filePath);
        
        // 查找匹配的符号
        const matchingSymbols = symbols.filter(symbol => 
          symbol.name === options.symbolName || 
          (symbol.text && symbol.text.includes(options.symbolName))
        );
        
        if (matchingSymbols.length > 0) {
          // 优先使用有完整文本的符号
          const bestMatch = matchingSymbols.find(s => s.text && s.text.trim().length > 0) || matchingSymbols[0];
          
          if (bestMatch.text) {
            // 直接返回完整的文本
            return this.createOptimizedContext(bestMatch.text, bestMatch.text);
          } else {
            // 回退到格式化符号上下文
            const contextText = this.formatSymbolContext(bestMatch);
            return this.createOptimizedContext(contextText, contextText);
          }
        }
      } catch (error) {
        console.warn('Failed to find symbol by name, falling back to AST layer:', error);
      }
    }
    
    // 降级到AST抽象层 - 只返回公共API
    return this.config.astLayer.optimizeContext(filePath, { 
      publicOnly: true,
      maxTokens: options.maxTokens || this.config.defaultMaxTokens
    });
  }

  /**
   * 格式化定义上下文
   */
  private formatDefinitionContext(definition: any): string {
    if (!definition) return '';
    
    const lines = [];
    
    // 添加文档字符串
    if (definition.documentation) {
      lines.push(definition.documentation);
      lines.push('');
    }
    
    // 优先使用完整的detail信息（这应该包含完整的函数签名）
    if (definition.detail) {
      // 如果detail看起来像是完整的函数签名，直接使用它
      if (this.isCompleteFunctionSignature(definition.detail)) {
        lines.push(definition.detail);
      } else {
        // 否则尝试从detail中提取有用信息
        lines.push(definition.detail);
      }
    } else if (definition.name) {
      // 构建基本的符号信息
      const kindMap: Record<number, string> = {
        7: 'class',
        8: 'interface', 
        12: 'function',
        13: 'type',
        14: 'variable'
      };
      
      const kind = kindMap[definition.kind] || 'unknown';
      lines.push(`${kind} ${definition.name}`);
      
      if (definition.containerName) {
        lines.push(`  in ${definition.containerName}`);
      }
    }
    
    // 添加位置信息
    if (definition.location) {
      const uri = definition.location.uri || definition.location.filePath;
      const range = definition.location.range || definition.location;
      if (range && range.start) {
        lines.push(`  at ${uri}:${range.start.line + 1}:${range.start.character + 1}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * 判断是否为完整的函数签名
   */
  private isCompleteFunctionSignature(detail: string): boolean {
    // 检查是否包含函数签名的关键元素
    const hasFunctionKeyword = detail.includes('function ') || detail.includes('=>');
    const hasParentheses = detail.includes('(') && detail.includes(')');
    const hasReturnType = detail.includes(':') || detail.includes('=>');
    const hasModifiers = detail.includes('async ') || 
                        detail.includes('private ') || 
                        detail.includes('protected ') || 
                        detail.includes('public ') || 
                        detail.includes('static ');
    
    // 如果包含括号和返回类型，或者有修饰符，很可能是完整的签名
    return (hasParentheses && hasReturnType) || hasModifiers;
  }

  /**
   * 格式化符号上下文
   */
  private formatSymbolContext(symbol: any): string {
    if (!symbol) return '';
    
    const lines = [];
    
    // 添加文档字符串
    if (symbol.documentation) {
      lines.push(symbol.documentation);
      lines.push('');
    }
    
    // 如果有完整的文本内容，直接使用它（这应该是完整的函数/类定义）
    if (symbol.text) {
      lines.push(symbol.text);
    } else {
      // 添加符号基本信息
      lines.push(`${symbol.type} ${symbol.name}`);
      
      // 添加类型信息
      if (symbol.typeInfo) {
        lines.push(`  type: ${symbol.typeInfo}`);
      }
    }
    
    // 添加位置信息
    lines.push(`  at ${symbol.location.filePath}:${symbol.location.line + 1}:${symbol.location.character + 1}`);
    
    // 添加导出信息
    if (symbol.isExported) {
      lines.push('  exported: true');
    }
    
    return lines.join('\n');
  }

  /**
   * 获取引用上下文
   */
  private async getReferencesContext(filePath: string, options: any): Promise<OptimizedContext> {
    if (options.line !== undefined && options.character !== undefined) {
      const references = await this.config.astLayer.findReferences(filePath, options.line, options.character);
      if (references && references.length > 0) {
        const contextText = this.formatReferencesContext(references);
        return this.createOptimizedContext(contextText, contextText);
      }
    }
    
    // 如果有符号名称，尝试通过符号表查找引用
    if (options.symbolName) {
      const symbols = await this.config.astLayer.getFileSymbols(filePath);
      const symbol = symbols.find(s => s.name === options.symbolName);
      if (symbol && symbol.references && symbol.references.length > 0) {
        const contextText = this.formatReferencesContext(symbol.references);
        return this.createOptimizedContext(contextText, contextText);
      }
    }
    
    return this.createOptimizedContext('No references found', 'No references found');
  }

  /**
   * 格式化引用上下文
   */
  private formatReferencesContext(references: any[]): string {
    if (!references || references.length === 0) {
      return 'No references found';
    }
    
    const lines = ['References:'];
    references.slice(0, 50).forEach((ref, index) => { // 限制显示前50个引用
      if (ref.location) {
        const uri = ref.location.uri || ref.location.filePath;
        const range = ref.location.range || ref.location;
        if (range && range.start) {
          lines.push(`  ${index + 1}. ${uri}:${range.start.line + 1}:${range.start.character + 1}`);
        }
      } else if (ref.filePath && ref.line) {
        lines.push(`  ${index + 1}. ${ref.filePath}:${ref.line + 1}:${ref.character + 1}`);
      }
    });
    
    if (references.length > 50) {
      lines.push(`  ... and ${references.length - 50} more references`);
    }
    
    return lines.join('\n');
  }

  /**
   * 获取实现上下文
   */
  private async getImplementationContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 如果指定了位置或符号名称，只返回该符号的实现
    if (options.line !== undefined && options.character !== undefined) {
      try {
        const definition = await this.config.astLayer.getDefinition(filePath, options.line, options.character);
        if (definition && definition.location) {
          // 提取完整的实现
          const sourceCode = await this.readFile(filePath);
          const startLine = definition.location.range.start.line;
          const endLine = definition.location.range.end.line;
          
          // 确保我们获取完整的实现（包括函数体）
          const lines = sourceCode.split('\n');
          let implementationLines = [];
          
          // 找到实现的开始和结束
          let braceCount = 0;
          let inImplementation = false;
          let implementationStart = startLine;
          let implementationEnd = endLine;
          
          // 向下查找直到找到完整的实现块
          for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('{')) {
              if (!inImplementation) {
                implementationStart = i;
                inImplementation = true;
              }
              braceCount += (line.match(/{/g) || []).length;
            }
            if (inImplementation && line.includes('}')) {
              braceCount -= (line.match(/}/g) || []).length;
              if (braceCount === 0) {
                implementationEnd = i;
                break;
              }
            }
          }
          
          implementationLines = lines.slice(implementationStart, implementationEnd + 1);
          const implementationText = implementationLines.join('\n');
          
          if (implementationText.trim()) {
            return this.createOptimizedContext(implementationText, implementationText);
          }
        }
      } catch (error) {
        console.warn('Failed to extract specific implementation, falling back to full file:', error);
      }
    }
    
    if (options.symbolName) {
      try {
        const symbols = await this.config.astLayer.getFileSymbols(filePath);
        const symbol = symbols.find(s => s.name === options.symbolName);
        if (symbol && symbol.text) {
          return this.createOptimizedContext(symbol.text, symbol.text);
        }
      } catch (error) {
        console.warn('Failed to find symbol implementation, falling back to full file:', error);
      }
    }
    
    // 默认返回完整文件实现，但移除注释和空白以节省token
    return this.config.astLayer.optimizeContext(filePath, { 
      includeDocumentation: false,
      includeTypeInformation: true,
      maxTokens: options.maxTokens || this.config.defaultMaxTokens
    });
  }
  
  /**
   * 读取文件内容
   */
  private async readFile(filePath: string): Promise<string> {
    const fs = await import('fs').then(m => m.promises);
    return fs.readFile(filePath, 'utf8');
  }

  /**
   * 获取签名上下文
   */
  private async getSignatureContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 获取所有符号并格式化为清晰的API签名列表
    try {
      // 强制重新获取文件符号，避免缓存污染
      const symbols = await this.config.astLayer.getFileSymbols(filePath, true);
      
      if (symbols.length === 0) {
        // 直接读取文件并提取公共API，避免降级到可能有问题的optimizeContext
        const sourceCode = await this.readFile(filePath);
        const publicApi = this.extractPublicApiFromSource(sourceCode);
        const contextText = publicApi.join('\n\n');
        return this.createOptimizedContext(contextText, contextText);
      }
      
      // 按类型分组符号
      const groupedSymbols: Record<string, any[]> = {
        'classes': [],
        'functions': [],
        'interfaces': [],
        'types': [],
        'variables': [],
        'methods': []
      };
      
      symbols.forEach(symbol => {
        // 只包含导出的符号或公共API
        if (symbol.isExported || 
            (symbol.type === 'class' || symbol.type === 'interface' || symbol.type === 'type') ||
            (symbol.text && symbol.text.includes('public'))) {
          if (symbol.type === 'class') {
            groupedSymbols.classes.push(symbol);
          } else if (symbol.type === 'interface') {
            groupedSymbols.interfaces.push(symbol);
          } else if (symbol.type === 'type') {
            groupedSymbols.types.push(symbol);
          } else if (symbol.type === 'function') {
            // 区分普通函数和类方法
            if (symbol.containerName) {
              groupedSymbols.methods.push(symbol);
            } else {
              groupedSymbols.functions.push(symbol);
            }
          } else {
            if (symbol.text && (symbol.text.includes('export') || symbol.isExported)) {
              groupedSymbols.variables.push(symbol);
            }
          }
        }
      });
      
      // 构建格式化的签名列表，只包含签名，不包含实现
      const lines = [];
      
      if (groupedSymbols.classes.length > 0) {
        lines.push('// Classes');
        groupedSymbols.classes.forEach(symbol => {
          if (symbol.text) {
            const signature = this.extractSignatureFromText(symbol.text, 'class');
            lines.push(signature);
          } else {
            lines.push(`class ${symbol.name}`);
          }
          lines.push('');
        });
      }
      
      if (groupedSymbols.interfaces.length > 0) {
        lines.push('// Interfaces');
        groupedSymbols.interfaces.forEach(symbol => {
          if (symbol.text) {
            const signature = this.extractSignatureFromText(symbol.text, 'interface');
            lines.push(signature);
          } else {
            lines.push(`interface ${symbol.name}`);
          }
          lines.push('');
        });
      }
      
      if (groupedSymbols.types.length > 0) {
        lines.push('// Type Aliases');
        groupedSymbols.types.forEach(symbol => {
          if (symbol.text) {
            const signature = this.extractSignatureFromText(symbol.text, 'type');
            lines.push(signature);
          } else {
            lines.push(`type ${symbol.name} = ...`);
          }
          lines.push('');
        });
      }
      
      if (groupedSymbols.functions.length > 0) {
        lines.push('// Functions');
        groupedSymbols.functions.forEach(symbol => {
          if (symbol.text) {
            const signature = this.extractSignatureFromText(symbol.text, 'function');
            lines.push(signature);
          } else {
            lines.push(`function ${symbol.name}(...): ${symbol.typeInfo || 'any'}`);
          }
          lines.push('');
        });
      }
      
      if (groupedSymbols.methods.length > 0) {
        lines.push('// Methods');
        groupedSymbols.methods.forEach(symbol => {
          if (symbol.text) {
            const signature = this.extractSignatureFromText(symbol.text, 'method');
            lines.push(signature);
          } else {
            lines.push(`${symbol.containerName ? symbol.containerName + '.' : ''}${symbol.name}(...): ${symbol.typeInfo || 'any'}`);
          }
          lines.push('');
        });
      }
      
      if (groupedSymbols.variables.length > 0) {
        lines.push('// Variables/Constants');
        groupedSymbols.variables.forEach(symbol => {
          if (symbol.text) {
            const signature = this.extractSignatureFromText(symbol.text, 'variable');
            lines.push(signature);
          } else {
            lines.push(`const ${symbol.name}: ${symbol.typeInfo || 'any'}`);
          }
          lines.push('');
        });
      }
      
      const contextText = lines.join('\n').trim();
      if (contextText) {
        return this.createOptimizedContext(contextText, contextText);
      }
      
      // 如果没有找到任何符号，直接返回空结果
      return this.createOptimizedContext('', '');
      
    } catch (error) {
      console.warn('Failed to generate signature context:', error);
      // 返回空结果而不是降级到可能有问题的方法
      return this.createOptimizedContext('', '');
    }
  }
  
  /**
   * 从源代码文本中提取签名（移除实现细节）
   */
  private extractSignatureFromText(text: string, type: string): string {
    if (!text) return '';
    
    // 移除函数体、类体等实现细节
    switch (type) {
      case 'function':
      case 'method':
        // 函数：保留到第一个 '{' 之前的内容
        const funcMatch = text.match(/^([^{}]*?)\s*\{/);
        return funcMatch ? funcMatch[1].trim() + ';' : text;
        
      case 'class':
        // 类：保留到第一个 '{' 之前的内容
        const classMatch = text.match(/^([^{}]*?)\s*\{/);
        return classMatch ? classMatch[1].trim() + ' {...}' : text;
        
      case 'interface':
        // 接口：保留整个声明（接口没有实现）
        return text;
        
      case 'type':
        // 类型别名：保留整个声明
        return text;
        
      case 'variable':
        // 变量：保留到 '=' 或 ';' 之前
        const varMatch = text.match(/^([^=;]*?)(?:=|;)/);
        return varMatch ? varMatch[1].trim() + ';' : text;
        
      default:
        return text;
    }
  }
  
  /**
   * 从源代码中直接提取公共API
   */
  private extractPublicApiFromSource(sourceCode: string): string[] {
    const lines = sourceCode.split('\n');
    const publicApi: string[] = [];
    let inClassOrInterface = false;
    let classDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 跳过注释和空行
      if (line.startsWith('//') || line.startsWith('/*') || line === '') {
        continue;
      }
      
      // 检测类/接口开始
      if (line.match(/^(export\s+)?(class|interface|type)\s+/)) {
        // 提取到第一个 '{' 的内容
        const match = line.match(/^([^{}]*?)\s*\{/);
        if (match) {
          publicApi.push(match[1].trim() + ' {...}');
        } else {
          publicApi.push(line);
        }
        continue;
      }
      
      // 检测函数
      if (line.match(/^(export\s+)?(async\s+)?function\s+[a-zA-Z_$]/) || 
          line.match(/^[a-zA-Z_$].*=\s*(async\s+)?\(/)) {
        const match = line.match(/^([^{}]*?)\s*\{/);
        if (match) {
          publicApi.push(match[1].trim() + ';');
        } else {
          publicApi.push(line);
        }
        continue;
      }
      
      // 检测导出的变量
      if (line.startsWith('export ') && !line.includes('from')) {
        const match = line.match(/^([^=;]*?)(?:=|;)/);
        if (match) {
          publicApi.push(match[1].trim() + ';');
        } else {
          publicApi.push(line);
        }
        continue;
      }
    }
    
    return publicApi;
  }
  
  /**
   * 读取文件内容
   */

  /**
   * 获取完整上下文
   */
  private async getFullContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 返回完整的优化上下文
    return this.config.astLayer.optimizeContext(filePath, {
      includeDocumentation: true,
      includeTypeInformation: true,
      maxTokens: options.maxTokens || this.config.defaultMaxTokens
    });
  }

  /**
   * 获取依赖上下文
   */
  private async getDependenciesContext(filePath: string, options: any): Promise<OptimizedContext> {
    // 使用AST抽象层获取完整的依赖关系
    const dependencies = await this.config.astLayer.getFileDependencies(filePath);
    const analyzer = new DependencyAnalyzer();
    const contextText = analyzer.formatDependencies(dependencies);
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
    // 修复token计算：确保original和context都是有效的
    const originalTokens = original ? TokenCounter.estimateTokenCount(original) : 0;
    const optimizedTokens = context ? TokenCounter.estimateTokenCount(context) : 0;
    
    // 修复savingsPercentage计算：避免负值
    let savingsPercentage = 0;
    if (originalTokens > 0) {
      savingsPercentage = Math.max(0, Math.round((1 - optimizedTokens / originalTokens) * 100));
    }
    
    // 确保 technologiesUsed 反映实际使用的技术
    let technologiesUsed: ('lsp' | 'tree-sitter' | 'symbol-table')[] = ['symbol-table'];
    
    // 如果 context 和 original 不同，说明进行了优化
    if (context !== original) {
      technologiesUsed = ['symbol-table', 'tree-sitter'];
    }
    
    // 特殊情况：如果context为空但original不为空，说明优化过度
    if (context === '' && original !== '') {
      technologiesUsed = ['symbol-table'];
      savingsPercentage = 100;
    }

    return {
      context: context || '',
      originalTokens,
      optimizedTokens,
      savingsPercentage,
      technologiesUsed
    };
  }

  /**
   * 压缩上下文以适应token限制
   */
  private async compressContext(context: OptimizedContext, maxTokens: number): Promise<OptimizedContext> {
    if (context.optimizedTokens <= maxTokens) {
      return context;
    }

    // 使用智能截断策略
    const compressedContext = TokenCounter.truncateToTokenLimit(
      context.context, 
      maxTokens, 
      true // 尝试保持结构完整性
    );

    return {
      ...context,
      context: compressedContext,
      optimizedTokens: TokenCounter.estimateTokenCount(compressedContext)
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