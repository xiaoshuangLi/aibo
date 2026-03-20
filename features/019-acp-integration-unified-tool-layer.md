# ACP 集成与本地 AI 编码代理统一工具层

## 📌 需求背景 (Requirements Background)

### 🔍 业务背景
随着本地 AI 编码代理工具的快速发展，团队需要统一的方式来管理和调用多个 AI 编码代理（如 Claude Code、Codex、Gemini、Cursor、GitHub Copilot 等）。原有的独立工具实现（如 `claude.ts`、`codex.ts`、`cursor.ts` 等）存在以下问题：

1. **重复代码**：每个代理工具都有类似的会话管理、错误处理逻辑
2. **缺乏统一协议**：不同代理之间的交互模式不一致，难以切换
3. **会话管理复杂**：缺少持久化会话和并行会话支持
4. **工具冗余**：基础工具（glob、grep、edit-file、write-file、todo）与 LSP 工具功能重叠

为了解决这些问题，决定引入 ACP (Agent Client Protocol) 协议，并重构工具层架构。

### 🎯 目标与价值
- **统一接口**：通过 ACP 协议提供一致的 AI 代理调用接口
- **简化架构**：移除冗余工具，减少维护成本
- **增强会话管理**：支持持久化会话、命名并行会话、会话暂停/恢复
- **提升用户体验**：提供更灵活的 AI 代理交互模式

### 📎 相关背景信息
- **需求来源**: 技术优化和架构简化
- **影响范围**: 所有使用 AI 编码代理的用户、工具层、Lark 和 Console 适配器
- **优先级**: 高 - 这是架构升级的关键步骤

---

## 📋 Specification (规格说明)

### 🎯 User Story
作为 AI 开发者，我想要通过统一的 ACP 协议调用多个本地 AI 编码代理，以便灵活选择最适合的工具并享受一致的交互体验。

### 📑 功能变更清单 (Functional Changes List)

#### 新增功能
- [ ] **ACP 工具层** (`src/tools/acp.ts`): 实现完整的 ACP 协议支持，包括 prompt、exec、sessions_new、sessions_list、sessions_close、cancel 六种模式
- [ ] **ACP 会话管理** (`src/shared/acp-session.ts`): 提供共享的会话状态管理，支持激活、暂停、恢复、清除会话
- [ ] **ACP 直传模式** (`src/presentation/lark/acp-passthrough.ts`): 实现 Lark 适配器的 ACP 直传模式，允许用户直接与 AI 代理对话
- [ ] **ACP 技能文档** (`skills/acpx/SKILL.md`): 提供完整的 ACP 使用指南和最佳实践
- [ ] **工具去重中间件** (`src/core/middlewares/filter-duplicate-tools.ts`): 在模型调用前过滤重复定义的工具
- [ ] **流内容处理测试** (`__tests__/core/utils/stream-content-processing.test.ts`): 新增流式内容处理的全面测试覆盖
- [ ] **文件系统重定向测试** (`__tests__/infrastructure/filesystem/safe-backend-redirect.test.ts`): 新增安全文件系统重定向测试
- [ ] **ACP 命令测试** (`__tests__/presentation/console/acp-command.test.ts`): Console 适配器的 ACP 命令测试
- [ ] **ACP 直传测试** (`__tests__/presentation/lark/acp-passthrough.test.ts`): Lark 适配器的 ACP 直传测试
- [ ] **ACP 连字符命令测试** (`__tests__/presentation/lark/acp-hyphenated-commands.test.ts`): 支持连字符命令格式的测试
- [ ] **交互式 ACP 测试** (`__tests__/presentation/lark/interactive-acp.test.ts`): 交互式 ACP 会话测试
- [ ] **ACP 执行测试** (`__tests__/tools/acp.test.ts`, `__tests__/tools/acp-execution.test.ts`): ACP 工具功能测试

#### 修改功能
- [ ] **工具索引重构** (`src/tools/index.ts`): 移除 glob、grep、edit-file、write-file、todo 工具，添加 ACP 工具
- [ ] **流工具增强** (`src/core/utils/stream.ts`): 增加流式内容处理功能，支持更复杂的流操作
- [ ] **会话捕获中间件** (`src/core/middlewares/session-capture.ts`): 增强会话捕获功能
- [ ] **Lark 适配器** (`src/presentation/lark/adapter.ts`): 支持 ACP 会话管理和直传模式
- [ ] **Lark 命令器** (`src/presentation/lark/commander.ts`): 添加 ACP 相关命令处理
- [ ] **Lark 交互器** (`src/presentation/lark/interactive.ts`): 支持 ACP 会话交互
- [ ] **Lark 结果格式化器** (`src/presentation/lark/result-formatter.ts`): 增强结果格式化以支持 ACP
- [ ] **Lark 调用格式化器** (`src/presentation/lark/call-formatter.ts`): 优化调用格式化逻辑
- [ ] **Console 适配器** (`src/presentation/console/adapter.ts`): 支持 ACP 会话
- [ ] **Console 命令器** (`src/presentation/console/commander.ts`): 添加 ACP 命令
- [ ] **Console 交互器** (`src/presentation/console/interactive.ts`): 支持 ACP 交互
- [ ] **Agent 工厂** (`src/core/agent/factory.ts`): 增强中间件支持
- [ ] **Agent 模型** (`src/core/agent/model.ts`): 优化模型配置
- [ ] **Agent 会话** (`src/core/agent/session.ts`): 增强会话管理
- [ ] **Agent 适配器** (`src/core/agent/adapter.ts`): 支持中间件链
- [ ] **配置管理** (`src/core/config/index.ts`): 更新配置选项
- [ ] **系统提示** (`src/core/utils/system-prompt.ts`): 优化系统提示
- [ ] **CLI 工具工厂** (`src/shared/utils/cli-tool-factory.ts`): 更新工具工厂以支持 ACP
- [ ] **现有 AI 工具** (`src/tools/claude.ts`, `src/tools/codex.ts`, `src/tools/gemini.ts`, `src/tools/cursor.ts`, `src/tools/copilot.ts`): 添加与 ACP 的兼容性支持
- [ ] **包配置** (`package.json`): 更新依赖和脚本
- [ ] **核心功能文档** (`features/001-core-features.md`): 修正 baseUrl 拼写错误

#### 删除/废弃功能
- [ ] **glob 工具** (`src/tools/glob.ts`): 功能与 LSP 工具重叠，已移除
- [ ] **grep 工具** (`src/tools/grep.ts`): 功能与 LSP 工具重叠，已移除
- [ ] **edit-file 工具** (`src/tools/edit-file.ts`): 功能与 LSP 工具和 AI 代理重叠，已移除
- [ ] **write-file 工具** (`src/tools/write-file.ts`): 功能与 AI 代理重叠，已移除
- [ ] **todo 工具** (`src/tools/todo.ts`): 功能与 write-subagent-todos 重叠，已移除
- [ ] **相关测试文件**: 删除已移除工具的测试文件

### ✅ Acceptance Criteria
- [ ] 所有 2171 个测试通过，测试覆盖率≥93%
- [ ] ACP 工具支持所有 6 种模式（prompt、exec、sessions_new、sessions_list、sessions_close、cancel）
- [ ] 支持至少 13 种 ACP 兼容的 AI 编码代理
- [ ] 会话管理功能完整（激活、暂停、恢复、清除）
- [ ] Lark 和 Console 适配器都支持 ACP 直传模式
- [ ] 移除 5 个冗余工具后系统功能正常
- [ ] 文档完整且使用中文书写

### ⚙️ Technical Constraints
- **技术栈要求**: TypeScript、Node.js、ACP 协议
- **兼容性要求**: 支持所有现有 AI 编码代理 CLI 工具
- **性能要求**: 会话创建时间<1 秒，消息响应时间<100ms
- **安全要求**: 会话状态隔离，防止跨会话数据泄露

---

## 🏗️ Technical Design (技术设计)

### 📐 Architecture Overview
```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Lark Adapter   │  │     Console Adapter         │  │
│  │  + ACP Support  │  │     + ACP Support           │  │
│  └────────┬────────┘  └──────────────┬──────────────┘  │
└───────────┼──────────────────────────┼─────────────────┘
            │                          │
┌───────────┴──────────────────────────┴─────────────────┐
│                   Shared Layer                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         ACP Session State Management             │  │
│  │  - getAcpSessionState / setAcpSessionState       │  │
│  │  - pauseAcpSessionState / resumeAcpSessionState  │  │
│  │  - KNOWN_ACP_AGENTS / getAcpAgentDisplayName     │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────┐
│                    Tools Layer                           │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   ACP Tool      │  │   Other AI Agent Tools      │  │
│  │  - prompt       │  │   - Claude / Codex / ...    │  │
│  │  - exec         │  │   (with ACP compatibility)  │  │
│  │  - sessions_*   │  │                             │  │
│  │  - cancel       │  │                             │  │
│  └─────────────────┘  └─────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────┐
│                 Core Layer                               │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Middlewares    │  │      Agent Factory          │  │
│  │  - Filter Dup   │  │      + Middleware Chain     │  │
│  │  - Session Cap  │  │                             │  │
│  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### ⚙️ Core Implementation

#### Main Components/Modules
- **ACP 工具模块** (`src/tools/acp.ts`): 实现 ACP 协议的核心工具，支持 6 种操作模式和 13+ 种 AI 代理
- **ACP 会话管理** (`src/shared/acp-session.ts`): 共享会话状态管理，避免循环依赖
- **工具去重中间件** (`src/core/middlewares/filter-duplicate-tools.ts`): 确保传给 LLM 的工具集唯一
- **会话捕获中间件** (`src/core/middlewares/session-capture.ts`): 捕获会话信息用于监控和调试
- **Lark/Console 适配器**: 两个展示层适配器都支持 ACP 会话管理

#### Key Technical Decisions
- **决策 1**: 选择 ACP 协议作为统一接口，因为它是本地 AI 编码代理的新兴标准，被多个主流工具支持
- **决策 2**: 将会话状态放在 `src/shared/` 而非 `src/presentation/`，避免 tools 层和 presentation 层之间的循环依赖
- **决策 3**: 移除冗余工具（glob、grep、edit-file、write-file、todo），因为 LSP 工具和 AI 代理已经提供这些功能
- **决策 4**: 使用中间件模式（FilterDuplicateTools、SessionCapture）而非硬编码，提高可扩展性

#### Data Flow/State Management
1. **会话创建**: 用户调用 ACP 工具 → 创建 acpx 会话 → 保存状态到 `AcpSessionState`
2. **直传模式**: 用户发送消息 → 检查 `getAcpSessionState()` → 转发到 acpx → 返回结果
3. **会话暂停**: 用户请求暂停 → `pauseAcpSessionState()` → 保存状态到 `_pausedState`
4. **会话恢复**: 用户请求恢复 → `resumeAcpSessionState()` → 从 `_pausedState` 恢复到 `_state`

### 🧩 API Changes

#### New APIs

**ACP 工具接口**:
```typescript
interface AcpToolInput {
  agent: string;  // AI 代理名称
  prompt?: string;  // 任务提示
  mode?: 'prompt' | 'exec' | 'sessions_new' | 'sessions_list' | 'sessions_close' | 'cancel';
  session_name?: string;  // 命名会话
  cwd?: string;  // 工作目录
  approve?: 'approve-all' | 'approve-reads' | 'deny-all';
  timeout?: number;  // 超时时间 (ms)
  args?: string[];  // 额外 CLI 参数
  start_passthrough?: boolean;  // 是否启动直传模式
}
```

**ACP 会话管理 API**:
```typescript
// 获取会话状态
function getAcpSessionState(): AcpSessionState | null;

// 设置会话状态
function setAcpSessionState(state: AcpSessionState | null): void;

// 清除会话状态
function clearAcpSessionState(): void;

// 暂停会话
function pauseAcpSessionState(): AcpSessionState | null;

// 恢复会话
function resumeAcpSessionState(): AcpSessionState | null;

// 获取 AI 代理显示名称
function getAcpAgentDisplayName(agent: string): string;
```

#### Modified APIs
- **工具工厂函数**: `getTools()` 现在返回 ACP 工具而非独立的 glob/grep/edit-file/write-file/todo 工具
- **中间件链**: Agent Factory 现在支持中间件链，包括 FilterDuplicateTools 和 SessionCapture

#### Deprecated APIs
- **glob 工具**: 使用 LSP 工具的 `get_workspace_symbols` 或系统命令替代
- **grep 工具**: 使用 LSP 工具的引用搜索或系统命令替代
- **edit-file/write-file 工具**: 使用 AI 代理或 LSP 工具替代
- **todo 工具**: 使用 `write-subagent-todos` 工具替代

---

## 📝 Implementation Plan (实施计划)

### 📋 Task Breakdown
1. **ACP 协议实现** - 实现完整的 ACP 协议支持，包括 6 种操作模式 (预计：8 小时)
2. **会话管理系统** - 开发共享会话状态管理，支持暂停/恢复 (预计：4 小时)
3. **工具层重构** - 移除冗余工具，添加 ACP 工具 (预计：6 小时)
4. **中间件开发** - 实现工具去重和会话捕获中间件 (预计：3 小时)
5. **适配器更新** - 更新 Lark 和 Console 适配器以支持 ACP (预计：8 小时)
6. **测试覆盖** - 编写全面的测试用例，确保覆盖率≥93% (预计：10 小时)
7. **文档编写** - 编写 ACP 技能文档和功能文档 (预计：4 小时)
8. **集成验证** - 验证所有 AI 代理的兼容性 (预计：3 小时)

**总预计工作量**: 46 小时

---

## 📖 Usage Guide (使用指南)

### ACP 工具基本用法

**1. 单次执行（不保存会话）**:
```typescript
{
  "agent": "codex",
  "prompt": "总结这个仓库的目的，限 3 行",
  "mode": "exec"
}
```

**2. 持久会话 - 多轮对话**:
```typescript
// 第 1 轮 - 创建会话
{ "agent": "codex", "mode": "sessions_new" }

// 第 2 轮 - 发送提示
{ "agent": "codex", "prompt": "找出 flaky 测试并描述根本原因" }

// 第 3 轮 - 跟进
{ "agent": "codex", "prompt": "应用最小修复并运行测试" }
```

**3. 命名并行会话**:
```typescript
// 后端工作流
{ "agent": "codex", "session_name": "backend", "prompt": "实现 token 分页" }

// 前端工作流（并行运行）
{ "agent": "gemini", "session_name": "frontend", "prompt": "添加无限滚动组件" }
```

**4. 取消进行中的提示**:
```typescript
{ "agent": "codex", "mode": "cancel" }
```

**5. 列出会话**:
```typescript
{ "agent": "codex", "mode": "sessions_list" }
```

**6. 关闭会话**:
```typescript
{ "agent": "codex", "mode": "sessions_close" }
```

### 支持的 AI 代理

| `agent` 值 | 底层工具 |
|-----------|---------|
| `codex` | OpenAI Codex CLI |
| `claude` | Claude Code CLI |
| `gemini` | Gemini CLI (`gemini --acp`) |
| `cursor` | Cursor agent (`cursor-agent acp`) |
| `copilot` | GitHub Copilot (`copilot --acp --stdio`) |
| `pi` | Pi Coding Agent |
| `openclaw` | OpenClaw ACP bridge |
| `kimi` | Kimi Coding Agent |
| `opencode` | OpenCode CLI |
| `kiro` | Kiro Agent |
| `kilocode` | KiloCode Agent |
| `qwen` | Qwen Coding Agent |
| `droid` | Droid Agent |

---

## 📊 Impact Analysis (影响分析)

### 文件变更统计
- **新增文件**: 15 个（包括测试文件、ACP 工具、会话管理、技能文档）
- **修改文件**: 52 个（适配器、工具、中间件、配置）
- **删除文件**: 11 个（冗余工具及其测试）
- **总变更**: +6306 行，-1965 行

### 影响的用户群体
- **AI 开发者**: 获得统一的 ACP 接口，可以灵活切换 AI 代理
- **Lark 用户**: 支持 ACP 直传模式，可以直接与 AI 代理对话
- **Console 用户**: 支持 ACP 会话管理，可以在命令行中使用 ACP

### 迁移指南
**从旧工具迁移到新架构**:
1. **glob 工具用户**: 改用 LSP 工具的 `get_workspace_symbols` 或系统 `find` 命令
2. **grep 工具用户**: 改用 LSP 工具的引用搜索或系统 `grep` 命令
3. **edit-file/write-file 工具用户**: 改用 AI 代理（如 `copilot_execute`）或 LSP 工具
4. **todo 工具用户**: 改用 `write-subagent-todos` 工具

---

## ✅ Quality Gates

- **✅ 所有测试通过**: 2171 个测试全部通过
- **✅ 覆盖率≥93%**: 实际覆盖率 93.54%
- **✅ 功能文档完整**: 所有模板章节已填写
- **✅ 无遗漏变更**: 78 个文件变更全部记录
- **✅ 工作量记录**: 预计 46 小时开发时间
- **✅ 中文文档**: 所有功能文档使用中文书写
- **✅ README 已更新**: 反映新的 ACP 功能和配置
- **✅ 编号连续**: 使用 features/019 编号

---

## 📝 Notes (备注)

### 技术亮点
1. **统一协议**: 通过 ACP 协议统一了 13+ 种 AI 编码代理的调用接口
2. **会话管理**: 实现了完整的会话生命周期管理（创建、暂停、恢复、关闭）
3. **架构优化**: 移除冗余工具，减少代码重复和维护成本
4. **中间件模式**: 使用中间件链提高可扩展性和灵活性

### 未来改进方向
1. **更多 AI 代理**: 持续添加新的 ACP 兼容代理支持
2. **会话持久化**: 支持会话状态的持久化存储
3. **性能优化**: 优化会话创建和消息传递性能
4. **监控增强**: 增加会话监控和指标收集功能

---

**功能编号**: 019  
**创建日期**: 2026-03-20  
**作者**: AIBO Team  
**状态**: ✅ 已完成
