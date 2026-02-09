# [Feature 标题]

<!--
以下内容只是模板的生成规则描述，禁止在生成内容中出现。

> **重要命名规则**: 
> - 生成的 feature 文件必须命名为 `features/[###]-[feature-name].md` 格式
> - `[###]` 必须是三位数字编号（如 001, 002, 003...）
> - 编号必须连续累加，不可重复或跳过
> - 参考示例: `003-support-git-worktree.md`
> - 在创建新文件前，请检查现有文件的最大编号并使用下一个编号
-->

## 功能概述 (Feature Summary)

**一句话描述**: [用一句话概括这个功能的核心价值]

**解决的问题**: 
- [具体描述解决了什么问题或满足了什么需求]
- [可以列出多个要点]

**核心价值**: 
- [说明这个功能带来的主要好处]

---

## 代码变更分析 (Code Changes Analysis)

> **数据来源**: 通过 `git diff --name-status main` 和 `git diff --stat main` 分析得出

### 变更文件清单
```bash
# 运行以下命令获取准确的文件列表：
# git diff --name-status main
```
- **新增文件**: [列出新增的文件]
- **修改文件**: [列出修改的文件]  
- **删除文件**: [列出删除的文件]

### 关键代码变更
```bash
# 运行以下命令查看详细变更统计：
# git diff --stat main
```
- **src/[主要文件]**: [简要说明主要变更内容]
- **tests/[测试文件]**: [简要说明测试覆盖情况]

---

## 使用方式变化 (Usage Changes)

### 功能前
```[相关语言]
// 原有的使用方式（如果适用）
```

### 功能后  
```[相关语言]
// 新的使用方式
```

### 影响范围
- **Breaking Changes**: [是/否，以及具体说明]
- **Migration Required**: [是/否，以及迁移步骤]
- **Backward Compatible**: [是/否]

---

## 工作量统计 (Workload Metrics)

> **数据收集命令**: 
> - 代码行数: `git diff --shortstat main`
> - 测试覆盖率: `npm run test:coverage`

| 指标 | 数值 | 说明 |
|------|------|------|
| 新增代码行数 | [数值] | 通过 `git diff --shortstat` 统计 |
| 删除代码行数 | [数值] | 通过 `git diff --shortstat` 统计 |
| 变更文件数 | [数值] | 通过 `git diff --name-only | wc -l` 统计 |
| 测试覆盖率 | [百分比] | 通过 `npm run test:coverage` 获取 |
| 净代码影响 | [数值] | 新增 - 删除 |

---

## 验证要求 (Verification Requirements)

### 必须验证的场景
1. [具体的验证场景1]
2. [具体的验证场景2]
3. [具体的验证场景3]

### 测试覆盖标准
- **总体覆盖率**: ≥ 90%
- **关键路径**: 100% 覆盖
- **错误处理**: 必须有对应的测试用例

### 验证命令
```bash
# 运行完整测试
npm test

# 检查覆盖率  
npm run test:coverage

# 验证构建
npm run build
```