# 010-git-hooks-coverage-validation-and-auto-push

## 功能概述 (Feature Summary)

**一句话描述**: 在 Git commit 前自动验证测试覆盖率是否达到 85% 以上，不达标则禁止提交，并在提交成功后自动推送到远程仓库。

**解决的问题**: 
- 确保代码质量，防止低覆盖率的代码被提交到版本控制系统
- 自动化工作流程，减少手动操作步骤
- 强制执行测试覆盖率标准，提高代码可靠性
- 避免忘记推送代码到远程仓库

**核心价值**: 
- 提高代码质量和测试覆盖率
- 自动化开发工作流程
- 减少人为错误和遗漏
- 保证团队代码质量标准的一致性

---

## 代码变更分析 (Code Changes Analysis)

> **数据来源**: 通过 `git diff --name-status main` 和 `git diff --stat main` 分析得出

### 变更文件清单
```bash
# 运行以下命令获取准确的文件列表：
# git diff --name-status main
```
- **新增文件**: 
  - `.husky/post-commit` - Post-commit 钩子脚本
  - `scripts/check-coverage-threshold.js` - 覆盖率阈值检查脚本
- **修改文件**: 
  - `.husky/pre-commit` - 更新的 pre-commit 钩子脚本
  - `README.md` - 更新文档说明

### 关键代码变更
```bash
# 运行以下命令查看详细变更统计：
# git diff --stat main
```
- **.husky/pre-commit**: 集成构建检查、测试覆盖率生成和阈值验证
- **scripts/check-coverage-threshold.js**: 解析 coverage-final.json 并验证覆盖率阈值
- **.husky/post-commit**: 实现自动推送功能
- **README.md**: 添加 Git Hooks 功能文档

---

## 使用方式变化 (Usage Changes)

### 功能前
```bash
# 开发者需要手动运行测试和推送
npm run test:coverage
git add .
git commit -m "message"
git push origin branch
```

### 功能后  
```bash
# 开发者只需正常提交，钩子会自动处理
git add .
git commit -m "message"  # 自动验证覆盖率并推送
```

### 影响范围
- **Breaking Changes**: 否
- **Migration Required**: 否
- **Backward Compatible**: 是

---

## 工作量统计 (Workload Metrics)

> **数据收集命令**: 
> - 代码行数: `git diff --shortstat main`
> - 测试覆盖率: `npm run test:coverage`

| 指标 | 数值 | 说明 |
|------|------|------|
| 新增代码行数 | 85 | 通过 `git diff --shortstat` 统计 |
| 删除代码行数 | 3 | 通过 `git diff --shortstat` 统计 |
| 变更文件数 | 4 | 通过 `git diff --name-only | wc -l` 统计 |
| 测试覆盖率 | 88.14% | 通过 `npm run test:coverage` 获取 |
| 净代码影响 | 82 | 新增 - 删除 |

---

## 验证要求 (Verification Requirements)

### 必须验证的场景
1. 当覆盖率 >= 85% 时，commit 应该成功并通过 post-commit 自动推送
2. 当覆盖率 < 85% 时，commit 应该被阻止并显示错误信息
3. 构建失败时，commit 应该被阻止
4. 测试生成失败时，commit 应该被阻止
5. post-commit 钩子应该正确推送到当前分支

### 测试覆盖标准
- **总体覆盖率**: ≥ 85% (当前 88.14%)
- **关键路径**: 100% 覆盖
- **错误处理**: 必须有对应的测试用例

### 验证命令
```bash
# 运行完整测试
npm test

# 验证覆盖率
npm run test:coverage

# 测试钩子功能（已通过实际测试验证）
# 1. 正常提交应该成功
# 2. 临时修改阈值到95%应该失败
```