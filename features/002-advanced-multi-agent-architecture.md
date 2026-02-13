# Advanced Multi-Agent Architecture with Skills System and Code Intelligence

## 📋 功能概述 (Feature Overview)

### 🎯 一句话描述
引入先进的多智能体架构和技能系统，结合深度代码分析能力，打造一个能够自主编程、协作解决问题的AI助手平台。

### 💡 业务价值
- **解决的问题**: 传统单智能体系统在复杂任务处理上的局限性，缺乏专业化分工和系统化能力组织
- **带来的价值**: 
  - 通过多智能体协作实现复杂任务的分解和并行处理
  - 技能系统提供标准化、可复用的能力模块
  - 深度代码分析能力支持精准的上下文理解和代码操作
  - 语音输入支持提供更自然的人机交互方式
- **目标用户**: 开发者、技术团队、需要自动化编程解决方案的企业

### 🔗 相关背景
- **相关 Issue/PR**: 基于当前重构需求
- **设计文档**: 本feature文档即为主要设计文档
- **依赖项**: 
  - TypeScript 5.9+
  - Jest 测试框架
  - Puppeteer 浏览器自动化
  - Tencent Cloud ASR/WSS 服务
  - Tree-sitter 和 LSP 客户端

---

## 🏗️ 技术设计 (Technical Design)

### 📐 架构概览
采用分层架构设计：
- **Presentation Layer**: 用户交互界面，包括控制台命令处理器、语音输入管理、输出样式化
- **Core Layer**: 核心智能体管理，包括智能体工厂、消息处理器、会话管理、优雅关闭机制
- **Infrastructure Layer**: 基础设施服务，包括多智能体加载器、音频录制、浏览器工具、代码分析、文件系统安全后端、云服务集成
- **Skills Layer**: 专业化技能库，提供可复用的领域特定能力
- **Shared Layer**: 共享常量和工具函数

### ⚙️ 核心实现
#### 主要组件/模块
- **Multi-Agent System**: 7种专业化智能体（coder, coordinator, documentation, innovator, researcher, testing, validator）
- **Skills Framework**: 15+个标准化技能模块，涵盖从基础编程到高级推理的完整能力谱系
- **Hybrid Code Reader**: 结合LSP和Tree-sitter的智能代码分析工具，支持定义查找、引用分析、符号表构建等
- **Voice Input System**: 集成Tencent Cloud ASR的语音识别功能，支持实时语音输入
- **Safe Filesystem Backend**: 安全的文件系统操作封装，防止意外的文件系统破坏

#### 关键技术决策
- **模块化架构**: 采用清晰的分层设计，确保各组件职责单一且可测试
- **混合代码分析**: 同时支持LSP（语义分析）和Tree-sitter（语法分析），提供最佳的代码理解能力
- **智能体专业化**: 不同类型的智能体专注于特定领域，通过协调器进行任务分配和结果整合
- **安全优先**: 所有文件系统操作都经过安全封装，防止恶意或意外的破坏性操作

#### 数据流/状态管理
1. 用户输入 → Presentation Layer（命令解析/语音识别）
2. 任务分发 → Core Layer（智能体工厂创建合适的智能体）
3. 能力调用 → Infrastructure/Skills Layer（执行具体操作）
4. 结果整合 → Core Layer（协调器整合多个智能体的结果）
5. 输出呈现 → Presentation Layer（格式化输出给用户）

### 🧩 API 变更
#### 新增 API
```typescript
// 多智能体系统
interface AgentConfig {
  type: 'coder' | 'coordinator' | 'documentation' | 'innovator' | 'researcher' | 'testing' | 'validator';
  capabilities: string[];
}

function createAgent(config: AgentConfig): Promise<Agent>;

// 技能系统
interface Skill {
  name: string;
  execute(context: any): Promise<any>;
}

function loadSkills(directory: string): Promise<Skill[]>;

// 混合代码阅读器
interface HybridCodeReaderOptions {
  filePath: string;
  requestType: 'definition' | 'references' | 'implementation' | 'signature' | 'full-context' | 'dependencies';
  line?: number;
  character?: number;
  symbolName?: string;
}

function hybridCodeReader(options: HybridCodeReaderOptions): Promise<string>;

// 语音输入
interface VoiceInputOptions {
  duration?: number;
  language?: string;
}

function startVoiceInput(options?: VoiceInputOptions): Promise<string>;
```

#### 修改的 API
- 重构了原有的工具系统，将功能分散到更专业的模块中
- 更新了配置系统，支持多智能体和技能系统的配置

#### 废弃的 API
- **agent-interaction.ts**: 已被多智能体系统替代
- **enhanced-system-prompt.ts**: 已整合到共享常量系统中
- **utils/tencent-asr.ts**: 已升级为完整的语音输入系统

---

## 🚀 使用指南 (Usage Guide)

### 📦 安装/配置
确保已安装必要的依赖：
```bash
npm install
# 确保已配置Tencent Cloud凭证（如需使用语音功能）
```

### 🎮 基本使用
```typescript
import { createAgent } from './src/core/agent/agent-factory';
import { hybridCodeReader } from './src/tools/hybrid-code-reader';

// 创建一个编码智能体
const coderAgent = await createAgent({
  type: 'coder',
  capabilities: ['typescript', 'javascript', 'python']
});

// 使用混合代码阅读器分析代码
const codeContext = await hybridCodeReader({
  filePath: './src/main.ts',
  requestType: 'definition',
  line: 10,
  character: 5
});

console.log(codeContext);
```

### 🏆 高级用法
```typescript
// 场景 1: 多智能体协作解决复杂问题
const coordinator = await createAgent({ type: 'coordinator' });
const result = await coordinator.solveComplexProblem({
  problem: '重构这个模块以提高测试覆盖率',
  context: await hybridCodeReader({
    filePath: './src/infrastructure/filesystem/safe-filesystem-backend.ts',
    requestType: 'full-context'
  })
});

// 场景 2: 语音驱动的编程助手
const voiceInput = await startVoiceInput({ duration: 5 });
if (voiceInput) {
  const coder = await createAgent({ type: 'coder' });
  const codeResult = await coder.generateCode(voiceInput);
  console.log(codeResult);
}
```

### 🔄 迁移指南
#### 从旧版本迁移
由于这是重大架构重构，建议：
1. 备份现有代码
2. 逐步迁移功能模块，而不是一次性切换
3. 更新所有工具调用以使用新的API

#### 兼容性说明
- **向后兼容**: 否（重大架构变更）
- **最低版本要求**: Node.js 18+, TypeScript 5.9+
- **已知限制**: 
  - LSP功能需要相应的语言服务器支持
  - 语音功能需要Tencent Cloud账户和网络连接
  - 某些文件系统操作在不同操作系统上可能有差异