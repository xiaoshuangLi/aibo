/**
 * Tree-sitter 语法解析器
 * 
 * 中文名称：Tree-sitter语法解析器
 * 
 * 预期行为：
 * - 加载和管理Tree-sitter语言语法
 * - 提供增量式语法解析能力
 * - 支持AST查询和遍历
 * - 提供高效的代码结构分析
 * - 处理多语言支持
 * 
 * 行为分支：
 * 1. 正常解析：成功解析源代码，生成AST
 * 2. 语法错误：即使代码有语法错误也能提供部分AST
 * 3. 增量更新：只重新解析修改的代码部分
 * 4. 多语言支持：根据文件扩展名选择合适的语法
 * 5. 查询优化：使用Tree-sitter查询系统高效提取信息
 * 
 * @class TreeSitterParser
 */
import Parser from 'tree-sitter';
const JavaScript = require('tree-sitter-javascript');
const TypeScript = require('tree-sitter-typescript');

/**
 * 支持的语言映射
 */
const LANGUAGE_MAP: Record<string, any> = {
  '.js': JavaScript,
  '.jsx': JavaScript,
  '.ts': TypeScript.typescript,
  '.tsx': TypeScript.tsx
};

/**
 * Tree-sitter解析器配置
 */
export interface TreeSitterParserConfig {
  /** 工作目录 */
  workingDirectory: string;
}

/**
 * AST节点信息
 */
export interface AstNodeInfo {
  /** 节点类型 */
  type: string;
  /** 节点文本内容 */
  text: string;
  /** 节点位置 */
  startPosition: { row: number; column: number };
  /** 节点结束位置 */
  endPosition: { row: number; column: number };
  /** 子节点 */
  children?: AstNodeInfo[];
}

/**
 * Tree-sitter解析器类
 * 
 * 中文名称：Tree-sitter解析器类
 * 
 * 负责使用Tree-sitter进行语法解析和AST操作
 */
export class TreeSitterParser {
  private parsers: Map<string, Parser> = new Map();
  private config: TreeSitterParserConfig;

  /**
   * 创建Tree-sitter解析器实例
   * @param config 配置
   */
  constructor(config: TreeSitterParserConfig) {
    this.config = config;
  }

  /**
   * 获取文件扩展名
   * @param filePath 文件路径
   * @returns 扩展名
   */
  private getFileExtension(filePath: string): string {
    const ext = filePath.split('.').pop() || '';
    return `.${ext}`;
  }

  /**
   * 获取语言语法
   * @param filePath 文件路径
   * @returns 语言语法
   */
  private getLanguage(filePath: string): any {
    const ext = this.getFileExtension(filePath);
    const language = LANGUAGE_MAP[ext];
    
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }
    
    return language;
  }

  /**
   * 获取或创建解析器
   * @param filePath 文件路径
   * @returns 解析器实例
   */
  private getOrCreateParser(filePath: string): Parser {
    const ext = this.getFileExtension(filePath);
    
    if (this.parsers.has(ext)) {
      return this.parsers.get(ext)!;
    }

    const parser = new Parser();
    const language = this.getLanguage(filePath);
    parser.setLanguage(language);
    
    this.parsers.set(ext, parser);
    return parser;
  }

  /**
   * 解析源代码
   * @param sourceCode 源代码
   * @param filePath 文件路径（用于确定语言）
   * @returns AST树
   */
  parse(sourceCode: string, filePath: string): Parser.Tree {
    const parser = this.getOrCreateParser(filePath);
    return parser.parse(sourceCode);
  }

  /**
   * 增量解析（用于代码编辑场景）
   * @param oldTree 旧的AST树
   * @param sourceCode 新的源代码
   * @param startIndex 修改开始位置
   * @param oldEndIndex 旧内容结束位置
   * @param newEndIndex 新内容结束位置
   * @param filePath 文件路径
   * @returns 新的AST树
   */
  parseWithEdit(
    oldTree: Parser.Tree,
    sourceCode: string,
    startIndex: number,
    oldEndIndex: number,
    newEndIndex: number,
    filePath: string
  ): Parser.Tree {
    const parser = this.getOrCreateParser(filePath);
    const edit: Parser.Edit = {
      startIndex,
      oldEndIndex,
      newEndIndex,
      startPosition: { row: 0, column: 0 },
      oldEndPosition: { row: 0, column: 0 },
      newEndPosition: { row: 0, column: 0 }
    };
    
    // 简化的位置计算，实际应用中需要更精确的行列计算
    const tree = parser.parse(sourceCode, oldTree);
    return tree;
  }

  /**
   * 将AST节点转换为结构化信息
   * @param node AST节点
   * @param sourceCode 源代码
   * @returns 结构化节点信息
   */
  private nodeToInfo(node: Parser.SyntaxNode, sourceCode: string): AstNodeInfo {
    let startIndex = node.startIndex;
    let endIndex = node.endIndex;
    
    // 对于方法定义，检查前一个兄弟节点是否是装饰器
    if (node.type === 'method_definition' && node.parent) {
      const siblings = node.parent.children;
      const currentIndex = siblings.indexOf(node);
      
      if (currentIndex > 0) {
        // 从当前节点向前查找连续的装饰器
        for (let i = currentIndex - 1; i >= 0; i--) {
          const sibling = siblings[i];
          if (sibling.type === 'decorator') {
            startIndex = Math.min(startIndex, sibling.startIndex);
          } else if (sibling.type === 'comment' || /^\s*$/.test(sibling.text)) {
            // 跳过注释和空白
            continue;
          } else {
            // 遇到非装饰器、非注释、非空白节点，停止查找
            break;
          }
        }
      }
    }
    
    const text = sourceCode.slice(startIndex, endIndex);
    return {
      type: node.type,
      text,
      startPosition: node.startPosition,
      endPosition: node.endPosition
    };
  }

  /**
   * 查询函数定义
   * @param sourceCode 源代码
   * @param filePath 文件路径
   * @returns 函数定义列表
   */
  queryFunctions(sourceCode: string, filePath: string): AstNodeInfo[] {
    const tree = this.parse(sourceCode, filePath);
    const root = tree.rootNode;
    const functions: AstNodeInfo[] = [];

    // 遍历AST查找函数定义
    const visit = (node: Parser.SyntaxNode) => {
      if (node.type === 'function_declaration' || 
          node.type === 'method_definition' || 
          node.type === 'arrow_function' ||
          node.type === 'function_expression') {
        functions.push(this.nodeToInfo(node, sourceCode));
      }
      
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return functions;
  }

  /**
   * 查询类定义
   * @param sourceCode 源代码
   * @param filePath 文件路径
   * @returns 类定义列表
   */
  queryClasses(sourceCode: string, filePath: string): AstNodeInfo[] {
    const tree = this.parse(sourceCode, filePath);
    const root = tree.rootNode;
    const classes: AstNodeInfo[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      if (node.type === 'class_declaration' || node.type === 'class') {
        classes.push(this.nodeToInfo(node, sourceCode));
      }
      
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return classes;
  }

  /**
   * 查询导入语句
   * @param sourceCode 源代码
   * @param filePath 文件路径
   * @returns 导入语句列表
   */
  queryImports(sourceCode: string, filePath: string): AstNodeInfo[] {
    const tree = this.parse(sourceCode, filePath);
    const root = tree.rootNode;
    const imports: AstNodeInfo[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      if (node.type === 'import_statement' || node.type === 'import_declaration') {
        imports.push(this.nodeToInfo(node, sourceCode));
      }
      
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return imports;
  }

  /**
   * 提取接口定义（仅TypeScript）
   * @param sourceCode 源代码
   * @param filePath 文件路径
   * @returns 接口定义列表
   */
  queryInterfaces(sourceCode: string, filePath: string): AstNodeInfo[] {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return [];
    }

    const tree = this.parse(sourceCode, filePath);
    const root = tree.rootNode;
    const interfaces: AstNodeInfo[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      if (node.type === 'interface_declaration') {
        interfaces.push(this.nodeToInfo(node, sourceCode));
      }
      
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return interfaces;
  }

  /**
   * 提取类型定义（仅TypeScript）
   * @param sourceCode 源代码
   * @param filePath 文件路径
   * @returns 类型定义列表
   */
  queryTypeDefinitions(sourceCode: string, filePath: string): AstNodeInfo[] {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return [];
    }

    const tree = this.parse(sourceCode, filePath);
    const root = tree.rootNode;
    const types: AstNodeInfo[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      if (node.type === 'type_alias_declaration') {
        types.push(this.nodeToInfo(node, sourceCode));
      }
      
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return types;
  }

  /**
   * 查询变量声明
   * @param sourceCode 源代码
   * @param filePath 文件路径
   * @returns 变量声明列表
   */
  queryVariables(sourceCode: string, filePath: string): AstNodeInfo[] {
    const tree = this.parse(sourceCode, filePath);
    const root = tree.rootNode;
    const variables: AstNodeInfo[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      // 查找变量声明
      if (node.type === 'variable_declarator') {
        variables.push(this.nodeToInfo(node, sourceCode));
      }
      // 查找常量声明
      else if (node.type === 'lexical_declaration' && 
               (node.firstChild?.text === 'const' || node.firstChild?.text === 'let')) {
        // 遍历declarator子节点
        for (const child of node.children) {
          if (child.type === 'variable_declarator') {
            variables.push(this.nodeToInfo(child, sourceCode));
          }
        }
      }
      
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return variables;
  }

  /**
   * 查询依赖关系（导入和导出语句）
   * @param sourceCode 源代码
   * @param filePath 文件路径
   * @returns 依赖关系信息
   */
  queryDependencies(sourceCode: string, filePath: string): {
    imports: AstNodeInfo[];
    exports: AstNodeInfo[];
  } {
    const tree = this.parse(sourceCode, filePath);
    const root = tree.rootNode;
    const imports: AstNodeInfo[] = [];
    const exports: AstNodeInfo[] = [];

    const visit = (node: Parser.SyntaxNode) => {
      // 处理导入语句
      if (node.type === 'import_statement') {
        imports.push(this.nodeToInfo(node, sourceCode));
      }
      // 处理导出语句
      else if (node.type === 'export_statement' || 
               node.type === 'export_clause' ||
               node.type === 'export_default_declaration' ||
               node.type === 'export_named_declaration') {
        exports.push(this.nodeToInfo(node, sourceCode));
      }
      // 处理默认导出
      else if (node.type === 'export' && node.parent?.type === 'program') {
        exports.push(this.nodeToInfo(node, sourceCode));
      }
      
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return { imports, exports };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.parsers.clear();
  }
}