/**
 * 混合代码读取器工具
 * 
 * 中文名称：混合代码读取器工具
 * 
 * 预期行为：
 * - 提供智能代码上下文读取功能
 * - 显著减少token消耗
 * - 提供多种上下文请求类型
 * - 支持缓存和性能优化
 * - 与现有工具系统集成
 * 
 * 行为分支：
 * 1. 定义查询：获取函数/类的定义信息
 * 2. 引用查询：获取符号的所有引用
 * 3. 实现查询：获取完整的函数/类实现
 * 4. 签名查询：只获取公共API签名
 * 5. 完整上下文：获取完整的优化代码上下文
 * 6. 依赖查询：获取文件的依赖关系
 * 
 * @tool hybrid-code-reader
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HybridCodeReader, HybridCodeReaderOptions } from "../infrastructure/code-analysis/hybrid-code-reader";

/**
 * 混合代码读取器工具实例
 */
let hybridCodeReader: HybridCodeReader | null = null;

/**
 * 获取或创建混合代码读取器实例
 */
export function getHybridCodeReader(): HybridCodeReader {
  if (!hybridCodeReader) {
    hybridCodeReader = new HybridCodeReader({
      workingDirectory: process.cwd(),
      defaultMaxTokens: Infinity
    });
  }
  return hybridCodeReader;
}

/**
 * 混合代码读取工具
 * 
 * 中文名称：混合代码读取工具
 * 
 * 预期行为：
 * - 接收文件路径、请求类型、位置信息等参数
 * - 使用混合代码读取器获取优化的代码上下文
 * - 返回结构化的JSON响应，包含优化结果和统计信息
 * - 处理各种错误情况并提供有用的错误信息
 * 
 * 行为分支：
 * 1. 正常执行：成功获取优化的代码上下文，返回包含context、savingsPercentage等字段的JSON
 * 2. 文件不支持：文件类型不被支持时返回错误信息
 * 3. 位置无效：提供的位置信息无效时返回错误信息
 * 4. Token超限：即使优化后仍超出token限制时返回截断的上下文
 * 5. 技术降级：当首选技术不可用时自动降级到备选方案
 * 
 * @param filePath - 要分析的文件路径（相对路径或绝对路径）
 * @param requestType - 请求类型：'definition' | 'references' | 'implementation' | 'signature' | 'full-context' | 'dependencies'
 * @param line - 行号（0-based，用于definition和references请求类型）
 * @param character - 字符位置（0-based，用于definition和references请求类型）
 * @param symbolName - 符号名称（可选，用于definition请求类型）
 * @param maxTokens - 最大token限制（可选，默认2000）
 * @returns Promise<string> - 包含优化结果的JSON字符串，包含success、context、savingsPercentage、technologiesUsed等字段
 * 
 * @example
 * ```typescript
 * // 获取函数定义
 * const result = await hybridCodeReaderTool.invoke({ 
 *   filePath: "src/main.ts", 
 *   requestType: "definition", 
 *   line: 45, 
 *   character: 12 
 * });
 * 
 * // 获取公共API签名
 * const result = await hybridCodeReaderTool.invoke({ 
 *   filePath: "src/api.ts", 
 *   requestType: "signature" 
 * });
 * 
 * // 获取完整上下文（限制token）
 * const result = await hybridCodeReaderTool.invoke({ 
 *   filePath: "src/complex-module.ts", 
 *   requestType: "full-context",
 *   maxTokens: 1000
 * });
 * ```
 * 
 * @note
 * - 该工具主要用于代码分析、重构、调试等场景
 * - 相比直接读取文件，可节省60-90%的token消耗
 * - 支持TypeScript、JavaScript、JSX、TSX文件
 * - 自动缓存结果以提高性能
 */
export const hybridCodeReaderTool = tool(
  async ({ filePath, requestType, line, character, symbolName, maxTokens }) => {
    try {
      const reader = getHybridCodeReader();
      
      // 检查文件是否支持
      if (!reader.isSupportedFile(filePath)) {
        return JSON.stringify({
          success: false,
          error: "Unsupported file type",
          message: `File type not supported: ${filePath}`,
          supportedTypes: [".js", ".jsx", ".ts", ".tsx"]
        });
      }

      const options: HybridCodeReaderOptions = {
        filePath,
        requestType,
        position: line !== undefined && character !== undefined ? { line, character } : undefined,
        symbolName,
        maxTokens
      };

      const result = await reader.getOptimizedContext(options);
      
      return JSON.stringify({
        success: true,
        context: result.context,
        originalTokens: result.originalTokens,
        optimizedTokens: result.optimizedTokens,
        savingsPercentage: result.savingsPercentage,
        technologiesUsed: result.technologiesUsed,
        message: `Successfully optimized code context with ${result.savingsPercentage}% token savings`
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to read and optimize code context",
        filePath,
        requestType
      });
    }
  },
  {
    name: "hybrid_code_reader",
    description: `Intelligent code reading tool that uses LSP, Tree-sitter, and symbol tables to provide optimized code context with minimal token usage. Supports TypeScript, JavaScript, JSX, and TSX files. Can extract definitions, references, implementations, signatures, full context, or dependencies.`,
    schema: z.object({
      filePath: z.string().describe("Path to the file to analyze (relative or absolute)"),
      requestType: z.enum(['definition', 'references', 'implementation', 'signature', 'full-context', 'dependencies']).describe("Type of context to request"),
      line: z.number().optional().describe("Line number (0-based) for definition and references requests"),
      character: z.number().optional().describe("Character position (0-based) for definition and references requests"),
      symbolName: z.string().optional().describe("Symbol name for definition requests"),
      maxTokens: z.number().optional().describe("Maximum token limit (default: 2000)")
    })
  }
);

/**
 * 异步获取混合代码读取器工具的方法
 * 
 * @returns Promise<Array<any>> - 包含混合代码读取器工具的数组
 */
export default async function getHybridCodeReaderTools() {
  return [hybridCodeReaderTool];
}
