/**
 * 混合代码读取器实现
 * 
 * 中文名称：混合代码读取器实现
 * 
 * 预期行为：
 * - 使用LSP客户端提供智能代码分析功能
 * - 支持多种请求类型（definition, references, implementation, signature, full-context, dependencies）
 * - 自动降级到文件读取模式（当LSP不可用时）
 * - 提供token优化和性能统计
 * - 与现有工具接口完全兼容
 * 
 * @class HybridCodeReader
 */
import * as fs from 'fs';
import * as path from 'path';
import { LspClientManager, LspClientConfig } from './lsp-client';

/**
 * 混合代码读取器选项
 */
export interface HybridCodeReaderOptions {
  /** 工作目录 */
  workingDirectory: string;
  /** 默认最大token限制 */
  defaultMaxTokens?: number;
  /** LSP客户端配置 */
  lspConfig?: Partial<LspClientConfig>;
}

/**
 * 优化上下文结果
 */
export interface OptimizedContextResult {
  /** 优化后的上下文内容 */
  context: string;
  /** 原始token数量 */
  originalTokens: number;
  /** 优化后token数量 */
  optimizedTokens: number;
  /** 节省的百分比 */
  savingsPercentage: number;
  /** 使用的技术 */
  technologiesUsed: string[];
}

/**
 * 混合代码读取器类
 */
export class HybridCodeReader {
  private workingDirectory: string;
  private defaultMaxTokens: number;
  private lspConfig: LspClientConfig;

  /**
   * 创建混合代码读取器实例
   * @param options 配置选项
   */
  constructor(options: HybridCodeReaderOptions) {
    console.log('HybridCodeReader constructor called with options:', options);
    this.workingDirectory = options.workingDirectory;
    this.defaultMaxTokens = options.defaultMaxTokens || Infinity;
    
    // 默认LSP配置
    this.lspConfig = {
      serverCommand: 'npx',
      serverArgs: ['typescript-language-server', '--stdio'],
      workingDirectory: this.workingDirectory,
      timeout: 60000,
      maxBufferSize: 10 * 1024 * 1024,
      ...options.lspConfig
    };
    console.log('HybridCodeReader constructed with config:', this.lspConfig);
  }

  /**
   * 检查文件是否支持
   * @param filePath 文件路径
   * @returns 是否支持
   */
  isSupportedFile(filePath: string): boolean {
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    const ext = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  /**
   * 获取优化的代码上下文
   * @param options 请求选项
   * @returns 优化上下文结果
   */
  async getOptimizedContext(options: {
    filePath: string;
    requestType: 'definition' | 'references' | 'implementation' | 'signature' | 'full-context' | 'dependencies';
    position?: { line: number; character: number };
    symbolName?: string;
    maxTokens?: number;
  }): Promise<OptimizedContextResult> {
    console.log('=== getOptimizedContext START ===');
    console.log('getOptimizedContext called with options:', options);
    const { filePath, requestType, position, symbolName, maxTokens } = options;
    const actualMaxTokens = maxTokens ?? this.defaultMaxTokens;
    console.log('Actual max tokens:', actualMaxTokens);
    console.log('Request type:', requestType, 'Type:', typeof requestType);

    // 验证文件路径
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);
    console.log('Absolute path:', absolutePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    // 验证文件类型
    if (!this.isSupportedFile(absolutePath)) {
      throw new Error(`Unsupported file type: ${absolutePath}`);
    }
    console.log('File validation passed');

    // For 'full-context' requests, directly return file content without LSP
    if (requestType === 'full-context') {
      console.log('Handling full-context request directly');
      return this.getFileOptimizedContext(absolutePath, requestType, actualMaxTokens);
    }

    console.log('Request type is not full-context, attempting LSP optimization...');
    try {
      console.log('Attempting LSP optimization...');
      // 尝试使用LSP获取优化上下文
      const lspResult = await this.getLspOptimizedContext(absolutePath, requestType, actualMaxTokens, position, symbolName);
      console.log('LSP result:', lspResult ? 'success' : 'null');
      if (lspResult) {
        return lspResult;
      }
    } catch (error) {
      console.warn('LSP optimization failed, falling back to file reading:', error);
    }

    // 降级到文件读取模式
    return this.getFileOptimizedContext(absolutePath, requestType, actualMaxTokens);
  }

  /**
   * 使用LSP获取优化上下文
   */
  private async getLspOptimizedContext(
    absolutePath: string,
    requestType: 'definition' | 'references' | 'implementation' | 'signature' | 'full-context' | 'dependencies',
    maxTokens: number,
    position?: { line: number; character: number },
    symbolName?: string
  ): Promise<OptimizedContextResult | null> {
    console.log('=== getLspOptimizedContext START ===');
    console.log('getLspOptimizedContext called with:', { absolutePath, requestType, maxTokens });
    try {
      console.log('Getting LSP client from manager...');
      console.log('LSP config:', this.lspConfig);
      const client = await LspClientManager.getClient(this.workingDirectory, this.lspConfig);
      console.log('LSP client obtained successfully');
      const relativePath = path.relative(this.workingDirectory, absolutePath);
      console.log('Relative path:', relativePath);

      switch (requestType) {
        case 'definition':
          if (!position) {
            throw new Error('Position is required for definition requests');
          }
          return await this.handleDefinitionRequest(client, relativePath, position, maxTokens);

        case 'references':
          if (!position) {
            throw new Error('Position is required for references requests');
          }
          return await this.handleReferencesRequest(client, relativePath, position, maxTokens);

        case 'implementation':
          if (!position) {
            // 如果没有位置信息，返回完整文件
            return await this.handleFullContextRequest(absolutePath, maxTokens);
          }
          return await this.handleImplementationRequest(client, relativePath, position, maxTokens);

        case 'signature':
          if (!position) {
            // 如果没有位置信息，返回完整文件
            return await this.handleFullContextRequest(absolutePath, maxTokens);
          }
          return await this.handleSignatureRequest(client, relativePath, position, maxTokens);

        case 'full-context':
          return await this.handleFullContextRequest(absolutePath, maxTokens);

        case 'dependencies':
          return await this.handleDependenciesRequest(client, relativePath, maxTokens);

        default:
          throw new Error(`Unsupported request type: ${requestType}`);
      }
    } catch (error) {
      console.error('LSP request failed:', error);
      return null;
    }
  }

  /**
   * 处理定义请求
   */
  private async handleDefinitionRequest(
    client: any,
    relativePath: string,
    position: { line: number; character: number },
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    console.log('handleDefinitionRequest called with:', { relativePath, position, maxTokens });
    const definitions = await client.getDefinition(relativePath, position);
    console.log('Definitions result:', definitions);
    
    if (!definitions || (Array.isArray(definitions) && definitions.length === 0)) {
      // 如果没有找到定义，返回当前位置的上下文
      return await this.getContextAroundPosition(relativePath, position, maxTokens);
    }

    let context = '';
    if (Array.isArray(definitions)) {
      for (const def of definitions) {
        if (def.uri && def.range) {
          const defContent = await this.getContentInRange(def.uri, def.range);
          context += defContent + '\n\n';
        }
      }
    } else if (definitions.uri && definitions.range) {
      context = await this.getContentInRange(definitions.uri, definitions.range);
    }

    // 截断到maxTokens
    const truncatedContext = this.truncateToTokens(context, maxTokens);
    const originalSize = context.length;
    const optimizedSize = truncatedContext.length;
    
    return {
      context: truncatedContext,
      originalTokens: this.estimateTokenCount(context),
      optimizedTokens: this.estimateTokenCount(truncatedContext),
      savingsPercentage: originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0,
      technologiesUsed: ['LSP', 'typescript-language-server']
    };
  }

  /**
   * 处理引用请求
   */
  private async handleReferencesRequest(
    client: any,
    relativePath: string,
    position: { line: number; character: number },
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    const references = await client.findReferences(relativePath, position);
    
    if (!references || references.length === 0) {
      return await this.getContextAroundPosition(relativePath, position, maxTokens);
    }

    let context = `Found ${references.length} references:\n\n`;
    for (const ref of references) {
      if (ref.uri && ref.range) {
        const refContent = await this.getContentInRange(ref.uri, ref.range);
        context += `Reference at ${ref.uri}:\n${refContent}\n\n`;
      }
    }

    const truncatedContext = this.truncateToTokens(context, maxTokens);
    const originalSize = context.length;
    const optimizedSize = truncatedContext.length;
    
    return {
      context: truncatedContext,
      originalTokens: this.estimateTokenCount(context),
      optimizedTokens: this.estimateTokenCount(truncatedContext),
      savingsPercentage: originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0,
      technologiesUsed: ['LSP', 'typescript-language-server', 'references']
    };
  }

  /**
   * 处理实现请求
   */
  private async handleImplementationRequest(
    client: any,
    relativePath: string,
    position: { line: number; character: number },
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    // 先获取hover信息（可能包含签名和文档）
    const hover = await client.getHover(relativePath, position);
    let context = '';
    
    if (hover && hover.contents) {
      if (typeof hover.contents === 'string') {
        context = hover.contents;
      } else if (Array.isArray(hover.contents)) {
        context = (hover.contents as Array<string | { value: string }>).map(item => 
          typeof item === 'string' ? item : item.value
        ).join('\n');
      } else if (typeof hover.contents === 'object') {
        context = hover.contents.value || JSON.stringify(hover.contents);
      }
    }

    // 如果hover信息不足，尝试获取定义
    if (context.length < 100) {
      try {
        const definitions = await client.getDefinition(relativePath, position);
        if (definitions && (Array.isArray(definitions) ? definitions.length > 0 : true)) {
          const defContext = await this.handleDefinitionRequest(client, relativePath, position, maxTokens);
          context = defContext.context;
        }
      } catch (error) {
        // 忽略定义获取失败
      }
    }

    if (!context) {
      return await this.getContextAroundPosition(relativePath, position, maxTokens);
    }

    const truncatedContext = this.truncateToTokens(context, maxTokens);
    const originalSize = context.length;
    const optimizedSize = truncatedContext.length;
    
    return {
      context: truncatedContext,
      originalTokens: this.estimateTokenCount(context),
      optimizedTokens: this.estimateTokenCount(truncatedContext),
      savingsPercentage: originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0,
      technologiesUsed: ['LSP', 'typescript-language-server', 'hover', 'definition']
    };
  }

  /**
   * 处理签名请求
   */
  private async handleSignatureRequest(
    client: any,
    relativePath: string,
    position: { line: number; character: number },
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    const hover = await client.getHover(relativePath, position);
    let context = '';
    
    if (hover && hover.contents) {
      if (typeof hover.contents === 'string') {
        context = hover.contents;
      } else if (Array.isArray(hover.contents)) {
        // 只取第一个内容（通常是签名）
        const firstContent = hover.contents[0];
        context = typeof firstContent === 'string' ? firstContent : firstContent.value;
      } else if (typeof hover.contents === 'object') {
        context = hover.contents.value || JSON.stringify(hover.contents);
      }
    }

    if (!context) {
      return await this.getContextAroundPosition(relativePath, position, maxTokens);
    }

    const truncatedContext = this.truncateToTokens(context, maxTokens);
    const originalSize = context.length;
    const optimizedSize = truncatedContext.length;
    
    return {
      context: truncatedContext,
      originalTokens: this.estimateTokenCount(context),
      optimizedTokens: this.estimateTokenCount(truncatedContext),
      savingsPercentage: originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0,
      technologiesUsed: ['LSP', 'typescript-language-server', 'hover']
    };
  }

  /**
   * 处理完整上下文请求
   */
  private async handleFullContextRequest(
    absolutePath: string,
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    console.log('handleFullContextRequest called with:', absolutePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const truncatedContent = this.truncateToTokens(content, maxTokens);
    
    return {
      context: truncatedContent,
      originalTokens: this.estimateTokenCount(content),
      optimizedTokens: this.estimateTokenCount(truncatedContent),
      savingsPercentage: 0, // 完整上下文没有节省
      technologiesUsed: ['file-reading']
    };
  }

  /**
   * 处理依赖请求
   */
  private async handleDependenciesRequest(
    client: any,
    relativePath: string,
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    const symbols = await client.getDocumentSymbols(relativePath);
    
    if (!symbols || symbols.length === 0) {
      // 如果没有符号，返回导入/导出语句
      const content = fs.readFileSync(path.join(this.workingDirectory, relativePath), 'utf8');
      const importsExports = content.split('\n').filter(line => 
        line.trim().startsWith('import ') || 
        line.trim().startsWith('export ') ||
        line.trim().startsWith('const ') ||
        line.trim().startsWith('function ') ||
        line.trim().startsWith('class ')
      ).join('\n');
      
      const truncatedContent = this.truncateToTokens(importsExports, maxTokens);
      return {
        context: truncatedContent,
        originalTokens: this.estimateTokenCount(importsExports),
        optimizedTokens: this.estimateTokenCount(truncatedContent),
        savingsPercentage: importsExports.length > 0 ? Math.round((1 - truncatedContent.length / importsExports.length) * 100) : 0,
        technologiesUsed: ['file-reading', 'regex-filtering']
      };
    }

    let context = `Document symbols for ${relativePath}:\n\n`;
    for (const symbol of symbols) {
      context += `- ${symbol.name} (${symbol.kind})\n`;
      if (symbol.detail) {
        context += `  ${symbol.detail}\n`;
      }
    }

    const truncatedContext = this.truncateToTokens(context, maxTokens);
    const originalSize = context.length;
    const optimizedSize = truncatedContext.length;
    
    return {
      context: truncatedContext,
      originalTokens: this.estimateTokenCount(context),
      optimizedTokens: this.estimateTokenCount(truncatedContext),
      savingsPercentage: originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0,
      technologiesUsed: ['LSP', 'typescript-language-server', 'document-symbol']
    };
  }

  /**
   * 获取位置周围的上下文
   */
  private async getContextAroundPosition(
    relativePath: string,
    position: { line: number; character: number },
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    const absolutePath = path.join(this.workingDirectory, relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');
    
    const startLine = Math.max(0, position.line - 5);
    const endLine = Math.min(lines.length, position.line + 6);
    const contextLines = lines.slice(startLine, endLine);
    const context = contextLines.join('\n');
    
    const truncatedContext = this.truncateToTokens(context, maxTokens);
    const originalSize = context.length;
    const optimizedSize = truncatedContext.length;
    
    return {
      context: truncatedContext,
      originalTokens: this.estimateTokenCount(context),
      optimizedTokens: this.estimateTokenCount(truncatedContext),
      savingsPercentage: originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0,
      technologiesUsed: ['file-reading', 'context-extraction']
    };
  }

  /**
   * 获取范围内的内容
   */
  private async getContentInRange(uri: string, range: any): Promise<string> {
    try {
      // uri 格式: file:///path/to/file
      const filePath = uri.replace(/^file:\/\//, '');
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      const startLine = range.start.line;
      const endLine = range.end.line;
      const startChar = range.start.character;
      const endChar = range.end.character;
      
      if (startLine === endLine) {
        return lines[startLine].substring(startChar, endChar);
      } else {
        const result = [];
        result.push(lines[startLine].substring(startChar));
        for (let i = startLine + 1; i < endLine; i++) {
          result.push(lines[i]);
        }
        result.push(lines[endLine].substring(0, endChar));
        return result.join('\n');
      }
    } catch (error) {
      console.error('Failed to get content in range:', error);
      return `Error getting content from ${uri}`;
    }
  }

  /**
   * 使用文件读取获取优化上下文（降级模式）
   */
  private async getFileOptimizedContext(
    absolutePath: string,
    requestType: 'definition' | 'references' | 'implementation' | 'signature' | 'full-context' | 'dependencies',
    maxTokens: number
  ): Promise<OptimizedContextResult> {
    const content = fs.readFileSync(absolutePath, 'utf8');
    
    let context = content;
    let technologiesUsed = ['file-reading'];
    
    // 根据请求类型进行简单优化
    switch (requestType) {
      case 'dependencies':
        // 只返回导入/导出语句
        context = content.split('\n').filter(line => 
          line.trim().startsWith('import ') || 
          line.trim().startsWith('export ')
        ).join('\n');
        technologiesUsed.push('dependency-filtering');
        break;
        
      case 'signature':
      case 'definition':
        // 返回前100行（假设包含接口/类型定义）
        const lines = content.split('\n');
        context = lines.slice(0, Math.min(100, lines.length)).join('\n');
        technologiesUsed.push('header-extraction');
        break;
        
      case 'full-context':
        // 返回完整内容
        break;
        
      default:
        // 其他类型也返回完整内容
        break;
    }
    
    const truncatedContext = this.truncateToTokens(context, maxTokens);
    const originalSize = context.length;
    const optimizedSize = truncatedContext.length;
    
    return {
      context: truncatedContext,
      originalTokens: this.estimateTokenCount(context),
      optimizedTokens: this.estimateTokenCount(truncatedContext),
      savingsPercentage: originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0,
      technologiesUsed
    };
  }

  /**
   * 估算token数量（简单估算）
   */
  private estimateTokenCount(text: string): number {
    // 简单的token估算：每4个字符约1个token
    return Math.ceil(text.length / 4);
  }

  /**
   * 截断文本到指定token数量
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    if (maxTokens === Infinity) {
      return text;
    }
    
    const estimatedChars = maxTokens * 4;
    if (text.length <= estimatedChars) {
      return text;
    }
    
    return text.substring(0, estimatedChars) + '... [truncated]';
  }
}

/**
 * 获取LSP客户端（用于高级LSP功能）
 */
export async function getLspClientForReader(reader: HybridCodeReader): Promise<any> {
  // 这里需要访问reader的私有lspClient属性
  // 由于TypeScript的限制，我们使用类型断言
  const readerAny = reader as any;
  if (!readerAny.lspClient) {
    readerAny.lspClient = await LspClientManager.getClient(readerAny.workingDirectory, readerAny.lspConfig);
  }
  return readerAny.lspClient;
}