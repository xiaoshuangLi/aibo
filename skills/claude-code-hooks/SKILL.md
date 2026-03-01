---
name: claude-code-hooks
description: Replicates Claude Code's automatic code quality enforcement in AIBO. Teaches how to simulate Claude Code's hooks system (auto-format, auto-lint, auto-test after every file change) and leverage extended thinking for complex tasks, closing the code quality gap between Claude Code and AIBO operating without local CLI tools.
---

# Claude Code Hooks Equivalence Skill

## 🎯 Purpose

This skill explains **why Claude Code produces higher-quality code** than a bare AI agent, and provides AIBO with the specific workflow patterns to match that quality level — even without the `claude` CLI installed.

The quality gap comes from three concrete mechanisms Claude Code uses automatically:
1. **PostToolUse hooks** — runs formatters and linters after every file write
2. **Extended thinking** — allocates deeper reasoning for complex tasks
3. **CLAUDE.md project memory** — reads project-specific rules before every action

This skill gives AIBO equivalent patterns for each.

---

## 🪝 Mechanism 1: PostToolUse Hooks → Auto-Format & Auto-Lint

### What Claude Code Does
Claude Code's `~/.claude/settings.json` supports hook definitions like:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "prettier --write \"$CLAUDE_TOOL_INPUT_PATH\"" },
          { "type": "command", "command": "eslint --fix \"$CLAUDE_TOOL_INPUT_PATH\"" }
        ]
      }
    ]
  }
}
```

This means: **every single file write is automatically formatted and linted**. The AI never sees a formatting inconsistency because it's corrected immediately. This is why Claude Code output looks polished even on the first attempt.

### AIBO Equivalent: Manual Hook Simulation

After every `edit_file` or `write_file` call, **immediately run the project's formatter and linter** on the changed file:

```bash
# Step 1: Write/edit the file
edit_file path="src/services/user.ts" ...

# Step 2: IMMEDIATELY auto-format (simulate PostToolUse hook)
execute_bash command="npx prettier --write src/services/user.ts"

# Step 3: IMMEDIATELY auto-lint with fix (simulate PostToolUse hook)
execute_bash command="npx eslint --fix src/services/user.ts"

# Step 4: Check if linter has remaining issues (non-auto-fixable)
execute_bash command="npx eslint src/services/user.ts"
```

### Formatter Detection by Project Type

| Project Type | Detection Method | Format Command |
|---|---|---|
| JavaScript/TypeScript | `package.json` has `prettier` | `npx prettier --write <file>` |
| Python | `pyproject.toml` has `black`/`ruff` | `black <file>` or `ruff format <file>` |
| Go | Always available | `gofmt -w <file>` |
| Rust | Always available | `rustfmt <file>` |
| Java | Check `pom.xml`/`build.gradle` | `mvn spotless:apply` |

### Linter Detection by Project Type

| Project Type | Detection Method | Lint Command |
|---|---|---|
| JavaScript/TypeScript | `package.json` has `eslint` | `npx eslint --fix <file>` |
| Python (type) | `pyproject.toml` has `mypy` | `mypy <file>` |
| Python (style) | Has `ruff` | `ruff check --fix <file>` |
| Go | Always available | `go vet ./...` |
| Rust | Always available | `cargo clippy --fix` |

### Workflow: Find the Right Commands

```bash
# Before starting any task, discover what quality tools are available:
execute_bash command="cat package.json | grep -E '\"prettier\"|\"eslint\"|\"lint\"|\"format\"'"
execute_bash command="ls .prettierrc* .eslintrc* pyproject.toml .golangci.yml 2>/dev/null"
```

---

## 🧠 Mechanism 2: Extended Thinking → Deeper Reasoning

### What Claude Code Does
For complex tasks (architecture decisions, debugging hard logic bugs, security review), Claude Code can use extended thinking via the `--extended-thinking` flag. This allocates significantly more "thinking tokens" before producing output, resulting in better analysis.

### AIBO Equivalent: Use Extended Thinking via claude_execute

When using `claude_execute` for complex tasks, pass the `--extended-thinking` flag:

```typescript
// For complex architecture, debugging, or security review tasks:
claude_execute({
  prompt: "Review these 5 files for security vulnerabilities in the authentication flow...",
  args: ["--extended-thinking"],
  cwd: projectDir
})

// For standard coding tasks, extended thinking is not needed:
claude_execute({
  prompt: "Add a null check to the getUser function in src/services/user.ts",
  cwd: projectDir
})
```

### When to Use Extended Thinking

| Task Type | Use Extended Thinking? |
|---|---|
| Simple function addition | ❌ Not needed |
| Bug fix with clear error | ❌ Not needed |
| Complex refactoring across 5+ files | ✅ Yes |
| Architecture decision | ✅ Yes |
| Security vulnerability analysis | ✅ Yes |
| Debugging async race conditions | ✅ Yes |
| Designing new data models | ✅ Yes |

### AIBO Self-Reasoning Equivalent (No Claude CLI)

When `claude_execute` is NOT available, allocate extra exploration steps before implementing complex tasks. Use the `think` tool to reason through the problem:

```typescript
// Use the think tool for complex decisions before implementing
think({
  thought: `
    Complex task: refactor authentication module for multi-tenant support.
    
    Current state analysis:
    - User model has single tenantId field (implicit single-tenant assumption)
    - Auth middleware extracts userId but not tenantId
    - 3 services access user data directly without tenant filtering
    
    Approach options:
    1. Add tenantId to middleware context → requires updating 3 service files
    2. Create TenantContext class → cleaner but more files changed
    3. Use database-level RLS → most secure but infrastructure change
    
    Decision: Option 1 (minimum viable, reversible, can migrate to 2 later)
    
    Files that will change:
    - src/middleware/auth.ts (extract tenantId)
    - src/services/user.ts (filter by tenant)
    - src/services/order.ts (filter by tenant)
    - src/services/product.ts (filter by tenant)
    - src/types/context.ts (add tenantId to AuthContext)
    
    Risk: must update all 3 services atomically or queries will return wrong data
  `
})
```

---

## 📋 Mechanism 3: CLAUDE.md → Project Memory

### What Claude Code Does
Claude Code automatically reads `CLAUDE.md` from:
1. The current project directory
2. Parent directories up to home
3. `~/.claude/CLAUDE.md` (global memory)

This gives it instant access to project conventions, forbidden patterns, and build commands — every session, without being told.

### AIBO Equivalent: Always Load Project Context First

At the start of every session, before writing any code:

```bash
# Step 1: Check for project context files (in priority order)
glob_files pattern="CLAUDE.md,AGENTS.md,AIBO.md" cwd="<project-root>"

# Step 2: Read whichever exists (CLAUDE.md takes priority)
view_file path="<project-root>/CLAUDE.md"   # if exists
view_file path="<project-root>/AGENTS.md"   # if exists
view_file path="<project-root>/AIBO.md"     # if exists

# Step 3: Read README for project overview
view_file path="<project-root>/README.md"

# Step 4: Understand the build/test/lint commands
execute_bash command="cat package.json | python3 -c \"import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('scripts',{}), indent=2))\""
```

> 📖 See the **project-context** skill for the complete context loading workflow.

---

## 👁️ Mechanism 4: Post-Implementation Review

### What Claude Code Does
After every non-trivial change, Claude Code performs a self-review by re-reading the changed files as a reviewer — checking correctness, edge cases, security, and consistency. This is the step that catches "it compiles but it's wrong" bugs that formatters and tests miss.

### AIBO Equivalent: Mandatory Post-Implementation Review

After build and tests pass, review every changed file before declaring done.

#### Option A: Self-Review (always available)
```bash
# Step 1: Get the list of changed files
execute_bash command="git diff --name-only HEAD"

# Step 2: Read each changed file with reviewer eyes
view_file path="<changed-file>"
```

Apply this checklist to each file:
- **Correctness** — Does the logic do exactly what was intended?
- **Edge cases** — What happens with null, empty, 0, very large input, concurrent calls?
- **Error handling** — Are all errors caught, logged, and surfaced correctly?
- **Security** — Any unsanitized input, exposed secrets, or missing authorization checks?
- **Naming** — Are variables and functions named clearly and consistently with the codebase?

#### Option B: Delegate to Claude Code (if `claude_execute` is available)
```typescript
claude_execute({
  prompt: `Review the following changed files for correctness, edge cases, security, and maintainability.
Changed files (relative to working directory):
- src/services/user.ts
- src/types/user.ts

For each issue found, output: file, line, severity (blocking/suggestion), and what to fix.
Severity "blocking" = must fix before merging. "suggestion" = improve quality but not critical.`,
  cwd: projectDir
})
```

#### Option C: Use think Tool (when Claude CLI is not available)
```typescript
think({
  thought: `
    Reviewing src/services/user.ts (validateUser function):
    
    Logic check: returns early for empty email, but "notanemail" also passes...
    → ISSUE (blocking): missing email format validation
    
    Edge case: what if email is whitespace only? " " is truthy → bypasses guard
    → ISSUE (blocking): need trim() before the empty check
    
    Security: no SQL/XSS concerns here — purely in-memory ✓
    
    Summary: 2 blocking issues found, must fix before marking complete.
  `
})
```

> 📖 See the **code-review** skill for the full review checklist covering correctness, security, performance, maintainability, and tests.

---

## 🔄 Combined Quality Enforcement Workflow

This is the complete AIBO equivalent of Claude Code operating with all hooks active:

```
FOR EVERY FILE CHANGE:
┌─────────────────────────────────────────────────────────┐
│ 1. BEFORE WRITING                                        │
│    - Read the file first (view_file)                     │
│    - Check for existing patterns (grep_files)            │
│                                                          │
│ 2. WRITE THE CHANGE                                      │
│    - edit_file or write_file                             │
│                                                          │
│ 3. IMMEDIATELY AFTER WRITING (simulate hooks)            │
│    - Format: prettier/black/gofmt on the changed file    │
│    - Lint: eslint/ruff/go vet on the changed file        │
│    - Fix any auto-fixable lint warnings                  │
│                                                          │
│ 4. IF LINT ERRORS REMAIN                                 │
│    - Read the lint output                                │
│    - Fix manually                                        │
│    - Re-run lint to confirm zero warnings                │
└─────────────────────────────────────────────────────────┘

AFTER ALL CHANGES:
┌─────────────────────────────────────────────────────────┐
│ 5. BUILD VERIFICATION                                    │
│    - Run the full build command                          │
│    - Fix ALL compiler errors before proceeding           │
│                                                          │
│ 6. TEST VERIFICATION                                     │
│    - Run affected tests                                  │
│    - Fix ALL failures before declaring done              │
│                                                          │
│ 7. POST-IMPLEMENTATION REVIEW                            │
│    - Read each changed file with reviewer eyes           │
│    - Check correctness, edge cases, security, naming     │
│    - Fix any blocking issues found; then re-run tests    │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Creating a CLAUDE.md for Your Project

If the project doesn't have a `CLAUDE.md`, create one to give all agents (Claude Code, AIBO, Copilot) consistent project context:

```markdown
# Project: [Project Name]

## Commands
- Build: `npm run build`
- Test: `npm test`
- Test single file: `npm test -- --testPathPatterns="<filename>"`
- Lint: `npm run lint`
- Format: `npm run format` or `npx prettier --write .`
- Dev: `npm run dev`

## Architecture
[Brief description of project architecture]

## Conventions
- Use `camelCase` for variables and functions
- Use `PascalCase` for classes and types
- Use `kebab-case` for file names
- All async functions must handle errors explicitly
- No `any` types — use `unknown` with type guards instead

## Forbidden
- Never commit secrets or API keys
- Never use `console.log` in production code (use the logger)
- Never skip tests when adding new functionality
- Never commit directly to `main` — always use PRs

## Key Files
- `src/core/` — core business logic
- `src/types/` — shared TypeScript types
- `__tests__/` — all test files
```

---

## 🔧 Tool Installation FAQ

### Q: Do I need to install ESLint, Prettier, etc. locally or globally?

**No global installation required.** There are two cases:

#### Case 1: The project already has these tools in `package.json`
This is the most common case. After running `npm install`, all tools are available inside `node_modules/.bin/`. Use `npx` to run them — it finds the local version automatically:

```bash
# These work without any global install, just after `npm install`:
npx prettier --write src/services/user.ts
npx eslint --fix src/services/user.ts
npx tsc --noEmit
```

How to check if the project already has them:
```bash
cat package.json | grep -E '"eslint"|"prettier"|"typescript"'
# If they appear under "dependencies" or "devDependencies", just run npm install
```

#### Case 2: The project does NOT have these tools in `package.json`
Install them as dev dependencies — they will be added to `node_modules` and never need a global install:

```bash
# TypeScript/JavaScript project without linting:
npm install --save-dev eslint prettier

# Python project without formatting:
pip install black ruff

# Go and Rust have formatters built in — no install needed
```

#### Summary

| Tool | Requires Global Install | How to Use |
|---|---|---|
| ESLint | ❌ No | `npx eslint` (after `npm install`) |
| Prettier | ❌ No | `npx prettier` (after `npm install`) |
| TypeScript (`tsc`) | ❌ No | `npx tsc` (after `npm install`) |
| Python `black` | ❌ No | `pip install black` (per project or venv) |
| Python `ruff` | ❌ No | `pip install ruff` (per project or venv) |
| Go `gofmt` | ✅ Included with Go | built into Go installation |
| Rust `rustfmt` | ✅ Included with Rust | built into Rust installation |

**Recommendation**: Check `package.json` (or `pyproject.toml`) first. In most projects, running `npm install` once is all that's needed — no global tools required.

---

## 📊 Quality Gap Analysis: Claude Code vs. Bare Agent

| Quality Factor | Claude Code | AIBO (default) | AIBO (with this skill) |
|---|---|---|---|
| Code formatting | ✅ Automatic (hooks) | ❌ Manual | ✅ Simulated hooks |
| Lint auto-fix | ✅ Automatic (hooks) | ❌ Manual | ✅ Simulated hooks |
| Project conventions | ✅ CLAUDE.md auto-loaded | ❌ Not loaded | ✅ Explicit load step |
| Extended reasoning | ✅ `--extended-thinking` | ❌ Not used | ✅ Via `claude_execute --extended-thinking` or `think` tool |
| Post-implementation review | ✅ Mandatory self-review | ❌ Skipped | ✅ Mandatory (step 7) |
| Build verification | ✅ Mandatory | ⚠️ Sometimes skipped | ✅ Mandatory (enforced) |
| Test verification | ✅ Mandatory | ⚠️ Sometimes skipped | ✅ Mandatory (enforced) |

---

## ✅ Summary: What to Do Every Session

1. **Load project context** → read CLAUDE.md/AGENTS.md/README at session start
2. **Discover quality tools** → check package.json to find formatter/linter; run `npm install` — no global install needed
3. **Simulate hooks** → format + lint immediately after every file write
4. **Use extended thinking** → `claude_execute` with `args: ["--extended-thinking"]` for complex tasks, or `think` tool for deep reasoning without Claude CLI
5. **Never skip verification** → build passes + tests pass = done; otherwise keep fixing
6. **Always self-review** → re-read every changed file before declaring done; delegate to `claude_execute` for complex reviews

This workflow closes the quality gap between Claude Code and AIBO.
