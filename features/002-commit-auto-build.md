# 002 - Commit Auto-Build: Git Hooks for Automatic Building

## 概述
本功能实现了在每次 Git commit 时自动构建项目的能力，确保提交的代码始终能够成功编译。通过 Husky Git hooks 和自定义构建脚本，开发者在提交代码前会自动运行 TypeScript 构建过程，防止将无法编译的代码推送到仓库。

## 功能详情

### 1. 技术栈

- **Husky**: 现代化的 Git hooks 管理工具
- **Shell Script**: 自定义预提交构建脚本
- **TypeScript Compiler**: 项目构建工具
- **Git Hooks**: pre-commit 钩子

### 2. 文件结构

```
aibo/
├── .husky/
│   └── pre-commit                 # Husky pre-commit hook
├── scripts/
│   └── pre-commit-build.sh        # 自定义构建脚本
└── package.json                   # 包含 prepare 脚本
```

### 3. 工作流程

#### 3.1 安装阶段
当开发者运行 `npm install` 时：
1. Husky 作为 devDependency 被安装
2. `prepare` 脚本自动执行 `husky` 命令
3. Husky 初始化 `.husky` 目录和必要的配置

#### 3.2 提交阶段
当开发者运行 `git commit` 时：
1. Git 触发 `pre-commit` hook
2. Husky 执行 `.husky/pre-commit` 脚本
3. 脚本调用 `./scripts/pre-commit-build.sh`
4. 构建脚本执行 `npm run build` (即 `tsc`)
5. 如果构建成功，允许提交继续
6. 如果构建失败，阻止提交并显示错误信息

### 4. 核心组件

#### 4.1 Husky 配置 (`package.json`)
```json
{
  "scripts": {
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.1.7"
  }
}
```

#### 4.2 Pre-commit Hook (`.husky/pre-commit`)
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run pre-commit build script
./scripts/pre-commit-build.sh
```

#### 4.3 构建脚本 (`scripts/pre-commit-build.sh`)
- **输入验证**: 无特殊输入，直接运行构建
- **构建执行**: 调用 `npm run build` 执行 TypeScript 编译
- **错误处理**: 
  - 构建失败时返回非零退出码，阻止 Git commit
  - 显示清晰的错误信息指导开发者修复问题
- **成功反馈**: 构建成功时显示确认信息

### 5. 使用体验

#### 正常情况（构建成功）:
```bash
$ git add .
$ git commit -m "feat: add new feature"
🔍 Pre-commit build check started...
📦 Building TypeScript project...

> aibo@1.0.0 build
> tsc

✅ Build successful! Ready to commit.
[master abc1234] feat: add new feature
 1 file changed, 10 insertions(+)
```

#### 异常情况（构建失败）:
```bash
$ git add .
$ git commit -m "feat: broken feature"
🔍 Pre-commit build check started...
📦 Building TypeScript project...

> aibo@1.0.0 build
> tsc

src/broken-file.ts:5:10 - error TS2322: Type 'string' is not assignable to type 'number'.

5     const x: number = "not a number";
           ~

❌ Build failed! Please fix the errors before committing.
husky - pre-commit hook exited with code 1 (error)
```

### 6. 优势

1. **代码质量保证**: 确保所有提交的代码都能成功编译
2. **早期错误检测**: 在本地开发阶段就发现问题，避免污染远程仓库
3. **团队一致性**: 所有开发者都遵循相同的构建标准
4. **CI/CD 友好**: 减少 CI 流水线中的构建失败
5. **无缝集成**: 对开发者透明，无需额外操作

### 7. 自定义选项

#### 7.1 跳过构建检查
如果需要临时跳过构建检查（不推荐）：
```bash
git commit --no-verify -m "commit message"
```

#### 7.2 扩展构建脚本
可以在 `scripts/pre-commit-build.sh` 中添加更多检查：
- 运行测试: `npm test`
- 代码格式化检查: `npm run lint`
- 类型检查: `npm run type-check`

#### 7.3 环境变量支持
构建脚本可以读取环境变量进行条件判断：
```bash
# 在 CI 环境中跳过某些检查
if [ "$CI" != "true" ]; then
    npm run additional-checks
fi
```

### 8. 故障排除

#### 8.1 Husky 未触发
- 确保已运行 `npm install`（触发 prepare 脚本）
- 检查 `.husky` 目录是否存在
- 验证 Git hooks 路径：`git config core.hooksPath`

#### 8.2 权限问题
- 确保脚本有执行权限：`chmod +x scripts/pre-commit-build.sh`
- 在 Windows 系统上可能需要额外配置

#### 8.3 构建性能
- 对于大型项目，可以考虑只检查修改的文件
- 使用增量构建或缓存机制优化性能

### 9. 版本兼容性

- **Node.js**: 14+
- **npm**: 7+
- **Git**: 2.13+
- **Husky**: 9.x

### 10. 未来扩展

1. **并行检查**: 同时运行构建、测试和 linting
2. **智能跳过**: 基于文件变更类型决定运行哪些检查
3. **报告生成**: 生成详细的构建报告
4. **通知集成**: 失败时发送桌面通知或 Slack 消息

---
*本文档描述了 commit-auto-build 功能的实现细节和使用指南*