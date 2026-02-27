import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * In-memory storage for the current subagent todo list.
 * Persists across multiple calls within the same session.
 */
let currentTodos: Array<{ content: string; status: string; subagent_type: string }> = [];

/**
 * 🚨 子代理任务清单工具 - 任务管理框架
 * 
 * 中文名称：子代理任务清单工具
 * 
 * ⚠️ **CRITICAL USAGE REQUIREMENTS - MUST FOLLOW**:
 * 1. **MUST USE CORRESPONDING SUBTASK AGENTS**: Every task MUST be assigned to the appropriate specialized subagent type
 *    - Code tasks → "coder" agent
 *    - Research tasks → "researcher" agent  
 *    - Validation/Testing → "validator"/"testing" agent
 *    - Documentation → "documentation" agent
 *    - Coordination → "coordinator" agent
 *    - Innovation → "innovator" agent
 *    - User-defined custom agents take precedence over built-in agents
 * 
 * 预期行为：
 * - 接收包含 subagent_type 属性的任务清单数组
 * - 为每个任务分配专门的子代理类型（支持内置类型和用户动态配置类型）
 * - 持久化任务清单到内存，供 read-subagent-todos 工具读取
 * - 返回结构化的任务清单用于跟踪和执行
 * 
 * 行为分支：
 * 1. 成功创建：返回包含 subagent_type 的任务清单
 * 2. 参数验证：通过Zod schema确保参数格式正确
 * 3. 任务状态管理：支持 pending, in_progress, completed 状态
 * 
 * @param todos - 任务清单数组，每个任务包含 content, status, subagent_type 属性
 * @returns Promise<string> - 包含任务清单的JSON字符串
 */
export const writeSubagentTodosTool = tool(
  async ({ todos }) => {
    try {
      // 验证 todos 格式
      const validatedTodos = todos.map((todo: any) => {
        if (!todo.content || !todo.status || !todo.subagent_type) {
          throw new Error('Each todo must have content, status, and subagent_type');
        }
        return {
          content: todo.content,
          status: todo.status,
          subagent_type: todo.subagent_type
        };
      });

      // Persist the todo list in memory for retrieval by readSubagentTodosTool
      currentTodos = validatedTodos;
      
      return JSON.stringify({
        success: true,
        message: `Updated subagent todo list with ${validatedTodos.length} tasks`,
        todos: validatedTodos
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to create subagent todo list"
      }, null, 2);
    }
  },
  {
    name: "write-subagent-todos",
    description: "Use this tool to create and manage a structured task list for your current work session where each task is assigned to a SPECIFIC SUBAGENT TYPE. MUST assign each task to the CORRESPONDING specialized subagent (coder, researcher, validator, etc.) and decompose complex tasks (3+ steps) into subtasks.",
    schema: z.object({
      todos: z.array(
        z.object({
          content: z.string().describe("Content of the todo item"),
          status: z.enum(['pending', 'in_progress', 'completed']).describe("Status of the todo"),
          subagent_type: z.string().describe("The CORRESPONDING specialized subagent type for this task. MUST assign appropriate agent: coder (code tasks), researcher (research), validator/testing (validation/testing), documentation (docs), coordinator (coordination), innovator (innovation). User-defined custom agents take precedence over built-in agents.")
        })
      ).describe("List of todo items with subagent type assignments to update")
    })
  }
);

/**
 * 读取当前子代理任务清单工具
 * 
 * 预期行为：
 * - 读取并返回当前会话中的子代理任务清单
 * - 如果清单为空，返回空数组
 * 
 * @returns Promise<string> - 包含当前任务清单的JSON字符串
 */
export const readSubagentTodosTool = tool(
  async () => {
    return JSON.stringify({
      success: true,
      todos: currentTodos,
      total: currentTodos.length
    }, null, 2);
  },
  {
    name: "read-subagent-todos",
    description: "Read the current subagent todo list for this work session. Use this to check the current state of tasks, their statuses, and assigned subagent types before updating the list.",
    schema: z.object({})
  }
);

/**
 * 异步获取子代理任务清单工具的方法
 * 
 * @returns Promise<Array<any>> - 包含子代理任务清单工具的数组
 */
export default async function getWriteSubagentTodosTools() {
  return [writeSubagentTodosTool, readSubagentTodosTool];
}