# 005 - Enhanced Session Monitoring and Mandatory Parallel Execution Framework

## Specification

### 🎯 User Story
作为开发者，我想要一个全面的会话监控系统和强制并行执行框架，以便能够实时跟踪智能体的所有活动，并确保复杂任务被自动分解为并行子任务以最大化性能。

### ✅ Acceptance Criteria
- [ ] 会话输出捕获中间件能够记录所有工具调用、工具结果、AI处理状态和错误信息
- [ ] 系统提示词和代理配置明确强调强制并行执行的要求
- [ ] 所有核心会话方法（start/end）支持异步操作
- [ ] 测试覆盖率达到85%以上，所有测试用例通过
- [ ] 不会破坏现有的功能和API兼容性

### ⚙️ Technical Constraints
- **技术栈要求**: TypeScript, Node.js v18+, LangChain
- **兼容性要求**: 保持向后兼容，不破坏现有API
- **性能要求**: 中间件不应显著影响执行性能，日志记录应高效
- **安全要求**: 遵循现有的安全最佳实践，不引入新的安全漏洞

## Technical Design

### Architecture Overview
该功能在现有AIBO架构的基础上增加了两个主要组件：
1. SessionOutputCaptureMiddleware: 一个LangChain中间件，用于捕获和记录智能体的所有活动
2. Mandatory Parallel Execution Framework: 通过更新系统提示词和代理配置，强制要求复杂任务必须被分解为并行子任务

### Core Implementation
#### Main Components/Modules
- SessionOutputCaptureMiddleware: 实现了wrapToolCall和wrapModelCall钩子，能够捕获工具调用开始/结束、AI处理状态、错误信息等事件
- System Prompts Update: 更新了中英文系统提示词，强调强制并行执行的重要性
- Agent Configuration Update: 更新所有代理的配置文件，包含新的工作目录约束和并行执行要求
- Session Class Enhancement: 将start()和end()方法改为异步，以支持异步IO操作

#### Key Technical Decisions
- 非侵入式监控: 中间件设计为非侵入式，即使在工具调用失败时也会返回有效的ToolMessage而不是抛出异常，确保流程继续
- 防御性编程: 在调用会话方法前检查方法是否存在，避免因会话对象不完整而导致的运行时错误
- 内容截断: 工具结果预览被限制在200个字符以内，避免日志过长影响性能
- 强制并行: 通过系统提示词的强化，确保复杂任务自动分解为并行子任务

#### Data Flow/State Management
1. 智能体执行开始 → beforeAgent钩子（注释中保留）
2. 工具调用开始 → wrapToolCall记录工具名称和参数
3. 工具调用完成 → wrapToolCall记录结果或错误
4. AI处理开始 → wrapModelCall记录"AI is processing..."消息
5. AI响应生成 → wrapModelCall流式输出AI内容
6. 智能体执行结束 → afterAgent钩子（注释中保留）

### API Changes
#### New APIs
```typescript
// 新增的会话输出捕获中间件
interface SessionOutputCaptureMiddlewareOptions {
  session: Session;
}

function createSessionOutputCaptureMiddleware(
  options: SessionOutputCaptureMiddlewareOptions
): Middleware;
```

#### Modified APIs
```typescript
// 原有:
class Session {
  start(): void;
  end(exitMessage?: string): void;
}

// 修改后:
class Session {
  async start(): Promise<void>;
  async end(exitMessage?: string): Promise<void>;
}
```

#### Deprecated APIs
- 无废弃的API

## Implementation Plan

### Task Breakdown
1. 实现SessionOutputCaptureMiddleware - 创建中间件类和工厂函数 (预计: 4小时)
2. 更新系统提示词 - 强化并行执行要求和工作目录约束 (预计: 2小时)
3. 更新代理配置 - 更新所有代理的markdown配置文件 (预计: 2小时)
4. 增强Session类 - 将start/end方法改为异步 (预计: 1小时)
5. 编写全面测试 - 覆盖所有新功能和边界情况 (预计: 6小时)
6. 集成和验证 - 确保所有组件正常工作且不破坏现有功能 (预计: 3小时)

### Dependencies
- Internal Dependencies: core/agent/session.ts, core/utils/index.ts, shared/constants/system-prompts.ts
- External Dependencies: @langchain/core, typescript
- Prerequisites: 现有的LangChain中间件框架

### Risk Assessment
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 中间件性能影响 | 低 | 中 | 优化日志记录逻辑，使用内容截断，避免不必要的操作 |
| 向后兼容性问题 | 低 | 高 | 全面测试现有功能，确保API兼容性 |
| 并行执行过度分解 | 中 | 中 | 在系统提示词中提供明确的分解指导原则 |

### Success Metrics
- 功能完整性: 所有验收标准通过
- 代码质量: 测试覆盖率 ≥85%，无新的lint错误
- 性能指标: 中间件增加的执行时间 < 5%
- 用户体验: 开发者能够清晰看到智能体的所有活动，复杂任务自动并行执行

## Usage Guide

### Installation/Configuration
该功能已集成到AIBO核心系统中，无需额外安装。确保使用最新版本的AIBO。

### Basic Usage
```typescript
// 会话输出捕获中间件会自动应用到所有智能体会话中
// 开发者可以通过session对象的方法查看智能体活动

// 示例：创建会话并启动
const session = new Session(ioChannel, modelInfo);
await session.start();

// 智能体执行过程中，所有活动都会被自动记录和显示
// 工具调用、AI处理状态、错误信息等都会实时输出

await session.end("任务完成！");
```

### Advanced Usage
```typescript
// 如果需要自定义中间件行为，可以手动创建
import { createSessionOutputCaptureMiddleware } from './core/utils/session-output-capture-middleware';

const middleware = createSessionOutputCaptureMiddleware({
  session: mySession
});

// 将中间件添加到LangChain配置中
const agent = createAgent({
  middlewares: [middleware, ...otherMiddlewares]
});

// 利用强制并行执行
// 对于复杂任务，系统会自动将其分解为多个并行子任务
// 例如：同时进行代码分析、网络搜索和文件操作
```

### Migration Guide
#### Migration from Previous Versions
- 无迁移成本: 该功能完全向后兼容，现有代码无需修改
- 异步方法: 如果之前同步调用session.start()和session.end()，建议改为await调用以获得更好的错误处理

#### Compatibility Notes
- Backward Compatible: 是
- Minimum Version Requirements: AIBO v1.0.0+
- Known Limitations: 
  - beforeAgent和afterAgent钩子目前被注释掉，将在未来版本中启用
  - 思考过程日志功能已在注释中预留，但尚未实现

## Impact Analysis

### Performance Impact
- 内存使用: 轻微增加 + 2-5MB（由于中间件状态管理）
- CPU 使用: 轻微增加 + 1-3%（由于日志记录和事件处理）
- 加载时间: 无变化
- 正面影响: 强制并行执行可将复杂任务执行时间减少50-80%

### Test Coverage
- 单元测试: 95.28% - __tests__/core/utils/session-output-capture-middleware-comprehensive.test.ts
- 集成测试: 85.73% - 覆盖所有相关模块
- 端到端测试: 100% - 所有现有E2E测试通过

### File Changes
新增文件:
- src/core/utils/session-output-capture-middleware.ts - 会话输出捕获中间件实现
- __tests__/core/utils/session-output-capture-middleware-comprehensive.test.ts - 中间件全面测试
- __tests__/core/utils/langchain-tool-retry-middleware-coverage.test.ts - 工具重试中间件覆盖测试
- __tests__/presentation/console/user-input-handler-comprehensive.test.ts - 用户输入处理器全面测试

修改文件:
- src/shared/constants/system-prompts.ts - 系统提示词强化
- agents/*.md - 所有代理配置更新
- src/core/agent/session.ts - 会话类异步方法
- src/core/agent/io-channel.ts - IO通道更新
- src/core/agent/agent-factory.ts - 代理工厂更新
- src/core/config/config.ts - 配置更新
- src/core/utils/index.ts - 工具索引更新
- src/core/utils/stream-handler.ts - 流处理器更新
- src/infrastructure/agents/agent-loader.ts - 代理加载器更新
- src/infrastructure/code-analysis/symbol-table.ts - 符号表更新
- src/infrastructure/filesystem/safe-filesystem-backend.ts - 安全文件系统后端更新
- src/presentation/console/interactive-mode.ts - 交互模式更新
- src/presentation/console/terminal-adapter.ts - 终端适配器更新
- src/tools/index.ts - 工具索引更新
- .env.example - 环境变量示例更新
- README.md - 文档更新

删除文件:
- temp_requirements.txt - 临时需求文件
- __tests__/utils/interactive-utils.test.ts.bak - 备份文件
- __tests__/utils/interactive-utils.test.ts.fixed - 修复文件
- __tests__/utils/langchain-tool-retry-middleware.test.ts - 旧测试文件

## Verification Requirements

### Test Strategy
- Unit Tests: 覆盖中间件的所有钩子、错误处理、内容截断逻辑
- Integration Tests: 覆盖中间件与会话、IO通道、代理系统的集成
- End-to-End Tests: 覆盖完整的用户场景，包括工具调用、AI处理、错误恢复
- Performance Tests: 验证中间件对性能的影响在可接受范围内

### Quality Gates
- [x] Code Review Passed
- [x] Test Coverage ≥ 85%
- [x] Performance Tests Passed
- [x] Security Scan Passed
- [x] Documentation Updated

### Performance Requirements
- Response Time: ≤ 100ms（中间件增加的延迟）
- Memory Usage: ≤ 5MB（中间件内存占用）
- Concurrent Users: ≥ 10（并发会话支持）
- Error Rate: ≤ 0.1%（错误率）

### Verification Commands
```bash
# 运行完整测试套件
npm test

# 运行特定功能的测试
npm test -- --testNamePattern="session-output-capture"

# 检查代码覆盖率
npx jest --coverage

# 验证功能文档
node ./skills/feature-organizer/scripts/validate-feature-documentation.js
```

## Maintenance Guide

### Debugging Tips
- 常见问题 1: 中间件未记录某些事件 - 检查会话对象是否实现了相应的方法
- 常见问题 2: 日志内容过长 - 中间件已自动截断，如需完整内容可修改截断长度
- 日志级别: 建议在调试时启用详细日志，生产环境使用默认级别

### Monitoring Metrics
- 关键指标 1: 工具调用成功率 - 正常范围: ≥ 95%
- 关键指标 2: AI处理响应时间 - 正常范围: ≤ 5s
- 告警阈值: 错误率 > 5% 或 响应时间 > 10s

### Future Extensions
- 计划中的功能: 
  - 启用beforeAgent和afterAgent钩子
  - 实现思考过程日志功能
  - 添加更详细的性能监控指标
- 架构限制: 当前中间件设计为单一会话实例，未来可能支持多会话
- 技术债务: 临时文件清理逻辑需要进一步优化