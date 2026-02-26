/**
 * LangChain 集成的 LSP 工具集 - 完整重构版本
 * 
 * 基于重构的 LspClient 实现，提供与 LangChain 兼容的工具接口
 * 支持完整的代码分析功能，包括悬停、补全、定义、引用等
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  LspClient,
  LspClientManager,
  LspClientConfig,
  Position,
  Range,
  Diagnostic,
  Hover,
  CompletionItem,
  CodeAction,
  Definition,
  References,
  SymbolInformation
} from '../infrastructure/code-analysis/lsp-client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 工具返回值类型
 */
interface ToolResult {
  success: boolean;
  content: Array<{ type: string; text: string }>;
  error?: string;
}

/**
 * 全局状态管理
 */
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
    console.log(`[LSP-TOOL ${level.toUpperCase()}] ${message}`);
  }
}

/**
 * 获取当前根目录
 */
function getCurrentRootDir(): string {
  if (!currentRootDir) {
    throw new Error(
      'No root directory specified. Call start_lsp first with a root directory.'
    );
  }
  return currentRootDir;
}

/**
 * 验证文件存在
 */
function validateFileExists(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(getCurrentRootDir(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  return absolutePath;
}

/**
 * 创建标准化的结果对象
 */
function createSuccessResult(text: string): ToolResult {
  return {
    success: true,
    content: [{ type: 'text', text }]
  };
}

function createErrorResult(error: string): ToolResult {
  return {
    success: false,
    content: [{ type: 'text', text: error }],
    error
  };
}

/**
 * start_lsp - 启动 LSP 服务器
 */
export const startLspTool = tool(
  async ({ root_dir }: { root_dir: string }) => {
    try {
      log('info', `Starting LSP server with root directory: ${root_dir}`);

      // 验证根目录存在
      if (!fs.existsSync(root_dir)) {
        throw new Error(`Root directory does not exist: ${root_dir}`);
      }

      // 配置 LSP 客户端
      const config: LspClientConfig = {
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: root_dir,
        timeout: 60000,
        maxBufferSize: 50 * 1024 * 1024
      };

      // 获取或创建 LSP 客户端
      await LspClientManager.getClient(root_dir, config);
      currentRootDir = root_dir;

      log('info', `LSP server started successfully with root: ${root_dir}`);

      return JSON.stringify(
        createSuccessResult(
          `LSP server successfully started with root directory: ${root_dir}`
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error starting LSP server: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to start LSP server: ${errorMessage}`));
    }
  },
  {
    name: 'start_lsp',
    description:
      '启动 LSP 服务器并指定根目录。重要：在使用任何其他 LSP 功能之前必须先调用此工具。根目录应指向项目的基础文件夹，通常包含 tsconfig.json、package.json 等配置文件。',
    schema: z.object({
      root_dir: z.string().describe('LSP 服务器的根目录')
    })
  }
);

/**
 * restart_lsp_server - 重启 LSP 服务器
 */
export const restartLspServerTool = tool(
  async ({ root_dir }: { root_dir?: string }) => {
    try {
      const restartRootDir = root_dir || currentRootDir;
      if (!restartRootDir) {
        throw new Error('No root directory specified and no previous LSP server to restart');
      }

      log('info', `Restarting LSP server${root_dir ? ` with root: ${root_dir}` : ''}...`);

      const config: LspClientConfig = {
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: restartRootDir,
        timeout: 60000,
        maxBufferSize: 50 * 1024 * 1024
      };

      await LspClientManager.restartClient(restartRootDir, config);
      currentRootDir = restartRootDir;

      log('info', 'LSP server restarted successfully');

      return JSON.stringify(
        createSuccessResult(
          `LSP server successfully restarted with root directory: ${restartRootDir}`
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error restarting LSP server: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to restart LSP server: ${errorMessage}`));
    }
  },
  {
    name: 'restart_lsp_server',
    description:
      '重启 LSP 服务器进程。当 LSP 服务器无响应、数据过时或需要应用配置更改时，使用此工具重置 LSP 服务器。',
    schema: z.object({
      root_dir: z.string().optional().describe('LSP 服务器的根目录。如果未提供，将使用之前的根目录。')
    })
  }
);

/**
 * open_document - 在 LSP 服务器中打开文件
 */
export const openDocumentTool = tool(
  async ({ file_path }: { file_path: string }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Opening document: ${file_path}`);

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      await client.openDocument(file_path);

      log('debug', `Document opened: ${file_path}`);

      return JSON.stringify(createSuccessResult(`File successfully opened: ${file_path}`));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error opening document: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to open document: ${errorMessage}`));
    }
  },
  {
    name: 'open_document',
    description:
      '在 LSP 服务器中打开文件进行分析。在对文件执行获取诊断、悬停信息或补全等操作之前，请先使用此工具。',
    schema: z.object({
      file_path: z.string().describe('要打开的文件路径')
    })
  }
);

/**
 * close_document - 关闭文件
 */
export const closeDocumentTool = tool(
  async ({ file_path }: { file_path: string }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Closing document: ${file_path}`);

      const client = await LspClientManager.getClient(rootDir);
      await client.closeDocument(file_path);

      log('debug', `Document closed: ${file_path}`);

      return JSON.stringify(createSuccessResult(`File successfully closed: ${file_path}`));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error closing document: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to close document: ${errorMessage}`));
    }
  },
  {
    name: 'close_document',
    description:
      '在 LSP 服务器中关闭文件。当完成对文件的操作后，使用此工具释放资源并减少内存使用。',
    schema: z.object({
      file_path: z.string().describe('要关闭的文件路径')
    })
  }
);

/**
 * get_hover_info - 获取悬停信息（Hover）
 */
export const getHoverInfoTool = tool(
  async ({ file_path, line, column }: { file_path: string; line: number; column: number }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Getting hover info: ${file_path} (${line}:${column})`);

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      await client.openDocument(file_path);
      const hover = await client.getHover(file_path, {
        line: line - 1,
        character: column - 1
      });

      if (!hover) {
        return JSON.stringify(createSuccessResult('No hover information available'));
      }

      let hoverText = '';
      if (typeof hover.contents === 'string') {
        hoverText = hover.contents;
      } else if (Array.isArray(hover.contents)) {
        hoverText = hover.contents
          .map((item: any) => (typeof item === 'string' ? item : item.value || ''))
          .join('\n');
      } else if (hover.contents && typeof hover.contents === 'object') {
        hoverText = (hover.contents as any).value || JSON.stringify(hover.contents);
      }

      log('debug', `Hover info retrieved: ${hoverText.substring(0, 100)}`);

      return JSON.stringify(createSuccessResult(hoverText));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting hover info: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to get hover info: ${errorMessage}`));
    }
  },
  {
    name: 'get_hover_info',
    description:
      '通过 LSP 悬停功能获取文件中特定位置的信息。返回该位置的类型定义、文档字符串等详细信息。',
    schema: z.object({
      file_path: z.string().describe('文件路径'),
      line: z.number().describe('行号（1-based）'),
      column: z.number().describe('列位置（1-based）')
    })
  }
);

/**
 * get_completions - 获取代码补全建议
 */
export const getCompletionsTool = tool(
  async ({ file_path, line, column }: { file_path: string; line: number; column: number }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Getting completions: ${file_path} (${line}:${column})`);

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      await client.openDocument(file_path);
      const completions = await client.getCompletion(file_path, {
        line: line - 1,
        character: column - 1
      });

      log('debug', `Retrieved ${completions.length} completions`);

      return JSON.stringify(
        createSuccessResult(JSON.stringify(completions.slice(0, 50), null, 2))
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting completions: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to get completions: ${errorMessage}`));
    }
  },
  {
    name: 'get_completions',
    description:
      '获取特定位置的代码补全建议。包括变量名、函数名、对象属性等可用的补全选项。',
    schema: z.object({
      file_path: z.string().describe('文件路径'),
      line: z.number().describe('行号（1-based）'),
      column: z.number().describe('列位置（1-based）')
    })
  }
);

/**
 * get_definition - 获取定义位置
 */
export const getDefinitionTool = tool(
  async ({ file_path, line, column }: { file_path: string; line: number; column: number }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Getting definition: ${file_path} (${line}:${column})`);

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      const definitions = await client.getDefinition(file_path, {
        line: line - 1,
        character: column - 1
      });

      if (definitions.length === 0) {
        return JSON.stringify(createSuccessResult('No definition found'));
      }

      log('debug', `Found ${definitions.length} definition(s)`);

      return JSON.stringify(createSuccessResult(JSON.stringify(definitions, null, 2)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting definition: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to get definition: ${errorMessage}`));
    }
  },
  {
    name: 'get_definition',
    description:
      '获取指定位置符号的定义位置。返回定义所在的文件和行号。',
    schema: z.object({
      file_path: z.string().describe('文件路径'),
      line: z.number().describe('行号（1-based）'),
      column: z.number().describe('列位置（1-based）')
    })
  }
);

/**
 * get_references - 获取引用位置
 */
export const getReferencesTool = tool(
  async ({ file_path, line, column }: { file_path: string; line: number; column: number }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Getting references: ${file_path} (${line}:${column})`);

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      const references = await client.getReferences(file_path, {
        line: line - 1,
        character: column - 1
      });

      if (references.length === 0) {
        return JSON.stringify(createSuccessResult('No references found'));
      }

      log('debug', `Found ${references.length} reference(s)`);

      return JSON.stringify(createSuccessResult(JSON.stringify(references, null, 2)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting references: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to get references: ${errorMessage}`));
    }
  },
  {
    name: 'get_references',
    description:
      '获取指定位置符号的所有引用位置。返回该符号在代码库中被使用的所有位置。',
    schema: z.object({
      file_path: z.string().describe('文件路径'),
      line: z.number().describe('行号（1-based）'),
      column: z.number().describe('列位置（1-based）')
    })
  }
);

/**
 * get_code_actions - 获取代码操作（快速修复、重构等）
 */
export const getCodeActionsTool = tool(
  async ({
    file_path,
    start_line,
    start_column,
    end_line,
    end_column
  }: {
    file_path: string;
    start_line: number;
    start_column: number;
    end_line: number;
    end_column: number;
  }) => {
    try {
      const rootDir = getCurrentRootDir();
      log(
        'debug',
        `Getting code actions: ${file_path} (${start_line}:${start_column} to ${end_line}:${end_column})`
      );

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      const codeActions = await client.getCodeActions(file_path, {
        start: { line: start_line - 1, character: start_column - 1 },
        end: { line: end_line - 1, character: end_column - 1 }
      });

      if (codeActions.length === 0) {
        return JSON.stringify(createSuccessResult('No code actions available'));
      }

      log('debug', `Found ${codeActions.length} code action(s)`);

      return JSON.stringify(createSuccessResult(JSON.stringify(codeActions, null, 2)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting code actions: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to get code actions: ${errorMessage}`));
    }
  },
  {
    name: 'get_code_actions',
    description:
      '获取指定范围内的代码操作。包括快速修复、重构、添加导入等可用操作。',
    schema: z.object({
      file_path: z.string().describe('文件路径'),
      start_line: z.number().describe('起始行号（1-based）'),
      start_column: z.number().describe('起始列位置（1-based）'),
      end_line: z.number().describe('结束行号（1-based）'),
      end_column: z.number().describe('结束列位置（1-based）')
    })
  }
);

/**
 * get_diagnostics - 获取诊断信息（错误和警告）
 */
export const getDiagnosticsTool = tool(
  async ({ file_path }: { file_path?: string }) => {
    try {
      const rootDir = getCurrentRootDir();

      const client = await LspClientManager.getClient(rootDir);

      if (file_path) {
        log('debug', `Getting diagnostics for: ${file_path}`);
        validateFileExists(file_path);

        const diagnostics = client.getDiagnostics(file_path);

        if (diagnostics.length === 0) {
          return JSON.stringify(createSuccessResult('No diagnostics found'));
        }

        return JSON.stringify(createSuccessResult(JSON.stringify(diagnostics, null, 2)));
      } else {
        log('debug', 'Getting diagnostics for all files');

        const allDiagnostics = client.getAllDiagnostics();
        const diagnosticsObject: Record<string, any> = {};

        allDiagnostics.forEach((value, key) => {
          diagnosticsObject[key] = value;
        });

        return JSON.stringify(createSuccessResult(JSON.stringify(diagnosticsObject, null, 2)));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting diagnostics: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to get diagnostics: ${errorMessage}`));
    }
  },
  {
    name: 'get_diagnostics',
    description:
      '获取诊断信息（错误、警告）。如果指定文件路径，则获取该文件的诊断信息；否则获取所有打开文件的诊断信息。',
    schema: z.object({
      file_path: z.string().optional().describe('文件路径。如果不提供，返回所有打开文件的诊断信息。')
    })
  }
);

/**
 * get_document_symbols - 获取文档中的符号（函数、类、变量等）
 */
export const getDocumentSymbolsTool = tool(
  async ({ file_path }: { file_path: string }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Getting document symbols: ${file_path}`);

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      const symbols = await client.getDocumentSymbols(file_path);

      if (symbols.length === 0) {
        return JSON.stringify(createSuccessResult('No symbols found'));
      }

      log('debug', `Found ${symbols.length} symbol(s)`);

      return JSON.stringify(createSuccessResult(JSON.stringify(symbols, null, 2)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting document symbols: ${errorMessage}`);
      return JSON.stringify(
        createErrorResult(`Failed to get document symbols: ${errorMessage}`)
      );
    }
  },
  {
    name: 'get_document_symbols',
    description:
      '获取文件中的所有符号（函数、类、变量、常量等）。返回符号的名称、类型和位置。',
    schema: z.object({
      file_path: z.string().describe('文件路径')
    })
  }
);

/**
 * get_workspace_symbols - 搜索工作区符号
 */
export const getWorkspaceSymbolsTool = tool(
  async ({ query }: { query: string }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Searching workspace symbols: ${query}`);

      const client = await LspClientManager.getClient(rootDir);
      const symbols = await client.getWorkspaceSymbols(query);

      if (symbols.length === 0) {
        return JSON.stringify(createSuccessResult('No symbols found matching the query'));
      }

      log('debug', `Found ${symbols.length} symbol(s)`);

      return JSON.stringify(createSuccessResult(JSON.stringify(symbols.slice(0, 50), null, 2)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error searching workspace symbols: ${errorMessage}`);
      return JSON.stringify(
        createErrorResult(`Failed to search workspace symbols: ${errorMessage}`)
      );
    }
  },
  {
    name: 'get_workspace_symbols',
    description:
      '在整个工作区中搜索符号。返回匹配查询字符串的所有符号及其位置。',
    schema: z.object({
      query: z.string().describe('搜索查询字符串（如函数名、类名等）')
    })
  }
);

/**
 * format_document - 格式化文档
 */
export const formatDocumentTool = tool(
  async ({ file_path }: { file_path: string }) => {
    try {
      const rootDir = getCurrentRootDir();
      log('debug', `Formatting document: ${file_path}`);

      validateFileExists(file_path);

      const client = await LspClientManager.getClient(rootDir);
      const edits = await client.formatDocument(file_path);

      if (edits.length === 0) {
        return JSON.stringify(createSuccessResult('Document is already formatted'));
      }

      log('debug', `Generated ${edits.length} formatting edit(s)`);

      return JSON.stringify(createSuccessResult(JSON.stringify(edits, null, 2)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error formatting document: ${errorMessage}`);
      return JSON.stringify(createErrorResult(`Failed to format document: ${errorMessage}`));
    }
  },
  {
    name: 'format_document',
    description:
      '使用 LSP 服务器的格式化功能格式化文档。返回所需的编辑操作。',
    schema: z.object({
      file_path: z.string().describe('要格式化的文件路径')
    })
  }
);

/**
 * set_log_level - 设置日志级别
 */
export const setLogLevelTool = tool(
  async ({
    level
  }: {
    level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  }) => {
    logLevel = level;
    log('info', `Log level set to: ${level}`);
    return JSON.stringify(createSuccessResult(`Log level set to: ${level}`));
  },
  {
    name: 'set_log_level',
    description:
      '设置工具的日志级别。可用级别（从最少到最多日志）：emergency, alert, critical, error, warning, notice, info, debug。',
    schema: z.object({
      level: z
        .enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'])
        .describe('日志级别')
    })
  }
);

/**
 * shutdown_lsp - 关闭 LSP 服务器
 */
export const shutdownLspTool = tool(
  async () => {
    try {
      log('info', 'Shutting down all LSP servers...');
      await LspClientManager.shutdownAll();
      currentRootDir = null;
      log('info', 'All LSP servers shut down successfully');
      return JSON.stringify(createSuccessResult('All LSP servers shut down successfully'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error shutting down LSP servers: ${errorMessage}`);
      return JSON.stringify(
        createErrorResult(`Failed to shut down LSP servers: ${errorMessage}`)
      );
    }
  },
  {
    name: 'shutdown_lsp',
    description: '关闭所有 LSP 服务器。在完成代码分析工作后调用此工具清理资源。',
    schema: z.object({})
  }
);

/**
 * 获取所有 LSP 工具
 */
export default async function getLspTools() {
  return [
    startLspTool,
    restartLspServerTool,
    openDocumentTool,
    closeDocumentTool,
    getHoverInfoTool,
    getCompletionsTool,
    getDefinitionTool,
    getReferencesTool,
    getCodeActionsTool,
    getDiagnosticsTool,
    getDocumentSymbolsTool,
    getWorkspaceSymbolsTool,
    formatDocumentTool,
    setLogLevelTool,
    shutdownLspTool
  ];
}