---
name: parallel-agents
description: Patterns for parallel and concurrent subagent execution. Use this skill when orchestrating multiple subtasks that can run concurrently, implementing fan-out/fan-in patterns, or managing task dependencies across multiple agents.
---

# Parallel Agents Execution Skill

## 🎯 Purpose
Provides battle-tested patterns for orchestrating multiple subagents concurrently. Parallel execution is the single biggest lever for reducing total task completion time — independent subtasks should almost always run in parallel.

## 🚀 When to Use
- Large refactoring tasks that touch multiple independent files
- Research + implementation that can proceed concurrently
- Multi-file code generation (test files, implementation files, docs)
- Running analysis on multiple independent modules
- Any task where subtasks don't share intermediate state

## ⚡ Core Patterns

### Pattern 1: Basic Fan-Out / Fan-In
```typescript
// 🚀 Fan-out: launch all independent tasks simultaneously
const [
  architectureAnalysis,
  testCoverage,
  securityAudit,
  documentation,
] = await Promise.all([
  task({
    description: "Analyze the current architecture and identify improvement opportunities",
    subagent_type: "architect"
  }),
  task({
    description: "Run test suite and report which areas have < 80% coverage",
    subagent_type: "testing"
  }),
  task({
    description: "Scan for OWASP Top 10 vulnerabilities in the authentication module",
    subagent_type: "security"
  }),
  task({
    description: "Generate JSDoc for all exported functions in src/api/",
    subagent_type: "documentation"
  }),
]);

// 🎯 Fan-in: synthesize results
// Now combine all 4 results into a comprehensive report
```

### Pattern 2: Staged Pipeline (Serial Stages, Parallel within Stage)
For workflows with dependencies between phases:
```typescript
// Stage 1: Research (all independent — run in parallel)
const [requirements, bestPractices, existingCode] = await Promise.all([
  task({ description: "Analyze requirements from specs/", subagent_type: "researcher" }),
  task({ description: "Research best practices for auth implementation", subagent_type: "researcher" }),
  task({ description: "Audit existing auth code for issues", subagent_type: "security" }),
]);

// Stage 2: Implementation (depends on Stage 1 results — can still partially parallelize)
const [coreImpl, tests] = await Promise.all([
  task({
    description: `Implement auth based on: ${requirements} and ${bestPractices}`,
    subagent_type: "coder"
  }),
  task({
    description: `Write test cases for auth based on requirements: ${requirements}`,
    subagent_type: "testing"
  }),
]);

// Stage 3: Validation (depends on Stage 2)
const validationResult = await task({
  description: `Validate the implementation against tests: impl=${coreImpl}, tests=${tests}`,
  subagent_type: "validator"
});
```

### Pattern 3: Map-Reduce for Large Codebases
When processing a large number of independent files:
```typescript
// Map: process each module independently
const moduleResults = await Promise.all(
  modules.map(module => task({
    description: `Refactor ${module.path} to use async/await instead of callbacks. Rules: [...]`,
    subagent_type: "coder"
  }))
);

// Reduce: combine all refactored modules
const summary = await task({
  description: `Review and integrate these refactored modules: ${moduleResults.join('\n')}`,
  subagent_type: "validator"
});
```

### Pattern 4: Speculative Execution
When uncertain which approach will work:
```typescript
// Try multiple approaches in parallel, use the first one that succeeds
const [approach1, approach2] = await Promise.allSettled([
  task({
    description: "Fix the failing test using approach A: mock the database",
    subagent_type: "coder"
  }),
  task({
    description: "Fix the failing test using approach B: use in-memory SQLite",
    subagent_type: "coder"
  }),
]);

// Use whichever succeeded, or evaluate both
```

## 📊 Dependency Analysis — Critical Step

Before parallelizing, map out task dependencies:

```
Task dependency graph:
A ──┐
B ──┼──> E ──> F (final)
C ──┘
D ─────────────> F

Execution plan:
- Round 1 (parallel): A, B, C, D
- Round 2 (serial):   E (needs A, B, C)
- Round 3 (serial):   F (needs D + E)

Max parallelism: 4 concurrent tasks in Round 1
```

**Dependency detection questions:**
1. Does task X need OUTPUT from task Y? → Serial
2. Does task X WRITE to a resource that task Y READS? → Serial or conflict
3. Are tasks X and Y completely independent? → Parallel ✅

## 🚦 When NOT to Parallelize

| Situation | Why Serial is Better |
|-----------|---------------------|
| Task B needs task A's output | Can't start B until A finishes |
| Both tasks write to same file | Race condition → corruption |
| Context would overflow | Serial with context handoff |
| Debugging: need to isolate issue | Parallel makes root cause unclear |
| User approval needed mid-task | Must wait for human feedback |

## 💡 Passing Context Between Parallel Tasks

When parallel tasks need shared context, pass it in the task description:
```typescript
// Prepare shared context ONCE before fan-out
const sharedContext = `
  Project: ${projectName}
  Language: TypeScript 5.0
  Conventions: Use functional style, no classes, strict null checks
  Current branch: ${currentBranch}
`;

// Each task gets the full context
const [implResult, testResult] = await Promise.all([
  task({ description: `${sharedContext}\n\nTask: Implement the UserService`, subagent_type: "coder" }),
  task({ description: `${sharedContext}\n\nTask: Write tests for UserService`, subagent_type: "testing" }),
]);
```

## ✅ Parallel Execution Checklist
- [ ] Listed all subtasks
- [ ] Mapped dependencies between them
- [ ] Grouped independent tasks for parallel execution
- [ ] Identified serial stages where outputs feed next stage
- [ ] Ensured shared context is passed to each parallel task
- [ ] Planned fan-in synthesis step after parallel fan-out
