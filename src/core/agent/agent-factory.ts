import { config } from '../../core/config/config';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from "@langchain/langgraph";
import { createDeepAgent } from 'deepagents';
import tools from '../../tools/index';
import { SYSTEM_PROMPT } from '../../shared/constants/system-prompts';
import { loadSubAgents, getDefaultGeneralPurposeSubAgent } from '../../infrastructure/agents/agent-loader';
import { findSkillsDirectories } from '../utils/find-skills-directories';
import { SafeFilesystemBackend } from '../../infrastructure/filesystem/safe-filesystem-backend';

/**
 * AI Agent Factory module that provides DeepAgents integration with LangChain.
 * 
 * This module creates and configures an AI agent using DeepAgents framework
 * integrated with LangChain components. It supports configurable AI models,
 * file system operations, and state persistence through checkpointer mechanisms.
 * 
 * @module agent-factory
 */

// ==================== 初始化模型 ====================
const model = new ChatOpenAI({
  apiKey: config.openai.apiKey,
  modelName: config.openai.modelName,
  temperature: 0,
  ...(config.openai.baseURL && { 
    configuration: { baseURL: config.openai.baseURL } 
  }),
});

const backend = new SafeFilesystemBackend({
  rootDir: process.cwd(),
  maxFileSizeMb: 10, // Reduced from 1000MB to 10MB
  maxDepth: 5, // Limit directory traversal depth
});

// ==================== 创建 Agent ====================
// 加载自定义subagents - 递归查找工作目录下所有agents目录
const customSubAgents = loadSubAgents(process.cwd());

// 查找工作目录下的所有skills目录
const allSkillsDirs = findSkillsDirectories(process.cwd());

// 为子代理应用默认配置
const subAgentsWithDefaults = customSubAgents.map(agent => ({
  ...agent,
  // 如果未指定tools，则使用系统tools
  tools: agent.tools ?? tools,
  // 如果未指定skills，则使用系统skills  
  skills: agent.skills ?? allSkillsDirs,
  // 如果未指定model，则使用系统model
  model: agent.model ?? model
}));

// 确保至少有一个通用子代理
const subAgents = subAgentsWithDefaults.length > 0 
  ? subAgentsWithDefaults 
  : [getDefaultGeneralPurposeSubAgent()];

export const agent = createDeepAgent({
  model,
  backend,
  systemPrompt: SYSTEM_PROMPT,
  checkpointer: new MemorySaver(),
  tools,
  skills: allSkillsDirs,
  subagents: subAgents,
  interruptOn: { grep: false },
});

/**
 * 创建AI代理实例
 * 
 * 中文名称：创建AI代理实例
 * 
 * 预期行为：
 * - 返回预先配置好的AI代理实例
 * - 代理实例包含以下组件：
 *   - 配置好的ChatOpenAI模型（使用环境变量中的API密钥、基础URL和模型名称）
 *   - 文件系统后端（以当前工作目录为根目录）
 *   - 内存检查点器（用于状态持久化）
 * - 优雅地处理可选配置参数
 * 
 * 行为分支：
 * 1. 正常情况：返回已配置的agent实例
 * 2. 配置错误：如果环境变量无效或依赖项初始化失败，会在main函数中抛出错误
 * 
 * @returns ReturnType<typeof createDeepAgent> - 配置好的DeepAgent实例
 * @throws {Error} 如果环境变量无效或必需的依赖项初始化失败（实际在main函数中处理）
 * 
 * @example
 * ```typescript
 * const agent = createAIAgent();
 * // 使用代理进行AI操作
 * ```
 * 
 * @see {@link config} 了解环境变量配置详情
 * @see {@link main} 了解主执行函数
 */
export function createAIAgent() {
  return agent;
}