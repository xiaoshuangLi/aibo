---
name: few-shot-prompting
description: Few-shot and in-context learning patterns for LLMs. Use this skill when designing prompts that need consistent output formatting, when teaching an AI a new task format, or when improving reliability of complex transformations.
---

# Few-Shot Prompting Skill

## 🎯 Purpose
Few-shot prompting dramatically improves LLM output quality and consistency by providing 2-8 examples of the desired input→output behavior. It's the fastest way to "teach" an LLM a custom task without fine-tuning.

## 🚀 When to Use
- Custom output formats (JSON schemas, specific markdown structures)
- Code transformation tasks (convert X style to Y style)
- Classification with nuanced categories
- Extraction tasks (pull specific fields from unstructured text)
- Evaluation tasks (rate outputs by specific criteria)
- When zero-shot prompts produce inconsistent results

## 📐 Core Structure

### Basic Few-Shot Template
```
You are [role]. Your task is to [task].

Here are examples:

Example 1:
Input: [example input 1]
Output: [example output 1]

Example 2:
Input: [example input 2]
Output: [example output 2]

Example 3 (edge case):
Input: [edge case input]
Output: [edge case output]

Now apply this to:
Input: [actual user input]
Output:
```

### JSON Output Few-Shot
```
Extract the following fields from the text and return as JSON.
Required fields: name (string), date (ISO 8601), amount (number).
If a field is missing, use null.

Example 1:
Text: "Invoice from Acme Corp on March 5th 2024 for $1,250.00"
JSON: {"name": "Acme Corp", "date": "2024-03-05", "amount": 1250.00}

Example 2:
Text: "Payment received from Bob"
JSON: {"name": "Bob", "date": null, "amount": null}

Example 3:
Text: "Q1 report payment of EUR 500 on 01/15/2024"
JSON: {"name": null, "date": "2024-01-15", "amount": 500}

Text: {user_text}
JSON:
```

### Code Transformation Few-Shot
```
Convert callback-style Node.js functions to async/await.
Preserve the original logic and error handling.

Example 1:
Before:
function readFile(path, cb) {
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) return cb(err);
    cb(null, data);
  });
}

After:
async function readFile(path) {
  return fs.promises.readFile(path, 'utf8');
}

Example 2:
Before:
function fetchUser(id, cb) {
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, rows) => {
    if (err) return cb(err);
    cb(null, rows[0] || null);
  });
}

After:
async function fetchUser(id) {
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

Now convert:
Before:
{user_code}

After:
```

## 🎯 Example Selection Guidelines

### Quality Rules for Examples
1. **Diversity over quantity**: 3 diverse examples > 6 similar ones
2. **Cover edge cases**: Include at least one example with missing/null/empty data
3. **Represent difficulty spectrum**: Easy, medium, and hard examples
4. **Match the real distribution**: Examples should look like real inputs the model will see
5. **Show what NOT to do** (negative examples are powerful for classification)

### Anti-patterns to Avoid
```
❌ All examples are structurally identical — model learns surface pattern, not underlying logic
❌ Examples are too simple — model won't generalize to complex real inputs
❌ No edge cases — model fails on nulls, empty strings, special characters
❌ Examples contradict each other — model gets confused
❌ Too many examples — context bloat without quality gain (5-8 max for most tasks)
```

## 🔬 Chain-of-Thought Few-Shot (Most Powerful)

For complex reasoning, include the reasoning chain in your examples:
```
Classify whether this code change is a security vulnerability.
Think through the code carefully before classifying.

Example 1:
Code: `query("SELECT * FROM users WHERE id = " + userId)`
Thinking: This concatenates user input directly into SQL. This is SQL injection.
Classification: CRITICAL — SQL Injection

Example 2:
Code: `query("SELECT * FROM users WHERE id = ?", [userId])`
Thinking: This uses parameterized queries. User input is properly escaped.
Classification: SAFE

Example 3:
Code: `const html = "<div>" + userComment + "</div>"`
Thinking: This injects user content directly into HTML. Could allow XSS.
Classification: HIGH — XSS vulnerability

Code: {user_code}
Thinking:
Classification:
```

## 📊 Evaluating Few-Shot Prompt Quality

After writing your few-shot prompt, evaluate it:

| Criterion | Check |
|-----------|-------|
| Are all examples correct and unambiguous? | Would a human expert agree with every example output? |
| Do examples cover the expected input distribution? | Is there diversity in input type, length, content? |
| Is there at least one edge case? | Null, empty, unusual format, etc. |
| Are examples internally consistent? | Same style, format, level of detail? |
| Is the format crystal clear from examples alone? | Could someone follow the pattern without reading the instructions? |

## 💡 Combining with Chain-of-Thought

For maximum reliability on complex tasks:
```
[Few-shot examples with reasoning chains]
+ [Zero-shot CoT trigger: "Let's think step by step"]
= Highest accuracy on novel inputs
```

This works because few-shot teaches the FORMAT and CoT teaches the REASONING PROCESS.
