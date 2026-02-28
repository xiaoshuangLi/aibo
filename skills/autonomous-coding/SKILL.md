---
name: autonomous-coding
description: End-to-end autonomous programming workflow. Use this skill when implementing features, fixing bugs, or making code changes that require writing → building → testing → verifying. Covers the complete implementation loop that Claude Code excels at.
---

# Autonomous Coding Skill

## 🎯 Purpose
This skill documents the complete autonomous programming workflow — the specific sequence of explore, implement, build, test, and verify steps that turns a task description into a working, tested, and verified code change.

The fundamental difference from "just writing code" is **verification at every step**. A task isn't done when the code is written — it's done when the build passes and the tests pass and the change actually solves the problem.

## 🔄 The Autonomous Coding Loop

```
Task received
     ↓
PLAN TODOS: Break into subtasks with todo_write (status: not_started)
     ↓
EXPLORE: What does existing similar code look like?
     ↓  
PLAN: Which files change? What are the cross-file impacts?
     ↓
IMPLEMENT: Write/edit the code  ← update todo status to in_progress first
     ↓
BUILD: Does it compile? → NO → Fix errors → repeat BUILD
     ↓ YES
TEST: Do tests pass? → NO → Fix failures → repeat TEST
     ↓ YES
VERIFY: Does it actually solve the problem?
     ↓ YES
CLEANUP: Remove debug code, temp files  ← mark todo completed
     ↓
DONE ✅
```

## 📝 Phase 0: PLAN TODOS

**For any task that requires 3+ steps, create a personal todo list BEFORE doing anything else.**

```typescript
// At the start of a complex task:
todo_write({
  todos: [
    { content: "Explore existing code and understand context", status: "not_started", priority: "high" },
    { content: "Implement feature X in src/services/user-service.ts", status: "not_started", priority: "high" },
    { content: "Add/update tests for feature X", status: "not_started", priority: "medium" },
    { content: "Run build and fix any TypeScript errors", status: "not_started", priority: "high" },
    { content: "Run tests and fix any failures", status: "not_started", priority: "high" },
    { content: "Verify feature X works end-to-end", status: "not_started", priority: "medium" },
  ]
})

// Before starting each task:
todo_write({ todos: [{ id: "1", content: "...", status: "in_progress" }] })

// After completing each task:
todo_write({ todos: [{ id: "1", content: "...", status: "completed" }] })
```

**Why this matters**: A todo list prevents "I forgot to update the barrel export" bugs,
shows users what you're doing, and ensures nothing is skipped during a long session.

> ⚠️ This is the `todo_write`/`todo_read` tool — for YOUR personal task tracking.
> For delegating to specialized subagents, use `write-subagent-todos` instead.

## 🔍 Phase 1: EXPLORE

**Before writing a single line of code, understand the context.**

### Codebase Orientation (on a new task)
```bash
# 1. Find the project build/test commands
cat package.json | grep -A20 '"scripts"'

# 2. Find related files to what you're implementing
glob_files("src/**/*.ts")           # list all TypeScript files
grep_files("YourFeatureName", "src/**/*.ts")  # find existing related code

# 3. Read the closest existing similar implementation
view_file("src/path/to/similar-feature.ts")

# 4. Check if there are existing tests to model
glob_files("__tests__/**/*.test.ts")
grep_files("describe.*YourFeature", "__tests__/**/*.ts")
```

### What to Extract from EXPLORE
- What naming conventions does this codebase use? (camelCase? PascalCase? underscore?)
- What error handling pattern is standard here? (throw? return Result<T>? callbacks?)
- How are imports organized? (barrel files? direct imports?)
- What testing patterns exist? (jest? vitest? what mock style?)
- Are there linting rules that affect how code should be written?

## 📋 Phase 2: PLAN

**Identify the full surface area of change BEFORE writing any code.**

```
For the task: "Add a validateEmail() function to the user service"

Files I need to CHANGE:
  src/services/user-service.ts    ← add the function
  src/types/user.ts               ← add ValidationResult type (if needed)
  
Files I need to CHECK (may need updating):
  src/services/index.ts           ← barrel export (may need new export)
  __tests__/services/user-service.test.ts  ← add test cases

Cross-file impacts:
  □ Does any existing code call a function with this name? (grep to check)
  □ Do I need to add an interface/type?
  □ Are there any callers that need updating?
```

**The plan prevents the "I changed A but forgot to update B" class of bugs.**

## ⚙️ Phase 3: IMPLEMENT

### Rule 1: Read the file you're about to edit
```bash
# ALWAYS do this before editing
view_file("/absolute/path/to/file.ts")
# Look at: existing structure, imports, exports, surrounding code style
```

### Rule 2: Make surgical edits
```
❌ Rewriting the entire file
✅ Editing the specific function/block that needs to change

❌ "I'll clean up while I'm here" (scope creep)
✅ Only change what the task requires

❌ Adding new dependencies without checking package.json first
✅ grep_files("package-name") in package.json before adding
```

### Rule 3: Match the style of the surrounding code
```typescript
// If existing code uses this error pattern:
if (!value) throw new Error(`Invalid value: ${value}`);

// Don't introduce a different pattern:
return { error: 'Invalid value' };  // ← wrong, inconsistent

// Match what's there:
if (!email) throw new Error(`Invalid email: ${email}`);  // ← correct
```

### Rule 4: Handle all the cases existing code handles
Before implementing:
- Check how existing similar functions handle null/undefined inputs
- Check what they return on error vs success
- Check if they're async or sync (be consistent)

## 🔨 Phase 4: BUILD

**Run the build immediately after every non-trivial change.**

```bash
# TypeScript projects:
npm run build
# or:
npx tsc --noEmit

# Python:
python -m py_compile your_file.py

# Go:
go build ./...
```

### Compiler Error Triage

```
Error: "Cannot find module './types'"
→ Wrong relative path. Use grep_files to find the actual location.

Error: "Property 'x' does not exist on type 'T'"  
→ Type definition needs updating OR you're using the wrong type.
   view_file the type definition and fix the mismatch.

Error: "Argument of type 'string' is not assignable to parameter of type 'number'"
→ Type mismatch. Check what the function signature expects.

Error: "Object is possibly 'undefined'"
→ Add null check: value?.property OR use if (value) guard

Error: "Module '"../utils"' has no exported member 'helperFn'"
→ The export doesn't exist. Check the actual exports with grep_files.
```

**CRITICAL RULE**: Never move to Phase 5 (TEST) while there are compiler errors. Fix ALL compilation errors first.

## 🧪 Phase 5: TEST

**Run tests after every change; fix failures immediately.**

```bash
# Run specific test file:
npm test -- --testPathPatterns="user-service"

# Run all tests in a directory:
npm test -- --testPathPatterns="__tests__/services"

# Run with coverage:
npm run test:coverage

# Watch mode for TDD:
npm test -- --watch
```

### Test Failure Triage

**Understand the failure before trying to fix it:**
```
Expected: "user@example.com"
Received: undefined

→ The function isn't returning anything. Check the return statement.
→ OR the wrong function is being called in the test.
→ Read the test carefully: what is it actually testing?
```

**If you wrote new code and an EXISTING test fails:**
```
1. This means your change broke something it wasn't supposed to touch.
2. Check the test: what behavior does it assert?
3. Did your change alter that behavior?
4. If yes: fix your implementation to preserve the old behavior.
5. If no: the test might have been testing something that should change — verify with the task description.
```

### TDD Mode (Preferred for New Features)
```
1. Write the test FIRST (it will fail — that's expected)
2. Run test → see it fail (confirms test is meaningful)
3. Write implementation
4. Run test → see it pass
5. Refactor if needed
6. Run test → still passes
```

## ✅ Phase 6: VERIFY

**Confirm the change actually solves the original problem.**

Ask yourself:
- If the task was "fix the bug where X happens when Y", can I now reproduce the scenario and confirm X no longer happens?
- If the task was "add feature F", does feature F actually work end-to-end?
- If the task was "the test is failing", is that specific test now passing?
- Are there any edge cases the original task description implied that I haven't tested?

**If you added a new function:**
```bash
# Manually verify it can be called correctly.
# For TypeScript ESM projects: use the test framework or ts-node:
npx ts-node -e 'import { validateEmail } from "./src/services/user-service"; console.log(validateEmail("test@example.com"))'
# For CommonJS/compiled output:
node -e 'const { validateEmail } = require("./dist/services/user-service"); console.log(validateEmail("test@example.com"))'
# Or add a simple assertion in the test file and run it
```

## 🧹 Phase 7: CLEANUP

Before declaring done:
```
□ Remove all console.log / print debugging statements
□ Remove all TODO/FIXME/HACK comments added during implementation (unless intentional)
□ Remove any temporary test files or scripts
□ Remove any commented-out code you added
□ Confirm no unrelated files were modified (git diff)
```

## ⚡ Speed Patterns

### Pattern: Fix a Failing Test
```
1. Run the specific test: npm test -- --testPathPatterns="test-name"
2. Read the full error output
3. grep_files the test name to find the test file
4. view_file the test → understand what it expects
5. Find the production code being tested → view_file it
6. Make ONE targeted fix
7. Re-run the specific test
8. If passing, run the full test suite to check for regressions
```

### Pattern: Add a New API Endpoint
```
1. grep_files existing endpoint patterns to understand the routing structure
2. view_file the router file
3. Find closest existing endpoint → read it as a template
4. Add your endpoint following the same pattern
5. npm run build → fix any TypeScript errors
6. Write a test for your endpoint
7. npm test → verify the test passes
```

### Pattern: Refactor Without Breaking
```
1. Run full test suite BEFORE starting → establish baseline
2. Make ONE change
3. Run full test suite → all passing? Continue.
4. If any test fails: undo the change, understand why, approach differently
5. Repeat until refactoring is complete
6. Final run of full test suite → must match baseline pass count
```

## 🚫 Anti-Patterns to Avoid

| Anti-pattern | Why it fails | Correct approach |
|--------------|-------------|-----------------|
| Write all the code, THEN run the build | Harder to pinpoint which change caused which error | Build after each logical unit of change |
| Fix a compiler error by adding `as any` | Hides real type errors; creates future bugs | Find and fix the actual type mismatch |
| Copy-paste code without reading it | Inherits bugs and violates DRY | Read → understand → adapt |
| Report "done" with test failures | Task is not done | Fix failures; task is done when tests pass |
| Edit without reading the file first | Wrong indentation, duplicate code, context blindness | Always view_file before edit_file |
| `grep_files` once, assume complete | May miss dynamic code, aliases, re-exports | Check multiple times with different queries |

## 🧹 Context Management During Long Tasks

Long coding sessions accumulate token history and cause two problems: **slowdown** and **goal drift**.

### Save Key Decisions to the Knowledge Base
After every major decision or milestone, save it:
```typescript
add_knowledge({
  content: "Decided to use JWT auth (not sessions) because the app is API-first",
  title: "Auth Architecture Decision",
  keywords: ["auth", "JWT", "architecture"]
})
```

### Use /compact Between Major Sub-Tasks
When you finish a phase and the session has grown large:
```
/compact
```
This clears the heavy message history (speeds up responses) while keeping the knowledge base intact.
After compacting, restate your goal so the AI stays on track.

> 📖 See the **context-management** skill for the full workflow.
