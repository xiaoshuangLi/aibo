/**
 * LSP 工具实现
 * 
 * 基于 Tritlo/lsp-mcp 仓库的实现重新编写
 * 移除了所有 MCP 相关代码，专注于纯 LSP 功能
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { LspClientManager, LspClientConfig } from "../infrastructure/code-analysis/lsp-client";
import * as fs from 'fs';
import * as path from 'path';

// const a:number = false; // Temporarily commented out for LSP testing

// 全局状态管理
let currentRootDir: string | null = null;
let logLevel: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency' = 'info';

/**
 * 日志函数
 */
function log(level: typeof logLevel, message: string): void {
  const levelOrder = ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'];
  const currentLevelIndex = levelOrder.indexOf(logLevel);
  const messageLevelIndex = levelOrder.indexOf(level);
  
  if (messageLevelIndex <= currentLevelIndex) {
    console.log(`[LSP ${level.toUpperCase()}] ${message}`);
  }
}

/**
 * 获取当前使用的 rootDir
 */
function getCurrentRootDir(): string {
  if (!currentRootDir) {
    throw new Error("No root directory specified. Call start_lsp first with a root directory.");
  }
  return currentRootDir;
}

/**
 * 创建文件URI
 */
function createFileUri(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(getCurrentRootDir(), filePath);
  return `file://${absolutePath}`;
}

/**
 * 验证文件存在
 */
function validateFileExists(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(getCurrentRootDir(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  return absolutePath;
}

// 工具定义

/**
 * start_lsp - 启动LSP服务器
 */
export const startLspTool = tool(
  async ({ root_dir }: { root_dir: string }) => {
    try {
      log('info', `Starting LSP server with root directory: ${root_dir}`);
      
      // 验证根目录存在
      if (!fs.existsSync(root_dir)) {
        throw new Error(`Root directory does not exist: ${root_dir}`);
      }
      
      // 配置LSP客户端
      const config: LspClientConfig = {
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: root_dir,
        timeout: 60000, // 增加超时时间到60秒
        maxBufferSize: 50 * 1024 * 1024 // 增加缓冲区到50MB
      };
      
      // 获取或创建LSP客户端
      await LspClientManager.getClient(root_dir, config);
      currentRootDir = root_dir;
      
      return JSON.stringify({
        success: true,
        content: [{ type: "text", text: `LSP server successfully started with root directory: ${root_dir}` }]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error starting LSP server: ${errorMessage}`);
      throw new Error(`Failed to start LSP server: ${errorMessage}`);
    }
  },
  {
    name: "start_lsp",
    description: "启动LSP服务器并指定根目录。重要：在使用任何其他LSP功能之前必须先调用此工具。根目录应指向项目的基础文件夹，通常包含tsconfig.json、package.json或其他语言特定的项目配置文件。所有其他工具调用中的文件路径都将相对于此根目录进行解析。",
    schema: z.object({
      root_dir: z.string().describe("LSP服务器的根目录")
    })
  }
);

/**
 * restart_lsp_server - 重启LSP服务器
 */
export const restartLspServerTool = tool(
  async ({ root_dir }: { root_dir?: string }) => {
    try {
      const restartRootDir = root_dir || currentRootDir;
      if (!restartRootDir) {
        throw new Error("No root directory specified and no previous LSP server to restart");
      }
      log('info', `Restarting LSP server${root_dir ? ` with root directory: ${root_dir}` : ''}...`);
      
      // 配置LSP客户端
      const config: LspClientConfig = {
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: restartRootDir,
        timeout: 60000, // 增加超时时间到60秒
        maxBufferSize: 50 * 1024 * 1024 // 增加缓冲区到50MB
      };
      
      // 重启LSP客户端
      await LspClientManager.restartClient(restartRootDir, config);
      currentRootDir = restartRootDir;
      
      return JSON.stringify({
        success: true,
        content: [{
          type: "text",
          text: root_dir
            ? `LSP server successfully restarted and initialized with root directory: ${root_dir}`
            : "LSP server successfully restarted"
        }]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error restarting LSP server: ${errorMessage}`);
      throw new Error(`Failed to restart LSP server: ${errorMessage}`);
    }
  },
  {
    name: "restart_lsp_server",
    description: "重启LSP服务器进程。当LSP服务器无响应、数据过时或需要应用配置更改时，使用此工具重置LSP服务器。可选择性地使用新的根目录重新初始化。在排查语言服务器问题或切换项目时非常有用。",
    schema: z.object({
      root_dir: z.string().optional().describe("LSP服务器的根目录。如果未提供，服务器将不会自动初始化。")
    })
  }
);

/**
 * open_document - 打开文档
 */
export const openDocumentTool = tool(
  async ({ file_path }: { file_path: string }) => {
    try {
      if (!currentRootDir) {
        throw new Error("LSP server not started. Call start_lsp first with a root directory.");
      }
      
      log('debug', `Opening document: ${file_path}`);
      
      // 验证文件存在
      validateFileExists(file_path);
      
      // 获取LSP客户端并打开文档
      const client = await LspClientManager.getClient(currentRootDir);
      await client.openDocument(file_path);
      
      return JSON.stringify({
        success: true,
        content: [{ type: "text", text: `File successfully opened: ${file_path}` }]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error opening document: ${errorMessage}`);
      throw new Error(`Failed to open document: ${errorMessage}`);
    }
  },
  {
    name: "open_document",
    description: "在LSP服务器中打开文件进行分析。在对文件执行获取诊断、悬停信息或补全等操作之前，请先使用此工具。文件将保持打开状态以供持续分析，直到显式关闭。",
    schema: z.object({
      file_path: z.string().describe("要打开的文件路径")
    })
  }
);

/**
 * close_document - 关闭文档
 */
export const closeDocumentTool = tool(
  async ({ file_path }: { file_path: string }) => {
    try {
      if (!currentRootDir) {
        throw new Error("LSP server not started. Call start_lsp first with a root directory.");
      }
      
      log('debug', `Closing document: ${file_path}`);
      
      // 获取LSP客户端并关闭文档
      const client = await LspClientManager.getClient(currentRootDir);
      await client.closeDocument(file_path);
      
      return JSON.stringify({
        success: true,
        content: [{ type: "text", text: `File successfully closed: ${file_path}` }]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error closing document: ${errorMessage}`);
      throw new Error(`Failed to close document: ${errorMessage}`);
    }
  },
  {
    name: "close_document",
    description: "在LSP服务器中关闭文件。当完成对文件的操作后，使用此工具释放资源并减少内存使用。在长时间运行的会话中或处理大型代码库时，关闭不再需要主动分析的文件是一个良好的实践。",
    schema: z.object({
      file_path: z.string().describe("要关闭的文件路径")
    })
  }
);

/**
 * get_info_on_location - 获取位置信息（hover）
 */
export const getInfoOnLocationTool = tool(
  async ({ file_path, line, column }: { file_path: string; line: number; column: number }) => {
    try {
      if (!currentRootDir) {
        throw new Error("LSP server not started. Call start_lsp first with a root directory.");
      }
      
      log('debug', `Getting info on location in file: ${file_path} (${line}:${column})`);
      
      // 验证文件存在
      validateFileExists(file_path);
      
      // 获取LSP客户端并获取悬停信息
      const client = await LspClientManager.getClient(currentRootDir);
      const result = await client.getHover(file_path, { line: line - 1, character: column - 1 }); // 转换为0-based
      
      let hoverText = '';
      if (result?.contents) {
        if (typeof result.contents === 'string') {
          hoverText = result.contents;
        } else if (result.contents.value) {
          hoverText = result.contents.value;
        } else if (Array.isArray(result.contents)) {
          hoverText = result.contents.map((item: any) =>
            typeof item === 'string' ? item : item.value || ''
          ).join('\n');
        }
      }
      
      log('debug', `Returned hover info: ${hoverText.slice(0, 100)}${hoverText.length > 100 ? '...' : ''}`);
      
      return JSON.stringify({
        success: true,
        content: [{ type: "text", text: hoverText }]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting info on location: ${errorMessage}`);
      throw new Error(`Failed to get info on location: ${errorMessage}`);
    }
  },
  {
    name: "get_info_on_location",
    description: "通过LSP悬停功能获取文件中特定位置的信息。使用此工具可以检索代码中符号的详细类型信息、文档和其他上下文详情。特别适用于理解变量类型、函数签名和模块文档。当需要更好地了解特定函数在该上下文中的作用时，请使用此工具。需要先打开文件。",
    schema: z.object({
      file_path: z.string().describe("文件路径"),
      line: z.number().describe("行号（1-based）"),
      column: z.number().describe("列位置（1-based）")
    })
  }
);

/**
 * get_completions - 获取代码补全
 */
export const getCompletionsTool = tool(
  async ({ file_path, line, column }: { file_path: string; line: number; column: number }) => {
    try {
      if (!currentRootDir) {
        throw new Error("LSP server not started. Call start_lsp first with a root directory.");
      }
      
      log('debug', `Getting completions in file: ${file_path} (${line}:${column})`);
      
      // 验证文件存在
      validateFileExists(file_path);
      
      // 获取LSP客户端并获取补全信息
      const client = await LspClientManager.getClient(currentRootDir);
      const completions = await client.getCompletion(file_path, { line: line - 1, character: column - 1 }); // 转换为0-based
      
      log('debug', `Returned ${completions.length} completions`);
      
      return JSON.stringify({
        success: true,
        content: [{ type: "text", text: JSON.stringify(completions, null, 2) }]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting completions: ${errorMessage}`);
      throw new Error(`Failed to get completions: ${errorMessage}`);
    }
  },
  {
    name: "get_completions",
    description: "Get completion suggestions at a specific location in a file. Use this tool to retrieve code completion options based on the current context, including variable names, function calls, object properties, and more. Helpful for code assistance and auto-completion at a particular location. Use this when determining which functions you have available in a given package, for example when changing libraries. Requires the file to be opened first.",
    schema: z.object({
      file_path: z.string().describe("Path to the file"),
      line: z.number().describe("Line number (1-based)"),
      column: z.number().describe("Column position (1-based)")
    })
  }
);

/**
 * get_code_actions - 获取代码操作
 */
export const getCodeActionsTool = tool(
  async ({ file_path, start_line, start_column, end_line, end_column }: { 
    file_path: string; 
    start_line: number; 
    start_column: number; 
    end_line: number; 
    end_column: number 
  }) => {
    try {
      if (!currentRootDir) {
        throw new Error("LSP server not started. Call start_lsp first with a root directory.");
      }
      
      log('debug', `Getting code actions in file: ${file_path} (${start_line}:${start_column} to ${end_line}:${end_column})`);
      
      // 验证文件存在
      validateFileExists(file_path);
      
      // 获取LSP客户端并获取代码操作
      const client = await LspClientManager.getClient(currentRootDir);
      const codeActions = await client.getCodeActions(file_path, {
        start: { line: start_line - 1, character: start_column - 1 }, // 转换为0-based
        end: { line: end_line - 1, character: end_column - 1 }
      });
      
      log('debug', `Returned ${codeActions.length} code actions`);
      
      return JSON.stringify({
        success: true,
        content: [{ type: "text", text: JSON.stringify(codeActions, null, 2) }]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting code actions: ${errorMessage}`);
      throw new Error(`Failed to get code actions: ${errorMessage}`);
    }
  },
  {
    name: "get_code_actions",
    description: "Get code actions for a specific range in a file. Use this tool to obtain available refactorings, quick fixes, and other code modifications that can be applied to a selected code range. Examples include adding imports, fixing errors, or implementing interfaces. Requires the file to be opened first.",
    schema: z.object({
      file_path: z.string().describe("Path to the file"),
      start_line: z.number().describe("Start line number (1-based)"),
      start_column: z.number().describe("Start column position (1-based)"),
      end_line: z.number().describe("End line number (1-based)"),
      end_column: z.number().describe("End column position (1-based)")
    })
  }
);

/**
 * get_diagnostics - 获取诊断信息
 */
export const getDiagnosticsTool = tool(
  async ({ file_path }: { file_path?: string }) => {
    try {
      if (!currentRootDir) {
        throw new Error("LSP server not started. Call start_lsp first with a root directory.");
      }
      
      const client = await LspClientManager.getClient(currentRootDir);
      
      if (file_path) {
        log('debug', `Getting diagnostics for file: ${file_path}`);
        
        // 验证文件存在
        validateFileExists(file_path);
        
        const diagnostics = await client.getDiagnostics(file_path);
        const fileUri = createFileUri(file_path);
        
        return JSON.stringify({
          success: true,
          content: [{ type: "text", text: JSON.stringify({ [fileUri]: diagnostics }, null, 2) }]
        });
      } else {
        log('debug', "Getting diagnostics for all files");
        const allDiagnostics = client.getAllDiagnostics();
        
        // 转换Map为对象
        const diagnosticsObject: Record<string, any[]> = {};
        allDiagnostics.forEach((value: any[], key: string) => {
          diagnosticsObject[key] = value;
        });
        
        return JSON.stringify({
          success: true,
          content: [{ type: "text", text: JSON.stringify(diagnosticsObject, null, 2) }]
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting diagnostics: ${errorMessage}`);
      throw new Error(`Failed to get diagnostics: ${errorMessage}`);
    }
  },
  {
    name: "get_diagnostics",
    description: "Get diagnostic messages (errors, warnings) for files. Use this tool to identify problems in code files such as syntax errors, type mismatches, or other issues detected by the language server. When used without a file_path, returns diagnostics for all open files. Requires files to be opened first.",
    schema: z.object({
      file_path: z.string().optional().describe("Path to the file to get diagnostics for. If not provided, returns diagnostics for all open files.")
    })
  }
);

/**
 * set_log_level - 设置日志级别
 */
export const setLogLevelTool = tool(
  async ({ level }: { level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency' }) => {
    logLevel = level;
    return JSON.stringify({
      success: true,
      content: [{ type: "text", text: `Log level set to: ${level}` }]
    });
  },
  {
    name: "set_log_level",
    description: "Set the server logging level. Use this tool to control the verbosity of logs generated by the LSP server. Available levels from least to most verbose: emergency, alert, critical, error, warning, notice, info, debug. Increasing verbosity can help troubleshoot issues but may generate large amounts of output.",
    schema: z.object({
      level: z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'])
        .describe("The logging level to set")
    })
  }
);

/**
 * 获取所有LSP工具
 */
export default async function getLspTools() {
  return [
    startLspTool,
    restartLspServerTool,
    openDocumentTool,
    closeDocumentTool,
    getInfoOnLocationTool,
    getCompletionsTool,
    getCodeActionsTool,
    getDiagnosticsTool,
    setLogLevelTool
  ];
}