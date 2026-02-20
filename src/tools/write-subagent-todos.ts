import { tool } from "@langchain/core/tools";
import { z } from "zod";

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
 * - 返回结构化的任务清单用于跟踪和执行
 * 
 * 行为分支：
 * 1. 成功创建：返回包含 subagent_type 的任务清单
 * 2. 参数验证：通过Zod schema确保参数格式正确
 * 3. 任务状态管理：支持 pending, in_progress, completed 状态
 * 
 * @param todos - 任务清单数组，每个任务包含 content, status, subagent_type 属性
 * @returns Promise<string> - 包含任务清单的JSON字符串
 * 
 * @example
 * ```typescript
 * // 基本用法
 * const result1 = await writeSubagentTodos({
 *   todos: [
 *     {
 *       content: "任务1",
 *       status: "in_progress",
 *       subagent_type: "coder"
 *     },
 *     {
 *       content: "任务2", 
 *       status: "in_progress",
 *       subagent_type: "researcher"
 *     },
 *     {
 *       content: "任务3",
 *       status: "pending", 
 *       subagent_type: "testing"
 *     }
 *   ]
 * });
 * ```
 * 
 * @note
 * - 此工具扩展了标准的 write_todos 功能，添加了子代理类型分配
 * - 支持两种子代理类型：
 *   - **内置专业类型**：coder, researcher, validator, coordinator, documentation, innovator, testing
 *   - **用户动态类型**：通过项目目录中的配置文件定义的任意自定义类型
 * - 系统会自动发现并优先使用用户配置的子代理类型
 * - 主流程应使用此工具来规划复杂任务并分配给专门的子代理
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
 * 异步获取子代理任务清单工具的方法
 * 
 * @returns Promise<Array<any>> - 包含子代理任务清单工具的数组
 */
export default async function getWriteSubagentTodosTools() {
  return [writeSubagentTodosTool];
}