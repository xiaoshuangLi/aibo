import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 🚨 子代理任务清单工具 - 强制并行执行框架
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
 * 2. **MANDATORY PARALLEL EXECUTION**: Complex tasks (3+ steps) MUST be decomposed into independent subtasks
 *    - Independent subtasks with same concurrent_group number MUST execute CONCURRENTLY
 *    - NEVER execute independent subtasks sequentially when they can run in parallel
 *    - This wastes time and resources and violates the core execution principle
 * 
 * 预期行为：
 * - 接收包含 subagent_type 和 concurrent_group 属性的任务清单数组
 * - 为每个任务分配专门的子代理类型（支持内置类型和用户动态配置类型）
 * - 通过 concurrent_group 参数强制控制分组并发执行逻辑
 * - 返回结构化的任务清单用于跟踪和执行
 * 
 * 行为分支：
 * 1. 成功创建：返回包含 subagent_type 和 concurrent_group 的任务清单
 * 2. 参数验证：通过Zod schema确保参数格式正确
 * 3. 任务状态管理：支持 pending, in_progress, completed 状态
 * 4. 并发组控制：concurrent_group 为 null 表示单独顺序执行，数字表示并发组ID
 * 
 * @param todos - 任务清单数组，每个任务包含 content, status, subagent_type, 和可选的 concurrent_group 属性
 * @returns Promise<string> - 包含任务清单的JSON字符串
 * 
 * @example
 * ```typescript
 * // 使用分组并发控制 - 按照你的需求：1-3并发，4单独，5-8并发，9单独，10单独
 * const result1 = await writeSubagentTodos({
 *   todos: [
 *     {
 *       content: "任务1 - 并发组1",
 *       status: "in_progress",
 *       subagent_type: "coder",
 *       concurrent_group: 1  // 与任务2、3同属并发组1
 *     },
 *     {
 *       content: "任务2 - 并发组1", 
 *       status: "in_progress",
 *       subagent_type: "researcher",
 *       concurrent_group: 1  // 与任务1、3同属并发组1
 *     },
 *     {
 *       content: "任务3 - 并发组1",
 *       status: "in_progress", 
 *       subagent_type: "testing",
 *       concurrent_group: 1  // 与任务1、2同属并发组1
 *     },
 *     {
 *       content: "任务4 - 单独执行",
 *       status: "pending",
 *       subagent_type: "validator",
 *       concurrent_group: null  // 单独顺序执行（默认）
 *     },
 *     {
 *       content: "任务5 - 并发组2",
 *       status: "pending",
 *       subagent_type: "documentation",
 *       concurrent_group: 2  // 与任务6、7、8同属并发组2
 *     },
 *     {
 *       content: "任务6 - 并发组2",
 *       status: "pending",
 *       subagent_type: "innovator",
 *       concurrent_group: 2  // 与任务5、7、8同属并发组2
 *     },
 *     {
 *       content: "任务7 - 并发组2", 
 *       status: "pending",
 *       subagent_type: "coordinator",
 *       concurrent_group: 2  // 与任务5、6、8同属并发组2
 *     },
 *     {
 *       content: "任务8 - 并发组2",
 *       status: "pending",
 *       subagent_type: "coder",
 *       concurrent_group: 2  // 与任务5、6、7同属并发组2
 *     },
 *     {
 *       content: "任务9 - 单独执行",
 *       status: "pending",
 *       subagent_type: "validator",
 *       concurrent_group: null  // 单独顺序执行
 *     },
 *     {
 *       content: "任务10 - 单独执行",
 *       status: "pending", 
 *       subagent_type: "documentation",
 *       concurrent_group: null  // 单独顺序执行
 *     }
 *   ]
 * });
 * 
 * // 执行流程说明：
 * // 1. 并发执行所有 concurrent_group: 1 的任务（任务1-3）
 * // 2. 顺序执行 concurrent_group: null 的任务4
 * // 3. 并发执行所有 concurrent_group: 2 的任务（任务5-8）  
 * // 4. 顺序执行 concurrent_group: null 的任务9
 * // 5. 顺序执行 concurrent_group: null 的任务10
 * ```
 * 
 * @note
 * - 此工具扩展了标准的 write_todos 功能，添加了子代理类型分配和分组并发控制
 * - 支持两种子代理类型：
 *   - **内置专业类型**：coder, researcher, validator, coordinator, documentation, innovator, testing
 *   - **用户动态类型**：通过项目目录中的配置文件定义的任意自定义类型
 * - 每个任务包含 `concurrent_group` 参数（默认为 null）：
 *   - `concurrent_group: null` - 任务必须单独顺序执行（默认行为）
 *   - `concurrent_group: number` - 相同数字的任务属于同一个并发组，可以同时执行
 * - 执行顺序：按任务在数组中的顺序处理，相同并发组的任务并行执行，null组的任务顺序执行
 * - 系统会自动发现并优先使用用户配置的子代理类型
 * - 主流程应使用此工具来规划复杂任务并分配给专门的子代理，同时精确控制分组并发执行策略
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
          subagent_type: todo.subagent_type,
          concurrent_group: todo.concurrent_group ?? null // null 表示单独执行，数字表示并发组ID
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
    description: "🚨 MANDATORY PARALLEL EXECUTION TOOL: Use this tool to create and manage a structured task list for your current work session where each task is assigned to a SPECIFIC SUBAGENT TYPE. ⚠️ CRITICAL REQUIREMENTS: 1) MUST assign each task to the CORRESPONDING specialized subagent (coder, researcher, validator, etc.), 2) MUST decompose complex tasks (3+ steps) into INDEPENDENT subtasks, 3) MUST execute independent subtasks CONCURRENTLY using concurrent_group parameter. NEVER execute independent subtasks sequentially when they can run in parallel - this violates core execution principles and wastes resources.",
    schema: z.object({
      todos: z.array(
        z.object({
          content: z.string().describe("Content of the todo item"),
          status: z.enum(['pending', 'in_progress', 'completed']).describe("Status of the todo"),
          subagent_type: z.string().describe("🚨 MANDATORY: The CORRESPONDING specialized subagent type for this task. MUST assign appropriate agent: coder (code tasks), researcher (research), validator/testing (validation/testing), documentation (docs), coordinator (coordination), innovator (innovation). User-defined custom agents take precedence over built-in agents. NEVER leave unassigned or use wrong agent type."),
          concurrent_group: z.number().nullable().optional().default(null).describe("🚨 MANDATORY PARALLEL EXECUTION: Concurrency group identifier for FORCED parallel execution. Tasks with the same non-null number MUST execute CONCURRENTLY as a group. Null/undefined means sequential execution. ⚠️ NEVER execute independent subtasks sequentially when they can run in parallel - this violates core execution principles and wastes time/resources.")
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