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
export async function createAIAgent(session?: Session) {
  if (cachedAgent) {
    return cachedAgent;
  }

  // 异步获取工具
  const tools = await getTools();

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

  cachedAgent = createDeepAgent({
    model,
    backend,
    systemPrompt: SYSTEM_PROMPT,
    checkpointer: createCheckpointer(),
    tools,
    skills: allSkillsDirs,
    subagents: subAgents,
    middleware: [toolRetryMiddleware],
    interruptOn: { grep: false },
  });

  return cachedAgent;
}