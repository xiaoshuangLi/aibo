# AI 编程工具竞品分析与 AIBO 能力拓展

## 📋 Specification (规格说明)

**一句话描述**: 深度分析 Cursor、Claude Code 等主流 AI 编程工具的核心能力，识别 AIBO 当前差距，并通过新增结构化 Git 操作工具来填补关键空白。

**解决的问题**:
- 缺乏与 Cursor / Claude Code 等同行的深度 Git 集成（结构化操作、清晰回显）
- bash 工具虽可执行 git 命令，但返回原始文本，难以被后续流程可靠解析
- 没有专属 git 工具，AI 必须记住精确的 CLI 语法且无统一错误处理

**核心价值**:
- 为 AI 提供一套结构化 Git 操作能力（status / diff / log / blame / add / commit / push / pull / checkout / branch / stash）
- 返回 JSON，让后续代理或工具可直接解析
- 与现有 bash 工具互补：简单命令用 bash，Git 专用操作用本工具

---

## 🔍 竞品分析 (Competitive Analysis)

### 主流 AI 编程工具对比

| 工具 | 定位 | 核心能力 | 部署方式 |
|------|------|----------|----------|
| **Cursor** | AI 增强 IDE | 多文件编辑、语义代码索引、@mention 文件引用、Composer 模式 | 桌面 IDE |
| **Claude Code** | 终端 AI 编程助手 | 文件编辑（Diff 预览）、深度 Git 集成、Bash 执行 | CLI |
| **GitHub Copilot** | IDE 插件补全 | 行/块补全、Chat、PR 描述生成 | IDE 插件 |
| **Devin** | 全自主 AI 工程师 | 端到端任务执行、浏览器操控、PR 自动提交 | SaaS |
| **Windsurf (Codeium)** | AI 增强 IDE | Cascade 多步任务、实时感知上下文变化 | 桌面 IDE |
| **Aider** | 终端 AI 编程助手 | 多文件编辑、Git 自动提交、多模型支持 | CLI |
| **Continue.dev** | 开源 IDE 插件 | 自定义 LLM、斜杠命令、文件上下文 | IDE 插件 |
| **Amazon Q Developer** | AWS AI 编程助手 | 代码补全、安全扫描、AWS 专项优化 | IDE 插件 / CLI |
| **OpenHands** | 开源自主 AI | 沙盒执行、多智能体、Web UI | 自托管 |
| **AIBO** | 多智能体编程助手 | 多智能体架构、31+技能、LSP 分析、Lark 集成 | CLI / Lark |

---

### 关键能力差距分析

#### 1. 结构化 Git 集成（最高优先级）

| 能力 | Claude Code | Cursor | Aider | AIBO (改进前) |
|------|-------------|--------|-------|----------------|
| 查看工作区状态 | ✅ 结构化 | ✅ 内联 | ✅ 自动 | ⚠️ 依赖 bash |
| 展示 Diff | ✅ 美化渲染 | ✅ 内联 Diff | ✅ 彩色 | ⚠️ 依赖 bash |
| 提交变更 | ✅ 内置命令 | ✅ Source Control | ✅ 自动提交 | ⚠️ 依赖 bash |
| 分支管理 | ✅ | ✅ | ✅ | ⚠️ 依赖 bash |
| Blame 溯源 | ✅ | ✅ | ❌ | ⚠️ 依赖 bash |

**AIBO 当前状态**: 所有 git 操作必须通过通用 `execute_bash` 工具执行，返回原始文本，缺乏结构化 JSON 响应，错误处理不统一，AI 需要记忆完整 CLI 语法。

**改进方向**: 新增 `git_operation` 工具，提供结构化、类型安全的 Git 操作接口。

#### 2. Diff 预览（中优先级）

Claude Code 在编辑文件前向用户展示 unified diff，允许用户确认后再应用变更。AIBO 的 `edit_file` 工具直接应用修改，无预览环节。

**改进方向（未来）**: 在 `edit_file` 中增加 `dry_run` 参数，返回 diff 而非直接写入文件。

#### 3. 语义代码索引（低优先级，复杂度高）

Cursor 对整个代码库建立语义向量索引，支持自然语言搜索定位代码位置。AIBO 已有 LSP + Tree-sitter 混合分析，但缺少持久化向量索引。此项改进需要引入向量数据库，改动范围较大，列为后续规划。

#### 4. 多模型支持（中优先级）

Cursor 和 Continue.dev 支持多种 LLM（GPT-4、Claude、Gemini 等）。AIBO 目前主要依赖 Anthropic Claude，已有 `@langchain/openai` 依赖但未在主流程中暴露模型切换选项。

**改进方向（未来）**: 通过环境变量 `AIBO_MODEL` 支持运行时切换模型。

---

## 🏗️ Technical Design (技术设计)

### 本次实施：结构化 Git 操作工具

#### 工具设计原则
1. **原子操作**: 每个 operation 专注单一职责
2. **结构化输出**: 所有结果返回 JSON，便于后续解析
3. **统一错误处理**: 区分 git 错误类型，返回可操作的错误信息
4. **安全优先**: 不执行危险的强制命令（如 `--force` push）

#### 支持的操作

| Operation | 描述 | 对应 git 命令 |
|-----------|------|--------------|
| `status` | 工作区状态 | `git status --porcelain` |
| `diff` | 展示变更差异 | `git diff` / `git diff --staged` |
| `log` | 提交历史 | `git log --oneline` |
| `blame` | 行级别责任溯源 | `git blame` |
| `add` | 暂存文件 | `git add` |
| `commit` | 提交变更 | `git commit -m` |
| `push` | 推送到远端 | `git push` |
| `pull` | 拉取远端变更 | `git pull` |
| `checkout` | 切换分支或还原文件 | `git checkout` |
| `branch` | 分支管理 | `git branch` |
| `stash` | 暂存工作进度 | `git stash` |

#### 数据流
```
AI Agent → git_operation({operation, args}) → execGit() → JSON 响应
```

---

## 📝 Implementation Plan (实施计划)

### ✅ 已完成任务

✅ **竞品分析与差距识别**
- [x] 分析 Cursor、Claude Code、Aider、Windsurf 等 10 款工具
- [x] 识别 AIBO 最高优先级差距：结构化 Git 集成

~~✅ **Git 工具实现** (`src/tools/git.ts`)~~
- ~~[x] 实现 `git_operation` 工具，支持 11 种 git 操作~~
- ~~[x] 结构化 JSON 响应，统一错误处理~~
- ~~[x] 注册到工具系统 (`src/tools/index.ts`)~~

> ⚠️ **已移除**：`git_operation` 工具已从工具系统中移除（`src/tools/git.ts` 已删除）。Git 操作改为通过通用 `execute_bash` 工具执行。

~~✅ **测试覆盖** (`__tests__/tools/git.test.ts`)~~
- ~~[x] 工具 schema 验证测试~~
- ~~[x] status / diff / log / blame / add / commit 操作测试~~
- ~~[x] 错误处理测试（非 git 目录、无效操作等）~~

✅ **文档更新** (README.md)
- [x] 移除 Git 工具相关说明

---

## 🚀 Usage Guide (使用指南)

### 基本用法

```typescript
// 查看工作区状态
await git_operation({ operation: 'status', cwd: '/path/to/repo' });

// 查看未暂存的变更
await git_operation({ operation: 'diff', cwd: '/path/to/repo' });

// 查看已暂存的变更
await git_operation({ operation: 'diff', args: ['--staged'], cwd: '/path/to/repo' });

// 查看提交历史（最近 10 条）
await git_operation({ operation: 'log', args: ['-10'], cwd: '/path/to/repo' });

// 查看某文件的行级别责任
await git_operation({ operation: 'blame', args: ['src/tools/git.ts'], cwd: '/path/to/repo' });

// 暂存所有变更
await git_operation({ operation: 'add', args: ['.'], cwd: '/path/to/repo' });

// 创建提交
await git_operation({
  operation: 'commit',
  args: ['-m', 'feat(tools): add structured git operations tool'],
  cwd: '/path/to/repo'
});

// 推送
await git_operation({ operation: 'push', cwd: '/path/to/repo' });

// 创建并切换到新分支
await git_operation({ operation: 'checkout', args: ['-b', 'feature/my-feature'], cwd: '/path/to/repo' });

// 列出所有分支
await git_operation({ operation: 'branch', args: ['-a'], cwd: '/path/to/repo' });

// 暂存当前工作进度
await git_operation({ operation: 'stash', cwd: '/path/to/repo' });
```

### 响应格式

```json
// 成功
{
  "success": true,
  "operation": "status",
  "output": "M  src/tools/git.ts\n?? features/013-ai-coding-tools-competitive-analysis.md",
  "args": []
}

// 失败
{
  "success": false,
  "operation": "commit",
  "error": "nothing to commit, working tree clean",
  "args": ["-m", "empty commit"]
}
```

---

## 📊 Impact Analysis (影响分析)

### 与竞品差距缩小情况

| 能力维度 | 改进前 | 改进后 |
|----------|--------|--------|
| 结构化 Git 操作 | ⚠️ 仅 bash | ✅ 专用工具 |
| Git 错误处理 | ⚠️ 原始文本 | ✅ 结构化 JSON |
| 分支管理 | ⚠️ 手写命令 | ✅ 类型安全接口 |
| 提交/推送流程 | ⚠️ 手写命令 | ✅ 统一接口 |

### 后续规划（不在本次实施范围内）

1. **Diff 预览** (`edit_file` 增加 `dry_run` 参数) — 对齐 Claude Code 的文件编辑体验
2. **模型切换** (`AIBO_MODEL` 环境变量) — 对齐 Cursor / Continue.dev 的多模型支持
3. **语义代码索引** (向量数据库 + embedding) — 对齐 Cursor 的 codebase 搜索
4. **PR 自动创建** (GitHub API 集成) — 对齐 Devin 的端到端工程师能力
