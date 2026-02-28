---
name: coding-agent-router
description: Multi-executor task routing skill for intelligently delegating coding tasks to the right local AI coding agent CLI (claude, gemini, codex, cursor). Use when local AI coding CLIs are available and you need to decide which agent handles which subtask.
---

# Coding Agent Router Skill

## 🎯 Purpose

When multiple local AI coding CLI tools are available (`claude_execute`, `gemini_execute`, `codex_execute`, `cursor_execute`), this skill guides how to intelligently route each subtask to the **right executor** rather than doing everything with a single agent or doing it manually.

The core principle: **match the task type to the agent's strength**, then delegate fully.

---

## 🗺️ Executor Routing Table

| Executor | Tool Name | Best For | Avoid For |
|----------|-----------|----------|-----------|
| **Claude Code** | `claude_execute` | Architecture decisions, code review, complex refactoring, cross-file analysis, debugging hard logic bugs, explaining large codebases | Pure frontend pixel work |
| **Gemini CLI** | `gemini_execute` | Frontend UI components (React/Vue/HTML/CSS), algorithm implementation, tasks needing 1M token context, multimodal (image + code) | Database schema design |
| **OpenAI Codex** | `codex_execute` | Backend API (REST/GraphQL), database/ORM, server-side logic, CLI tools, scripts, data pipelines | UI component styling |
| **Cursor** | `cursor_execute` | General AI-assisted coding when no specialist tool is available; opening files in the Cursor editor | — |

---

## 🔄 Routing Decision Process

```
Task received
     ↓
CHECK available tools (inspect which CLI tools are present)
     ↓
CLASSIFY the task:
  ├─ Frontend UI / styling / components?  → gemini_execute
  ├─ Backend API / DB / server logic?     → codex_execute
  ├─ Architecture / review / refactor?    → claude_execute
  ├─ General coding (no specialist match)? → cursor_execute or claude_execute
  └─ Multiple concerns (full-stack)?      → split into subtasks, route each
     ↓
DELEGATE with a complete self-contained prompt
     ↓
VERIFY the result
     ↓
INTEGRATE and report back
```

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

### General Coding → `cursor_execute` (fallback)
- Any coding task when neither gemini nor codex is available

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
1. Check if an alternative specialist is available (e.g., if `codex_execute` fails, try `claude_execute` for backend task)
2. Fall back to direct file manipulation tools (`edit_file`, `write_file`, `execute_bash`) only as last resort
3. Never silently skip verification — always build and test even when falling back

---

## 🚫 Anti-Patterns

| Anti-pattern | Why it fails | Correct approach |
|--------------|-------------|-----------------|
| Routing all tasks to `claude_execute` only | Misses Gemini's UI strength and Codex's backend depth | Use the routing table |
| Sending vague prompts ("fix the bug") | Agent lacks context to act | Write self-contained prompts with file paths and requirements |
| Not verifying output | Undetected compile errors or test failures | Always build + test after delegation |
| Doing the implementation yourself instead of delegating | Defeats the purpose of having specialist agents | Delegate first; only fall back if delegation fails |
