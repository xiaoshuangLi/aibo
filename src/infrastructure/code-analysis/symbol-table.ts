/**
 * 符号表管理器
 * 
 * 中文名称：符号表管理器
 * 
 * 预期行为：
 * - 构建和维护项目级符号表
 * - 提供符号定义、引用和依赖关系查询
 * - 支持增量更新和缓存
 * - 与LSP和Tree-sitter集成
 * - 提供高效的符号查找
 * 
 * 行为分支：
 * 1. 符号构建：从源代码或LSP响应构建符号表
 * 2. 增量更新：文件修改时只更新相关符号
 * 3. 跨文件查询：支持跨文件的符号引用查询
 * 4. 缓存管理：智能缓存符号表以提高性能
 * 5. 多语言支持：支持不同语言的符号表示
 * 
 * @class SymbolTable
 */
import path from 'path';
import { LspTool } from '@/infrastructure/code-analysis/lsp-tool';
import { TreeSitterTool, AstNodeInfo } from '@/infrastructure/code-analysis/tree-sitter-tool';

/**
 * 符号类型
 */
export type SymbolType = 'function' | 'class' | 'interface' | 'type' | 'variable' | 'import' | 'export';

/**
 * 符号信息
 */
export interface SymbolInfo {
  /** 符号名称 */
  name: string;
  /** 符号类型 */
  type: SymbolType;
  /** 定义位置 */
  location: {
    filePath: string;
    line: number;
    character: number;
  };
  /** 文档字符串 */
  documentation?: string;
  /** 类型信息 */
  typeInfo?: string;
  /** 是否为导出项 */
  isExported: boolean;
  /** 引用列表 */
  references: Array<{
    filePath: string;
    line: number;
    character: number;
  }>;
  /** 依赖的符号 */
  dependencies: string[];
  /** 完整的符号文本内容 */
  text?: string;
  /** 容器名称（对于类成员） */
  containerName?: string;
}

/**
 * 符号表配置
 */
export interface SymbolTableConfig {
  /** 工作目录 */
  workingDirectory: string;
  /** LSP工具实例 */
  lspTool: LspTool;
  /** Tree-sitter工具实例 */
  treeSitterTool: TreeSitterTool;
}

/**
 * 符号表类
 * 
 * 中文名称：符号表类
 * 
 * 负责管理和查询项目中的符号信息
 */
export class SymbolTable {
  private config: SymbolTableConfig;
  private symbols: Map<string, SymbolInfo> = new Map();
  private fileSymbols: Map<string, string[]> = new Map();
  private isBuilt: boolean = false;

  /**
   * 创建符号表实例
   * @param config 配置
   */
  constructor(config: SymbolTableConfig) {
    this.config = config;
  }

  /**
   * 构建符号表
   * @param filePaths 文件路径列表
   */
  async build(filenames: string[]): Promise<void> {
    // 清空现有符号表
    this.symbols.clear();
    this.fileSymbols.clear();

    // 并行处理所有文件
    const promises = filenames.map(filePath => this.processFile(filePath));
    await Promise.all(promises);

    this.isBuilt = true;
  }

  /**
   * 处理单个文件
   * @param filePath 文件路径
   */
  private async processFile(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.workingDirectory, filePath);
    
    try {
      if (this.config.lspTool.isSupportedFile(absolutePath)) {
        // 使用LSP获取符号信息
        await this.processFileWithLsp(absolutePath);
      } else if (this.config.treeSitterTool.isSupportedFile(absolutePath)) {
        // 使用Tree-sitter获取符号信息
        await this.processFileWithTreeSitter(absolutePath);
      }
    } catch (error) {
      console.error(`Failed to process file ${absolutePath}:`, error);
    }
  }

  /**
   * 使用LSP处理文件
   * @param filePath 文件路径
   */
  private async processFileWithLsp(filePath: string): Promise<void> {
    try {
      console.log('config', this.config);
      console.log('filePath', filePath);
      // 使用文件名作为查询参数，以减少返回的符号数量
      const relativeFilePath = filePath.replace(this.config.workingDirectory, '').replace(/^[\/\\]/, '');
      const workspaceSymbols = await this.config.lspTool.getWorkspaceSymbols(relativeFilePath);
      
      // 这里简化处理，实际应用中需要过滤出当前文件的符号
      if (workspaceSymbols && Array.isArray(workspaceSymbols)) {
        for (const symbol of workspaceSymbols) {
          if (symbol.location?.uri?.includes(filePath)) {
            const symbolInfo: SymbolInfo = {
              name: symbol.name,
              type: this.mapLspSymbolKindToType(symbol.kind),
              location: {
                filePath,
                line: symbol.location.range.start.line,
                character: symbol.location.range.start.character
              },
              isExported: true, // 简化处理
              references: [],
              dependencies: []
            };
            this.addSymbol(symbolInfo);
          }
        }
      }
    } catch (error) {
      console.error(`LSP processing failed for ${filePath}:`, error);
      // 降级到Tree-sitter
      await this.processFileWithTreeSitter(filePath);
    }
  }

  /**
   * 使用Tree-sitter处理文件
   * @param filePath 文件路径
   */
  private async processFileWithTreeSitter(filePath: string): Promise<void> {
    try {
      const [functions, classes, interfaces, types] = await Promise.all([
        this.config.treeSitterTool.queryFunctions(filePath),
        this.config.treeSitterTool.queryClasses(filePath),
        this.config.treeSitterTool.queryInterfaces(filePath),
        this.config.treeSitterTool.queryTypeDefinitions(filePath)
      ]);

      // 处理函数
      for (const func of functions) {
        // 检查是否包含装饰器
        const hasDecorator = func.text && func.text.trim().startsWith('@');
        
        const symbolInfo: SymbolInfo = {
          name: this.extractNameFromAstNode(func),
          type: 'function',
          location: {
            filePath,
            line: func.startPosition.row,
            character: func.startPosition.column
          },
          isExported: this.isExported(func.text),
          references: [],
          dependencies: [],
          text: func.text
        };
        this.addSymbol(symbolInfo);
      }

      // 处理类
      for (const cls of classes) {
        const symbolInfo: SymbolInfo = {
          name: this.extractNameFromAstNode(cls),
          type: 'class',
          location: {
            filePath,
            line: cls.startPosition.row,
            character: cls.startPosition.column
          },
          isExported: this.isExported(cls.text),
          references: [],
          dependencies: [],
          text: cls.text
        };
        this.addSymbol(symbolInfo);
      }

      // 处理接口
      for (const iface of interfaces) {
        const symbolInfo: SymbolInfo = {
          name: this.extractNameFromAstNode(iface),
          type: 'interface',
          location: {
            filePath,
            line: iface.startPosition.row,
            character: iface.startPosition.column
          },
          isExported: this.isExported(iface.text),
          references: [],
          dependencies: [],
          text: iface.text
        };
        this.addSymbol(symbolInfo);
      }

      // 处理类型
      for ( const type of types) {
        const symbolInfo: SymbolInfo = {
          name: this.extractNameFromAstNode(type),
          type: 'type',
          location: {
            filePath,
            line: type.startPosition.row,
            character: type.startPosition.column
          },
          isExported: this.isExported(type.text),
          references: [],
          dependencies: [],
          text: type.text
        };
        this.addSymbol(symbolInfo);
      }
    } catch (error) {
      console.error(`Tree-sitter processing failed for ${filePath}:`, error);
    }
  }

  /**
   * 从AST节点提取名称
   * @param node AST节点
   * @returns 符号名称
   */
  private extractNameFromAstNode(node: AstNodeInfo): string {
    // 简化实现，实际需要更精确的名称提取
    const match = node.text.match(/(?:function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * 检查是否为导出项
   * @param text 节点文本
   * @returns 是否导出
   */
  private isExported(text: string): boolean {
    return text.trim().startsWith('export ');
  }
  
  /**
   * 从文本中提取装饰器信息
   * @param text 节点文本
   * @returns 装饰器信息数组
   */
  private extractDecorators(text: string): any[] {
    if (!text) return [];
    
    const decorators: any[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        // 提取装饰器名称和参数
        const match = trimmed.match(/@([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(\([^)]*\))?/);
        if (match) {
          decorators.push({
            name: match[1],
            arguments: match[2] ? match[2].slice(1, -1) : '',
            fullText: trimmed
          });
        }
      } else if (trimmed.length > 0 && !trimmed.startsWith('@')) {
        // 遇到非装饰器行，停止提取
        break;
      }
    }
    
    return decorators;
  }

  /**
   * 将LSP符号类型映射到内部类型
   * @param kind LSP符号类型
   * @returns 内部符号类型
   */
  private mapLspSymbolKindToType(kind: number): SymbolType {
    // LSP符号类型常量
    switch (kind) {
      case 5: return 'class';
      case 11: return 'interface';
      case 12: return 'function';
      case 13: return 'variable';
      default: return 'variable';
    }
  }

  /**
   * 添加符号到符号表
   * @param symbol 符号信息
   */
  private addSymbol(symbol: SymbolInfo): void {
    const key = `${symbol.location.filePath}::${symbol.name}`;
    this.symbols.set(key, symbol);

    // 更新文件符号映射
    if (!this.fileSymbols.has(symbol.location.filePath)) {
      this.fileSymbols.set(symbol.location.filePath, []);
    }
    this.fileSymbols.get(symbol.location.filePath)!.push(key);
  }

  /**
   * 查找符号
   * @param name 符号名称
   * @param filePath 文件路径（可选）
   * @returns 符号信息
   */
  findSymbol(name: string, filePath?: string): SymbolInfo | undefined {
    if (filePath) {
      const key = `${filePath}::${name}`;
      return this.symbols.get(key);
    }

    // 全局搜索
    for (const [key, symbol] of this.symbols) {
      if (symbol.name === name) {
        return symbol;
      }
    }
    return undefined;
  }

  /**
   * 获取文件中的所有符号
   * @param filePath 文件路径
   * @returns 符号列表
   */
  getFileSymbols(filePath: string): SymbolInfo[] {
    const keys = this.fileSymbols.get(filePath) || [];
    return keys.map(key => this.symbols.get(key)!).filter(Boolean);
  }

  /**
   * 获取所有符号
   * @returns 符号列表
   */
  getAllSymbols(): SymbolInfo[] {
    return Array.from(this.symbols.values());
  }

  /**
   * 更新文件符号
   * @param filePath 文件路径
   */
  async updateFile(filePath: string): Promise<void> {
    // 移除旧的符号
    const oldKeys = this.fileSymbols.get(filePath) || [];
    for (const key of oldKeys) {
      this.symbols.delete(key);
    }
    this.fileSymbols.delete(filePath);

    // 重新处理文件
    await this.processFile(filePath);
  }

  /**
   * 清理符号表
   */
  clear(): void {
    this.symbols.clear();
    this.fileSymbols.clear();
    this.isBuilt = false;
  }

  /**
   * 检查符号表是否已构建
   */
  isBuiltTable(): boolean {
    return this.isBuilt;
  }
}