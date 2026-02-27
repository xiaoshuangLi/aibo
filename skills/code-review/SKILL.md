---
name: code-review
description: Systematic code review methodology for evaluating code quality, correctness, security, and maintainability. Use this skill when reviewing pull requests, auditing existing code, or preparing code for review.
---

# Code Review Skill

## 🎯 Purpose
Provides a structured, consistent framework for conducting thorough code reviews that catch bugs, improve quality, and promote knowledge sharing.

## 🚀 When to Use
- Reviewing pull requests or merge requests
- Conducting pre-merge code audits
- Self-reviewing code before submitting for review
- Evaluating inherited or legacy code quality
- Mentoring junior developers through review

## 📋 Review Checklist

### 1. Correctness
- [ ] Does the code do what it's supposed to do?
- [ ] Are all edge cases handled (null, empty, overflow, boundary conditions)?
- [ ] Are errors handled gracefully with meaningful messages?
- [ ] Is async/await or Promise handling correct (no unhandled rejections)?
- [ ] Are race conditions and concurrency issues addressed?

### 2. Security
- [ ] Is all user input validated and sanitized?
- [ ] Are there any SQL injection, XSS, or CSRF vulnerabilities?
- [ ] Are secrets/credentials kept out of the code?
- [ ] Is authentication and authorization applied correctly?
- [ ] Are dependencies free of known vulnerabilities (`npm audit`)?

### 3. Performance
- [ ] Are there any obvious N+1 query problems?
- [ ] Are expensive operations cached appropriately?
- [ ] Is the algorithm complexity acceptable for expected data sizes?
- [ ] Are there unnecessary synchronous blocking operations?

### 4. Maintainability
- [ ] Is the code easy to understand without comments?
- [ ] Are functions/methods small and focused (Single Responsibility)?
- [ ] Is there code duplication that could be extracted?
- [ ] Are variable and function names descriptive?
- [ ] Is the code consistent with existing patterns in the codebase?

### 5. Tests
- [ ] Are there tests for the new functionality?
- [ ] Do tests cover the happy path AND error cases?
- [ ] Are tests independent (no shared mutable state)?
- [ ] Is test coverage adequate (≥85%)?

### 6. Documentation
- [ ] Are complex algorithms explained with comments?
- [ ] Are public API functions documented with JSDoc/docstrings?
- [ ] Is the README updated if needed?

## 🗣️ Review Communication Tone

### Constructive Feedback Language
Use questions and suggestions rather than commands:
- ✅ "Could we extract this into a separate function for readability?"
- ✅ "What do you think about using a Map here instead of an object?"
- ✅ "I noticed this might cause issues when `data` is null — have you considered adding a guard?"
- ❌ "This is wrong."
- ❌ "You should have used X."
- ❌ "Why did you do it this way?"

### Comment Types
- **Blocking (must fix)**: Bugs, security issues, test failures
- **Non-blocking (suggestion)**: Style, naming, minor improvements
- **Nitpick (optional)**: Very minor preferences, clearly labeled as nitpick
- **Praise**: Highlight good approaches to encourage them

## 🔍 Review Workflow
1. **Understand the context**: Read the PR description, linked issues, and ticket
2. **High-level design review**: Does the approach make sense? Are there simpler alternatives?
3. **File-by-file review**: Go through each changed file systematically
4. **Cross-cutting concerns**: Check security, performance, and tests holistically
5. **Summarize**: Provide an overall assessment with key actionable feedback

## ⏱️ Review Time Guidelines
- **Small PR** (<100 lines): 15–30 minutes
- **Medium PR** (100–500 lines): 30–90 minutes
- **Large PR** (>500 lines): Request splitting into smaller PRs when possible
