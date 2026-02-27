---
name: git-workflow
description: Git best practices for branching, committing, merging, and collaborating. Use this skill for any Git-related operations including feature branches, commit conventions, rebasing, and pull request workflows.
---

# Git Workflow Skill

## 🎯 Purpose
Provides systematic Git workflow patterns aligned with professional software development standards. Ensures consistent branching strategies, meaningful commit messages, and clean project history.

## 🚀 When to Use
- Starting work on a new feature, bug fix, or refactoring
- Reviewing uncommitted changes before staging
- Writing commit messages
- Resolving merge conflicts
- Preparing a pull request
- Managing release branches
- Undoing or amending recent changes

## 🌿 Branching Strategy

### Branch Naming Conventions
```
feature/<short-description>      # New features
fix/<issue-id>-<short-desc>      # Bug fixes
refactor/<component-name>        # Refactoring
docs/<what-you-are-documenting>  # Documentation only
chore/<task-name>                # Maintenance, dependency updates
hotfix/<critical-issue>          # Production hotfixes
release/<version>                # Release preparation
```

### Core Workflow
```bash
# 1. Always start from an up-to-date main branch
git checkout main && git pull origin main

# 2. Create a feature branch
git checkout -b feature/my-new-feature

# 3. Make changes, stage selectively
git add -p  # interactive staging (preferred over git add .)

# 4. Commit with conventional message
git commit -m "feat(scope): short description of change"

# 5. Keep branch up to date
git fetch origin && git rebase origin/main

# 6. Push and open PR
git push -u origin feature/my-new-feature
```

## 📝 Commit Message Convention (Conventional Commits)

### Format
```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types
| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, no logic changes |
| `refactor` | Code restructure, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependency updates |
| `ci` | CI/CD configuration changes |
| `revert` | Revert a previous commit |

### Good Commit Message Examples
```
feat(auth): add JWT refresh token rotation
fix(api): handle null response from payment gateway
refactor(database): extract query builder to separate module
test(user-service): add unit tests for password validation
```

### Bad Commit Message Examples
```
fix bug           # too vague
WIP               # never commit WIP to main
updated files     # meaningless
misc changes      # no information value
```

## 🔄 Keeping Branches Clean

### Rebase vs Merge
- **Prefer `rebase`** for feature branches to maintain linear history
- **Use `merge --no-ff`** for integrating completed features into main
- **Never rebase shared branches** (main, develop)

```bash
# Update feature branch without merge commits
git fetch origin
git rebase origin/main

# Squash multiple WIP commits before PR
git rebase -i HEAD~<number-of-commits>
```

## 🔍 Pre-Commit Checklist
1. `git status` — review all changed files
2. `git diff` — inspect all changes
3. `git add -p` — stage only intended changes
4. Run tests and linter before committing
5. Verify no secrets, credentials, or debug code
6. Check `.gitignore` is up to date

## ⚠️ Emergency: Undoing Changes

```bash
# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert a commit without rewriting history (safe for shared branches)
git revert <commit-hash>

# Unstage a file
git restore --staged <file>

# Discard unstaged changes to a file
git restore <file>
```

## 🏷️ Tagging and Releases

```bash
# Create an annotated tag
git tag -a v1.2.3 -m "Release version 1.2.3"

# Push tags
git push origin --tags

# List tags
git tag -l "v1.*"
```
