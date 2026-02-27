---
name: project-context
description: Automatically reads and applies project-specific conventions, architecture decisions, and development guidelines. Equivalent to Claude Code's CLAUDE.md support. Use this skill at the start of every session to understand the project's specific rules and patterns.
---

# Project Context Skill

## 🎯 Purpose
Loads and applies project-specific context files that define conventions, architecture decisions, coding standards, and development workflows unique to this project. This is the equivalent of Claude Code's `CLAUDE.md` support.

## 🚀 When to Use
- **At the start of every session** — always read project context before making changes
- Before implementing any feature to understand project conventions
- Before reviewing code to understand what "good" looks like for this project
- When joining a new project for the first time
- When context about the project's unique decisions is needed

## 📁 Context File Discovery

### Priority Order (highest first)
1. `CLAUDE.md` — Claude Code convention (if present)
2. `AGENTS.md` — Agent-specific instructions
3. `AIBO.md` — Aibo-specific project instructions
4. `README.md` — General project documentation
5. `docs/ARCHITECTURE.md` — Architecture decisions
6. `docs/CONTRIBUTING.md` — Contributing guidelines
7. `docs/DEVELOPMENT.md` — Development setup

### How to Read Project Context
```bash
# Step 1: Find context files
glob_files pattern="CLAUDE.md,AGENTS.md,AIBO.md,README.md" cwd="<project-root>"

# Step 2: Read them in priority order
read_file path="<project-root>/CLAUDE.md"  # if exists
read_file path="<project-root>/AGENTS.md"  # if exists
read_file path="<project-root>/README.md"

# Step 3: Find architecture docs
glob_files pattern="docs/**/*.md" cwd="<project-root>"
```

## 📝 CLAUDE.md / AIBO.md Format

Projects may include a `CLAUDE.md` or `AIBO.md` file at the root. This file provides persistent instructions that apply to every session. It typically includes:

```markdown
# Project Instructions

## Architecture
Brief overview of the architecture...

## Commands
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

## Conventions
- Use kebab-case for file names
- Use PascalCase for React components
- All API responses must include `success` boolean

## Do Not
- Never commit to main directly
- Never use `any` type in TypeScript
- Never skip tests

## Key Files
- `src/core/agent/agent-factory.ts` — agent initialization
- `src/shared/constants/system-prompts.ts` — system prompts
```

## 🔍 What to Extract from Context

When reading project context files, extract and remember:

1. **Build and test commands** — how to build, test, and run the project
2. **Architecture patterns** — how code is organized, naming conventions
3. **Forbidden patterns** — things you must never do in this project
4. **Key files** — the most important files to understand
5. **External dependencies** — APIs, services, and their configurations
6. **Testing standards** — coverage requirements, test patterns to follow
7. **Code style** — linting rules, formatting conventions

## ✅ Context Application Checklist

Before starting any task in a session:
- [ ] Read `CLAUDE.md` or `AIBO.md` if present
- [ ] Read `README.md` for project overview
- [ ] Note the build and test commands
- [ ] Note any forbidden patterns or hard constraints
- [ ] Understand the directory structure (`glob_files pattern="src/**" `)
- [ ] Check for `.env.example` to understand environment configuration
- [ ] Review recent git commits to understand current development context: `git log --oneline -10`

## 💡 Creating a Project Context File

If no context file exists, consider creating one at `AIBO.md`:

```markdown
# AIBO Project Context

## Quick Start
- Install: `npm install`
- Build: `npm run build`
- Test: `npm test`
- Dev: `npm run dev`

## Architecture
[Brief description of the project architecture]

## Conventions
[List of conventions specific to this project]

## Important Notes
[Any critical information agents should know]
```
