import { SYSTEM_PROMPT } from '@/shared/constants';

/**
 * Detects available AI coding CLI tools from the tools array, builds the coding agent hint,
 * and returns the complete system prompt by combining SYSTEM_PROMPT with the hint.
 *
 * @param tools - Array of tool objects with a `name` property
 * @returns The complete system prompt string
 */
export function buildSystemPromptFromTools(tools: Array<{ name: string }>): string {
  const hasClaudeTool  = tools.some(t => t.name === 'claude_execute');
  const hasCursorTool  = tools.some(t => t.name === 'cursor_execute');
  const hasGeminiTool  = tools.some(t => t.name === 'gemini_execute');
  const hasCodexTool   = tools.some(t => t.name === 'codex_execute');
  const hasCopilotTool = tools.some(t => t.name === 'copilot_execute');
  const hasAcpTool     = tools.some(t => t.name === 'acpx_execute');
  return SYSTEM_PROMPT + buildCodingAgentHint(hasClaudeTool, hasCursorTool, hasGeminiTool, hasCodexTool, hasCopilotTool, hasAcpTool);
}

/**
 * 当检测到本地安装了 AI 编程 CLI 工具时，生成优先使用这些工具并按任务类型智能路由的提示词补充。
 *
 * 路由策略参考 nexus-cli 的多执行器设计：
 *   - claude_execute  : 架构分析、代码审查、复杂重构、跨文件分析
 *   - gemini_execute  : 前端 UI 开发、算法实现、需要大上下文的任务
 *   - codex_execute   : 后端 API、数据库、服务端业务逻辑
 *   - cursor_execute  : 通用 AI 辅助编程（通用任务的优选）
 *   - copilot_execute : 通用 AI 辅助编程（通用任务的优选）
 *   - acpx_execute    : 通过 ACP 协议与本地编程工具对话（支持持久会话）
 *
 * @param hasClaudeTool  - 是否检测到 claude_execute 工具
 * @param hasCursorTool  - 是否检测到 cursor_execute 工具
 * @param hasGeminiTool  - 是否检测到 gemini_execute 工具
 * @param hasCodexTool   - 是否检测到 codex_execute 工具
 * @param hasCopilotTool - 是否检测到 copilot_execute 工具
 * @param hasAcpTool     - 是否检测到 acpx_execute 工具
 * @returns 追加到系统提示词末尾的补充字符串（若均不可用则返回空字符串）
 */
export function buildCodingAgentHint(
  hasClaudeTool: boolean,
  hasCursorTool: boolean,
  hasGeminiTool: boolean = false,
  hasCodexTool: boolean = false,
  hasCopilotTool: boolean = false,
  hasAcpTool: boolean = false,
): string {
  const available: string[] = [];
  if (hasClaudeTool) available.push('`claude_execute`');
  if (hasGeminiTool) available.push('`gemini_execute`');
  if (hasCodexTool) available.push('`codex_execute`');
  if (hasCursorTool) available.push('`cursor_execute`');
  if (hasCopilotTool) available.push('`copilot_execute`');
  if (hasAcpTool) available.push('`acpx_execute`');

  if (available.length === 0) {
    return '';
  }

  const toolList = available.join(', ');

  // When only a single coding tool is available, emit a simpler, more forceful instruction
  // so the model immediately knows to use that one tool for every coding task.
  if (available.length === 1) {
    const singleTool = available[0];
    return `

## 🤖 PRIORITY: Use the Local AI Coding Agent — ${singleTool}

A local AI coding agent CLI is available on this system: ${singleTool}.

**You MUST use ${singleTool} for EVERY coding task — writing code, fixing bugs, refactoring, adding tests, explaining code, shell commands, or any multi-file change — instead of implementing it yourself.**

### How to use it

1. **Immediately delegate** any coding request to ${singleTool} — do NOT start writing code yourself first.
2. Pass a **complete, self-contained task description** as the \`prompt\` argument (include file paths, requirements, libraries, tests).
3. Always set \`cwd\` to the relevant project directory.
4. After the agent responds, review its output and verify correctness before reporting back.
5. Only fall back to direct tools (edit_file, write_file, execute_bash) if ${singleTool} is unavailable or has already failed on this specific task.`;
  }

  // Multiple tools available — build routing table and rules.
  const routingRows: string[] = [];
  if (hasClaudeTool) routingRows.push('| `claude_execute` | Architecture design, code review, complex refactoring, cross-file analysis, debugging |');
  if (hasGeminiTool) routingRows.push('| `gemini_execute` | Frontend UI (React/Vue/HTML/CSS), algorithm implementation, large-context tasks (1M tokens) |');
  if (hasCodexTool) routingRows.push('| `codex_execute`  | Backend API (REST/GraphQL), database/ORM design, server-side business logic, scripts |');
  if (hasCursorTool) routingRows.push('| `cursor_execute` | General-purpose AI coding: any coding task, file editing, shell commands, codebase search |');
  if (hasCopilotTool) routingRows.push('| `copilot_execute` | General-purpose AI coding: any coding task, shell & git commands, codebase search, gh CLI |');
  if (hasAcpTool) routingRows.push('| `acpx_execute`   | ACP protocol: persistent multi-turn sessions with codex/claude/gemini/cursor/copilot; use when you need session continuity or named parallel sessions |');

  const routingTable = `\n| Tool | Best for |\n|------|----------|\n${routingRows.join('\n')}`;

  // Determine general-purpose fallback tools (in priority order)
  const generalTools = available.filter(t =>
    t === '`cursor_execute`' || t === '`copilot_execute`' || t === '`claude_execute`'
  );
  const fallbackClause = generalTools.length > 0
    ? `use ${generalTools[0]} (general-purpose)`
    : `use the most general tool available from the list`;

  return `

## 🤖 PRIORITY: Use Local AI Coding Agents

The following local AI coding agent CLI tool(s) are available on this system: ${toolList}.

**Before writing any code yourself, ALWAYS check the table below and delegate the task to the appropriate coding agent.**
${routingTable}

### Routing rules

1. **Immediately delegate** any coding task — do NOT start implementing code yourself before trying an available agent.
2. **Pick the right specialist** for the task type using the table above (gemini → frontend, codex → backend, claude → review/architecture).
3. **When no specialist matches** the task type or when multiple general-purpose tools are available, ${fallbackClause}.
4. **Multiple tools are available** — if one agent fails or is rate-limited, automatically retry with the next available tool from the list: ${toolList}.
5. Pass a **complete, self-contained task description** as the \`prompt\` argument so the agent can act autonomously (include file paths, requirements, libraries, tests).
6. Always set \`cwd\` to the relevant project directory.
7. After the agent responds, review its output and verify correctness before reporting back.
8. Only fall back to direct tools (edit_file, write_file, execute_bash) when ALL coding agent tools are unavailable or have already failed.`;
}
