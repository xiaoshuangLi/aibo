---
name: chain-of-thought
description: Chain-of-thought reasoning patterns for complex problem solving. Use this skill when facing ambiguous problems, multi-step debugging, architectural decisions, or any task where reasoning quality matters more than speed.
---

# Chain-of-Thought Reasoning Skill

## 🎯 Purpose
Provides structured thinking patterns that produce more reliable, traceable, and higher-quality reasoning for complex problems. Based on research showing CoT improves accuracy on reasoning tasks by 40-80%.

## 🚀 When to Use
- Multi-step debugging where the root cause is not obvious
- Architectural decisions with non-trivial trade-offs
- Analyzing an error with multiple plausible causes
- Tasks where you're uncertain about the right approach
- Before writing complex algorithms or business logic
- When reviewing code for bugs or security issues

## 🧠 Core CoT Patterns

### Pattern 1: Problem Decomposition
Break the problem into the smallest independent questions:
```
Problem: [complex problem statement]

Decompose:
1. What do I KNOW for certain?
2. What am I UNCERTAIN about?
3. What ASSUMPTIONS am I making (and are they valid)?
4. What are the CONSTRAINTS (time, correctness, compatibility)?
5. What are my OPTIONS (at least 2-3)?
6. What are the TRADE-OFFS for each option?
7. What's my RECOMMENDED approach and WHY?
```

### Pattern 2: Root Cause Analysis (5 Whys)
For debugging and error analysis:
```
Symptom: [what went wrong]

Why 1: [immediate cause]
Why 2: [cause of the cause]
Why 3: [deeper cause]
Why 4: [systemic cause]
Why 5: [root cause — this is what to fix]

Fix: Address Why 5, not just Why 1
```

### Pattern 3: Pre-Mortem Analysis
Before implementing, imagine it's failed and work backwards:
```
Imagine it's 3 months from now and this implementation has failed.
What went wrong?

Likely failure modes:
1. [failure mode 1] → Mitigation: [prevention strategy]
2. [failure mode 2] → Mitigation: [prevention strategy]
3. [failure mode 3] → Mitigation: [prevention strategy]

Given these risks, I should adjust my approach by: [adjustments]
```

### Pattern 4: Evidence-Based Reasoning
When making claims, trace them to evidence:
```
Claim: [assertion]
Evidence: [what data/code/documentation supports this]
Confidence: [high/medium/low] because [reason for confidence level]
Counter-evidence: [what could contradict this]
Conclusion: [revised claim accounting for uncertainty]
```

### Pattern 5: Algorithmic Thinking
For complex algorithms, trace through with concrete examples:
```
Algorithm: [description]

Invariant: [what must always be true]
Termination: [why this always terminates]

Trace with example input [X]:
Step 1: [state after step 1]
Step 2: [state after step 2]
...
Final state: [result]

Edge cases:
- Empty input: [behavior]
- Single element: [behavior]
- Maximum size: [behavior]
- Invalid input: [behavior]
```

## 💡 The `think` Tool Integration

Use the `think` tool to make your reasoning explicit and traceable:

```typescript
// Before tackling a complex bug
await think({
  reasoning: `
    The test is failing with "Cannot read property 'length' of undefined".
    
    What I know:
    - This only fails in CI, not locally
    - The error is in processItems(), line 47
    - The function expects an array
    
    Possible causes:
    1. API returns null/undefined in CI environment
    2. Race condition — data not loaded before function called
    3. Environment variable difference affecting mock behavior
    
    Evidence:
    - CI logs show API call succeeds (200 OK) but body is empty
    - Local runs use mock data that always returns array
    
    Root cause: The API response body parsing strips empty arrays to undefined
    
    Fix: Add null check: const items = response.items ?? []
  `
});
```

## 🔄 Self-Critique Before Presenting

After drafting a solution, run it through a mental quality check:
```
My proposed solution: [solution]

Critique:
✓ Does it solve the STATED problem? [yes/no + reasoning]
✓ Does it solve the ACTUAL problem (are my assumptions correct)? [yes/no]
✓ Are there simpler alternatives I haven't considered? [yes/no]
✓ What could break it? [edge cases]
✓ Would a reviewer approve this? [anticipate their objections]

Revised solution: [if needed]
```

## ⚠️ Common Reasoning Traps to Avoid

| Trap | Description | Prevention |
|------|-------------|-----------|
| Confirmation bias | Only looking for evidence that supports first hypothesis | Actively look for counter-evidence |
| Availability bias | Treating the most recent/memorable solution as the right one | Enumerate all options before choosing |
| Premature optimization | Solving performance before correctness | Get it right, then fast |
| Scope creep in reasoning | Solving adjacent problems instead of the stated problem | Constantly ask "is this what was asked?" |
| Overconfidence | Treating uncertain assumptions as facts | Explicitly label confidence levels |
