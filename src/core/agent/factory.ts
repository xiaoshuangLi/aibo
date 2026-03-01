import { config } from '@/core/config';
import { MemorySaver } from "@langchain/langgraph";
import { createModel } from './model';
import { createDeepAgent } from 'deepagents';
import { FilesystemCheckpointer } from '@/infrastructure/checkpoint';
import getTools from '@/tools';
import { SYSTEM_PROMPT } from '@/shared/constants';
import { loadSubAgents, getDefaultGeneralPurposeSubAgent } from '@/infrastructure/agents';
import { findSkillsDirectories } from '@/core/utils';
import { SafeFilesystemBackend } from '@/infrastructure/filesystem';
import { createLangChainToolRetryMiddleware, createSessionOutputCaptureMiddleware } from '@/core/middlewares';
import { Session } from './session';
import { SubAgentPromptTemplate } from '@/infrastructure/prompt';

/**
 * AI Agent Factory module that provides DeepAgents integration with LangChain.
 * 
 * This module creates and configures an AI agent using DeepAgents framework
 * integrated with LangChain components. It supports configurable AI models,
 * file system operations, and state persistence through checkpointer mechanisms.
 * 
 * @module factory
 */

// ==================== 初始化模型 ====================
const model = createModel();

const backend = new SafeFilesystemBackend({
  rootDir: process.cwd(),
  maxFileSizeMb: 10, // Reduced from 1000MB to 10MB
  maxDepth: 5, // Limit directory traversal depth
});

// 缓存的代理实例
let cachedAgent: ReturnType<typeof createDeepAgent>;

/**
 * 当检测到本地安装了 AI 编程 CLI 工具时，生成优先使用这些工具并按任务类型智能路由的提示词补充。
 *
 * 路由策略参考 nexus-cli 的多执行器设计：
 *   - claude_execute  : 架构分析、代码审查、复杂重构、跨文件分析
 *   - gemini_execute  : 前端 UI 开发、算法实现、需要大上下文的任务
 *   - codex_execute   : 后端 API、数据库、服务端业务逻辑
 *   - cursor_execute  : 通用 AI 辅助编程（无上述专项工具时的首选）
 *   - copilot_execute : shell 命令建议、git 命令建议、gh CLI 命令建议
 *
 * @param hasClaudeTool  - 是否检测到 claude_execute 工具
 * @param hasCursorTool  - 是否检测到 cursor_execute 工具
 * @param hasGeminiTool  - 是否检测到 gemini_execute 工具
 * @param hasCodexTool   - 是否检测到 codex_execute 工具
 * @param hasCopilotTool - 是否检测到 copilot_execute 工具
 * @returns 追加到系统提示词末尾的补充字符串（若均不可用则返回空字符串）
 */
export function buildCodingAgentHint(
  hasClaudeTool: boolean,
  hasCursorTool: boolean,
  hasGeminiTool: boolean = false,
  hasCodexTool: boolean = false,
  hasCopilotTool: boolean = false,
): string {
  const available: string[] = [];
  if (hasClaudeTool) available.push('`claude_execute`');
  if (hasGeminiTool) available.push('`gemini_execute`');
  if (hasCodexTool) available.push('`codex_execute`');
  if (hasCursorTool) available.push('`cursor_execute`');
  if (hasCopilotTool) available.push('`copilot_execute`');

  if (available.length === 0) {
    return '';
  }

  // Build routing table rows for each available tool
  const routingRows: string[] = [];
  if (hasClaudeTool) routingRows.push('| `claude_execute` | Architecture design, code review, complex refactoring, cross-file analysis, debugging |');
  if (hasGeminiTool) routingRows.push('| `gemini_execute` | Frontend UI (React/Vue/HTML/CSS), algorithm implementation, large-context tasks (1M tokens) |');
  if (hasCodexTool) routingRows.push('| `codex_execute`  | Backend API (REST/GraphQL), database/ORM design, server-side business logic, scripts |');
  if (hasCursorTool) routingRows.push('| `cursor_execute` | General AI-assisted coding when no specialist tool is available; open files in Cursor editor |');
  if (hasCopilotTool) routingRows.push('| `copilot_execute` | General-purpose AI coding: writing code, editing files, running shell commands, searching the codebase |');

  const routingTable = routingRows.length > 0
    ? `\n| Tool | Best for |\n|------|----------|\n${routingRows.join('\n')}`
    : '';

  const toolList = available.join(', ');

  // Build dynamic fallback hint (only mention tools that are actually available)
  const fallbackTools = available.filter(t => t === '`cursor_execute`' || t === '`claude_execute`');
  const fallbackClause = fallbackTools.length > 0
    ? `fall back to ${fallbackTools.join(' or ')}`
    : `fall back to the most general tool available`;

  return `

## 🤖 PRIORITY: Use Local AI Coding Agents

The following local AI coding agent CLI tool(s) are available on this system: ${toolList}.

**When handling any coding task — writing code, fixing bugs, refactoring, adding tests, explaining code, or multi-file changes — you MUST delegate the work to the appropriate tool below instead of implementing it yourself.**
${routingTable}

### Routing rules

1. **Pick the right agent for the task type** using the table above.
2. If multiple agents could handle the task, prefer the specialist (gemini for frontend, codex for backend, claude for review/architecture).
3. If none of the specialist agents match, ${fallbackClause}.
4. Pass a **complete, self-contained task description** as the \`prompt\` argument so the agent can act autonomously.
5. Always set \`cwd\` to the relevant project directory.
6. After the agent responds, review its output and verify correctness before reporting back.
7. Only fall back to direct tools (edit_file, write_file, execute_bash) when the coding agent tool is unavailable or has already failed.`;
}

/**
 * 创建检查点器实例
 * 根据配置动态创建不同类型的检查点器
 */
function createCheckpointer() {
  const checkpointerType = config.langgraph.checkpointerType;
  
  switch (checkpointerType) {
    case 'memory':
      return new MemorySaver();
    case 'filesystem':
      return new FilesystemCheckpointer();
    case 'sqlite':
      throw new Error('SQLite checkpointer is not yet implemented');
    default:
      throw new Error(`Unsupported checkpointer type: ${checkpointerType}`);
  }
}

/**
 * 创建AI代理实例
 * 
 * 中文名称：创建AI代理实例
 * 
 * 预期行为：
 * - 异步获取所有工具并返回配置好的AI代理实例
 * - 代理实例包含以下组件：
 *   - 配置好的ChatOpenAI模型（使用环境变量中的API密钥、基础URL和模型名称）
 *   - 文件系统后端（以当前工作目录为根目录）
 *   - 检查点器（用于状态持久化，支持 memory/filesystem/sqlite）
 * - 优雅地处理可选配置参数
 * 
 * 行为分支：
 * 1. 正常情况：返回已配置的agent实例
 * 2. 配置错误：如果环境变量无效或依赖项初始化失败，会在main函数中抛出错误
 * 
 * @param session - 可选的会话对象，用于子代理输出捕获
 * @returns Promise<ReturnType<typeof createDeepAgent>> - 配置好的DeepAgent实例的Promise
 * @throws {Error} 如果环境变量无效或必需的依赖项初始化失败（实际在main函数中处理）
 * 
 * @example
 * ```typescript
 * const agent = await createAIAgent();
 * // 使用代理进行AI操作
 * ```
 * 
 * @see {@link config} 了解环境变量配置详情
 * @see {@link main} 了解主执行函数
 */
export async function createAIAgent(session?: Session): Promise<any> {
  if (cachedAgent) {
    return cachedAgent;
  }

  // 异步获取工具
  const tools = await getTools(session);

  // 创建 LangChain 工具重试中间件
  const toolRetryMiddleware = createLangChainToolRetryMiddleware();
  
  // 创建会话输出捕获中间件（如果提供了session）
  const sessionMiddleware = session ? [createSessionOutputCaptureMiddleware({ session })] : [];

  // 加载自定义subagents - 递归查找工作目录下所有agents目录
  const customSubAgents = loadSubAgents(process.cwd());

  // 查找工作目录下的所有skills目录
  const allSkillsDirs = findSkillsDirectories(process.cwd());

  /**
 * 过滤掉子代理不应该使用的工具
 * @param tools - 原始工具列表
 * @returns 过滤后的工具列表
 */
function filterSubAgentTools(tools: any[]): any[] {
  return tools.filter(tool => {
    // 禁止子代理使用 write-subagent-todos 工具
    if (tool.name === 'write-subagent-todos') {
      return false;
    }
    return true;
  });
}

// 为子代理应用默认配置（强化提示词已在代理加载器中处理）
  const subAgentsWithDefaults = customSubAgents.map(agent => ({
    ...agent,
    // 确保子代理的tools中不包含 write-subagent-todos 工具
    // 即使用户在配置中指定了该工具，也会被过滤掉
    tools: filterSubAgentTools(agent.tools ?? tools),
    // 如果未指定skills，则使用系统skills  
    skills: agent.skills ?? allSkillsDirs,
    // 如果未指定model，则使用系统model
    model: agent.model ?? model,
    // 为子代理的middleware添加会话中间件（如果提供了session）
    middleware: session 
      ? [...(agent.middleware ?? []), toolRetryMiddleware, ...sessionMiddleware]
      : (agent.middleware ?? [toolRetryMiddleware]),
  }));

  // 确保至少有一个通用子代理
  let subAgents = subAgentsWithDefaults.length > 0 
    ? subAgentsWithDefaults 
    : [getDefaultGeneralPurposeSubAgent()];

  // Build coding-agent priority hint when any AI coding CLI tools are available
  const hasClaudeTool = tools.some(t => t.name === 'claude_execute');
  const hasCursorTool = tools.some(t => t.name === 'cursor_execute');
  const hasGeminiTool = tools.some(t => t.name === 'gemini_execute');
  const hasCodexTool  = tools.some(t => t.name === 'codex_execute');
  const hasCopilotTool = tools.some(t => t.name === 'copilot_execute');
  const systemPrompt = SYSTEM_PROMPT + buildCodingAgentHint(hasClaudeTool, hasCursorTool, hasGeminiTool, hasCodexTool, hasCopilotTool);

  cachedAgent = createDeepAgent({
    model,
    backend,
    systemPrompt,
    checkpointer: createCheckpointer(),
    tools,
    skills: allSkillsDirs,
    subagents: subAgents as any,
    middleware: [toolRetryMiddleware] as any,
    interruptOn: { grep: false },
  });

  return cachedAgent;
}