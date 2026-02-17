/**
 * 依赖关系分析器
 * 
 * 中文名称：依赖关系分析器
 * 
 * 预期行为：
 * - 解析TypeScript/JavaScript文件的导入和导出语句
 * - 提取模块依赖关系
 * - 支持各种导入/导出语法
 * - 提供结构化的依赖信息
 * 
 * @class DependencyAnalyzer
 */
import { AstNodeInfo } from '@/infrastructure/code-analysis/tree-sitter-parser';

/**
 * 导入信息
 */
export interface ImportInfo {
  /** 导入类型：named, default, namespace, sideEffect */
  type: 'named' | 'default' | 'namespace' | 'sideEffect';
  /** 模块源路径 */
  source: string;
  /** 导入的标识符（对于命名导入） */
  specifiers?: string[];
  /** 默认导入名称 */
  defaultName?: string;
  /** 命名空间导入名称 */
  namespaceName?: string;
  /** 原始AST节点 */
  node: AstNodeInfo;
}

/**
 * 导出信息
 */
export interface ExportInfo {
  /** 导出类型：named, default, all, declaration */
  type: 'named' | 'default' | 'all' | 'declaration';
  /** 导出的标识符 */
  specifiers?: string[];
  /** 源模块路径（对于重新导出） */
  source?: string;
  /** 原始AST节点 */
  node: AstNodeInfo;
}

/**
 * 依赖关系结果
 */
export interface DependencyResult {
  /** 文件路径 */
  filePath: string;
  /** 导入列表 */
  imports: ImportInfo[];
  /** 导出列表 */
  exports: ExportInfo[];
  /** 外部依赖（来自node_modules） */
  externalDependencies: string[];
  /** 内部依赖（项目内文件） */
  internalDependencies: string[];
}

/**
 * 依赖关系分析器类
 */
export class DependencyAnalyzer {
  
  /**
   * 从AST节点解析导入信息
   * @param node AST节点
   * @returns 导入信息
   */
  parseImport(node: AstNodeInfo): ImportInfo | null {
    const text = node.text.trim();
    
    // 侧效应导入: import 'module'
    if (text.startsWith("import '") || text.startsWith('import "')) {
      const match = text.match(/import\s+(['"])([^'"]+)\1/);
      if (match) {
        return {
          type: 'sideEffect',
          source: match[2],
          node
        };
      }
    }
    
    // 默认导入: import defaultName from 'module'
    const defaultMatch = text.match(/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+(['"])([^'"]+)\2/);
    if (defaultMatch) {
      return {
        type: 'default',
        source: defaultMatch[3],
        defaultName: defaultMatch[1],
        node
      };
    }
    
    // 命名空间导入: import * as name from 'module'
    const namespaceMatch = text.match(/import\s+\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+(['"])([^'"]+)\2/);
    if (namespaceMatch) {
      return {
        type: 'namespace',
        source: namespaceMatch[3],
        namespaceName: namespaceMatch[1],
        node
      };
    }
    
    // 命名导入: import { name1, name2 } from 'module'
    // 或混合导入: import defaultName, { name1 } from 'module'
    const namedMatch = text.match(/import\s+(.*?)\s+from\s+(['"])([^'"]+)\2/);
    if (namedMatch) {
      const importPart = namedMatch[1];
      const source = namedMatch[3];
      
      // 检查是否包含默认导入
      let defaultName: string | undefined;
      let specifiers: string[] = [];
      
      if (importPart.includes(',')) {
        // 混合导入: defaultName, { specifiers }
        const parts = importPart.split(',').map(p => p.trim());
        defaultName = parts[0];
        if (parts[1]) {
          const specifiersText = parts[1].replace(/[{}]/g, '');
          specifiers = specifiersText.split(',').map(s => s.trim().split(' as ')[0]).filter(s => s.length > 0);
        }
      } else if (importPart.startsWith('{')) {
        // 纯命名导入
        const specifiersText = importPart.replace(/[{}]/g, '');
        specifiers = specifiersText.split(',').map(s => s.trim().split(' as ')[0]).filter(s => s.length > 0);
      } else {
        // 只有默认导入
        defaultName = importPart;
      }
      
      return {
        type: specifiers.length > 0 ? 'named' : 'default',
        source,
        defaultName,
        specifiers: specifiers.length > 0 ? specifiers : undefined,
        node
      };
    }
    
    return null;
  }
  
  /**
   * 从AST节点解析导出信息
   * @param node AST节点
   * @returns 导出信息
   */
  parseExport(node: AstNodeInfo): ExportInfo | null {
    const text = node.text.trim();
    
    // 默认导出: export default ...
    if (text.startsWith('export default')) {
      return {
        type: 'default',
        node
      };
    }
    
    // 重新导出所有: export * from 'module'
    const reexportAllMatch = text.match(/export\s+\*\s+from\s+(['"])([^'"]+)\1/);
    if (reexportAllMatch) {
      return {
        type: 'all',
        source: reexportAllMatch[2],
        node
      };
    }
    
    // 重新导出命名: export { name1, name2 } from 'module'
    const reexportNamedMatch = text.match(/export\s+({.*?})\s+from\s+(['"])([^'"]+)\2/);
    if (reexportNamedMatch) {
      const specifiersText = reexportNamedMatch[1].replace(/[{}]/g, '');
      const specifiers = specifiersText.split(',').map(s => s.trim().split(' as ')[0]).filter(s => s.length > 0);
      return {
        type: 'named',
        source: reexportNamedMatch[3],
        specifiers,
        node
      };
    }
    
    // 命名导出: export { name1, name2 }
    const namedExportMatch = text.match(/export\s+({.*?})/);
    if (namedExportMatch) {
      const specifiersText = namedExportMatch[1].replace(/[{}]/g, '');
      const specifiers = specifiersText.split(',').map(s => s.trim().split(' as ')[0]).filter(s => s.length > 0);
      return {
        type: 'named',
        specifiers,
        node
      };
    }
    
    // 声明导出: export function/class/const/let/var
    if (text.startsWith('export ')) {
      return {
        type: 'declaration',
        node
      };
    }
    
    return null;
  }
  
  /**
   * 分析文件的依赖关系
   * @param filePath 文件路径
   * @param dependencies 从Tree-sitter获取的依赖信息
   * @returns 依赖关系结果
   */
  analyzeDependencies(filePath: string, dependencies: { imports: AstNodeInfo[]; exports: AstNodeInfo[] }): DependencyResult {
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    
    // 解析导入
    for (const node of dependencies.imports) {
      const importInfo = this.parseImport(node);
      if (importInfo) {
        imports.push(importInfo);
      }
    }
    
    // 解析导出
    for (const node of dependencies.exports) {
      const exportInfo = this.parseExport(node);
      if (exportInfo) {
        exports.push(exportInfo);
      }
    }
    
    // 分类依赖
    const externalDependencies: string[] = [];
    const internalDependencies: string[] = [];
    
    for (const imp of imports) {
      if (imp.source.startsWith('.') || imp.source.startsWith('/')) {
        internalDependencies.push(imp.source);
      } else if (!imp.source.startsWith('@') || imp.source.startsWith('@types/')) {
        // 非作用域包或@types包视为外部依赖
        externalDependencies.push(imp.source);
      } else {
        // 作用域包
        externalDependencies.push(imp.source);
      }
    }
    
    // 添加重新导出的依赖
    for (const exp of exports) {
      if (exp.source && (exp.source.startsWith('.') || exp.source.startsWith('/'))) {
        internalDependencies.push(exp.source);
      } else if (exp.source) {
        externalDependencies.push(exp.source);
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
   * 格式化依赖关系为人类可读的字符串
   * @param result 依赖关系结果
   * @returns 格式化的字符串
   */
  formatDependencies(result: DependencyResult): string {
    const lines: string[] = [];
    
    lines.push(`Dependencies for: ${result.filePath}`);
    lines.push('');
    
    if (result.imports.length > 0) {
      lines.push('Imports:');
      for (const imp of result.imports) {
        if (imp.type === 'sideEffect') {
          lines.push(`  - Side effect: ${imp.source}`);
        } else if (imp.type === 'default') {
          lines.push(`  - Default: ${imp.defaultName || ''} from ${imp.source}`);
        } else if (imp.type === 'namespace') {
          lines.push(`  - Namespace: * as ${imp.namespaceName} from ${imp.source}`);
        } else if (imp.type === 'named') {
          const specifiers = imp.specifiers?.join(', ') || '';
          const defaultPart = imp.defaultName ? `${imp.defaultName}, ` : '';
          lines.push(`  - Named: ${defaultPart}{${specifiers}} from ${imp.source}`);
        }
      }
      lines.push('');
    }
    
    if (result.exports.length > 0) {
      lines.push('Exports:');
      for (const exp of result.exports) {
        if (exp.type === 'default') {
          lines.push('  - Default export');
        } else if (exp.type === 'all') {
          lines.push(`  - Re-export all from ${exp.source || ''}`);
        } else if (exp.type === 'named') {
          const specifiers = exp.specifiers?.join(', ') || '';
          lines.push(`  - Named: {${specifiers}}${exp.source ? ` from ${exp.source}` : ''}`);
        } else if (exp.type === 'declaration') {
          lines.push('  - Declaration export');
        }
      }
      lines.push('');
    }
    
    if (result.externalDependencies.length > 0) {
      lines.push('External dependencies:');
      for (const dep of result.externalDependencies) {
        lines.push(`  - ${dep}`);
      }
      lines.push('');
    }
    
    if (result.internalDependencies.length > 0) {
      lines.push('Internal dependencies:');
      for (const dep of result.internalDependencies) {
        lines.push(`  - ${dep}`);
      }
    }
    
    return lines.join('\n');
  }
}