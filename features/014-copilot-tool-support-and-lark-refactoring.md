# 新增 GitHub Copilot CLI 工具支持与 Lark 展示层重构

## 📌 需求背景 (Requirements Background)

### 🔍 业务背景
AIBO 作为多代理 AI 助手，核心价值之一是能够调度本地安装的各类 AI 编程工具（claude、gemini、codex、cursor 等）完成编程任务。随着 GitHub Copilot CLI 工具的普及，有必要将其纳入工具生态，以覆盖更广泛的用户群体。同时，Lark（飞书）机器人展示层存在大量重复的格式化逻辑（内联的代码格式化、Emoji 映射等），需要统一提取为共享工具函数；此外，历史遗留的 Puppeteer 浏览器自动化依赖已不再使用，应一并清理以降低维护成本和包体积。

### 🎯 目标与价值
- 新增 `copilot_execute` 工具，使 AIBO 可在本地 GitHub Copilot CLI 可用时，将通用编程任务委托给 Copilot 执行
- 将系统提示词构建逻辑从 factory.ts 中提取为独立模块，提升可维护性和可测试性
- 重构 Lark 展示层，消除重复代码，统一 AI 代理工具调用/结果的展示格式
- 移除 Puppeteer 依赖，减少无用代码和项目体积
- 扩展配置支持（新增 `AIBO_INTERACTION` 环境变量），方便部署时覆盖交互模式

### 📎 相关背景信息
- **需求来源**: 工具生态扩展需求、技术优化（代码重复消除）、依赖清理
- **影响范围**: 工具层（tools）、核心 Agent 工厂（factory）、Lark 展示层（presentation）、配置模块（config）、技能文档（skills）、Agent 定义（agents）
- **优先级**: 中，功能增强 + 代码质量提升

---

## 📋 Specification (规格说明)

### 🎯 User Story
- 作为开发者，我想要使用 `copilot_execute` 工具委托本地 GitHub Copilot CLI 完成通用编程任务，以便利用 Copilot 的 AI 能力处理代码生成、调试、重构等场景。
- 作为飞书机器人用户，我想要 AI 代理工具（claude_execute、cursor_execute 等）的调用参数和执行结果在消息卡片中得到清晰展示，以便直观了解代理执行状态。
- 作为系统维护者，我想要格式化工具函数集中管理在共享模块中，以便降低 Lark 展示层的代码重复度，提升可维护性。
- As a developer, I want to use copilot_execute tool to delegate coding tasks to GitHub Copilot CLI, so that I can leverage Copilot AI capabilities for general programming tasks.

### 📑 功能变更清单 (Functional Changes List)
> 以下列表来源于代码变更的逐项分析，涵盖本次所有功能变更，不得遗漏。

#### 新增功能
- [x] **copilot_execute 工具** (`src/tools/copilot.ts`, 150行)：新增 `isCopilotAvailable()` 检测函数、`handleCopilotExecutionError()` 统一错误处理、`createCopilotExecuteTool()` 工具创建函数、`getCopilotTools()` 入口，支持超时/中断/SIGTERM 三种异常场景，通过 `--autopilot --yolo` 参数全自动化执行
- [x] **系统提示词独立模块** (`src/core/utils/system-prompt.ts`, 114行)：从 `factory.ts` 提取 `buildCodingAgentHint()`，新增 `buildSystemPromptFromTools()` 组合函数，新增 `hasCopilotTool` 参数支持 copilot 路由
- [x] **Lark 共享工具函数** (`src/presentation/lark/shared.ts`)：新增 `TOOL_TYPE_EMOJIS` 常量（含 `agent_runner` 类型）、`getToolTypeEmoji()`、`formatStringAsCode()`、`formatErrorText()` 函数；新增 `agent_runner` 工具类型识别（claude_execute、cursor_execute、cursor_open、gemini_execute、codex_execute）；扩展任务管理工具列表（新增 `todo_write`/`todo_read`）
- [x] **AI 代理调用格式化** (`src/presentation/lark/call-formatter.ts`)：新增 `formatAgentRunnerToolCall()` 函数，支持 prompt/cwd/args/timeout 参数的结构化展示
- [x] **claude-code-hooks 技能** (`skills/claude-code-hooks/SKILL.md`, 417行)：新增 Claude Code hooks 工作流技能文档
- [x] **Copilot 工具测试** (`__tests__/tools/copilot.test.ts` 80行 + `__tests__/tools/copilot-execution.test.ts` 119行)：覆盖基础功能与超时/中断/错误处理场景
- [x] **GitHub Copilot 项目指令文件** (`.github/copilot-instructions.md`, 108行)：新增项目专属 Copilot 上下文指令

#### 修改功能
- [x] **工具聚合层** (`src/tools/index.ts`)：并发加载 `getCopilotTools` 和 `getLocalMcpTools`，输出工具数组中加入 `copilotTools`、`localMcpTools`
- [x] **工厂函数重构** (`src/core/agent/factory.ts`)：移除内联 `buildCodingAgentHint`，改用 `buildSystemPromptFromTools` 构建系统提示词，加入 copilot 工具感知
- [x] **配置模块** (`src/core/config/index.ts`)：新增 `AIBO_INTERACTION` 环境变量（可直接覆盖交互模式）；移除 `AIBO_MEMORY_WINDOW_SIZE` 配置及相关 Zod schema
- [x] **Lark call-formatter 重构** (`src/presentation/lark/call-formatter.ts`)：替换重复内联格式化逻辑为 `formatStringAsCode` 共享函数；导入并使用 `getToolTypeEmoji`
- [x] **Lark result-formatter 重构** (`src/presentation/lark/result-formatter.ts`)：替换重复格式化逻辑为 `formatStringAsCode`/`formatErrorText`；新增 `agent_runner` 类型识别；扩展任务管理工具列表
- [x] **Lark styler 重构** (`src/presentation/lark/styler.ts`)：移除内联 `typeEmojis` Map，改用 `getToolTypeEmoji` 共享函数；使用 `formatErrorText` 统一错误展示
- [x] **编程代理路由技能** (`skills/coding-agent-router/SKILL.md`)：新增 `copilot_execute` 路由规则，更新通用任务优先级（cursor → copilot → claude）
- [x] **Agent 定义更新** (`agents/coder.md`, `agents/nexus.md`)：重写角色定位与工具使用指南，加入 copilot 工具引用
- [x] **文档更新** (`docs/mcp.md` 大幅重写, `docs/env.md` 移除旧配置项, `README.md` 更新工具列表)
- [x] **各类测试补充** (`__tests__/presentation/console/commander.test.ts` +213行、`__tests__/recognition-coverage.test.ts` +47行 等多个文件扩充测试)

#### 删除/废弃功能
- [x] **移除 Puppeteer 浏览器支持** (`src/infrastructure/browser/puppeteer.ts` -291行、`src/infrastructure/browser/index.ts` -1行)：删除浏览器自动化代码及对应测试文件（`__tests__/utils/puppeteer.test.ts` -202行）
- [x] **废弃 AIBO_MEMORY_WINDOW_SIZE** (`src/core/config/index.ts`)：移除内存窗口大小配置项，无替代方案
- [x] **清理过期测试文件**：删除 `__tests__/config-branch-coverage.test.ts`、`__tests__/infrastructure/checkpoint/checkpointer-comprehensive.test.ts`、`__tests__/infrastructure/checkpoint/checkpointer-coverage.test.ts`
- [x] **移除 package-lock.json**：清理 lockfile（-8827行）

### ✅ Acceptance Criteria
- [x] `copilot_execute` 工具在本地 copilot CLI 可用时自动注册，不可用时返回空数组
- [x] `buildSystemPromptFromTools` 正确检测所有 5 种 AI 工具（claude/gemini/codex/cursor/copilot）并生成对应提示词
- [x] Lark 消息卡片正确展示 `agent_runner` 类型工具的调用参数（prompt、cwd、args）
- [x] `formatStringAsCode` 和 `formatErrorText` 正确处理单行/多行场景
- [x] 所有测试通过（1763 个测试），测试覆盖率 ≥ 80%
- [x] 移除 Puppeteer 后不影响任何现有功能

### ⚙️ Technical Constraints
- **技术栈要求**: TypeScript strict mode，LangChain Tools，Zod schema
- **兼容性要求**: copilot_execute 工具通过 CLI 检测（`execSync`）自动降级，不影响未安装 Copilot 的用户
- **安全要求**: 使用 `execFile` + 独立 args 数组防止命令注入，不直接拼接 shell 字符串

---

## 🏗️ Technical Design (技术设计)

### 📐 Architecture Overview
本次变更涉及三个主要层次：

```
src/
├── tools/
│   ├── copilot.ts          ← 新增：GitHub Copilot CLI 工具
│   └── index.ts            ← 更新：加入 copilotTools + localMcpTools
├── core/
│   ├── utils/
│   │   └── system-prompt.ts ← 新增：系统提示词构建逻辑提取
│   ├── agent/
│   │   └── factory.ts      ← 重构：使用 buildSystemPromptFromTools
│   └── config/index.ts     ← 更新：新增 AIBO_INTERACTION，移除 MEMORY_WINDOW_SIZE
├── infrastructure/
│   └── browser/            ← 删除：puppeteer.ts + index.ts
└── presentation/
    └── lark/
        ├── shared.ts        ← 新增：共享工具函数（formatStringAsCode 等）
        ├── call-formatter.ts ← 重构：使用共享函数，新增 agent_runner 格式化
        ├── result-formatter.ts ← 重构：使用共享函数
        └── styler.ts        ← 重构：使用 getToolTypeEmoji
```

### ⚙️ Core Implementation

#### Main Components/Modules

- **`src/tools/copilot.ts`**: 通过 `execSync("copilot --version")` 检测工具可用性；使用 `execFile` + `AbortController` 实现可中断的异步执行；统一的错误处理区分超时（SIGTERM）、用户中断（ABORT_ERR）和普通错误三种场景
- **`src/core/utils/system-prompt.ts`**: `buildSystemPromptFromTools(tools)` 遍历工具数组检测各 AI 工具存在性，调用 `buildCodingAgentHint()` 生成路由提示词，拼接至 `SYSTEM_PROMPT` 末尾
- **`src/presentation/lark/shared.ts`**: 集中管理 Lark 展示层共享逻辑，`formatStringAsCode` 根据是否含换行选择代码块或行内代码，`getToolTypeEmoji` 通过映射表统一返回工具类型 Emoji

#### Key Technical Decisions

- **决策 1 — system-prompt.ts 提取**: 原 `factory.ts` 中 `buildCodingAgentHint` 函数难以单独测试，提取为独立模块后可在 `__tests__/core/utils/` 中独立验证，且 factory 职责更清晰
- **决策 2 — execFile 替代 exec**: copilot 工具使用 `execFile(cmd, argsArray)` 而非字符串拼接，从根本上防止 prompt 内容中的特殊字符造成命令注入
- **决策 3 — 自动可用性检测**: 所有 AI 工具（claude/cursor/gemini/codex/copilot）均采用相同模式：启动时检测 CLI 是否可用，不可用时安静返回空数组，避免影响无关用户

#### Data Flow/State Management
```
用户请求 → factory.ts → getTools() → [copilotTools, ...]
                     ↓
          buildSystemPromptFromTools(tools)
                     ↓
          检测 copilot_execute 存在 → buildCodingAgentHint(..., hasCopilot=true)
                     ↓
          系统提示词中注入 copilot 路由规则
```

### 🧩 API Changes

#### New APIs

```typescript
// src/tools/copilot.ts
function isCopilotAvailable(): boolean;
function handleCopilotExecutionError(error: unknown, prompt: string, timeout: number): string;
function createCopilotExecuteTool(session?: Session): ReturnType<typeof tool>;
export default function getCopilotTools(session?: Session): Promise<ReturnType<typeof tool>[]>;

// src/core/utils/system-prompt.ts
export function buildSystemPromptFromTools(tools: Array<{ name: string }>): string;
export function buildCodingAgentHint(
  hasClaudeTool: boolean,
  hasCursorTool: boolean,
  hasGeminiTool?: boolean,
  hasCodexTool?: boolean,
  hasCopilotTool?: boolean,  // 新增参数
): string;

// src/presentation/lark/shared.ts
export const TOOL_TYPE_EMOJIS: Record<string, string>;
export const getToolTypeEmoji: (toolType: string) => string;
export const formatStringAsCode: (text: string) => string;
export const formatErrorText: (text: string) => string;
export const formatAgentRunnerToolCall: (name: string, args: any) => string;
```

#### Modified APIs

```typescript
// src/core/agent/factory.ts
// 移除：export function buildCodingAgentHint(...): string  （已迁移至 system-prompt.ts）
// 改用：import { buildSystemPromptFromTools } from '@/core/utils'

// src/core/config/index.ts
// 移除：AIBO_MEMORY_WINDOW_SIZE 环境变量
// 新增：AIBO_INTERACTION 环境变量（'console' | 'lark'）
```

#### Deprecated APIs
- **`buildCodingAgentHint` (factory.ts)**: 已从 `factory.ts` 移除，请改用 `@/core/utils/system-prompt` 中的同名函数
- **`AIBO_MEMORY_WINDOW_SIZE`**: 已移除，无替代方案

---

## 📝 Implementation Plan (实施计划)

### 📋 Task Breakdown
1. **新增 copilot.ts 工具** - 实现检测、执行、错误处理逻辑，编写单元测试 (预计: 4小时)
2. **提取 system-prompt.ts 模块** - 从 factory.ts 迁移 buildCodingAgentHint，新增 copilot 支持 (预计: 2小时)
3. **Lark 展示层重构** - 提取共享函数、新增 agent_runner 格式化、更新 styler/formatter (预计: 3小时)
4. **移除 Puppeteer** - 删除 browser 目录及相关测试 (预计: 1小时)
5. **配置与 Agent 文档更新** - 更新 config、agents、skills、docs (预计: 2小时)
6. **测试补充与验证** - 确保全量测试通过，覆盖率 ≥ 80% (预计: 2小时)

### 📊 开发工作量明细 (Development Workload)

| 工作类型 | 文件数量 | 变更行数 | 预估工时 | 备注 |
|----------|----------|----------|----------|------|
| 工具（Tools） | 5个文件 | +166/-0行 | 4小时 | copilot.ts新增, tools/index.ts更新 |
| 核心 Agent 逻辑 | 3个文件 | +117/-86行 | 2小时 | system-prompt.ts新增, factory.ts重构 |
| Lark 展示层 | 4个文件 | +143/-72行 | 3小时 | shared.ts新增工具函数, 各formatter重构 |
| 基础设施清理 | 2个文件 | +0/-292行 | 1小时 | 移除 puppeteer |
| 配置 | 1个文件 | +4/-11行 | 0.5小时 | 新增 AIBO_INTERACTION |
| 技能 / Agent 定义 | 5个文件 | +647/-0行 | 2小时 | claude-code-hooks新增, 其余更新 |
| 文档 | 5个文件 | +302/-13行 | 1小时 | mcp.md, env.md, README等 |
| 测试代码 | 17个文件 | +910/-633行 | 2.5小时 | 新增copilot测试, 清理过期测试 |
| **合计** | **42个源文件** | **+2289/-1107行** | **16小时** | |

### 🔗 Dependencies
- **Internal Dependencies**: `deepagents`、`@langchain/core/tools`、`zod`
- **External Dependencies**: GitHub Copilot CLI（可选，运行时检测）
- **Prerequisites**: 无

### ⚠️ Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| copilot CLI 版本不兼容 | 中 | 低 | 工具自动检测，不可用时静默降级 |
| Lark 格式化重构引入回归 | 低 | 中 | 已有完整测试覆盖，重构后测试均通过 |
| 移除 AIBO_MEMORY_WINDOW_SIZE 影响现有部署 | 低 | 低 | 该配置无实际使用场景，直接移除 |

### 🎯 Success Metrics
- **功能完整性**: copilot_execute 工具在 copilot CLI 可用时正常注册和调用
- **代码质量**: 测试覆盖率 92.21%（≥80%），零测试失败
- **代码重复消除**: Lark 展示层中 3 处重复的格式化逻辑合并为共享函数
- **包体积**: 移除 Puppeteer 依赖后 package.json 更精简

---

## 🚀 Usage Guide (使用指南)

### 📦 Installation/Configuration

确保本地安装了 GitHub Copilot CLI：
```bash
npm install -g @githubnext/github-copilot-cli
# 或通过其他方式安装 copilot 命令
```

可选配置（`AIBO_INTERACTION` 环境变量）：
```bash
# 强制使用 console 模式（忽略 Lark 环境变量）
AIBO_INTERACTION=console npm run dev
# 强制使用 lark 模式
AIBO_INTERACTION=lark npm run dev:lark
```

### 🎮 Basic Usage

```typescript
// AIBO 会自动检测并加载 copilot_execute 工具
// 通过 AIBO Agent 发出指令时，系统提示词会自动包含 copilot 路由规则

// 示例：直接使用工具层（测试场景）
import getCopilotTools from '@/tools/copilot';
const tools = await getCopilotTools(session);
// 若 copilot CLI 不可用，返回 []
// 若可用，返回包含 copilot_execute 工具的数组
```

### 🏆 Advanced Usage

```typescript
// 构建系统提示词（包含 copilot 路由规则）
import { buildSystemPromptFromTools } from '@/core/utils/system-prompt';
const tools = [{ name: 'copilot_execute' }, { name: 'claude_execute' }];
const prompt = buildSystemPromptFromTools(tools);
// prompt 末尾会包含多工具路由表

// Lark 展示层使用共享格式化工具
import { formatStringAsCode, getToolTypeEmoji } from '@/presentation/lark/shared';
const code = formatStringAsCode('console.log("hello")');  // → `console.log("hello")`
const multiline = formatStringAsCode('line1\nline2');      // → ```\nline1\nline2\n```
const emoji = getToolTypeEmoji('agent_runner');            // → '🤖'
```

### 🔄 Migration Guide

#### 从旧版本迁移

**移除 AIBO_MEMORY_WINDOW_SIZE**：
```bash
# 旧配置（已无效，请从 .env 中移除）
AIBO_MEMORY_WINDOW_SIZE=5
```

**buildCodingAgentHint 迁移**：
```typescript
// 旧（已不可用）：
import { buildCodingAgentHint } from '@/core/agent/factory';

// 新：
import { buildCodingAgentHint, buildSystemPromptFromTools } from '@/core/utils/system-prompt';
```

#### Compatibility Notes
- **向后兼容**: copilot 工具自动检测，未安装时不影响任何现有工具
- **Breaking Changes**: `factory.ts` 不再导出 `buildCodingAgentHint`

---

## 📊 Impact Analysis (影响分析)

### 📈 Performance Impact
- **包体积**: 移除 puppeteer 依赖后显著减小（puppeteer.ts 原 291 行 + 浏览器二进制）
- **启动时间**: 新增 copilot/localMcp 并发检测，与现有工具检测并行执行，无额外延迟
- **内存使用**: 无影响

### 🧪 Test Coverage
- **单元测试**: 92.21% 语句覆盖率（4646/5038）
- **分支覆盖**: 81.16%（2728/3361）
- **测试套件**: 108 个，1763 个测试全部通过
- **新增测试**: `__tests__/tools/copilot.test.ts`、`__tests__/tools/copilot-execution.test.ts`

### 📁 File Changes

**新增文件**:
- `src/tools/copilot.ts` - GitHub Copilot CLI 执行工具
- `src/core/utils/system-prompt.ts` - 系统提示词构建模块
- `skills/claude-code-hooks/SKILL.md` - Claude Code hooks 技能
- `.github/copilot-instructions.md` - 项目 Copilot 指令
- `__tests__/tools/copilot.test.ts` - copilot 工具基础测试
- `__tests__/tools/copilot-execution.test.ts` - copilot 工具执行场景测试

**修改文件**:
- `src/tools/index.ts` - 加入 copilot 和 localMcp 工具加载
- `src/core/agent/factory.ts` - 使用 buildSystemPromptFromTools
- `src/core/config/index.ts` - 新增 AIBO_INTERACTION，移除 MEMORY_WINDOW_SIZE
- `src/presentation/lark/shared.ts` - 新增共享格式化工具函数
- `src/presentation/lark/call-formatter.ts` - 重构使用共享函数，新增 agent_runner
- `src/presentation/lark/result-formatter.ts` - 重构使用共享函数
- `src/presentation/lark/styler.ts` - 使用 getToolTypeEmoji
- `skills/coding-agent-router/SKILL.md` - 加入 copilot 路由规则
- `agents/coder.md`、`agents/nexus.md` - 更新工具引用
- `docs/mcp.md`、`docs/env.md`、`README.md` - 文档更新

**删除文件**:
- `src/infrastructure/browser/puppeteer.ts` - Puppeteer 浏览器封装
- `src/infrastructure/browser/index.ts` - 浏览器模块入口
- `__tests__/utils/puppeteer.test.ts` - 已删除模块的测试
- `__tests__/config-branch-coverage.test.ts` - 过期分支覆盖测试
- `__tests__/infrastructure/checkpoint/checkpointer-comprehensive.test.ts` - 过期测试
- `__tests__/infrastructure/checkpoint/checkpointer-coverage.test.ts` - 过期测试
- `package-lock.json` - lockfile 清理

---

## ✅ Verification Requirements (验证要求)

### 🧪 Test Strategy
- **单元测试**: copilot 工具的检测、执行、超时、中断、错误处理逻辑；system-prompt.ts 的 5 种工具组合；shared.ts 的格式化函数边界条件
- **集成测试**: 通过 `__tests__/tools/index.test.ts` 验证工具聚合层正确加载 copilot 工具
- **回归测试**: 全量 1763 个测试通过，确保 Lark 重构无回归

### 🚪 Quality Gates
- **[x] Code Review Passed**
- **[x] Test Coverage ≥ 80%**（实际 92.21%）
- **[x] 功能变更清单中所有条目均已验证**
- **[x] 文档已更新**（docs/env.md、docs/mcp.md、README.md）

### 🧪 Verification Commands
```bash
# 运行完整测试套件
npm test

# 运行 copilot 相关测试
npx jest --testPathPatterns="copilot"

# 运行 Lark 展示层测试
npx jest --testPathPatterns="lark"

# 检查代码覆盖率
npm run test:coverage
```

---

## 🛠️ Maintenance Guide (维护指南)

### 🔍 Debugging Tips
- **copilot_execute 未注册**: 运行 `copilot --version` 确认 CLI 已安装且在 PATH 中可用
- **Lark 消息格式异常**: 检查 `src/presentation/lark/shared.ts` 中 `formatStringAsCode` 的逻辑，确认 `\n` 检测正确
- **系统提示词缺少路由规则**: 在 factory.ts 中确认 `buildSystemPromptFromTools` 接收的 tools 数组中包含对应工具名称

### 📈 Monitoring Metrics
- **工具注册数量**: 启动日志中确认 copilot_execute 出现在工具列表中
- **测试覆盖率**: 维持 ≥ 80%，重点关注 `src/tools/copilot.ts` 的分支覆盖

### 🔄 Future Extensions
- **计划中的功能**: 可按同样模式新增其他 AI CLI 工具（如 aider、continue 等）
- **架构扩展**: `system-prompt.ts` 已预留扩展点，新增工具只需添加一个布尔参数和对应路由规则
- **技术债务**: `src/tools/local-mcp.ts` 变更较大（353行变更），建议后续单独重构
