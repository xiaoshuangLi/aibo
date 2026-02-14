---
name: using-git-worktrees
description: Creates isolated git worktrees with smart directory selection and safety verification for safe parallel development workflows.
---

# Using Git Worktrees Skill

## 🎯 Purpose
This skill enables safe, isolated development workflows by creating git worktrees - separate working directories that share the same git repository but allow independent branching and development without affecting the main working directory.

## 🚀 When to Use
- When you need to work on multiple features or branches simultaneously
- When you want to test changes without affecting your current working state
- When you need to maintain a clean separation between different development tasks
- When working on experimental features that might break your main workspace

## 🔧 Core Capabilities
1. **Smart Directory Selection**: Automatically suggests appropriate directory names based on branch names
2. **Safety Verification**: Validates that the target directory doesn't conflict with existing work
3. **Isolated Environment**: Creates completely separate working directories with their own file states
4. **Branch Management**: Handles branch creation and switching within worktrees
5. **Cleanup Support**: Provides guidance for proper worktree removal and cleanup

## 📋 Workflow Steps
1. **Identify Need**: Determine if the current task requires isolation from the main workspace
2. **Choose Branch**: Select or create a branch name that represents the feature/fix
3. **Select Directory**: Choose an appropriate directory name (typically matching the branch)
4. **Create Worktree**: Execute `git worktree add <directory> <branch>` command
5. **Verify Setup**: Confirm the worktree is properly created and isolated
6. **Switch Context**: Navigate to the worktree directory for development
7. **Cleanup**: Remove worktree when no longer needed using `git worktree remove`

## ⚠️ Safety Guidelines
- Always verify the target directory doesn't exist before creating a worktree
- Never delete worktree directories manually - use `git worktree remove` instead
- Ensure you have committed or stashed changes in your main workspace before switching
- Be aware that worktrees share the same .git directory, so some operations affect all worktrees
- Regularly prune stale worktrees with `git worktree prune`

## 🛠️ Command Reference
- `git worktree add <path> <branch>` - Create new worktree
- `git worktree list` - List all worktrees
- `git worktree remove <path>` - Remove worktree
- `git worktree prune` - Clean up stale worktree references
- `git worktree move <old-path> <new-path>` - Move worktree to new location

## 💡 Best Practices
- Use descriptive directory names that match your branch names
- Keep worktrees organized in a dedicated subdirectory (e.g., `worktrees/`)
- Document the purpose of each worktree in your project notes
- Set up your IDE/editor to recognize worktree boundaries
- Use worktrees for long-running features, not quick fixes

## 🔄 Integration with Development Workflow
This skill integrates seamlessly with other development practices:
- **Test-Driven Development**: Write tests in isolation before merging
- **Code Review**: Prepare clean, focused changes for review
- **Feature Branching**: Maintain clear separation between features
- **Bug Fixing**: Isolate bug fixes from ongoing feature work

## 📝 Examples
- "Create a worktree for the user-authentication feature"
- "Set up an isolated environment for testing the API integration"
- "I need to work on the payment processing refactor without affecting my current checkout work"
- "Create a separate workspace for the mobile-responsive design changes"

## 🎯 Success Criteria
- Worktree is created successfully with proper branch setup
- Directory is isolated and doesn't interfere with main workspace
- All git operations work correctly within the worktree
- Cleanup can be performed safely when work is complete