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
  return SYSTEM_PROMPT + buildCodingAgentHint(hasClaudeTool, hasCursorTool, hasGeminiTool, hasCodexTool, hasCopilotTool);
}

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
