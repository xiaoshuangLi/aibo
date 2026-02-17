---
name: feature-organizer
description: "Guide for organizing current code changes into a well-structured feature. This skill should be used when users want to convert uncommitted code changes into a complete feature with proper testing, documentation, and git workflow. Use this skill when you need to: organize uncommitted changes, create feature documentation, generate feature spec, document current work, convert changes to feature, package current work, create feature from changes, document pending changes, or prepare feature for commit. 中文触发词：整理代码、生成文档、创建功能、打包提交、整理成文档、代码转功能、未提交整理、自动生成文档、整理当前工作、一键生成feature"
license: "Complete terms in LICENSE.txt"
---

# Feature Organizer

This skill provides a systematic workflow for converting uncommitted code changes into a well-structured, production-ready feature.

## When to Use This Skill

Use this skill when you have uncommitted code changes that need to be:
- Properly tested and validated
- Documented as a complete feature
- Organized according to project standards
- Prepared for code review and merging

## Core Workflow

### Step 1: Test Validation and Coverage Verification

**Objective**: Ensure all tests pass and achieve ≥85% coverage

**Process**:
1. **Run complete test suite**: Execute all test scripts to verify no errors exist
2. **Check test coverage**: Verify coverage is ≥85% using `npx jest --coverage`
3. **Handle failures systematically**:
   - If tests fail: Identify the specific failing test and corresponding source code
   - Analyze the business logic mismatch between test and source code
   - Fix ONE issue at a time (either test or source code, not both simultaneously)
   - Re-run tests after each fix to verify resolution
   - Continue until all tests pass AND coverage ≥85%

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-test-coverage.js` and ensure it passes before proceeding to the next step. If the validation fails, you must adjust your implementation based on the feedback and re-run the validation until it passes.

**Key Principle**: Never attempt to fix multiple issues simultaneously. Focus on one failing test or coverage gap at a time.

### Step 2: Extract Requirements from Uncommitted Changes

**Objective**: Identify feature requirements from actual code changes

**Process**:
1. **Get uncommitted changes**: Use `git diff --name-only` to identify modified files
2. **Analyze change patterns**: Examine the actual code modifications to understand:
   - New functionality being added
   - Existing functionality being modified
   - Business logic changes
   - API changes or additions
3. **Extract user stories**: Convert technical changes into user-focused requirements:
   - "As a [user role], I want [feature] so that [business value]"
   - Focus on WHAT the feature does, not HOW it's implemented

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-requirements-extraction.js` and ensure it passes before proceeding to the next step. If the validation fails, you must adjust your requirements extraction based on the feedback and re-run the validation until it passes.

### Step 3: Create Feature Documentation

**Objective**: Generate comprehensive feature documentation using the standard template

**Process**:
1. **Use feature template**: Apply `templates/feature-template.md` structure
2. **Populate sections based on extracted requirements**:
   - **Specification**: User stories and acceptance criteria from Step 2
   - **Technical Design**: Architecture overview based on actual code changes
   - **Implementation Plan**: Task breakdown reflecting the work already done
   - **Usage Guide**: Examples based on the new/modified APIs
   - **Impact Analysis**: File changes from `git diff --name-status`
3. **Assign sequential numbering**: Check existing features in `features/` directory and use next available number (e.g., if max is 042, use 043)

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-feature-documentation.js` and ensure it passes before proceeding to the next step. If the validation fails, you must adjust your feature documentation based on the feedback and re-run the validation until it passes.

### Step 4: Commit with Proper Structure

**Objective**: Create a clean, well-structured commit

**Process**:
1. **Stage all changes**: `git add .`
2. **Create feature file**: Save the generated feature documentation as `features/[###]-[feature-name].md`
3. **Commit with descriptive message**: Follow conventional commit format
4. **Verify final state**: Ensure working directory is clean and all changes are committed

**MANDATORY VALIDATION**: After completing this step, you MUST execute the validation script `./skills/feature-organizer/scripts/validate-commit-structure.js` and ensure it passes. If the validation fails, you must adjust your commit structure based on the feedback and re-run the validation until it passes.

## Quality Gates

Before completing the feature organization process, ensure:

- **✅ All tests pass**: Zero test failures
- **✅ Coverage ≥85%**: Verified through coverage report  
- **✅ Feature documentation complete**: All template sections populated
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
- **Phase 2**: `./skills/feature-organizer/scripts/validate-requirements-extraction.js` - Validates requirements extraction from uncommitted changes
- **Phase 3**: `./skills/feature-organizer/scripts/validate-feature-documentation.js` - Validates feature documentation structure and content
- **Phase 4**: `./skills/feature-organizer/scripts/validate-commit-structure.js` - Validates commit structure and cleanliness

**IMPORTANT**: Each validation script MUST be executed after its corresponding phase and MUST pass before proceeding to the next phase. The validation scripts provide detailed feedback that should be used to adjust the implementation if needed.

## Example Usage Scenarios

### Scenario 1: Path Alias Conversion Feature
- **Uncommitted changes**: Relative path imports converted to `@/` aliases
- **Extracted requirement**: "As a developer, I want consistent path aliases so that code navigation is easier and refactoring is safer"
- **Feature file**: `features/043-path-alias-conversion.md`

### Scenario 2: New Utility Function
- **Uncommitted changes**: New utility function added with tests
- **Extracted requirement**: "As a user, I want [utility] so that [specific problem] is solved"
- **Feature file**: `features/044-utility-function-name.md`

## Best Practices

- **Always validate tests first** before creating documentation
- **Extract requirements from actual code**, not assumptions
- **Use precise, actionable language** in feature documentation
- **Maintain consistent naming** and numbering conventions
- **Focus on user value** rather than technical implementation details