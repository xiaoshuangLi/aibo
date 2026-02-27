---
name: issue-to-pr
description: End-to-end workflow for resolving a GitHub Issue by implementing a code fix and creating a Pull Request. Use this skill when asked to fix a bug, implement a feature, or resolve a GitHub issue autonomously.
requires:
  skills: [autonomous-coding, code-review, git-workflow]
  mcp: [github] # optional: for direct GitHub API access via Composio
---

# Issue-to-PR Skill

## 🎯 Purpose
Provides a complete, repeatable workflow for autonomously resolving a GitHub Issue from start to finish: understand the problem, locate the code, fix it, verify with tests, and create a Pull Request.

Inspired by SWE-agent's benchmark-proven approach to software engineering automation.

## 🚀 When to Use
- User provides a GitHub Issue URL or issue description and wants it fixed
- Automated bug fixing pipelines
- Contributing to open source projects via AI-generated PRs
- Resolving issues in your own repositories

## 🔄 The Issue-to-PR Workflow

```
GitHub Issue
     ↓
1. UNDERSTAND  → Parse issue: problem, repro steps, expected behavior
     ↓
2. MAP         → Use repo_map to understand codebase structure
     ↓
3. LOCATE      → Use grep_files + glob_files to find relevant code
     ↓
4. REPRODUCE   → Write/run a failing test that captures the bug
     ↓
5. FIX         → Implement the minimal code change
     ↓
6. VERIFY      → Run full test suite; confirm no regressions
     ↓
7. REVIEW      → Self-review the diff using code-review checklist
     ↓
8. PR          → Create a well-documented Pull Request
```

## 📋 Phase 1: UNDERSTAND the Issue

Extract structured information from the issue:

```markdown
## Issue Analysis
- **Type**: bug | feature | enhancement | docs
- **Summary**: One-sentence description of the problem
- **Reproduction steps**: (for bugs) exact steps to trigger
- **Expected behavior**: what should happen
- **Actual behavior**: what currently happens
- **Affected files/components**: any hints in the issue about where the problem is
- **Labels/Priority**: from GitHub labels
```

**Key questions to answer before writing any code:**
1. Is this a bug (broken behavior) or a feature (new behavior)?
2. Are there existing tests for the affected area?
3. Is there a minimal repro case in the issue?
4. What's the acceptance criteria for "done"?

## 🗺️ Phase 2: MAP the Repository

Always start with `repo_map` before diving into files:

```typescript
// Get high-level overview of the codebase
const overview = await repo_map({ rootDir: process.cwd() });

// Now you know:
// - Overall project structure
// - Entry points (main.ts, index.ts, etc.)
// - Key modules and their file counts
// - Configuration files available
```

Use the map to:
- Identify which modules are most likely to contain the relevant code
- Understand the project's testing framework and test organization
- Find configuration files that might affect behavior

## 🔍 Phase 3: LOCATE the Relevant Code

Use targeted search tools after repo_map orientation:

```typescript
// Search for the symbol/function/class mentioned in the issue
grep_files("functionName", "src/**/*.ts");

// Find files related to the affected feature area
glob_files("src/**/auth*.ts");

// Search for the error message if mentioned in the issue
grep_files("Cannot read property of undefined", "src/**/*.ts");

// Find existing tests for the affected area
glob_files("__tests__/**/*auth*.test.ts");
```

**Localization heuristics by issue type:**
- **TypeError/ReferenceError**: search for the symbol name, check where it's used
- **Wrong output**: find the function producing the output, trace data flow
- **Missing feature**: find where similar features are implemented to model after
- **Performance**: find the hot path (look for loops over large data, DB queries)

## 🧪 Phase 4: REPRODUCE the Bug (Test First)

Write a failing test BEFORE touching production code:

```typescript
// 1. Find the test file for the affected module
glob_files("__tests__/**/*.test.ts");

// 2. Write a test that demonstrates the current broken behavior
describe("UserService", () => {
  it("should return null when user ID does not exist (bug repro)", () => {
    // This should return null, but currently throws — that's the bug
    expect(() => userService.findById(99999)).not.toThrow();
    expect(userService.findById(99999)).toBeNull();
  });
});

// 3. Run ONLY this test to confirm it fails
// npm test -- --testPathPatterns="auth-service"
// Expected: FAIL (confirms we captured the bug)
```

**Why test first?**
- Proves you understood the bug correctly
- Provides a clear success criterion
- Prevents "fixed" bugs from silently reappearing

## ⚙️ Phase 5: FIX the Code

Apply the **minimum necessary change** to make the failing test pass:

```
✅ Change only what the issue requires
✅ Match the style and patterns of surrounding code
✅ Handle all the edge cases the issue mentions
✅ Don't "clean up while you're here" (separate PR for cleanup)
❌ Don't rewrite unrelated code
❌ Don't add new dependencies without strong justification
❌ Don't change the public API unless the issue specifically asks
```

After implementing the fix:
```bash
# Compile to catch type errors immediately
npm run build  # or: npx tsc --noEmit

# Run the specific test to confirm it now passes
npm test -- --testPathPatterns="affected-module"
```

## ✅ Phase 6: VERIFY (No Regressions)

Run the FULL test suite to confirm nothing broke:

```bash
npm test

# If coverage drops, check what was uncovered:
npm run test:coverage
```

**Verification checklist:**
- [ ] The specific bug/feature test now passes
- [ ] All pre-existing tests still pass
- [ ] Build compiles without errors or warnings
- [ ] (For bugs) You can manually confirm the bug is fixed
- [ ] (For features) The new feature works end-to-end

## 🔍 Phase 7: SELF-REVIEW the Diff

Before creating the PR, review your own changes using the code-review checklist:

```bash
# See what changed
git diff HEAD

# Or if you've already committed:
git diff main...HEAD
```

Review each changed file for:
- [ ] **Correctness**: Does the change actually fix the root cause?
- [ ] **Edge cases**: null, undefined, empty arrays, concurrent access
- [ ] **Security**: No injection, no exposed secrets, no path traversal
- [ ] **Tests**: Test covers both the fix and the edge cases
- [ ] **Minimal scope**: No unrelated changes snuck in

## 📝 Phase 8: CREATE the Pull Request

Use Composio GitHub tools (or bash git commands) to create the PR:

```typescript
// Via Composio GitHub MCP (if connected):
GITHUB_CREATE_A_PULL_REQUEST({
  owner: "repo-owner",
  repo: "repo-name",
  head: "fix/issue-123-null-user-crash",
  base: "main",
  title: "fix: handle null user in AuthService.getUser (#123)",
  body: generatePRBody(issue, changes)
})
```

### PR Body Template

```markdown
## Summary
Fixes #[ISSUE_NUMBER]: [ONE_SENTENCE_SUMMARY]

## Root Cause
[Explain WHY the bug occurred — don't just describe what you changed]

## Changes
- `src/path/to/file.ts`: [what changed and why]
- `__tests__/path/to/file.test.ts`: [added test for X scenario]

## Testing
- [x] Added test case that reproduces the original bug
- [x] All existing tests pass
- [x] Build compiles without errors

## Checklist
- [x] Code follows project conventions
- [x] Tests added/updated
- [x] No unrelated changes
```

## ⚡ Quick Reference: Tool Sequence

| Phase | Tools Used |
|-------|-----------|
| Understand | `web_fetch` (read GitHub issue), `think` |
| Map | `repo_map` |
| Locate | `grep_files`, `glob_files` |
| Reproduce | `view_file`, `write_file`, bash (`npm test`) |
| Fix | `view_file`, `edit_file`, bash (`npm run build`) |
| Verify | bash (`npm test`) |
| Review | bash (`git diff`) |
| PR | Composio `GITHUB_CREATE_A_PULL_REQUEST` or bash (`git push`) |

## 🚫 Anti-Patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Fix without a test | Can't verify the fix actually works | Write failing test first |
| Fix without repo_map | Might miss related code / fix wrong place | Always map first |
| Fix more than the issue asks | PR scope creep, harder to review | Minimum viable fix only |
| Open PR without running full tests | Breaks CI, wastes reviewers' time | Always run full suite before PR |
| Generic PR title "fix bug" | Unhelpful, hard to search in history | Reference issue number and be specific |
| Skip self-review | Miss obvious issues, security holes | Always `git diff` and review |

## 📚 Related Skills
- **autonomous-coding**: Complete implementation loop (explore → implement → build → test → verify)
- **code-review**: Systematic review checklist used in Phase 7
- **git-workflow**: Git branching, commit messages, and push workflows
- **github-automation**: GitHub API operations via Composio MCP
