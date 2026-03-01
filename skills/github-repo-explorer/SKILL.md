---
name: github-repo-explorer
description: Quickly understand any GitHub repository using structured API-based exploration. Covers repository metadata, file structure, and commit history — equivalent to how Claude Code explores a new repo at the start of a session, but working directly against the GitHub API without requiring a local clone.
---

# GitHub Repository Explorer Skill

## 🎯 Purpose
Provides a fast, repeatable workflow for understanding any GitHub repository from scratch using the GitHub REST API. This mirrors Claude Code's approach: read context files, inspect recent history, and explore file structure — but entirely remotely, without cloning.

## 🚀 When to Use
- Before contributing to or reviewing an unfamiliar GitHub repository
- When asked to analyse, summarize, or extend a GitHub project
- When you need to understand what changed recently in a remote codebase
- As a first step before fetching individual files with `WebFetchFromGithub`

---

## 🔍 Step-by-Step Exploration Workflow

### Step 1 — Get repository metadata
```
github_repo_info owner="<owner>" repo="<repo>"
```
Returns: description, primary language, topics, stars, forks, default branch, license, last pushed date.  
This tells you **what the project is** in one API call.

### Step 2 — See the file structure
```
github_repo_tree owner="<owner>" repo="<repo>"
```
Returns a recursive list of every file and directory.  
- Spot the tech stack: `package.json` → Node.js, `requirements.txt` → Python, `go.mod` → Go  
- Find key files: `README.md`, `CLAUDE.md`, `AGENTS.md`, `src/`, `lib/`, `tests/`  
- Use `path="src"` to filter to a sub-directory once you know the layout

### Step 3 — Read recent commit history
```
github_repo_commits owner="<owner>" repo="<repo>" max_count=20
```
Returns: short SHA, subject line, author, date for each commit.  
This tells you **what the team has been working on** and the velocity of development.

### Step 4 — Read key files
Once you know which files matter (from Steps 2–3), fetch them:
```
WebFetchFromGithub owner="<owner>" repo="<repo>" path="README.md"
WebFetchFromGithub owner="<owner>" repo="<repo>" path="package.json"
WebFetchFromGithub owner="<owner>" repo="<repo>" path="CLAUDE.md"
```

---

## ⚡ Quick One-Shot Repo Overview

Run these **in parallel** for maximum speed (they are independent API calls):

```
# Parallel batch
github_repo_info    owner="<owner>" repo="<repo>"
github_repo_tree    owner="<owner>" repo="<repo>"
github_repo_commits owner="<owner>" repo="<repo>" max_count=10
```

Then, once you know the key files from `github_repo_tree`, fetch them in a second parallel batch:

```
# Parallel batch 2 — key files
WebFetchFromGithub owner="<owner>" repo="<repo>" path="README.md"
WebFetchFromGithub owner="<owner>" repo="<repo>" path="<config-file>"
```

---

## 🧩 Tool Reference

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `github_repo_info` | Repository metadata | `owner`, `repo` |
| `github_repo_tree` | Recursive file listing | `owner`, `repo`, `branch`, `path` |
| `github_repo_commits` | Recent commit history | `owner`, `repo`, `branch`, `max_count`, `author`, `since` |
| `WebFetchFromGithub` | Read a single file's contents | `owner`, `repo`, `path`, `branch` |

---

## 💡 How Claude Code Does It

When Claude Code first encounters a repository it:
1. **Reads `CLAUDE.md`** — persistent project-specific instructions
2. **Runs `git log --oneline -20`** — recent commit context
3. **Lists the directory** — maps the structure
4. **Reads `README.md`** and key config files — architecture overview
5. **Searches for relevant patterns** — locates code of interest

This skill replicates that workflow over the GitHub API using `github_repo_info`, `github_repo_tree`, and `github_repo_commits`, then `WebFetchFromGithub` for individual files.

---

## 🔑 Authentication

- **Public repos**: No token required.
- **Private repos or higher rate limits**: Set `GITHUB_TOKEN` (or `AIBO_GITHUB_TOKEN`) in your environment.
  - Unauthenticated: 60 requests/hour
  - Authenticated: 5,000 requests/hour

---

## ✅ Repository Understanding Checklist

Before starting any task on a GitHub repository:
- [ ] Run `github_repo_info` to understand purpose, language, and activity
- [ ] Run `github_repo_tree` to map the file structure
- [ ] Run `github_repo_commits` to understand recent development focus
- [ ] Fetch `README.md`, `CLAUDE.md`, or `AGENTS.md` if present
- [ ] Note the default branch (from `github_repo_info`)
- [ ] Check whether there are config files: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.
