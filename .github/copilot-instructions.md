# AIBO — Copilot Instructions

## Build, Test, and Dev Commands

```bash
npm install           # install dependencies
npm run build         # compile TypeScript → dist/ (tsc + tsc-alias)
npm test              # run all tests (Jest)
npm run test:watch    # watch mode
npm run test:coverage # with coverage report

# Run a single test file
npx jest __tests__/config.test.ts

# Run tests matching a pattern
npx jest --testPathPatterns="config"

# Dev (ts-node, no build required)
npm run dev           # console mode
npm run dev:lark      # Lark/Feishu bot mode
```

No linter is configured; TypeScript strict mode (`"strict": true`) acts as the primary check.

## Architecture Overview

AIBO is a **multi-agent AI assistant** built on [DeepAgents](https://www.npmjs.com/package/deepagents) + LangChain/LangGraph. The key execution flow:

```
bin/index.js
  └─ src/main.ts          (createProgram / Commander CLI)
       └─ src/cli/         (subcommands: interact, init)
            └─ src/core/agent/factory.ts   (createAIAgent)
                 ├─ src/core/agent/model.ts        (LangChain model factory; auto-detects provider)
                 ├─ src/tools/index.ts              (aggregates all tools)
                 ├─ src/infrastructure/agents/      (loads agents/*.md as SubAgents)
                 ├─ src/core/utils/skills.ts         (discovers skills/ dirs recursively)
                 ├─ src/core/utils/system-prompt.ts  (injects coding-agent routing hint)
                 └─ createDeepAgent(...)             (DeepAgents orchestration + LangGraph checkpointer)
```

**Two interaction modes** (resolved in `src/core/config/index.ts`):
- `console` — terminal REPL via `src/presentation/console/`
- `lark` — Feishu/Lark bot via `src/presentation/lark/`

**Agents** (`agents/*.md`) are Markdown files with YAML frontmatter loaded at startup into `SubAgent` configs. The loader (`src/infrastructure/agents/loader.ts`) recursively finds every `agents/` directory under `process.cwd()` and reinforces their system prompts via `SubAgentPromptTemplate`.

**Skills** (`skills/<name>/SKILL.md`) are Markdown workflow guides passed directly to DeepAgents as `skills` paths. They are discovered recursively under `process.cwd()` as well.

**Tools** (`src/tools/*.ts`) wrap LangChain tools. CLI coding tools (`claude_execute`, `gemini_execute`, `codex_execute`, `cursor_execute`, `copilot_execute`) delegate to locally installed AI CLIs and are auto-detected at startup; their presence dynamically extends the system prompt with routing guidance.

## Key Conventions

### Path aliasing
`@/` maps to `src/` throughout the TypeScript source (configured in `tsconfig.json` and `jest.config.ts`). Always use `@/` for internal imports.

### Environment / config
All configuration lives in `src/core/config/index.ts`, validated with Zod at startup. Every env var is prefixed `AIBO_`. Access config via the exported `config` object — never read `process.env` directly elsewhere.

### Agent markdown format
Agent files use YAML frontmatter + Markdown body:
```markdown
---
name: my-agent
description: One-line description used by the coordinator for routing
---
System prompt body here…

## Capabilities
- Item one

## Guidelines
- Item one
```
The loader parses `## Capabilities` and `## Guidelines` sections to build a reinforced prompt.

### Skill markdown format
```markdown
---
name: my-skill
description: Trigger description
---
Workflow instructions…
```
Place the file at `skills/<skill-name>/SKILL.md`.

### Coding-agent routing (multi-tool)
When multiple CLI coding tools are available, the system routes by task type:
- `gemini_execute` → frontend UI / React / Vue / CSS
- `codex_execute` → backend API / DB / server logic
- `claude_execute` → architecture review / complex refactoring / cross-file analysis
- `cursor_execute` / `copilot_execute` → general-purpose fallback (priority order)

When only one tool is available, always use it for every coding task. See `skills/coding-agent-router/SKILL.md` for the full routing decision tree.

### Filesystem safety
All file operations go through `SafeFilesystemBackend` (`src/infrastructure/filesystem/safe-backend.ts`) rooted at `process.cwd()` with a 10 MB file limit and depth 5 cap. Sub-agents must use absolute paths constructed from `process.cwd()`.

### Checkpointing
Configured via `AIBO_CHECKPOINTER_TYPE`: `memory` (default), `filesystem`, or `sqlite` (not yet implemented). The `FilesystemCheckpointer` stores state under `.data/`.

### Tests
All tests live in `__tests__/` mirroring the `src/` structure. Tests use `ts-jest` with the `@/` alias via `moduleNameMapper`. To add a test for `src/foo/bar.ts`, create `__tests__/foo/bar.test.ts`.

### MCP tools
MCP server configs go in `mcps/*.json` (not committed; see `docs/mcp.md`). They are loaded by `src/tools/local-mcp.ts` at startup.
