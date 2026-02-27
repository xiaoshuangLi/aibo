---
name: debugging
description: Systematic debugging methodology for identifying and resolving software defects. Use this skill when diagnosing bugs, tracing unexpected behavior, or analyzing error logs and stack traces.
---

# Debugging Skill

## 🎯 Purpose
Provides a structured, scientific approach to debugging that avoids random trial-and-error and leads to reliable root cause identification and resolution.

## 🚀 When to Use
- Diagnosing unexpected behavior or incorrect output
- Analyzing error messages and stack traces
- Investigating intermittent or flaky test failures
- Understanding why a "simple" change caused a regression
- Debugging performance degradation
- Tracing data flow through complex systems

## 🔬 Scientific Debugging Method

### Step 1: Reproduce the Bug
Before anything else, establish a reliable reproduction case.
```bash
# Minimal reproduction requirements:
# 1. Known input that triggers the bug
# 2. Expected output
# 3. Actual (wrong) output
# 4. Reproducibility rate (always / sometimes / rarely)
```

### Step 2: Understand the System
- Read the relevant code paths before guessing
- Use `grep_files` to find all code related to the bug
- Use `glob_files` to understand the project structure
- Use LSP `get_definition` and `get_references` to trace symbol usage

### Step 3: Form a Hypothesis
"The bug is caused by X because Y" — make one specific, testable hypothesis.

### Step 4: Test the Hypothesis
- Add targeted logging (not console.log everywhere)
- Use debugger breakpoints to inspect state
- Write a failing test that captures the bug

### Step 5: Fix and Verify
- Apply the minimal fix that addresses the root cause
- Run the failing test — it should now pass
- Run the full test suite to check for regressions

### Step 6: Prevent Recurrence
- Add a regression test
- Document the root cause in the commit message
- Consider whether similar bugs exist elsewhere

## 🔍 Debugging Strategies

### Binary Search Debugging
Cut the search space in half with each observation:
```bash
# For version regressions: git bisect
git bisect start
git bisect bad HEAD
git bisect good v1.0.0
# Test each commit, mark good/bad until root commit is found
git bisect run npm test
```

### Rubber Duck Debugging
Explain the problem out loud (or in writing) step by step. Articulating the problem often reveals the solution.

### Delta Debugging
"What changed?" — compare working vs broken states:
```bash
git diff <working-commit> <broken-commit>
git log --oneline <working-commit>..HEAD
```

## 🧰 Debugging Tools by Environment

### Node.js / TypeScript
```bash
# Enable Node.js debugger
node --inspect-brk dist/index.js
# Then open chrome://inspect in Chrome

# Run tests with debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Trace asynchronous operations
NODE_OPTIONS='--trace-warnings' node app.js

# Heap snapshot for memory leaks
node --heapsnapshot-signal=SIGUSR2 app.js
```

### Common Log Analysis
```bash
# Find all error patterns in logs
grep_files pattern="ERROR|FATAL|Exception" include="**/*.log"

# Find recent changes to a specific function
git log -p --follow -S "functionName" -- src/
```

## 🐛 Common Bug Patterns

### Off-by-One Errors
```typescript
// Wrong: misses last element
for (let i = 0; i < arr.length - 1; i++) { ... }

// Right
for (let i = 0; i < arr.length; i++) { ... }
```

### Async/Await Mistakes
```typescript
// Bug: not awaiting async function
const result = getData(); // missing await!

// Bug: Promise rejection not caught
fetch(url).then(r => r.json()); // no .catch()

// Correct
const result = await getData();
const result = await fetch(url).then(r => r.json()).catch(handleError);
```

### Null/Undefined Access
```typescript
// Bug: accessing property of potentially null value
const name = user.profile.name; // TypeError if profile is null

// Safe: optional chaining
const name = user?.profile?.name ?? 'Unknown';
```

### Mutation Bugs
```typescript
// Bug: mutating shared array
const modifiedData = data;
modifiedData.push(newItem); // also modifies `data`!

// Correct: copy first
const modifiedData = [...data];
modifiedData.push(newItem);
```

## 📋 Bug Report Template
When escalating a bug or writing a GitHub issue:
```
## Summary
One-sentence description of the bug.

## Environment
- OS: macOS 14.1 / Ubuntu 22.04
- Node.js: v20.x
- Package version: 1.2.3

## Steps to Reproduce
1. Given ...
2. When ...
3. Then ...

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens (include error messages and stack traces).

## Minimal Reproduction
Link to minimal code that reproduces the issue.

## Additional Context
Relevant logs, screenshots, or related issues.
```
