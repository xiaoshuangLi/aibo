# 适配器架构重构和Lark集成增强

## 📋 Specification (规格说明)

### 🎯 User Story
作为开发者，我想要一个解耦的适配器架构，以便能够轻松支持多种输出平台（如终端、飞书等），同时保持核心逻辑的纯净性。

作为飞书用户，我想要在飞书环境中获得与终端相同的功能体验，包括完整的工具调用、结果展示和交互能力。

### ✅ Acceptance Criteria
- [ ] 核心模块不再直接依赖终端API，所有I/O操作都通过适配器接口进行
- [ ] 飞书适配器完全实现适配器接口，支持所有输出事件类型
- [ ] 终端适配器保持向后兼容，现有功能不受影响
- [ ] 所有测试用例通过，覆盖率≥80%
- [ ] 删除了过时的io-channel.ts文件，简化了架构
- [ ] 新增的shared.ts模块提供Lark特定的工具函数

### ⚙️ Technical Constraints
- **技术栈要求**: TypeScript 5+, Node.js 18+
- **兼容性要求**: 保持现有终端用户的完全兼容性
- **性能要求**: 适配器切换不应引入明显的性能开销
- **安全要求**: 飞书适配器必须正确处理环境变量和认证信息

---

## 🏗️ Technical Design (技术设计)

### 📐 Architecture Overview
本次重构引入了适配器模式，将核心会话逻辑与具体的I/O实现完全分离。核心模块（如Session）现在只依赖于抽象的Adapter接口，而具体的实现（如DefaultAdapter用于终端，LarkAdapter用于飞书）则负责处理平台特定的细节。

### ⚙️ Core Implementation
#### Main Components/Modules
- **Adapter接口**: 定义了14种输出事件类型，涵盖了所有可能的I/O场景
- **DefaultAdapter**: 终端适配器的具体实现，保持向后兼容
- **LarkAdapter**: 飞书适配器的具体实现，处理飞书特有的消息格式和API
- **Session类**: 重构后的会话管理器，接受Adapter实例作为依赖注入

#### Key Technical Decisions
- **决策 1**: 使用事件驱动的适配器接口而非直接的方法调用，这样可以更好地支持异步操作和流式处理
- **决策 2**: 将Lark特定的文本处理逻辑提取到shared.ts模块中，便于复用和测试
- **决策 3**: 删除io-channel.ts以简化架构，所有I/O逻辑现在都集中在适配器中

#### Data Flow/State Management
数据流从核心逻辑（Session）→ 适配器接口 → 具体适配器实现 → 目标平台。状态管理完全由核心模块负责，适配器只负责展示和输入收集。

### 🧩 API Changes
#### New APIs
```typescript
// 适配器接口
export interface Adapter {
  sendOutput(event: OutputEvent): Promise<void>;
  waitForUserInput(prompt?: string): Promise<string>;
  setAbortSignal(signal: AbortSignal): void;
  destroy(): void;
}

// 输出事件类型
export type OutputEventType = 
  | 'aiResponse'           // AI 响应内容
  | 'toolCall'            // 工具调用
  | 'toolResult'          // 工具执行结果  
  | 'thinkingProcess'      // 思考过程
  | 'systemMessage'       // 系统消息
  | 'errorMessage'        // 错误消息
  | 'hintMessage'         // 提示消息
  | 'streamStart'         // 流开始
  | 'streamChunk'         // 流数据块
  | 'streamEnd'           // 流结束
  | 'userInputRequest'    // 用户输入请求
  | 'sessionStart'        // 会话开始
  | 'sessionEnd'          // 会话结束
  | 'commandExecuted'     // 命令执行完成
  | 'rawText'             // 原始文本输出
```

#### Modified APIs
```typescript
// Session构造函数修改
// 原有:
constructor() { /* 直接使用终端 */ }

// 修改后:
constructor(adapter: Adapter, options: SessionOptions = {}) {
  this.adapter = adapter; // 依赖注入
}
```

#### Deprecated APIs
- **io-channel.ts**: 已完全删除，所有功能已迁移到适配器架构中

---

## 📝 Implementation Plan (实施计划)

### 📋 Task Breakdown
1. **定义适配器接口** - 创建抽象的Adapter接口和OutputEvent类型 (已完成)
2. **实现默认适配器** - 将原有终端逻辑迁移到DefaultAdapter中 (已完成)
3. **实现飞书适配器** - 创建LarkAdapter处理飞书特定的I/O需求 (已完成)
4. **重构会话管理器** - 修改Session类以接受Adapter依赖注入 (已完成)
5. **迁移Lark工具格式化器** - 将Lark特定的文本处理提取到shared.ts (已完成)
6. **更新测试用例** - 为新架构编写全面的测试覆盖 (已完成)
7. **清理过时代码** - 删除io-channel.ts和其他冗余代码 (已完成)

### 🔗 Dependencies
- **Internal Dependencies**: core/agent, presentation/console, presentation/lark
- **External Dependencies**: @larksuiteoapi/node-sdk
- **Prerequisites**: 现有的Lark集成基础

### ⚠️ Risk Assessment
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 终端用户体验退化 | 低 | 高 | 保持DefaultAdapter的完全向后兼容，充分测试 |
| 飞书消息格式问题 | 中 | 中 | 增加Lark文本处理的单元测试，处理特殊字符转义 |
| 性能开销增加 | 低 | 低 | 监控性能指标，优化适配器实现 |

### 🎯 Success Metrics
- **功能完整性**: 所有原有功能在新架构下正常工作
- **代码质量**: 测试覆盖率83.37% > 80%目标
- **性能指标**: 适配器切换无明显性能影响
- **用户体验**: 终端和飞书用户都能获得一致的功能体验

---

## 🚀 Usage Guide (使用指南)

### 📦 Installation/Configuration
对于飞书集成，需要设置以下环境变量：
```bash
AIBO_LARK_APP_ID=your_app_id
AIBO_LARK_APP_SECRET=your_app_secret
```

### 🎮 Basic Usage
```typescript
// 终端使用（向后兼容）
import { DefaultAdapter } from '@/core/agent/adapter';
import { Session } from '@/core/agent/session';

const adapter = new DefaultAdapter();
const session = new Session(adapter);

// 飞书使用
import { LarkAdapter } from '@/presentation/lark/lark-adapter';

const larkAdapter = new LarkAdapter();
const session = new Session(larkAdapter);
```

### 🛠 Advanced Configuration
```typescript
// 自定义会话选项
const session = new Session(adapter, {
  threadId: 'custom-thread-id',
  modelInfo: 'gpt-4-turbo'
});
```

### 🧪 Testing
所有适配器实现都应该通过相同的测试套件，确保行为一致性：
```bash
# 运行完整测试套件（60秒超时）
npm test -- --testTimeout=60000

# 检查覆盖率
npx jest --coverage --testTimeout=60000
```

---

## 📊 Impact Analysis (影响分析)

### 文件变更概览
- **新增文件**: 
  - `src/core/agent/adapter.ts` (适配器接口)
  - `src/presentation/lark/shared.ts` (Lark共享工具)
- **修改文件**:
  - `src/core/agent/session.ts` (会话重构)
  - `src/presentation/console/terminal-adapter.ts` (终端适配器)
  - `src/presentation/lark/lark-adapter.ts` (飞书适配器)
  - 多个测试文件 (全面的测试覆盖)
- **删除文件**:
  - `src/core/agent/io-channel.ts` (过时的I/O通道)
  - `skills/hybrid-code-reader/SKILL.md` (移除的技能)

### 向后兼容性
- **终端用户**: 完全兼容，无需任何代码更改
- **API用户**: Session构造函数签名改变，需要传入适配器实例
- **飞书用户**: 获得完整的功能支持，包括工具调用和结果展示

### 性能影响
- 内存使用: 轻微增加（适配器对象）
- CPU使用: 无显著影响
- 启动时间: 无显著影响

---
*本文档使用中文编写，符合feature-organizer技能的要求*