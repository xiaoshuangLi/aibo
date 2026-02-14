# [Feature Title]

## 📋 Specification (规格说明)

### 🎯 User Story
作为[用户角色]，我想要[功能描述]，以便[业务价值]。

### ✅ Acceptance Criteria
- [ ] 条件1：具体的验收标准（必须是可测试的）
- [ ] 条件2：具体的验收标准（必须是可测试的）  
- [ ] 条件3：具体的验收标准（必须是可测试的）

### ⚙️ Technical Constraints
- **技术栈要求**: [指定的技术栈和版本]
- **兼容性要求**: [浏览器/系统/设备兼容性]
- **性能要求**: [响应时间、资源使用等具体指标]
- **安全要求**: [安全相关的约束和标准]

---

## 🏗️ Technical Design (技术设计)

### 📐 Architecture Overview
[提供高层次的架构图或描述，说明功能在整体系统中的位置]

### ⚙️ Core Implementation
#### Main Components/Modules
- **[组件名称]**: [简要描述组件职责和关键实现]
- **[组件名称]**: [简要描述组件职责和关键实现]

#### Key Technical Decisions
- **决策 1**: [描述决策内容、原因和替代方案]
- **决策 2**: [描述决策内容、原因和替代方案]

#### Data Flow/State Management
[描述数据如何在系统中流动，状态如何管理]

### 🧩 API Changes
#### New APIs
```typescript
// 示例：新增的 API 接口
interface NewFeatureOptions {
  option1: string;
  option2?: boolean;
}

function newFeature(options: NewFeatureOptions): Promise<Result>;
```

#### Modified APIs
```typescript
// 示例：修改的 API 接口
// 原有:
function oldFunction(param: string): void;

// 修改后:
function oldFunction(param: string, options?: { newOption: boolean }): void;
```

#### Deprecated APIs
- **[API 名称]**: [废弃原因和替代方案]

---

## 📝 Implementation Plan (实施计划)

### 📋 Task Breakdown
1. **[任务1]** - [具体描述] (预计: X小时)
2. **[任务2]** - [具体描述] (预计: X小时)
3. **[任务3]** - [具体描述] (预计: X小时)

### 🔗 Dependencies
- **Internal Dependencies**: [项目内其他模块]
- **External Dependencies**: [第三方库/服务]
- **Prerequisites**: [需要先完成的工作]

### ⚠️ Risk Assessment
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| [风险1] | 高/中/低 | 高/中/低 | [具体措施] |
| [风险2] | 高/中/低 | 高/中/低 | [具体措施] |

### 🎯 Success Metrics
- **功能完整性**: [完成度指标]
- **代码质量**: [测试覆盖率/代码复杂度]
- **性能指标**: [具体的性能目标]
- **用户体验**: [用户满意度/易用性指标]

---

## 🚀 Usage Guide (使用指南)

### 📦 Installation/Configuration
[如果需要特殊的安装或配置步骤]

### 🎮 Basic Usage
```typescript
// 基本使用示例
import { newFeature } from 'your-library';

const result = await newFeature({
  option1: 'value',
  option2: true
});
```

### 🏆 Advanced Usage
```typescript
// 高级用法示例
// 场景 1: [描述场景]
const advancedResult = await newFeature({
  // 高级配置
});

// 场景 2: [描述场景]
```

### 🔄 Migration Guide
#### Migration from Previous Versions
[如果存在 Breaking Changes，提供详细的迁移步骤]

#### Compatibility Notes
- **Backward Compatible**: [是/否]
- **Minimum Version Requirements**: [版本号]
- **Known Limitations**: [列出任何已知的限制或边界情况]

---

## 📊 Impact Analysis (影响分析)

### 📈 Performance Impact
- **内存使用**: [增加/减少/无变化] + [具体数值或百分比]
- **CPU 使用**: [增加/减少/无变化] + [具体数值或百分比]
- **加载时间**: [增加/减少/无变化] + [具体数值或百分比]

### 🧪 Test Coverage
- **单元测试**: [覆盖率百分比] - [测试文件路径]
- **集成测试**: [覆盖率百分比] - [测试文件路径]
- **端到端测试**: [覆盖率百分比] - [测试文件路径]

### 📁 File Changes
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

## ✅ Verification Requirements (验证要求)

### 🧪 Test Strategy
- **Unit Tests**: [覆盖哪些逻辑和边界条件]
- **Integration Tests**: [覆盖哪些集成点和交互]
- **End-to-End Tests**: [覆盖哪些用户场景]
- **Performance Tests**: [性能测试的具体要求]

### 🚪 Quality Gates
- **[ ] Code Review Passed**
- **[ ] Test Coverage ≥ 90%**
- **[ ] Performance Tests Passed**
- **[ ] Security Scan Passed**
- **[ ] Documentation Updated**

### 📊 Performance Requirements
- **Response Time**: ≤ [X]ms
- **Memory Usage**: ≤ [X]MB
- **Concurrent Users**: ≥ [X]
- **Error Rate**: ≤ [X]%

### 🧪 Verification Commands
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

## 🛠️ Maintenance Guide (维护指南)

### 🔍 Debugging Tips
- **常见问题 1**: [问题描述和解决方案]
- **常见问题 2**: [问题描述和解决方案]
- **日志级别**: [建议的日志级别和关键日志点]

### 📈 Monitoring Metrics
- **关键指标 1**: [指标名称和正常范围]
- **关键指标 2**: [指标名称和正常范围]
- **告警阈值**: [触发告警的阈值]

### 🔄 Future Extensions
- **计划中的功能**: [列出计划中的扩展功能]
- **架构限制**: [当前架构的限制和改进方向]
- **技术债务**: [识别的技术债务和解决计划]

---

## 📝 Changelog (变更日志)

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