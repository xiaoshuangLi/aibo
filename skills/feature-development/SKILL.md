---
name: feature-development
description: Strict feature development workflow requirements
---

## 🏗️ FEATURE DEVELOPMENT WORKFLOW
Every completed feature implementation MUST follow this strict workflow:

### 1. Comprehensive Testing
- **MANDATORY PRE-FEATURE TESTING**: Before creating ANY new feature, you MUST run the complete test suite using `npm test` and `npm run test:coverage`
- **COVERAGE REQUIREMENT**: Ensure ALL existing tests pass AND achieve **85%+ overall test coverage** (including statement, branch, function, and line coverage)
- **FAILURE HANDLING**: If coverage is below 85% or any tests fail, you MUST:
  1. Immediately identify the root cause using test feedback and coverage reports
  2. Locate problematic areas in either original source code OR test code
  3. Modify the appropriate code (source or test) to resolve issues
  4. Re-run tests until ALL tests pass AND coverage reaches 85%+ threshold
- Create test scripts in __tests__ directory covering ALL new functionality
- Achieve 90%+ test coverage for new feature acceptance (unit, integration, edge cases)
- Use appropriate testing frameworks for the language/technology stack
- **PROHIBITED** from proceeding with feature creation until the 85%+ coverage requirement is met

### 2. Feature Documentation Creation
- **REQUIREMENT EXTRACTION**: Before creating the feature documentation, you MUST extract requirements from the current uncommitted changes using git commands:
  - Use `git diff` to analyze all uncommitted code changes
  - Extract functional requirements, technical decisions, and implementation details from the code changes
  - Use this extracted information as the basis for your feature documentation
- **DOCUMENTATION CREATION**: Create new documentation in `features/` directory using `templates/feature-template.md` as the base template
- **CONTENT REQUIREMENTS**: The feature documentation MUST include:
  - Detailed usage examples based on the actual implemented code
  - API references that match the implemented interfaces
  - Implementation details derived from the code changes
  - Follow established numbering and formatting conventions
- **JSDOC COMPLIANCE**: All new and modified methods/functions MUST include complete JSDoc documentation following industry standards
- **COMPLETE BRANCH COVERAGE**: Documentation MUST describe ALL code paths, including all conditional branches, error handling paths, business logic variations, and edge cases
- **BILINGUAL DOCUMENTATION**: Include both English descriptions AND Chinese method name annotations using @name or @description tags
- **REQUIRED JSDOC TAGS**: Minimum required tags: @param, @returns, @throws, @example, @name
- **VALIDATION REQUIREMENT**: Verify JSDoc completeness before code submission - incomplete documentation is prohibited

### 3. Main Documentation Update
- Update README.md using templates/README-template.md as structure guide
- Add feature to table of contents and include installation/usage/configuration details
- Ensure all links and references are correct and consistent

### 4. Proper Code Commit
- Follow standardized commit process using template/git-commit-template.md
- Ensure descriptive commit messages following conventional commit format
- Include relevant issue references and comprehensive change descriptions
- **COMMIT SCOPE**: Only commit the current working changes - do not include unrelated files or changes
- **NO SEPARATE FEATURE BRANCHES**: Features should be committed directly to the main development branch (typically `master` or `main`) without creating dedicated feature branches. This is a specific workflow requirement for this project.