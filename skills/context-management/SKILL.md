---
name: context-management
description: Best practices for managing long conversations — preventing response slowdown and goal drift. Use this skill when a conversation has been running long, responses are slowing down, or you feel the AI is losing track of the main objective. Covers /compact, knowledge base usage, and AIBO.md persistent context.
keywords: ["长对话", "context", "compact", "goal drift", "slow responses", "knowledge base", "AIBO.md"]
---

# Context Management Skill

## 🎯 Purpose
Long conversations accumulate tokens in the message history, causing two problems:
1. **Slowdown** — Every request sends the entire history to the model. More history = more tokens = longer wait.
2. **Goal drift** — The AI "forgets" the original objective as the active window fills with recent tool calls and intermediate results.

This skill documents the exact tools and workflows to fix both problems, mirroring the best practices used in Claude Code.

---

## 🚨 Signs You Need Context Management

| Symptom | Cause | Fix |
|---------|-------|-----|
| Responses are noticeably slower | History has grown large | `/compact` |
| AI asks clarifying questions about what you already discussed | Goal drift | `/compact` + restate goal |
| AI starts repeating work it already did | Context overload | `/compact` |
| You are about to start a new major sub-task | Preventive maintenance | `/compact` before starting |

---

## 🛠️ Tool 1: `/compact` Command (Primary Fix)

### What it does
`/compact` is Aibo's equivalent of Claude Code's `/compact` command. It:
1. **Saves** all knowledge base entries from the current session
2. **Creates** a fresh session thread (clearing the heavy message history)
3. **Migrates** the saved knowledge entries to the new session
4. **Shows** a summary of what was preserved

### When to use it
```
After completing a major sub-task           → /compact
When response time noticeably increases     → /compact
Before starting a complex new phase         → /compact
When the AI seems confused about the goal   → /compact, then restate goal
```

### Usage
Simply type:
```
/compact
```

After running `/compact`, the new session starts clean. Restate your current goal to orient the AI:
```
继续上面的工作：我们正在为 user-service.ts 添加邮件验证功能。
知识库中已有背景信息，请继续。
```

### How it differs from `/new`
| Command | Message history | Knowledge base | Use when |
|---------|----------------|----------------|----------|
| `/new` | ❌ Cleared | ❌ Lost | Starting a completely different task |
| `/compact` | ❌ Cleared | ✅ Migrated | Continuing the same task, just freeing up context |

---

## 🛠️ Tool 2: Knowledge Base (Preserve Goals Across Compactions)

The knowledge base persists through `/compact` — it's the mechanism that carries your important context forward.

### What to store in the knowledge base

**Store these kinds of things:**
```
Project goal / main objective
Key architectural decisions already made
Important constraints or requirements
Current progress ("Phase 1 done, starting Phase 2")
Key file paths and their purposes
API specifications or contracts
```

**Don't store these:**
```
Intermediate code snippets (use the filesystem)
Full tool call results (too verbose)
Things that will change frequently
```

### How to store knowledge

Tell the AI directly:
```
请用 add_knowledge 工具把这个决定保存下来：我们决定使用 JWT 而不是 session cookie，
原因是前后端分离架构的需要。标题：'认证方案决策'，关键词：['JWT', '认证', '架构决策']
```

Or use the tool directly in prompts:
```typescript
// The AI will call:
add_knowledge({
  content: "Project goal: Build a REST API for the user management service. Key constraints: (1) must support JWT auth, (2) PostgreSQL only, (3) no external services",
  title: "Project Goal & Constraints",
  keywords: ["goal", "constraints", "architecture"]
})
```

### Retrieve knowledge after /compact
```
请用 get_knowledge_summaries 工具查看当前知识库内容，然后告诉我你的理解。
```

---

## 🛠️ Tool 3: AIBO.md — Persistent Session-Independent Context

For project-level context that should be available at the start of **every** session (not just after `/compact`), create an `AIBO.md` file at the project root.

### Why AIBO.md matters
The knowledge base is session-scoped. `AIBO.md` is read from disk at session start, so it's always available regardless of how many times you compact or restart.

### Create AIBO.md
```bash
# Create at the project root
touch AIBO.md
```

### AIBO.md template
```markdown
# AIBO Project Context

## 🎯 Main Goal
[One paragraph: what this project does and what we're trying to achieve]

## 📋 Current Phase
[What phase of work we're in right now — update this as you progress]

## 🚀 Commands
- Build: `npm run build`
- Test: `npm test`
- Dev: `npm run dev`

## 🏗️ Architecture
[Brief description of the architecture — key components and how they connect]

## ⚠️ Constraints & Rules
- [Rule 1 — e.g., never commit to main directly]
- [Rule 2 — e.g., all code must have 85%+ test coverage]
- [Rule 3 — e.g., use TypeScript strict mode]

## 📁 Key Files
- `src/core/agent/agent-factory.ts` — agent initialization
- `src/shared/constants/system-prompts.ts` — system prompts

## 🚫 Do Not
- [Thing 1 the AI should never do in this project]
- [Thing 2]
```

### Reading AIBO.md at session start
The `project-context` skill documents how to read context files. At the start of any session:
```
请读取项目根目录的 AIBO.md 文件，了解当前项目背景，然后告诉我你的理解。
```

---

## 🔄 Recommended Workflow for Long Tasks

```
1. SESSION START
   └── Read AIBO.md (if present) to orient yourself
   └── Use get_knowledge_summaries to check existing knowledge
   └── State the current goal clearly

2. DURING WORK
   └── Save key decisions: add_knowledge(...)
   └── Save completed milestones: add_knowledge(...)
   └── At the end of each major phase: /compact

3. AFTER /compact
   └── Restate the current goal ("我们在继续做...")
   └── The AI will check the knowledge base for context

4. SESSION END
   └── Save any final knowledge items
   └── Update AIBO.md with the new "Current Phase"
```

---

## ⚡ Quick Reference

```
/compact                  → Free up context, keep knowledge base
/new                      → Completely fresh start (loses everything)
add_knowledge(...)        → Save important context for future compactions
get_knowledge_summaries() → See what context has been preserved
AIBO.md                   → Persistent context across all sessions
```

---

## 📊 Token Budget Awareness

These are rough estimates — actual token usage varies greatly depending on message size
(tool call results, code snippets, and long outputs consume many more tokens than short messages):

- **< 20 messages**: Usually fine; no action needed
- **20–50 messages**: Consider `/compact` after completing a sub-task
- **50+ messages**: Responses likely slowing; use `/compact`
- **100+ messages**: Strongly recommended to `/compact` immediately

> **Note**: A few messages with large code blocks can consume as many tokens as dozens of short messages.
> When in doubt, use `/compact` — it has no downside if the knowledge base is populated.

The best time to compact is **between sub-tasks**, not in the middle of one, so that no in-progress state is lost.
