---
name: feature-organizer
description: "Guide for organizing current code changes into a well-structured feature with **MANDATORY CHINESE DOCUMENTATION**. This skill should be used when users want to convert uncommitted code changes into a complete feature with proper testing, documentation (必须使用中文书写), and git workflow. Use this skill when you need to: organize uncommitted changes, create feature documentation, generate feature spec, document current work, convert changes to feature, package current work, create feature from changes, document pending changes, or prepare feature for commit. 中文触发词：整理代码、生成文档、创建功能、打包提交、整理成文档、代码转功能、未提交整理、自动生成文档、整理当前工作、一键生成feature"
license: "Complete terms in LICENSE.txt"
---

# Feature Organizer

This skill provides a systematic workflow for converting code changes into a well-structured, production-ready feature with comprehensive documentation.

## When to Use This Skill

Use this skill when you have code changes (uncommitted or committed) that need to be:
- Properly tested and validated
- Documented as a complete feature
- Organized according to project standards
- Prepared for code review and merging

## Core Workflow

### Step 1: Test Validation and Coverage Verification

**Objective**: Ensure all tests pass and achieve ≥80% coverage

**Process**:
1. **Run complete test suite**: Execute all test scripts to verify no errors exist
2. **Check test coverage**: Verify coverage is ≥80% using `npx jest --coverage`
3. **Handle failures systematically**:
   - If tests fail: Identify the specific failing test and corresponding source code
   - Analyze the business logic mismatch between test and source code
   - Fix ONE issue at a time (either test or source code, not both simultaneously)
   - Re-run tests after each fix to verify resolution
   - Continue until all tests pass AND coverage ≥80%

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-test-coverage.js` and ensure it passes before proceeding to the next step. If the validation fails, you must adjust your implementation based on the feedback and re-run the validation until it passes.

**Key Principle**: Never attempt to fix multiple issues simultaneously. Focus on one failing test or coverage gap at a time.

### Step 2: Comprehensive Code Change Analysis

**Objective**: Thoroughly identify ALL functional changes from code modifications, including changes in committed or uncommitted code

**Change Source Detection**:
- **Uncommitted changes**: `git diff --name-only` (files modified but not yet committed)
- **Committed changes on current branch**: `git diff --name-only origin/main..HEAD` or `git diff --name-only main..HEAD`
- **Specific commit range**: `git diff --name-only <base-commit>..<head-commit>`
- Use whichever source is appropriate for the current task. If both uncommitted and committed changes exist, analyze both.

**Process for Large Changesets (>10 files)**:

Large changesets MUST use a structured, domain-based analysis approach to prevent missing important changes:

1. **Get the full file list and statistics**:
   ```bash
   git diff --stat          # for uncommitted changes
   git diff --stat origin/main..HEAD   # for committed branch changes
   ```

2. **Group files by domain/module**: Categorize all changed files into logical groups:
   - **Core agent logic** (e.g., `src/core/`, `src/features/`)
   - **Tools** (e.g., `src/tools/`)
   - **Infrastructure** (e.g., `src/infrastructure/`)
   - **Shared utilities** (e.g., `src/shared/`, `src/types/`)
   - **CLI & presentation** (e.g., `src/cli/`, `src/presentation/`)
   - **Skills & agents** (e.g., `skills/`, `agents/`)
   - **Configuration & build** (e.g., `config/`, `.env*`, build files)
   - **Tests** (e.g., `__tests__/`, `*.test.*`, `*.spec.*`)
   - **Documentation** (e.g., `docs/`, `*.md`, `features/`)

3. **Analyze each group systematically** — for EVERY file in each group, identify:
   - **New functions/methods/classes added**: List each one with its purpose
   - **Modified functions/methods/classes**: List what changed and why
   - **Removed/deprecated items**: List what was removed and the replacement
   - **API changes**: New endpoints, modified signatures, deprecated calls
   - **Configuration changes**: New env variables, changed defaults, new dependencies
   - **Business logic changes**: Changed behavior, new rules, removed constraints

4. **Cross-file impact analysis**: After analyzing individual files, identify:
   - How changes in one module affect others
   - New interactions or dependencies introduced
   - Breaking changes that require migration

5. **Compile the complete functional change inventory**: Create an exhaustive list of EVERY functional change found across all groups. Do NOT summarize or skip any change — each change must be individually listed.

**Process for Small Changesets (≤10 files)**:
1. **Get changed files**: `git diff --name-only` or `git diff --name-only origin/main..HEAD`
2. **Analyze each file's diff**: Read the actual diff for each file
3. **Extract all functional changes**: Apply the same systematic identification as above

**Requirements Extraction**:
After compiling the complete change inventory:
1. **Map each functional change to a user-facing requirement**: Convert technical changes to user-focused requirements using the format:
   - "As a [user role], I want [feature] so that [business value]"
2. **Identify the business background**: What problem does this set of changes solve? What was the trigger?
3. **Estimate actual development effort**: Based on the number and complexity of changes, estimate effort in person-days or hours

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-requirements-extraction.js` and ensure it passes before proceeding to the next step. If the validation fails, you must adjust your requirements extraction based on the feedback and re-run the validation until it passes.

### Step 3: Create Feature Documentation

**Objective**: Generate comprehensive feature documentation using the standard template **(MUST BE WRITTEN IN CHINESE)**

**Process**:
1. **Use feature template**: Apply `skills/feature-organizer/templates/feature-template.md` structure
2. **Populate sections based on extracted requirements** **(ALL DOCUMENTATION MUST BE IN CHINESE)**:
   - **需求背景**: Business context, problem being solved, trigger for this work **(用中文书写)**
   - **Specification**: User stories, acceptance criteria, and the complete functional change list from Step 2 **(用中文书写)**
   - **Technical Design**: Architecture overview based on actual code changes **(用中文书写)**
   - **Implementation Plan**: Task breakdown with actual workload details **(用中文书写)**
   - **Usage Guide**: Examples based on the new/modified APIs **(用中文书写)**
   - **Impact Analysis**: File changes from `git diff --name-status` **(用中文书写)**
3. **Assign sequential numbering**: Check existing features in `features/` directory and use next available number (e.g., if max is 042, use 043)

**CRITICAL REQUIREMENT**: All feature documentation content MUST be written in Chinese (中文). This includes all sections, descriptions, examples, and technical explanations. English should only be used for code snippets, technical terms, or API names that are inherently in English.

**COMPLETENESS CHECK**: Before finalizing the documentation, verify:
- Every functional change identified in Step 2 is reflected in the documentation
- The workload section includes actual time/effort estimates based on real changes
- The requirements background section explains WHY this work was done
- No important changes have been omitted

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-feature-documentation.js` and ensure it passes before proceeding to the next step. If the validation fails, you must adjust your feature documentation based on the feedback and re-run the validation until it passes.

### Step 4: Update README and Documentation

**Objective**: Keep user-facing documentation in sync with the code changes

**Process**:
1. **Identify user-facing changes**: From the functional change inventory compiled in Step 2, determine which changes affect end users (new features, changed behavior, new environment variables, new CLI tools, new configuration options, removed features, etc.)
2. **Update `README.md`** if any of the following changed:
   - New feature capabilities or tools (update the ✨ 功能特性 section)
   - New or changed environment variables (update the ⚙️ 配置 / Quick Start section and point to docs/env.md)
   - New or changed CLI usage / interaction modes
   - Any other user-visible behavior
3. **Update `docs/` files** for the corresponding topic if any of the following changed:
   - Environment variables → update `docs/env.md`
   - MCP tool integration → update `docs/mcp.md`
   - Any other file in `docs/` that covers the changed functionality
4. **Skip this step only when** the changes are entirely internal (refactoring, test additions, build config) with zero impact on user-facing behavior or configuration

**CRITICAL REQUIREMENT**: Documentation updates MUST be written in Chinese (中文), consistent with the existing documentation language.

### Step 5: Commit with Proper Structure

**Objective**: Create a clean, well-structured commit

**Process**:
1. **Clean up temp files**: Delete `temp_requirements.txt` if it exists (`rm -f temp_requirements.txt`)
2. **Stage all changes**: `git add .`
3. **Create feature file**: Save the generated feature documentation as `features/[###]-[feature-name].md`
4. **Commit with descriptive message**: Follow conventional commit format
5. **Verify final state**: Ensure working directory is clean and all changes are committed

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-commit-structure.js` and ensure it passes. If the validation fails, you must adjust your commit structure based on the feedback and re-run the validation until it passes.

## Quality Gates

Before completing the feature organization process, ensure:

- **✅ All tests pass**: Zero test failures
- **✅ Coverage ≥80%**: Verified through coverage report  
- **✅ Feature documentation complete**: All template sections populated including 需求背景 and 功能变更清单
- **✅ No changes missed**: Every functional change from Step 2 is reflected in the documentation
- **✅ Workload documented**: Actual development effort is captured in the workload section
- **✅ Documentation in Chinese**: **ALL feature documentation content MUST be written in Chinese (中文)**
- **✅ README updated**: `README.md` reflects any user-facing feature or configuration changes
- **✅ Docs updated**: All relevant `docs/` files updated when corresponding functionality changes
- **✅ Sequential numbering**: No gaps or duplicates in feature numbering
- **✅ Clean commit**: All changes properly staged and committed

## Error Handling Strategy

If any step fails:

1. **Stop immediately** and analyze the root cause
2. **Address the specific failure** without proceeding to next steps
3. **Re-validate** the fixed step before continuing
4. **Maintain focus** on one problem at a time
5. **Use validation scripts**: Always run the corresponding validation script after each step to ensure correctness

## Validation Scripts

The following JavaScript validation scripts are provided to ensure each phase is completed correctly:

- **Phase 1**: `./skills/feature-organizer/scripts/validate-test-coverage.js` - Validates test execution and coverage
- **Phase 2**: `./skills/feature-organizer/scripts/validate-requirements-extraction.js` - Validates requirements extraction from code changes
- **Phase 3**: `./skills/feature-organizer/scripts/validate-feature-documentation.js` - Validates feature documentation structure and content
- **Step 4** (README & docs update): No automated script — verify manually that README.md and affected `docs/` files reflect the changes
- **Phase 4**: `./skills/feature-organizer/scripts/validate-commit-structure.js` - Validates commit structure and cleanliness

**IMPORTANT**: Each validation script MUST be executed after its corresponding phase and MUST pass before proceeding to the next phase. The validation scripts provide detailed feedback that should be used to adjust the implementation if needed.

## Example Usage Scenarios

### Scenario 1: Path Alias Conversion Feature
- **Changes**: Relative path imports converted to `@/` aliases across 15+ files
- **Analysis approach**: Group files by domain (core, tools, infrastructure, shared), analyze each group systematically
- **Extracted requirements**: List every file changed with the specific alias pattern applied
- **Feature file**: `features/043-path-alias-conversion.md`

### Scenario 2: Large Infrastructure Refactoring
- **Changes**: 20+ files modified across core agent logic, tools, and infrastructure
- **Analysis approach**: Start with `git diff --stat` for overview, group by domain (core, tools, infrastructure), analyze each domain's changes
- **Key risk**: Missing a renamed tool or changed internal interface - use cross-file impact analysis
- **Feature file**: `features/044-infrastructure-refactoring.md`

### Scenario 3: New Utility Function
- **Uncommitted changes**: New utility function added with tests
- **Extracted requirement**: "As a user, I want [utility] so that [specific problem] is solved"
- **Feature file**: `features/045-utility-function-name.md`

## Best Practices

- **Always validate tests first** before creating documentation
- **For large changesets, always group files by domain** before analyzing to prevent missing changes
- **Use `git diff --stat` first** to understand the scope before diving into individual files
- **Never summarize away details** — every functional change must appear in the documentation
- **Capture actual workload** based on real changes, not estimates based on feature description
- **Extract requirements from actual code**, not assumptions
- **Maintain consistent naming** and numbering conventions
- **Focus on user value** rather than technical implementation details