# Enhanced System Prompt - Filesystem Access Optimization

> **重要命名规则**: 
> - 生成的 feature 文件必须命名为 `features/[###]-[feature-name].md` 格式
> - `[###]` 必须是三位数字编号（如 001, 002, 003...）
> - 编号必须连续累加，不可重复或跳过
> - 参考示例: `003-support-git-worktree.md`
> - 在创建新文件前，请检查现有文件的最大编号并使用下一个编号

## 📋 功能概述 (Feature Overview)

### 🎯 一句话描述
强化系统提示词，明确指导 AI Agent 避免读取不必要的目录（如 `dist`、`__tests__`、`node_modules`、`coverage` 等），从而显著减少 token 消耗并提高操作效率。

### 💡 业务价值
- **解决的问题**: AI Agent 在使用文件系统工具时可能无意中读取大型生成目录、依赖目录和测试目录，导致大量不必要的 token 消耗，影响性能和成本。
- **带来的价值**: 
  - 显著减少 token 消耗，降低 API 调用成本
  - 提高文件系统操作的针对性和效率
  - 增强 AI Agent 的智能决策能力，避免无效操作
  - 提供明确的最佳实践指导，减少错误操作
- **目标用户**: 所有使用 Aibo AI Agent 进行文件系统操作的开发者和用户

### 🔗 相关背景
- **相关 Issue/PR**: 用户直接请求优化文件系统访问策略
- **设计文档**: 无
- **依赖项**: 无，此功能仅修改系统提示词内容

---

## 🏗️ 技术设计 (Technical Design)

### 📐 架构概览
此功能在现有的 `enhanced-system-prompt.ts` 文件中添加新的 "Filesystem Access Optimization" 章节，作为 OPERATIONAL RULES 的一部分。该章节提供明确的指导原则，帮助 AI Agent 在使用文件系统工具时做出更智能的决策。

### ⚙️ 核心实现
#### 主要组件/模块
- **Enhanced System Prompt Module**: 在 `src/enhanced-system-prompt.ts` 中添加新的文件系统访问优化指导
- **Bilingual Support**: 同时更新英文版 (`ENHANCED_SYSTEM_PROMPT_EN`) 和中文版 (`ENHANCED_SYSTEM_PROMPT_ZH`) 提示词

#### 关键技术决策
- **明确目录列表**: 提供具体的应避免读取的目录类型和名称，包括生成目录、测试目录、依赖目录、覆盖率报告等
- **替代策略指导**: 提供精确的文件访问策略，如使用 glob 模式、直接读取特定文件、使用 grep 搜索等
- **上下文感知优先级**: 根据项目类型（开发项目、文档项目、配置分析）提供不同的目录优先级指导
- **语法兼容性**: 使用双引号包围目录名称，确保 TypeScript 模板字符串语法正确

#### 数据流/状态管理
此功能不涉及运行时数据流或状态管理，仅在系统提示词层面提供静态指导。

### 🧩 API 变更
#### 修改的 API
- **文件**: `src/enhanced-system-prompt.ts`
- **变更**: 在 OPERATIONAL RULES 部分添加 "Filesystem Access Optimization" 章节
- **影响**: 所有使用系统提示词的场景都会受益于更智能的文件系统访问指导

---
## 🚀 使用指南 (Usage Guide)

### 📦 安装/配置
此功能无需额外安装或配置，已集成到系统提示词中，所有用户自动受益。

### 🎮 基本使用
AI Agent 在执行文件系统操作时会自动遵循以下指导原则：

**避免读取的目录类型**：
- **生成/构建目录**: "dist", "build", "out", "target", "public", "static"
- **测试目录**: "__tests__", "test", "tests", "spec", "e2e"  
- **依赖目录**: "node_modules", "vendor", ".venv", "venv", "packages"
- **覆盖率/报告目录**: "coverage", ".nyc_output", "reports", "docs"
- **缓存/临时目录**: ".cache", ".next", ".nuxt", ".svelte-kit", "tmp"
- **版本控制目录**: ".git", ".svn", ".hg"
- **IDE/编辑器目录**: ".vscode", ".idea", ".vs", ".editorconfig"

**推荐的文件访问策略**：
- **优先使用有针对性的 glob 模式**而非递归目录列出（例如，"src/**/*.ts" 而不是 "ls -laR"）
- **直接读取特定文件**当知道其位置时，而不是探索整个目录
- **使用 grep 进行内容搜索**而不是读取目录中的所有文件
- **对大文件实施分页**使用 offset/limit 参数
- **首先关注源代码目录**（"src", "lib", "app", "components"）和配置文件

**上下文感知的目录优先级**：
- **对于开发项目**: 优先考虑 "src/", "lib/", "app/", "package.json", "README.md"
- **对于文档项目**: 关注 "docs/", "README.md", "*.md" 文件
- **对于配置分析**: 读取 ".env", "config/", "*.json", "*.yaml", "*.toml" 文件
- **始终检查 .gitignore** 以了解哪些目录被有意排除在版本控制之外

### 🏆 高级用法
此功能完全自动化，无需用户手动调用。AI Agent 会根据上下文自动应用这些优化策略。

### 🔄 迁移指南
#### 从旧版本迁移
此功能向后兼容，无需任何迁移步骤。现有代码和工作流程不受影响，但会自动获得更好的文件系统访问优化。