---
name: coding-agent-router
description: Multi-executor task routing skill for intelligently delegating coding tasks to the right local AI coding agent CLI (claude, gemini, codex, cursor, copilot). Use when local AI coding CLIs are available and you need to decide which agent handles which subtask.
---

# Coding Agent Router Skill

## 🎯 Purpose

When one or more local AI coding CLI tools are available (`claude_execute`, `gemini_execute`, `codex_execute`, `cursor_execute`, `copilot_execute`), this skill guides how to intelligently route each subtask to the **right executor** rather than implementing it manually.

The core principles:
1. **Always delegate first** — before writing a single line of code yourself, check whether an available coding agent can do it.
2. **Match the task type to the agent's strength** — use the routing table below.
3. **Handle single-tool and multi-tool scenarios** differently (see sections below).

---

## 🗺️ Executor Routing Table

| Executor | Tool Name | Best For | Avoid For |
|----------|-----------|----------|-----------|
| **Claude Code** | `claude_execute` | Architecture decisions, code review, complex refactoring, cross-file analysis, debugging hard logic bugs, explaining large codebases | Pure frontend pixel work |
| **Gemini CLI** | `gemini_execute` | Frontend UI components (React/Vue/HTML/CSS), algorithm implementation, tasks needing 1M token context, multimodal (image + code) | Database schema design |
| **OpenAI Codex** | `codex_execute` | Backend API (REST/GraphQL), database/ORM, server-side logic, CLI tools, scripts, data pipelines | UI component styling |
| **Cursor** | `cursor_execute` | General-purpose AI coding: any coding task, file editing, shell commands, codebase search, debugging | — |
| **GitHub Copilot** | `copilot_execute` | General-purpose AI coding: any coding task, file editing, shell commands, codebase search, debugging | — |

---

## 🔄 Routing Decision Process

```
Task received
     ↓
CHECK available tools (inspect which CLI tools are present)
     ↓
ONE tool available?
  └─ YES → Use that single tool for ALL coding tasks immediately
  └─ NO (multiple tools) → continue below
     ↓
CLASSIFY the task:
  ├─ Frontend UI / styling / components?    → gemini_execute (if available)
  ├─ Backend API / DB / server logic?       → codex_execute (if available)
  ├─ Architecture / review / refactor?      → claude_execute (if available)
  └─ General coding / no specialist match?  → cursor_execute or copilot_execute or claude_execute
                                              (whichever is available, in this priority order)
     ↓
Multiple concerns (full-stack)? → split into subtasks, route each to the right specialist
     ↓
DELEGATE with a complete self-contained prompt
     ↓
If agent fails or is unavailable → retry with next available tool from the list
     ↓
VERIFY the result
     ↓
INTEGRATE and report back
```

---

## 🔧 Single-Tool Scenario

When only **one** coding agent is available (e.g., only `copilot_execute` or only `claude_execute`):

- **Use that tool for every coding task** — writing code, fixing bugs, editing files, running commands, etc.
- Do NOT attempt to implement code yourself just because the tool is a "specialist" for a different domain.
- Example: if only `copilot_execute` is available, use it for backend, frontend, refactoring, and everything else.

---

## 🔀 Multi-Tool Scenario

When **multiple** coding agents are available:

1. **Route to the specialist first** — gemini for frontend, codex for backend, claude for review/architecture.
2. **Use general-purpose tools** (cursor_execute, copilot_execute, claude_execute) for tasks that don't fit a specialist.
3. **If a specialist fails** — retry with a general-purpose tool rather than implementing it yourself.
4. **For full-stack work** — split into subtasks and run specialist agents in parallel where possible.

---

## 📋 Task Classification Examples

### Frontend → `gemini_execute`
- "Create a responsive login form component in React"
- "Add CSS animation to the navbar"
- "Implement a date picker with Vue 3 Composition API"
- "Build an interactive chart with D3.js"

### Backend → `codex_execute`
- "Implement a REST endpoint for user authentication with JWT"
- "Write a database migration to add an index on the emails column"
- "Create a GraphQL resolver for paginated posts"
- "Build a CLI tool that parses CSV files and outputs JSON"

### Architecture / Review → `claude_execute`
- "Review these 5 files for security vulnerabilities"
- "Refactor this module to reduce coupling between services"
- "Design the data flow architecture for this new feature"
- "Debug why this async race condition occurs"

### General Coding → `cursor_execute` or `copilot_execute`
- Use whichever general-purpose tool is available for any coding task
- Writing code, editing files, running commands, searching the codebase
- "Fix the bug in src/api.ts"
- "Add unit tests for the UserService class"
- "Search for all usages of the deprecated method and replace them"

---

## 📦 Full-Stack Task Splitting

For full-stack features, **split into specialist subtasks** and run them in parallel when dependencies allow:

```
Feature: "Add user profile editing"
     ↓
Split:
  ├─ [gemini_execute] "Create ProfileEditForm React component with validation UI"
  ├─ [codex_execute]  "Implement PUT /api/users/:id endpoint with validation"
  └─ [claude_execute] "Review the profile update data flow for security issues"
     ↓
Run frontend + backend in parallel (no dependency)
     ↓
Run review after both complete
```

---

## ✍️ Prompt Construction Guidelines

A good prompt to a coding agent must be **self-contained** — the agent has no context from the conversation.

### ✅ Good prompt
```
Implement a REST API endpoint `PUT /api/users/:id` in the Express app located at
./src/server.ts. The endpoint should:
1. Accept JSON body with fields: displayName (string), bio (string, max 500 chars)
2. Validate input using Zod
3. Update the user record in the SQLite database (schema in ./src/db/schema.ts)
4. Return the updated user object as JSON
5. Add a corresponding test in __tests__/api/users.test.ts
Working directory: /Users/alice/my-project
```

### ❌ Bad prompt
```
Add the user profile update endpoint
```
(Missing: file locations, database type, validation library, test requirements)

### Template
```
[Action verb] [what to build] in [file/module location].
Requirements:
1. [Specific requirement]
2. [Specific requirement]
[Technologies/libraries to use]
[Any constraints or existing patterns to follow]
Working directory: [absolute path]
```

---

## ⚡ Parallel Execution Pattern

When tasks have no dependencies between them, delegate all in a **single step** using parallel tool calls:

```typescript
// Parallel: frontend + backend have no dependency on each other
await Promise.all([
  gemini_execute({ prompt: "...", cwd: projectDir }),
  codex_execute({ prompt: "...", cwd: projectDir }),
]);

// Then sequential: review depends on both completing first
await claude_execute({ prompt: "Review the changes made to ...", cwd: projectDir });
```

---

## 🧠 Extended Thinking for Complex claude_execute Tasks

For complex tasks routed to `claude_execute`, pass `--extended-thinking` via the `args` parameter to unlock Claude Code's deeper reasoning mode. This produces significantly better analysis for architecture, security, and multi-file refactoring:

```typescript
// Complex tasks — use extended thinking
claude_execute({
  prompt: "Review these 5 files for security vulnerabilities in the auth flow...",
  args: ["--extended-thinking"],
  cwd: projectDir
})

claude_execute({
  prompt: "Refactor the order module to remove circular dependencies across 6 files...",
  args: ["--extended-thinking"],
  cwd: projectDir
})

// Simple tasks — standard mode is fine
claude_execute({
  prompt: "Add JSDoc comments to the getUser function in src/services/user.ts",
  cwd: projectDir
})
```

### When to Add `--extended-thinking`

| Use extended thinking | Standard mode |
|---|---|
| Refactoring across 5+ files | Adding a single function |
| Architecture or data model design | Fixing a clear bug |
| Security vulnerability analysis | Adding comments or docs |
| Debugging async race conditions | Renaming a variable |
| Evaluating multiple design approaches | Adding an import |

---

## 🔍 After Delegation: Verification Steps

After each coding agent responds:

1. **Check `success` field** in the JSON response
2. **Read `stdout`** to see what the agent produced
3. **Verify output files exist** using `glob_files` or `view_file`
4. **Run build** (`execute_bash`: `npm run build` or equivalent) to catch compile errors
5. **Run affected tests** (`execute_bash`: `npm test -- --testPathPatterns="..."`)
6. Only mark the task complete when build + tests pass

---

## ⚠️ Fallback Behavior

If a specialist tool call fails or the CLI is not installed:
1. Try the next available coding agent from the list (e.g., if `codex_execute` fails for a backend task, try `copilot_execute` or `claude_execute`)
2. Only fall back to direct file manipulation tools (`edit_file`, `write_file`, `execute_bash`) as a **last resort** after all available coding agents have been tried
3. Never silently skip verification — always build and test even when falling back

---

## 🚫 Anti-Patterns

| Anti-pattern | Why it fails | Correct approach |
|--------------|-------------|-----------------|
| Routing all tasks to `claude_execute` only | Misses Gemini's UI strength and Codex's backend depth | Use the routing table |
| Sending vague prompts ("fix the bug") | Agent lacks context to act | Write self-contained prompts with file paths and requirements |
| Not verifying output | Undetected compile errors or test failures | Always build + test after delegation |
| Doing the implementation yourself instead of delegating | Defeats the purpose of having specialist agents | Delegate first; only fall back if delegation fails |
| Ignoring a locally installed tool because it's "not the best specialist" | Any available coding agent is better than doing it manually | If a tool is available, use it — even if it's not the ideal specialist for the task |
| Assuming only one coding tool is installed | There may be multiple tools; each should be tried on failure | Enumerate all available tools and use them as a fallback chain |
