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
import { TokenCounter } from '@/infrastructure/code-analysis/token-counter';
import { DependencyAnalyzer, DependencyResult } from '@/infrastructure/code-analysis/dependency-analyzer';

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
        const lspResult = await this.config.lspTool.getDefinition(filePath, line, character);
        if (lspResult) {
          // 使用LSP的位置信息，但使用Tree-sitter提取完整的函数签名
          if (this.config.treeSitterTool.isSupportedFile(filePath)) {
            try {
              const sourceCode = await this.readFile(filePath);
              const allSymbols = await Promise.all([
                this.config.treeSitterTool.queryFunctions(filePath),
                this.config.treeSitterTool.queryClasses(filePath),
                this.config.treeSitterTool.queryInterfaces(filePath),
                this.config.treeSitterTool.queryTypeDefinitions(filePath),
                this.config.treeSitterTool.queryVariables(filePath)
              ]);
              
              const symbols = allSymbols.flat();
              
              // 使用LSP返回的位置来查找对应的符号
              let targetSymbol = null;
              if (Array.isArray(lspResult)) {
                // 处理多个定义的情况
                const firstDef = lspResult[0];
                const lspLine = firstDef.range.start.line;
                const lspChar = firstDef.range.start.character;
                targetSymbol = symbols.find(symbol => 
                  symbol.startPosition.row <= lspLine && 
                  symbol.endPosition.row >= lspLine
                );
              } else if (lspResult.range) {
                // 处理单个定义的情况
                const lspLine = lspResult.range.start.line;
                const lspChar = lspResult.range.start.character;
                targetSymbol = symbols.find(symbol => 
                  symbol.startPosition.row <= lspLine && 
                  symbol.endPosition.row >= lspLine
                );
              }
              
              if (targetSymbol) {
                result = {
                  name: this.extractNameFromAstNode(targetSymbol),
                  kind: this.mapAstNodeTypeToLspKind(targetSymbol.type),
                  location: lspResult.range ? lspResult : lspResult[0],
                  containerName: this.getContainerName(targetSymbol, symbols),
                  detail: targetSymbol.text || this.extractTypeInformation(targetSymbol, sourceCode),
                  documentation: this.extractDocumentation(targetSymbol, sourceCode)
                };
                technologiesUsed.push('lsp', 'tree-sitter');
              } else {
                // 如果找不到符号，使用LSP结果
                result = lspResult;
                technologiesUsed.push('lsp');
              }
            } catch (treeSitterError) {
              console.warn('Tree-sitter failed to extract signature, using LSP result:', treeSitterError);
              result = lspResult;
              technologiesUsed.push('lsp');
            }
          } else {
            result = lspResult;
            technologiesUsed.push('lsp');
          }
        }
      }
    } catch (error) {
      console.warn('LSP definition failed, falling back to Tree-sitter:', error);
    }

    if (!result && this.config.treeSitterTool.isSupportedFile(filePath)) {
      // 降级到Tree-sitter - 实现真正的定义查找
      try {
        const sourceCode = await this.readFile(filePath);
        const allSymbols = await Promise.all([
          this.config.treeSitterTool.queryFunctions(filePath),
          this.config.treeSitterTool.queryClasses(filePath),
          this.config.treeSitterTool.queryInterfaces(filePath),
          this.config.treeSitterTool.queryTypeDefinitions(filePath),
          this.config.treeSitterTool.queryVariables(filePath)
        ]);
        
        const symbols = allSymbols.flat();
        
        // 精确的位置匹配：找到包含指定位置的符号
        const targetSymbol = symbols.find(symbol => {
          return symbol.startPosition.row <= line && 
                 symbol.endPosition.row >= line &&
                 (symbol.startPosition.row !== symbol.endPosition.row || 
                  (symbol.startPosition.column <= character && 
                   symbol.endPosition.column >= character));
        });
        
        if (targetSymbol) {
          // 构建完整的定义信息
          result = {
            name: this.extractNameFromAstNode(targetSymbol),
            kind: this.mapAstNodeTypeToLspKind(targetSymbol.type),
            location: {
              uri: filePath,
              range: {
                start: {
                  line: targetSymbol.startPosition.row,
                  character: targetSymbol.startPosition.column
                },
                end: {
                  line: targetSymbol.endPosition.row,
                  character: targetSymbol.endPosition.column
                }
              }
            },
            containerName: this.getContainerName(targetSymbol, symbols),
            // 优先使用完整的文本内容作为detail
            detail: targetSymbol.text || this.extractTypeInformation(targetSymbol, sourceCode),
            documentation: this.extractDocumentation(targetSymbol, sourceCode)
          };
        }
        technologiesUsed.push('tree-sitter');
      } catch (error) {
        console.error('Tree-sitter definition failed:', error);
      }
    }

    if (!result && this.config.symbolTable.isBuiltTable()) {
      // 最后使用符号表
      try {
        const symbols = this.config.symbolTable.getFileSymbols(filePath);
        const symbol = symbols.find(s => s.location.line === line);
        if (symbol) {
          // 构建包含完整文本的result对象
          result = {
            name: symbol.name,
            kind: this.mapSymbolTypeToLspKind(symbol.type),
            location: {
              uri: filePath,
              range: {
                start: {
                  line: symbol.location.line,
                  character: symbol.location.character
                },
                end: {
                  line: symbol.location.line, // 这里可能不准确，但至少有文本
                  character: symbol.location.character
                }
              }
            },
            detail: symbol.text, // 使用完整的文本作为detail
            containerName: symbol.containerName,
            documentation: symbol.documentation
          };
          technologiesUsed.push('symbol-table');
        }
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
   * 从AST节点提取名称
   */
  private extractNameFromAstNode(node: any): string {
    if (node.name) return node.name;
    if (node.text) {
      // 尝试从文本中提取标识符
      const match = node.text.match(/(?:function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (match) return match[1];
      
      // 对于方法定义，提取方法名
      const methodMatch = node.text.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
      if (methodMatch) return methodMatch[1];
      
      // 对于变量声明，提取第一个标识符
      const varMatch = node.text.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=:]/);
      if (varMatch) return varMatch[1];
      
      // 对于箭头函数，提取变量名
      const arrowMatch = node.text.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\(/);
      if (arrowMatch) return arrowMatch[1];
    }
    return 'unknown';
  }

  /**
   * 映射AST节点类型到LSP符号种类
   */
  private mapAstNodeTypeToLspKind(nodeType: string): number {
    switch (nodeType) {
      case 'function_declaration':
      case 'method_definition':
        return 12; // Function
      case 'class_declaration':
        return 7; // Class
      case 'interface_declaration':
        return 8; // Interface
      case 'type_alias_declaration':
        return 13; // TypeParameter
      case 'variable_declarator':
        return 14; // Variable
      default:
        return 0; // Unknown
    }
  }

  /**
   * 映射符号类型到LSP符号种类
   */
  private mapSymbolTypeToLspKind(symbolType: string): number {
    switch (symbolType) {
      case 'class':
        return 7; // Class
      case 'interface':
        return 8; // Interface
      case 'function':
        return 12; // Function
      case 'method_definition':
        return 12; // Function
      case 'type':
        return 13; // TypeParameter
      default:
        return 0; // Unknown
    }
  }

  /**
   * 获取符号的容器名称
   */
  private getContainerName(targetSymbol: any, allSymbols: any[]): string | undefined {
    // 查找包含目标符号的类或函数
    const container = allSymbols.find(symbol => 
      symbol.type === 'class_declaration' || symbol.type === 'function_declaration'
    );
    
    if (container && 
        container.startPosition.row <= targetSymbol.startPosition.row &&
        container.endPosition.row >= targetSymbol.endPosition.row) {
      return this.extractNameFromAstNode(container);
    }
    
    return undefined;
  }

  /**
   * 从源代码中提取类型信息
   */
  private extractTypeInformation(node: any, sourceCode: string): string {
    if (!node.text) return '';
    
    // 提取完整的函数/方法签名，包括修饰符
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      const lines = node.text.split('\n');
      const signatureLine = lines[0];
      return signatureLine.trim();
    }
    
    // 对于类方法，需要更精确的提取
    if (node.type === 'method_definition') {
      // 查找包含修饰符的完整行
      const startLine = node.startPosition.row;
      const lines = sourceCode.split('\n');
      
      // 向上查找可能的修饰符（async, private, protected, public, static）
      let signatureStart = startLine;
      for (let i = startLine; i >= Math.max(0, startLine - 3); i--) {
        const line = lines[i].trim();
        if (line.startsWith('async ') || 
            line.startsWith('private ') || 
            line.startsWith('protected ') || 
            line.startsWith('public ') || 
            line.startsWith('static ') ||
            line.includes('@')) { // 装饰器
          signatureStart = i;
          break;
        }
      }
      
      // 向下查找直到找到完整的签名（包含参数列表）
      let signatureEnd = startLine;
      for (let i = startLine; i < Math.min(lines.length, startLine + 5); i++) {
        const line = lines[i];
        if (line.includes(')') && line.includes('{')) {
          signatureEnd = i;
          break;
        }
      }
      
      // 提取完整的签名
      const fullSignature = lines.slice(signatureStart, signatureEnd + 1).join('\n');
      return fullSignature.trim();
    }
    
    // 提取类型注解
    const typeAnnotationMatch = node.text.match(/:\s*([^;{]+)[;{]/);
    if (typeAnnotationMatch) {
      return typeAnnotationMatch[1].trim();
    }
    
    return '';
  }

  /**
   * 从源代码中提取文档字符串
   */
  private extractDocumentation(node: any, sourceCode: string): string {
    if (!node.startPosition) return '';
    
    const lines = sourceCode.split('\n');
    const nodeLineIndex = node.startPosition.row;
    
    // 检查前几行是否有JSDoc注释
    for (let i = Math.max(0, nodeLineIndex - 5); i < nodeLineIndex; i++) {
      const line = lines[i].trim();
      if (line.startsWith('/**')) {
        // 找到JSDoc注释的开始，收集整个注释块
        const docLines = [];
        for (let j = i; j < nodeLineIndex; j++) {
          const currentLine = lines[j];
          docLines.push(currentLine);
          if (currentLine.includes('*/')) break;
        }
        return docLines.join('\n').trim();
      }
    }
    
    return '';
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

    // 应用token限制
    const maxTokens = options.maxTokens || Infinity;
    const currentTokens = this.estimateTokenCount(optimizedContext);
    
    if (currentTokens > maxTokens) {
      // 首先尝试移除注释和空白
      const cleanedContext = this.removeCommentsAndWhitespace(optimizedContext);
      const cleanedTokens = this.estimateTokenCount(cleanedContext);
      
      if (cleanedTokens <= maxTokens) {
        optimizedContext = cleanedContext;
      } else {
        // 如果仍然超出限制，进行智能截断
        optimizedContext = TokenCounter.truncateToTokenLimit(
          cleanedContext, 
          maxTokens, 
          true // 尝试保持结构完整性
        );
        technologiesUsed.push('symbol-table'); // 表示使用了截断优化
      }
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
   * 估算token数量（使用精确的token计数器）
   * @param text 文本
   * @returns token数量
   */
  private estimateTokenCount(text: string): number {
    return TokenCounter.estimateTokenCount(text);
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
  async getFileSymbols(filePath: string, forceRefresh: boolean = false): Promise<SymbolInfo[]> {
    const cacheKey = `file-symbols:${filePath}`;
    
    if (!forceRefresh) {
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
    }
    
    // 如果需要强制刷新或符号表未构建，重新构建
    if (forceRefresh || !this.config.symbolTable.isBuiltTable()) {
      // 清除缓存
      this.cache.delete(cacheKey);
      // 重新构建符号表
      await this.config.symbolTable.build([filePath]);
    }
    
    const symbols = this.config.symbolTable.getFileSymbols(filePath);
    this.cache.set(cacheKey, symbols);
    return symbols;
  }

  /**
   * 获取文件的依赖关系
   * @param filePath 文件路径
   * @returns 依赖关系结果
   */
  async getFileDependencies(filePath: string): Promise<DependencyResult> {
    const cacheKey = `dependencies:${filePath}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let dependencies: DependencyResult;
    const technologiesUsed: ('lsp' | 'tree-sitter' | 'symbol-table')[] = [];

    try {
      // 使用Tree-sitter解析依赖关系
      if (this.config.treeSitterTool.isSupportedFile(filePath)) {
        const rawDependencies = await this.config.treeSitterTool.queryDependencies(filePath);
        const analyzer = new DependencyAnalyzer();
        dependencies = analyzer.analyzeDependencies(filePath, rawDependencies);
        technologiesUsed.push('tree-sitter');
      } else {
        // 降级到简单的正则表达式解析
        const sourceCode = await this.readFile(filePath);
        dependencies = this.fallbackDependencyAnalysis(filePath, sourceCode);
        technologiesUsed.push('symbol-table');
      }
    } catch (error) {
      console.error('Dependency analysis failed:', error);
      // 最后的降级方案
      const sourceCode = await this.readFile(filePath).catch(() => '');
      dependencies = this.fallbackDependencyAnalysis(filePath, sourceCode || '');
      technologiesUsed.push('symbol-table');
    }

    this.cache.set(cacheKey, dependencies);
    return dependencies;
  }

  /**
   * 降级的依赖关系分析（使用正则表达式）
   * @param filePath 文件路径
   * @param sourceCode 源代码
   * @returns 依赖关系结果
   */
  private fallbackDependencyAnalysis(filePath: string, sourceCode: string): DependencyResult {
    const imports: any[] = [];
    const exports: any[] = [];
    const externalDependencies: string[] = [];
    const internalDependencies: string[] = [];

    if (sourceCode) {
      // 简单的正则表达式匹配
      const importMatches = sourceCode.matchAll(/import\s+(?:[^'"]*['"]([^'"]+)['"])/g);
      for (const match of importMatches) {
        const source = match[1];
        if (source.startsWith('.') || source.startsWith('/')) {
          internalDependencies.push(source);
        } else {
          externalDependencies.push(source);
        }
      }

      const exportMatches = sourceCode.matchAll(/export\s+.*from\s+['"]([^'"]+)['"]/g);
      for (const match of exportMatches) {
        const source = match[1];
        if (source.startsWith('.') || source.startsWith('/')) {
          internalDependencies.push(source);
        } else {
          externalDependencies.push(source);
        }
      }
    }

    return {
      filePath,
      imports,
      exports,
      externalDependencies: [...new Set(externalDependencies)],
      internalDependencies: [...new Set(internalDependencies)]
    };
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