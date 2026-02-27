import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Personal task tracking storage for the current session.
 * Each entry has a stable id so individual items can be updated by id.
 */
let currentTodos: Array<{
  id: string;
  content: string;
  status: "not_started" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}> = [];

let nextId = 1;

/**
 * TodoWrite — personal task management tool (Claude Code parity).
 *
 * Maintains a personal task list for the AI's own work within a session.
 * This is NOT for delegating to subagents — use write-subagent-todos for that.
 *
 * Usage pattern:
 *   1. At the start of a complex task, call TodoWrite with all subtasks.
 *   2. Before starting each subtask, update its status to "in_progress".
 *   3. When a subtask is done, update its status to "completed".
 *   4. Use TodoRead at any point to see the current state.
 *
 * Behavior:
 *   - Passing todos WITHOUT an id creates new items (id is auto-assigned).
 *   - Passing todos WITH an id updates the matching existing item.
 *   - Items not mentioned in a call are left unchanged.
 *   - Pass an empty array to clear all todos.
 */
export const todoWriteTool = tool(
  async ({ todos }) => {
    try {
      // An empty array explicitly clears the todo list
      if (todos.length === 0) {
        currentTodos = [];
        return JSON.stringify({
          success: true,
          todos: currentTodos,
          total: 0,
        }, null, 2);
      }

      for (const todo of todos) {
        if (todo.id !== undefined && todo.id !== null) {
          // Update existing item
          const idx = currentTodos.findIndex((t) => t.id === todo.id);
          if (idx === -1) {
            return JSON.stringify({
              success: false,
              error: "TODO_NOT_FOUND",
              message: `No todo found with id "${todo.id}". Use TodoRead to see all current todos.`,
            }, null, 2);
          }
          currentTodos[idx] = {
            ...currentTodos[idx],
            ...(todo.content !== undefined ? { content: todo.content } : {}),
            ...(todo.status !== undefined ? { status: todo.status } : {}),
            ...(todo.priority !== undefined ? { priority: todo.priority } : {}),
          };
        } else {
          // Create new item — content is required
          if (!todo.content) {
            return JSON.stringify({
              success: false,
              error: "MISSING_CONTENT",
              message: "content is required when creating a new todo (no id provided).",
            }, null, 2);
          }
          currentTodos.push({
            id: String(nextId++),
            content: todo.content,
            status: todo.status ?? "not_started",
            priority: todo.priority ?? "medium",
          });
        }
      }

      return JSON.stringify({
        success: true,
        todos: currentTodos,
        total: currentTodos.length,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2);
    }
  },
  {
    name: "todo_write",
    description: `Create or update your personal task list for the current work session.
Use this tool to:
  - Break a complex task into subtasks at the start (create items with status "not_started")
  - Mark a task as active before starting it (update status to "in_progress")
  - Mark a task as done after completing it (update status to "completed")

To CREATE new tasks: omit the "id" field — ids are auto-assigned.
To UPDATE existing tasks: include the "id" returned by a previous call (or from todo_read).
Items not mentioned in a call are left unchanged.

This is for YOUR personal task tracking, not for delegating to subagents.
For multi-agent task delegation, use the write-subagent-todos tool instead.`,
    schema: z.object({
      todos: z.array(
        z.object({
          id: z.string().optional().describe(
            "ID of an existing todo to update. Omit to create a new todo."
          ),
          content: z.string().optional().describe(
            "Description of the task. Required when creating a new todo (no id); optional when updating an existing one."
          ),
          status: z
            .enum(["not_started", "in_progress", "completed"])
            .optional()
            .default("not_started")
            .describe("Current status of the task (default: not_started)."),
          priority: z
            .enum(["high", "medium", "low"])
            .optional()
            .default("medium")
            .describe("Priority of the task (default: medium)."),
        })
      ).describe("List of todos to create or update."),
    }),
  }
);

/**
 * TodoRead — read back the current personal task list.
 */
export const todoReadTool = tool(
  async () => {
    return JSON.stringify({
      success: true,
      todos: currentTodos,
      total: currentTodos.length,
      summary: {
        not_started: currentTodos.filter((t) => t.status === "not_started").length,
        in_progress: currentTodos.filter((t) => t.status === "in_progress").length,
        completed: currentTodos.filter((t) => t.status === "completed").length,
      },
    }, null, 2);
  },
  {
    name: "todo_read",
    description: `Read the current personal task list for this work session.
Returns all tasks with their ids, content, status, and priority.
Use this to check what tasks are pending, in progress, or completed before deciding what to do next.`,
    schema: z.object({}),
  }
);

/**
 * Reset internal state (exported for testing).
 */
export function resetTodos() {
  currentTodos = [];
  nextId = 1;
}

export default async function getTodoTools() {
  return [todoWriteTool, todoReadTool];
}
