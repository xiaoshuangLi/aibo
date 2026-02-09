# 001 - Core Features: AI Agent with DeepAgents Integration

## 概述
本项目实现了基于 DeepAgents 的 AI Agent 核心功能，提供完整的 TypeScript 开发环境、Jest 测试框架集成，以及灵活的环境变量配置系统。项目支持通过环境变量配置所有 AI 相关参数，包括自定义 baseURL，便于在不同环境和 API 端点之间切换。

## 功能详情

### 1. 环境变量配置系统 (`src/config.ts`)

#### 提供的能力：
- **自动加载 `.env` 文件**：使用 `dotenv` 库自动从项目根目录加载环境变量
- **类型安全验证**：使用 `Zod` 库对环境变量进行严格的运行时验证
- **默认值支持**：为可选参数提供合理的默认值
- **错误处理**：在环境变量缺失或格式不正确时抛出清晰的错误信息

#### 支持的环境变量：

| 环境变量 | 类型 | 必需 | 默认值 | 描述 |
|---------|------|------|--------|------|
| `OPENAI_API_KEY` | string | ✅ | - | OpenAI API 密钥（必需） |
| `OPENAI_BASE_URL` | URL string | ❌ | - | 自定义 API 基础 URL（支持代理、本地部署等） |
| `MODEL_NAME` | string | ❌ | `gpt-4o` | 使用的模型名称 |
| `RECURSION_LIMIT` | number | ❌ | `1000` | LangGraph 递归限制 |
| `CHECKPOINTER_TYPE` | enum | ❌ | `memory` | 检查点类型（`memory` 或 `sqlite`） |
| `MEMORY_WINDOW_SIZE` | number | ❌ | `5` | 记忆窗口大小 |

#### 配置对象结构：
```typescript
export const config = {
  openai: {
    apiKey: string,
    baseURL: string | undefined,
    modelName: string,
  },
  langgraph: {
    recursionLimit: number,
    checkpointerType: 'memory' | 'sqlite',
  },
  memory: {
    windowSize: number,
  },
}
```

### 2. AI Agent 核心实现 (`src/index.ts`)

#### 提供的能力：
- **DeepAgents 集成**：创建和配置 DeepAgents 实例
- **LangChain 模型集成**：集成 ChatOpenAI 模型，支持自定义 baseURL
- **文件系统后端**：提供 FilesystemBackend 用于文件操作
- **内存检查点**：使用 MemorySaver 进行状态持久化
- **错误处理**：完整的错误捕获和日志记录
- **模块化设计**：可重用的 `createAIAgent()` 函数

#### 核心组件：

##### 2.1 ChatOpenAI 配置
- **API Key 支持**：从环境变量读取 `OPENAI_API_KEY`
- **自定义 baseURL**：当提供 `OPENAI_BASE_URL` 时，自动配置到模型的 configuration 中
- **模型选择**：支持动态选择不同的模型（通过 `MODEL_NAME` 环境变量）
- **温度控制**：固定 temperature 为 0，确保输出的一致性

##### 2.2 DeepAgents 配置
- **模型集成**：将配置好的 ChatOpenAI 模型传递给 DeepAgents
- **文件系统后端**：
  - `rootDir`: 设置为当前工作目录
  - `maxFileSizeMb`: 限制最大文件大小为 1000MB
- **状态管理**：使用 MemorySaver 进行对话状态的持久化

##### 2.3 主函数 (`main()`)
- **初始化验证**：确保 AI Agent 能够成功初始化
- **错误处理**：捕获并记录初始化过程中的任何错误
- **可扩展性**：预留了主逻辑的扩展点（注释标记）

### 3. 测试框架集成

#### 测试能力：
- **配置测试** (`__tests__/config.test.ts`)：
  - 验证环境变量加载是否正确
  - 测试默认值的应用
  - 确保必需参数的存在性

- **核心功能测试** (`__tests__/index.test.ts`)：
  - 验证 AI Agent 创建成功
  - 测试主函数初始化无错误
  - 确保依赖注入正常工作

#### 测试特性：
- **自动环境变量加载**：测试运行时自动加载 `.env` 文件
- **类型安全**：TypeScript 编译时类型检查
- **覆盖率报告**：支持生成测试覆盖率报告

### 4. 构建和部署支持

#### 构建能力：
- **TypeScript 编译**：将 TypeScript 代码编译为 CommonJS JavaScript
- **声明文件生成**：自动生成 `.d.ts` 类型声明文件
- **源码映射**：生成 source map 便于调试

#### 运行模式：
- **生产模式**：`npm start` - 运行编译后的 JavaScript 代码
- **开发模式**：`npm run dev` - 使用 ts-node 直接运行 TypeScript 代码
- **测试模式**：`npm test` - 运行完整的测试套件

### 5. 安全性和最佳实践

#### 安全特性：
- **环境变量隔离**：敏感信息（如 API key）通过环境变量管理，不在代码中硬编码
- **输入验证**：所有环境变量都经过 Zod 验证，防止无效配置
- **错误信息控制**：错误信息包含足够的调试信息但不泄露敏感数据

#### 最佳实践：
- **模块化设计**：配置和业务逻辑分离
- **可测试性**：所有功能都可以通过单元测试验证
- **可维护性**：清晰的代码结构和文档注释
- **可扩展性**：易于添加新的功能和配置选项

## 使用示例

### 基本使用：
```typescript
import { createAIAgent } from './src/index';

const agent = createAIAgent();
// 现在可以使用 agent 进行 AI 操作
```

### 自定义配置：
创建 `.env` 文件：
```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=http://localhost:8080/v1
MODEL_NAME=gpt-4-turbo
RECURSION_LIMIT=50
MEMORY_WINDOW_SIZE=10
```

### 测试运行：
```bash
# 运行测试
npm test

# 构建并运行
npm run build && npm start

# 开发模式运行
npm run dev
```

## 依赖关系

### 核心依赖：
- `deepagents@^1.7.2` - 主要的 AI Agent 框架
- `@langchain/openai@^1.2.5` - OpenAI 模型集成
- `@langchain/langgraph@^1.1.4` - 状态图和检查点支持
- `zod@^4.3.6` - 环境变量验证
- `dotenv@^17.2.4` - 环境变量加载

### 开发依赖：
- `jest@^30.2.0` - 测试框架
- `ts-jest@^29.4.6` - TypeScript Jest 集成
- `typescript@^5.9.3` - TypeScript 编译器
- `@types/jest` - Jest 类型定义

## 扩展可能性

1. **多模型支持**：可以轻松扩展支持其他 AI 提供商（Anthropic, Google等）
2. **数据库后端**：可以替换 FilesystemBackend 为数据库后端
3. **Web 接口**：可以添加 Express.js 或 Fastify 提供 HTTP API
4. **CLI 工具**：可以构建命令行工具进行交互
5. **监控和日志**：可以集成更高级的日志和监控系统

## 当前限制

1. **DeepAgents API 限制**：当前实现基于 DeepAgents 的特定 API 结构
2. **单模型支持**：目前只支持 OpenAI 兼容的模型
3. **内存检查点**：当前使用 MemorySaver，生产环境可能需要持久化存储

## 版本信息
- **项目版本**: 1.0.0
- **最后更新**: 2024年
- **兼容性**: Node.js 18+，TypeScript 5+

---
*本文档由项目自动生成，反映了当前代码库的实际功能和能力*