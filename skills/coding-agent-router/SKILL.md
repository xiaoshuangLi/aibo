---
name: coding-agent-router
description: Multi-executor task routing skill for intelligently delegating coding tasks to the right local AI coding agent CLI (claude, gemini, codex, cursor, copilot). Use whenever any local AI coding CLI is available — whether one tool or many.
---

# Coding Agent Router Skill

## 🎯 Purpose

When one or more local AI coding CLI tools are available (`claude_execute`, `gemini_execute`, `codex_execute`, `cursor_execute`, `copilot_execute`), this skill guides how to **delegate first** and then route to the best available executor.

**Core principles:**
1. **Delegate first, always.** The moment any coding tool is detected, use it for all coding work — never implement code yourself.
2. **Route to the best specialist.** When multiple tools are available, match the task type to each tool's strength. When only one tool is available, it handles everything.
3. **No specialist match → use the most general available tool** (`cursor_execute` or `copilot_execute` or `claude_execute`), not direct implementation.

---

## 🗺️ Executor Routing Table

| Executor | Tool Name | Best For | Avoid For |
|----------|-----------|----------|-----------|
| **Claude Code** | `claude_execute` | Architecture decisions, code review, complex refactoring, cross-file analysis, debugging hard logic bugs, explaining large codebases | Pure frontend pixel work |
| **Gemini CLI** | `gemini_execute` | Frontend UI components (React/Vue/HTML/CSS), algorithm implementation, tasks needing 1M token context, multimodal (image + code) | Database schema design |
| **OpenAI Codex** | `codex_execute` | Backend API (REST/GraphQL), database/ORM, server-side logic, CLI tools, scripts, data pipelines | UI component styling |
| **Cursor** | `cursor_execute` | General AI-assisted coding; handles any task type when used as the sole or fallback tool | — |
| **GitHub Copilot** | `copilot_execute` | General-purpose AI coding: writing code, editing files, running shell commands, searching the codebase, debugging | — |

---

## 🔄 Routing Decision Process

```
Task received
     ↓
CHECK available tools (inspect which CLI tools are present in the tool list)
     ↓
← ANY tools available? → NO  →  implement directly with edit_file / execute_bash
     ↓ YES
DELEGATE — always route to an available tool; never implement code yourself
     ↓
CLASSIFY the task to pick the best available tool:
  ├─ Frontend UI / styling / components?         → gemini_execute (if available)
  ├─ Backend API / DB / server logic?            → codex_execute  (if available)
  ├─ Architecture / review / complex refactor?   → claude_execute (if available)
  ├─ Shell / git / gh command suggestion?        → copilot_execute or execute_bash
  ├─ General coding / no specialist match?       → cursor_execute (preferred) → copilot_execute → claude_execute (priority order: pick the first one that is available)
  └─ Multiple concerns (full-stack)?             → split into subtasks, route each
     ↓
If the ideal specialist is NOT available, route to the closest available alternative
  (e.g. claude unavailable → use cursor or copilot for the task)
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

### General Coding → `cursor_execute` or `copilot_execute` (when available)
- Any coding task when no specialist tool matches, or when these are the only available tools
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
