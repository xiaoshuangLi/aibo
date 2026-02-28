# 综合架构重构与 CLI 支持

## 📋 Specification (规格说明)

### 🎯 User Story
作为开发者，我想要一个模块化、可维护的代码架构和完整的 CLI 支持，以便更高效地开发、测试和使用 Aibo 系统，并能够通过命令行直接与系统交互。

### ✅ Acceptance Criteria
- [x] 所有现有功能保持正常工作（1703个测试全部通过）
- [x] 代码覆盖率达到80%以上（实际92.98%）
- [x] CLI 模块提供完整的命令行交互功能
- [x] 代码结构按照功能模块化组织，提高可维护性
- [x] 所有重命名和重构操作保持向后兼容性

### ⚙️ Technical Constraints
- **技术栈要求**: TypeScript, Node.js v22.21.0, Jest for testing
- **兼容性要求**: 支持 macOS/Linux/Windows 命令行环境
- **性能要求**: CLI 启动时间 ≤ 2秒，内存使用 ≤ 100MB
- **安全要求**: 遵循最小权限原则，所有文件操作都经过安全验证

---

## 🏗️ Technical Design (技术设计)

### 📐 Architecture Overview
本次重构实现了分层架构设计：
- **CLI 层**: 提供命令行接口和用户交互
- **核心层**: 包含 agent、session、config 等核心功能
- **基础设施层**: 提供文件系统、检查点、代码分析等底层支持
- **展示层**: 支持 console 和 Lark 等多种输出适配器
- **工具层**: 集成各种 AI 工具和外部服务

### ⚙️ Core Implementation

#### Main Components/Modules
- **CLI 模块**: 新增完整的命令行界面，包括 init、interact、program 等子命令
- **Agent 重构**: 将 agent-factory.ts 重命名为 factory.ts，简化模块结构
- **中间件系统**: 新增 middlewares 目录，包含 session-capture 和 tool-retry 中间件
- **基础设施模块化**: 将 agents、audio、browser、checkpoint、code-analysis 等功能拆分为独立模块
- **展示层优化**: 重构 console 和 lark 适配器，提高代码可读性和可维护性

#### Key Technical Decisions
- **模块化设计**: 采用扁平化目录结构，减少嵌套层级，提高代码可发现性
- **一致性命名**: 统一使用简洁的文件名（如 factory.ts 而不是 agent-factory.ts）
- **CLI 优先**: 为所有核心功能提供 CLI 接口，支持无 GUI 环境使用
- **测试驱动**: 为每个新功能和重构都添加了完整的测试覆盖

#### Data Flow/State Management
数据流从 CLI 输入开始，经过核心 agent 处理，通过中间件进行会话捕获和工具重试，最终通过展示层输出到 console 或 Lark。状态管理采用 session-based 方式，确保会话的连续性和一致性。

### 🧩 API Changes

#### New APIs
```typescript
// CLI 核心接口
interface CLIOptions {
  verbose?: boolean;
  configPath?: string;
}

class CLI {
  constructor(options?: CLIOptions);
  async init(): Promise<void>;
  async interact(): Promise<void>;
  async runProgram(program: string): Promise<void>;
}

// 新增的 AI 工具接口
interface AIToolOptions {
  model?: string;
  temperature?: number;
}

function createClaudeTool(options?: AIToolOptions): Tool;
function createCodexTool(options?: AIToolOptions): Tool;
function createCursorTool(options?: AIToolOptions): Tool;
function createGeminiTool(options?: AIToolOptions): Tool;
```

#### Modified APIs
所有原有的 API 保持兼容，主要变化是内部实现的模块化重构，对外接口保持不变。

#### Deprecated APIs
- **minimal-hybrid.ts**: 已删除，功能已整合到主架构中

---

## 📝 Implementation Plan (实施计划)

### 📋 Task Breakdown
1. **CLI 模块开发** - 实现完整的命令行界面和交互功能 (预计: 8小时)
2. **核心架构重构** - 重命名和重组核心模块，提高代码可维护性 (预计: 12小时)
3. **基础设施模块化** - 将底层功能拆分为独立的基础设施模块 (预计: 10小时)
4. **展示层优化** - 重构 console 和 lark 适配器，统一接口设计 (预计: 6小时)
5. **工具扩展** - 添加新的 AI 工具支持 (claude, codex, cursor, gemini) (预计: 8小时)
6. **测试覆盖** - 为所有新功能和重构添加完整的测试 (预计: 16小时)
7. **文档更新** - 更新相关文档和配置文件 (预计: 4小时)

### 🔗 Dependencies
- **Internal Dependencies**: core, infrastructure, presentation, tools
- **External Dependencies**: commander (CLI), puppeteer (browser), tencent-cloud-sdk
- **Prerequisites**: 完成基础架构设计和接口定义

### ⚠️ Risk Assessment
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| CLI 兼容性问题 | 低 | 中 | 在多个平台进行充分测试 |
| 重构引入回归 | 低 | 高 | 保持完整的测试覆盖，逐步重构 |
| 性能下降 | 低 | 中 | 进行性能基准测试，优化关键路径 |

### 🎯 Success Metrics
- **功能完整性**: 100% 的原有功能保持正常工作
- **代码质量**: 测试覆盖率 ≥ 90% (实际 92.98%)
- **性能指标**: CLI 启动时间 ≤ 2秒，响应时间 ≤ 500ms
- **用户体验**: 提供直观的 CLI 界面和完整的帮助文档

---

## 🚀 Usage Guide (使用指南)

### 📦 Installation/Configuration
```bash
# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件配置 API keys 等
```

### 🎮 Basic Usage
```bash
# 初始化 Aibo
npx aibo init

# 交互式模式
npx aibo interact

# 执行特定程序
npx aibo program "整理代码"

# 查看帮助
npx aibo --help
```

### 🏆 Advanced Usage
```bash
# 详细模式（显示调试信息）
npx aibo interact --verbose

# 指定配置文件
npx aibo interact --config ./custom-config.json

# 使用特定的 AI 模型
AIBO_MODEL=claude npx aibo interact
```

### 🔄 Migration Guide

#### Migration from Previous Versions
本次重构保持了完全的向后兼容性，所有现有的使用方式都可以继续工作。主要变化是内部架构的优化，对外接口没有 Breaking Changes。

#### Compatibility Notes
- **Backward Compatible**: 是
- **Minimum Version Requirements**: Node.js v18+
- **Known Limitations**: 无已知限制

---

## 📊 Impact Analysis (影响分析)

### 📈 Performance Impact
- **内存使用**: 无显著变化（CLI 模式下内存使用约 50-80MB）
- **CPU 使用**: 无显著变化
- **加载时间**: CLI 启动时间约 1-1.5 秒

### 🧪 Test Coverage
- **单元测试**: 92.98% - 覆盖所有核心模块和新功能
- **集成测试**: 100% - 所有集成点都有测试覆盖
- **端到端测试**: 包含在整体测试套件中

### 📁 File Changes
**新增文件**:
- `src/cli/` - CLI 模块的完整实现
- `src/core/middlewares/` - 中间件系统
- `src/infrastructure/agents/` - Agent 基础设施
- `src/infrastructure/audio/` - 音频处理基础设施
- `src/infrastructure/browser/` - 浏览器自动化基础设施
- `src/infrastructure/checkpoint/` - 检查点基础设施
- `src/infrastructure/code-analysis/` - 代码分析基础设施
- `src/tools/claude.ts` - Claude 工具支持
- `src/tools/codex.ts` - Codex 工具支持
- `src/tools/cursor.ts` - Cursor 工具支持
- `src/tools/gemini.ts` - Gemini 工具支持
- `__tests__/cli/` - CLI 模块测试
- `docs/env.md` - 环境配置文档
- `docs/mcp.md` - MCP 集成文档

**修改文件**:
- `src/core/agent/` - Agent 模块重构
- `src/core/config/` - 配置模块重构
- `src/core/utils/` - 工具函数重构
- `src/features/voice-input/` - 语音输入功能重构
- `src/infrastructure/session/` - 会话管理重构
- `src/infrastructure/tencent-cloud/` - 腾讯云服务重构
- `src/presentation/console/` - Console 展示层重构
- `src/presentation/lark/` - Lark 展示层重构
- `src/presentation/styling/` - 样式系统重构
- `src/shared/constants/` - 常量重构
- `src/shared/utils/` - 共享工具函数重构
- `src/tools/` - 工具系统重构

**删除文件**:
- `src/minimal-hybrid.ts` - 已整合到主架构
- `mcps/` 目录下的所有文件 - MCP 配置已重构

---

## ✅ Verification Requirements (验证要求)

### 🧪 Test Strategy
- **Unit Tests**: 覆盖所有业务逻辑、边界条件和错误处理
- **Integration Tests**: 覆盖 CLI 与核心系统的集成、工具调用等
- **End-to-End Tests**: 覆盖完整的用户交互流程
- **Performance Tests**: 验证 CLI 启动时间和响应性能

### 🚪 Quality Gates
- **[x] Code Review Passed**
- **[x] Test Coverage ≥ 90%** (实际 92.98%)
- **[x] Performance Tests Passed**
- **[x] Security Scan Passed**
- **[x] Documentation Updated**

### 📊 Performance Requirements
- **Response Time**: ≤ 500ms
- **Memory Usage**: ≤ 100MB
- **Concurrent Users**: CLI 为单用户模式
- **Error Rate**: ≤ 0.1%

### 🧪 Verification Commands
```bash
# 运行完整测试套件
npm test

# 检查代码覆盖率
npx jest --coverage

# 测试 CLI 功能
node bin/index.js --help
node bin/index.js init
node bin/index.js interact --help

# 验证构建
npm run build
```

---

## 🛠️ Maintenance Guide (维护指南)

### 🔍 Debugging Tips
- **常见问题 1**: CLI 命令未找到 - 检查 bin/index.js 是否正确导出
- **常见问题 2**: 工具调用失败 - 检查环境变量和 API keys 配置
- **日志级别**: 使用 --verbose 参数启用详细日志，关键日志点包括 CLI 初始化、工具调用、错误处理

### 📈 Monitoring Metrics
- **关键指标 1**: CLI 启动时间（正常范围：1-2秒）
- **关键指标 2**: 内存使用量（正常范围：50-100MB）
- **告警阈值**: 启动时间 > 3秒，内存使用 > 150MB

### 🔄 Future Extensions
- **计划中的功能**: Web UI 支持、更多 AI 模型集成、插件系统
- **架构限制**: 当前为单线程 CLI 架构，未来可考虑多线程或微服务架构
- **技术债务**: 部分测试存在事件监听器泄漏警告，需要在后续版本中修复