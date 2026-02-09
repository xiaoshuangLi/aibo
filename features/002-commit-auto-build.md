# 002 - Commit Auto-Build: Git Hooks for Automatic Building

## 功能修复 (Bug Fix / Feature Enhancement)

- **问题描述**: 
  - 开发者可能提交无法编译的 TypeScript 代码到仓库
  - 缺乏在提交前自动验证代码可编译性的机制
  - 需要确保每次提交的代码都是可构建的

- **解决方案**: 
  - 实现 Git pre-commit hook，在每次提交前自动运行 TypeScript 构建
  - 使用 Husky 管理 Git hooks
  - 创建自定义构建脚本，提供清晰的成功/失败反馈
  - 集成到 npm 安装流程中，确保所有开发者都能自动获得此功能

- **预期效果**: 
  - 每次 git commit 时自动验证代码可编译性
  - 阻止无法编译的代码被提交到仓库
  - 提供清晰的错误信息帮助开发者快速修复问题
  - 无需手动配置，新开发者安装依赖后自动生效

---

## 代码实现 (Code Implementation)

### 涉及的文件
- package.json
- .husky/pre-commit
- scripts/pre-commit-build.sh

### 文件内部的核心功能

#### 文件1: package.json

**功能说明**: 
- 添加 prepare 脚本，在 npm install 后自动初始化 Husky
- 确保 husky 作为 devDependency 安装
- build 脚本用于 TypeScript 编译

#### 文件2: .husky/pre-commit

**功能说明**: 
- Husky 自动生成的 pre-commit hook
- 加载 Husky 运行时环境
- 调用自定义构建脚本进行预提交检查

#### 文件3: scripts/pre-commit-build.sh

**功能说明**: 
- 执行 npm run build 命令进行 TypeScript 编译
- 构建成功时显示确认信息并允许提交继续
- 构建失败时显示错误信息并阻止提交
- 提供有用的提示信息帮助开发者解决问题

> **注意**: 根据实际涉及的文件数量调整上述模板

---

## 使用变化 (Usage Changes)

### 功能前的接口/使用方式
```bash
# 开发者需要手动运行构建检查
$ npm run build
$ git add .
$ git commit -m "message"
# 可能提交无法编译的代码
```

### 功能后的接口/使用方式
```bash
# 自动构建检查，无需额外步骤
$ git add .
$ git commit -m "message"
# 自动运行构建检查，失败则阻止提交
```

### 变更说明
- **Breaking Changes**: 无破坏性变更，只是增加了提交前的检查
- **Migration Guide**: 新开发者只需运行 npm install 即可自动配置，现有开发者需要重新安装依赖或手动运行 npx husky install
- **Backward Compatibility**: 完全向后兼容，不影响现有代码和工作流程

---

## 工作量 (Workload Tracking)

| 指标 | 数量 | 备注 |
|------|------|------|
| 新增代码行数 | 15 | 不包含注释和空行 |
| 修改代码行数 | 5 | package.json 中添加 prepare 脚本和 husky 依赖 |
| 删除代码行数 | 0 | 完全删除的代码行数 |
| 变更文件数 | 3 | package.json, .husky/pre-commit, scripts/pre-commit-build.sh |
| 总代码量影响 | 20 | 净增代码行数 (新增 - 删除) |
| 测试覆盖率 | N/A | Git hooks 难以自动化测试 |

### 复杂度评估
- **技术复杂度**: 低
- **业务复杂度**: 低
- **风险评估**: 低