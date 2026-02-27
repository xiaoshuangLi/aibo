---
name: self-debugging
description: Systematic debugging skill for diagnosing and fixing code errors. Use when facing compiler errors, test failures, runtime exceptions, or unexpected behavior. Provides step-by-step triage for TypeScript/JavaScript, Python, and general errors.
---

# Self-Debugging Skill

## 🎯 Purpose
Provides a systematic, evidence-based approach to debugging code errors. The key insight is: **don't guess — read the error, locate the exact failure point, understand why it fails, then make ONE targeted fix**.

The most common debugging failure mode is making random changes hoping something works. This skill replaces that with a deterministic process.

## 🧭 Universal Debugging Process

```
Step 1: READ  → Read the complete error output, don't skim
Step 2: LOCATE → Find the exact file, line, and symbol
Step 3: CONTEXT → view_file with ±20 lines of context around the failure
Step 4: HYPOTHESIZE → Form ONE specific hypothesis about why it fails
Step 5: FIX → Make ONE targeted change that tests the hypothesis
Step 6: VERIFY → Re-run; did the error change? Disappear? Transform?
Step 7: REPEAT → If still failing, new hypothesis from updated error
```

**Critical rule**: Never make multiple changes simultaneously when debugging. One change → re-test → repeat. Multiple simultaneous changes make it impossible to know which fix worked.

## 🔴 Compiler Error Triage (TypeScript / JavaScript)

### Error: Cannot find module
```
Error: Cannot find module '@/services/user' or its corresponding type declarations

Diagnosis process:
1. grep_files("UserService", "src/**/*.ts")  → find where it actually is
2. Check the import path in the failing file: is it correct?
3. Check tsconfig.json paths aliases if using @/ style imports
4. Check if the file has a default export vs named export

Common causes:
- Typo in the path
- File was moved/renamed
- Path alias not configured in tsconfig.json
- Missing index.ts barrel file
```

### Error: Property does not exist on type
```
Error: Property 'emailAddress' does not exist on type 'User'. Did you mean 'email'?

Diagnosis process:
1. grep_files("interface User\|type User", "src/**/*.ts")
2. view_file the type definition
3. Check the actual field names
4. Either: fix the field name in usage OR add the field to the type

Never fix with: (user as any).emailAddress  ← this hides the real bug
```

### Error: Object is possibly undefined/null
```
Error: Object is possibly 'undefined'. ts(2532)

Diagnosis process:
1. view_file the failing line and ±10 lines
2. What variable is possibly undefined?
3. How does it become undefined? (function return type? optional chaining?)

Fix options (choose appropriate one):
a) Add null guard:        if (value !== undefined) { ... }
b) Use optional chaining: value?.property
c) Use nullish coalescing: value ?? defaultValue
d) Assert non-null (only if you're certain): value!.property
e) Fix the source so it never returns undefined
```

### Error: Argument/Return type mismatch
```
Error: Argument of type 'string' is not assignable to parameter of type 'number'

Diagnosis process:
1. Find the function being called: grep_files("function functionName\|functionName =", "src/**/*.ts")
2. view_file the function signature
3. Determine: is the calling code wrong, or is the function signature wrong?
4. Fix the mismatch at the correct layer

Often reveals: the function was refactored but callers weren't updated
```

### Error: Missing await on async function
```
Error: Type 'Promise<User>' is not assignable to type 'User'

Fix: Add await:  const user = await getUser(id);
Or:  Fix return type to accept Promise<User>
```

## 🧪 Test Failure Triage

### Pattern 1: Expected X but Received Y
```
Expected: {"name": "Alice", "email": "alice@example.com"}
Received: {"name": "Alice"}

Debugging:
1. Find which assertion failed (look at the test line number in the stack trace)
2. view_file the test — understand what input it provides and what it expects
3. view_file the production function being tested
4. Trace: what path does the code take with this specific input?
5. Why does it return {name: "Alice"} instead of the full object?

Common causes:
- Forgot to map/include a field
- Early return before setting all fields
- Async code where result isn't awaited
- Mock returning incomplete data
```

### Pattern 2: Test Throws Unexpected Error
```
Error: TypeError: Cannot read property 'name' of undefined
    at processUser (src/user-service.ts:42:20)

Debugging:
1. Line 42 in user-service.ts accesses .name on something undefined
2. view_file("src/user-service.ts", {startLine: 35, endLine: 50})
3. What is undefined at that point? Trace back to where it's set
4. The test is providing input that the code doesn't handle (null/empty case)

Fix options:
- Add null guard in the production code  
- OR the test is providing invalid input that shouldn't be possible → fix the test
```

### Pattern 3: Async/Timing Issues
```
Expected: "completed"
Received: "pending"

Debugging:
1. Is the test properly awaiting async operations?
2. view_file the test — check for missing await
3. Check if the production code returns a Promise that's not being awaited
4. Check if there are race conditions (timeouts, event handlers)

Fix: 
- Add await in test: const result = await myAsyncFunction()
- Or mock the async dependency to return synchronously
```

### Pattern 4: Mock Not Working
```
Expected mock to have been called, but it wasn't called

Debugging:
1. Is the mock targeting the right module path?
   jest.mock('../../services/user') ← must match exact import path in source
2. Is the mock being set up BEFORE the import? (jest.mock hoisting)
3. Is the function being called through the mock or imported directly?
4. print the mock to verify: console.log(mockFn.mock.calls)
```

### Pattern 5: Snapshot Test Failure
```
Snapshot doesn't match stored snapshot

Diagnosis:
1. Is this an INTENTIONAL change (feature update) or a REGRESSION?
2. If intentional: update snapshot with --updateSnapshot flag
3. If regression: find what changed in the component/function that produces different output
```

## 🔥 Runtime Error Triage

### Stack Trace Reading
```
Error: Cannot read properties of null (reading 'map')
    at UserList.render (/app/src/UserList.tsx:23:18)
    at processChild (/app/node_modules/react-dom/...)
    at ...

Reading a stack trace:
1. The FIRST line shows WHAT failed: trying to .map() on null
2. The SECOND line shows WHERE in YOUR code: UserList.tsx:23:18
3. Below that is usually framework internals — less relevant

Debugging:
1. view_file("src/UserList.tsx", {startLine: 18, endLine: 28})
2. Line 23: something.map() where 'something' is null
3. Find where 'something' comes from (prop? state? API response?)
4. Add null guard: (something ?? []).map(...) or check the data source
```

### Infinite Loop / Hang
```
Symptoms: process hangs, memory climbs, no output

Debugging:
1. Add temporary log at the start of suspect loops: console.log('iteration:', i)
2. Run and observe: does it loop? What's the counter doing?
3. Common causes:
   - while loop condition never becomes false
   - Recursive function with no base case
   - Promise that never resolves
   - Event listener re-triggering its own event
```

### Memory Leak
```
Symptoms: memory grows over time, eventually crashes or slows

Debugging:
1. grep_files("setInterval\|setTimeout\|addEventListener\|subscribe", "src/**/*.ts")
2. For each found: is there a corresponding clearInterval/removeEventListener/unsubscribe?
3. Subscriptions or intervals not cleaned up in component unmount/service destroy
```

## 🔄 When to Escalate (Stop and Explain)

Use `think` tool before escalating to decide if it's truly necessary:

**Escalate only when:**
- The error message is genuinely ambiguous and you've tried 3+ different fixes
- The fix requires understanding business logic or requirements that aren't in the code
- Multiple interacting systems (external API, database, network) and you can't isolate which one is failing
- The root cause requires a decision about architectural direction

**Do NOT escalate when:**
- You haven't read the error message carefully yet
- You haven't found the failing line with view_file yet
- You've only tried 1 approach

## ⚡ Quick Reference: Most Common Bugs

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| `undefined is not a function` | Called method on undefined object | Add null check before the call |
| `Maximum call stack size exceeded` | Infinite recursion | Add base case or check termination condition |
| `SyntaxError: Unexpected token` | Invalid JSON or syntax error | Look at the exact line; check for missing comma/bracket |
| Test passes locally but fails in CI | Environment-specific dependency | Check for hardcoded paths, environment variables |
| `ENOENT: no such file or directory` | File path doesn't exist | Use glob_files to find the correct path |
| `Cannot set headers after they are sent` | Multiple responses in Node.js handler | Add early return after first response |
| Test is non-deterministic (flaky) | Order dependency or timing issue | Check for shared state; add proper awaits |
| `Module not found` | Import path wrong or package missing | Check package.json; verify path with grep_files |

## 🛠️ Debugging Tools Reference

```bash
# TypeScript: check types without full build
npx tsc --noEmit

# Find all TypeScript errors in project  
npx tsc --noEmit 2>&1 | head -50

# Run single test with verbose output
npm test -- --verbose --testPathPatterns="specific-test"

# Run test with console output
npm test -- --verbose --testPathPatterns="specific-test" --no-coverage

# Find the exact line of a runtime error
node --stack-trace-limit=50 your-script.js

# Check if a specific export exists
grep -r "export.*functionName" src/
```
