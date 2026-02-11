# [Feature Title]

## 📋 功能概述 (Feature Overview)

### 🎯 一句话描述
[用一句话概括这个功能的核心价值和解决的问题]

### 💡 业务价值
- **解决的问题**: [具体描述解决了什么问题或满足了什么需求]
- **带来的价值**: [说明这个功能带来的主要好处]
- **目标用户**: [明确功能的目标用户群体]

### 🔗 相关背景
- **相关 Issue/PR**: [链接到相关的 GitHub Issue 或 PR]
- **设计文档**: [如果有相关的设计文档链接]
- **依赖项**: [列出此功能依赖的其他功能或服务]

---

## 🏗️ 技术设计 (Technical Design)

### 📐 架构概览
[提供高层次的架构图或描述，说明功能在整体系统中的位置]

### ⚙️ 核心实现
#### 主要组件/模块
- **[组件名称]**: [简要描述组件职责和关键实现]
- **[组件名称]**: [简要描述组件职责和关键实现]

#### 关键技术决策
- **决策 1**: [描述决策内容和原因]
- **决策 2**: [描述决策内容和原因]

#### 数据流/状态管理
[描述数据如何在系统中流动，状态如何管理]

### 🧩 API 变更
#### 新增 API
```typescript
// 示例：新增的 API 接口
interface NewFeatureOptions {
  option1: string;
  option2?: boolean;
}

function newFeature(options: NewFeatureOptions): Promise<Result>;
```

#### 修改的 API
```typescript
// 示例：修改的 API 接口
// 原有:
function oldFunction(param: string): void;

// 修改后:
function oldFunction(param: string, options?: { newOption: boolean }): void;
```

#### 废弃的 API
- **[API 名称]**: [废弃原因和替代方案]

---

## 🚀 使用指南 (Usage Guide)

### 📦 安装/配置
[如果需要特殊的安装或配置步骤]

### 🎮 基本使用
```typescript
// 基本使用示例
import { newFeature } from 'your-library';

const result = await newFeature({
  option1: 'value',
  option2: true
});
```

### 🏆 高级用法
```typescript
// 高级用法示例
// 场景 1: [描述场景]
const advancedResult = await newFeature({
  // 高级配置
});

// 场景 2: [描述场景]
```

### 🔄 迁移指南
#### 从旧版本迁移
[如果存在 Breaking Changes，提供详细的迁移步骤]

#### 兼容性说明
- **向后兼容**: [是/否]
- **最低版本要求**: [版本号]
- **已知限制**: [列出任何已知的限制或边界情况]

---

## 📊 影响分析 (Impact Analysis)

### 📈 性能影响
- **内存使用**: [增加/减少/无变化] + [具体数值或百分比]
- **CPU 使用**: [增加/减少/无变化] + [具体数值或百分比]
- **加载时间**: [增加/减少/无变化] + [具体数值或百分比]

### 🧪 测试覆盖
- **单元测试**: [覆盖率百分比] - [测试文件路径]
- **集成测试**: [覆盖率百分比] - [测试文件路径]
- **端到端测试**: [覆盖率百分比] - [测试文件路径]

### 📁 文件变更
```bash
# 通过以下命令查看详细变更:
# git diff --name-status main
# git diff --stat main
```

**新增文件**:
- `src/new-feature/` - [新功能的主要实现]
- `tests/new-feature/` - [新功能的测试]

**修改文件**:
- `src/core/` - [核心模块的修改]
- `docs/` - [文档更新]

**删除文件**:
- [列出删除的文件，如果有的话]

---

## 🧪 验证要求 (Verification Requirements)

### ✅ 必须验证的场景
1. **[场景 1]**: [具体的验证场景描述]
   - 预期结果: [预期的行为或输出]
   - 验证方法: [如何验证]

2. **[场景 2]**: [具体的验证场景描述]
   - 预期结果: [预期的行为或输出]
   - 验证方法: [如何验证]

3. **[边界情况]**: [边界情况的验证]
   - 预期结果: [预期的行为或输出]
   - 验证方法: [如何验证]

### 📏 测试覆盖标准
- **总体覆盖率**: ≥ 90%
- **关键路径**: 100% 覆盖
- **错误处理**: 必须有对应的测试用例
- **性能基准**: [如果有性能要求，列出基准测试]

### 🧪 验证命令
```bash
# 运行完整测试套件
npm test

# 运行特定功能的测试
npm test -- --testNamePattern="new-feature"

# 运行性能测试
npm run test:performance

# 检查代码覆盖率
npm run test:coverage
```

---

## 🛠️ 维护指南 (Maintenance Guide)

### 🔍 调试技巧
- **常见问题 1**: [问题描述和解决方案]
- **常见问题 2**: [问题描述和解决方案]
- **日志级别**: [建议的日志级别和关键日志点]

### 📈 监控指标
- **关键指标 1**: [指标名称和正常范围]
- **关键指标 2**: [指标名称和正常范围]
- **告警阈值**: [触发告警的阈值]

### 🔄 未来扩展
- **计划中的功能**: [列出计划中的扩展功能]
- **架构限制**: [当前架构的限制和改进方向]
- **技术债务**: [识别的技术债务和解决计划]

---

## 📝 变更日志 (Changelog)

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| v1.0.0 | YYYY-MM-DD | [@author](https://github.com/author) | 初始实现 |
| v1.0.1 | YYYY-MM-DD | [@author](https://github.com/author) | Bug 修复和性能优化 |

> **最后更新**: YYYY-MM-DD  
> **文档状态**: ✅ 已完成 / 🚧 进行中 / 📝 待完善

<!--
IMPORTANT NAMING RULES FOR DEVELOPERS (NOT PART OF FEATURE CONTENT):
- Generated feature files must be named as `features/[###]-[feature-name].md`
- `[###]` must be a three-digit number (e.g., 001, 002, 003...)
- Numbers must be consecutive and cannot be repeated or skipped
- Example: `003-support-git-worktree.md`
- Before creating a new file, check the maximum existing number and use the next number
-->