# AIBO - 高级多智能体自主编程AI助手

一个由复杂多智能体架构驱动的高级自主编程AI助手，具备专业技能系统、深度代码智能和完整的本地文件系统访问能力。使用TypeScript、Jest和DeepAgents构建。

## 功能特性

- ✅ **高级多智能体架构**: 7种专业智能体类型（编码器、协调器、文档、创新者、研究员、测试员、验证器）协同工作
- ✅ **技能系统框架**: 31+个标准化技能模块，提供可重用的领域特定能力，支持渐进式披露
- ✅ **混合代码智能**: 结合LSP（语义分析）和Tree-sitter（语法分析）的高级代码分析，实现60-90%的token节省
- ✅ **语音输入集成**: 使用腾讯云官方ASR服务的实时语音输入支持，支持麦克风音频捕获和语音转文本
- ✅ **高级自主编程**: 跨任何语言编写、编辑、调试和优化代码，具备智能上下文感知
- ✅ **子智能体委托**: 为复杂、独立的任务生成专业子智能体，**强制并行执行**和协调结果 - 复杂任务必须拆分为多个可并行完成的子任务，每个子任务交给对应的子任务代理去完成
- ✅ **高级子代理任务管理**: **write-subagent-todos** 工具提供结构化任务清单，支持专门的子代理类型分配和分组并发控制，确保主流程只负责规划而子任务代理执行实际工作
- ✅ **错误恢复与重试策略**: 系统性错误分析、策略调整和后备方案，支持优雅降级
- ✅ **完整系统访问**: 对本地文件系统和终端命令的完整读写访问，采用安全优先设计
- ✅ **增强型Web工具**: 基于Puppeteer的WebSearch和WebFetch工具，具备适当的错误处理、资源管理和反机器人绕过能力
- ✅ **双语系统提示**: 完整的中英文支持，包含全面的方法论和文化背景
- ✅ **交互式聊天模式**: 支持实时交互模式，包含命令快捷键、会话管理和语音输入支持
- ✅ **I/O 解耦架构**: 通过 `Adapter` 接口实现终端依赖与核心逻辑的完全分离，提高可测试性和可扩展性
- ✅ **Lark 飞书集成**: 完整的企业级飞书(Lark)平台集成，支持实时消息交互、命令处理和会话管理
- ✅ **Lark JSON 智能格式化**: 在 Lark 对话模式下实现 JSON 数据的优化输出格式，绝不截断任何内容，第一层属性以 "属性: 值" 形式展示，复杂文本保持原有格式
- ✅ **Lark /rebot 命令支持**: 在 Lark 交互模式中支持 `/rebot` 命令，自动执行项目构建并重启对话模式
- ✅ **全面测试**: 86.5%+的测试覆盖率，涵盖所有模块的单元测试、集成测试和边界情况测试
- ✅ **问题解决方法论**: 7步结构化方法，包括最佳实践研究和多智能体协作
- ✅ **功能开发工作流**: 严格的工作流程确保质量，包含文档和正确提交
- ✅ **增强型整理代码技能**: 包含四阶段验证脚本（测试覆盖、需求提取、文档生成、提交结构），确保每个阶段的质量保证，并**强制更新 README.md 文档**

## 快速开始

### 先决条件
- Node.js 18+
- npm 或 yarn

### 安装
```bash
npm install
```

### 配置
复制示例环境文件并按需编辑：
```bash
cp .env.example .env
# 编辑 .env 文件，填入您的 API 密钥和其他配置
```

变量说明及获取方式请参阅 **[docs/env.md](docs/env.md)**。

### 运行
```bash
# 开发模式（终端交互）
npm run dev

# 开发模式（飞书模式）
npm run dev:lark

# 构建
npm run build

# 生产模式启动
npm start

# 测试
npm test
```

## 环境变量概览

以下列出所有支持的环境变量及其简要说明，完整配置步骤请查阅 **[docs/env.md](docs/env.md)**。

### 模型配置

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_API_KEY` | 视服务商而定 | 统一 API 密钥（OpenAI / Anthropic / Google 等） |
| `AIBO_BASE_URL` | 视服务商而定 | 自定义 API 基础 URL（Azure / Ollama / 兼容接口必填） |
| `AIBO_MODEL_NAME` | ✅ | 模型名称，如 `gpt-4o`、`claude-3-5-sonnet-20241022` |
| `AIBO_MODEL_PROVIDER` | 部分必填 | 显式指定服务商，Groq / Ollama / Azure 必须设置 |
| `AIBO_AZURE_API_VERSION` | 仅 Azure | Azure OpenAI API 版本，默认 `2024-02-15-preview` |

### 运行时配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `AIBO_RECURSION_LIMIT` | ❌ | `1000` | LangGraph 递归深度上限 |
| `AIBO_CHECKPOINTER_TYPE` | ❌ | `memory` | 检查点存储类型：`memory` / `sqlite` / `filesystem` |
| `AIBO_MEMORY_WINDOW_SIZE` | ❌ | `5` | 对话滑动窗口记忆大小 |
| `AIBO_VERBOSE_OUTPUT` | ❌ | `false` | 是否开启调试输出 |
| `AIBO_LANGUAGE` | ❌ | `en` | 提示语言：`en` / `zh` |
| `AIBO_PERSONA` | ❌ | 魅魔人设 | 自定义 AI 人设描述 |
| `AIBO_MAX_CONCURRENT_SUBTASKS` | ❌ | `5` | 最大并发子任务数（1–50） |
| `AIBO_SPECIAL_KEYWORD` | ❌ | `干活` | 触发特殊行为的关键词 |

### 腾讯云 ASR（语音功能）

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_TENCENTCLOUD_APP_ID` | ✅ | 腾讯云账号 AppID |
| `AIBO_TENCENTCLOUD_SECRET_ID` | ✅ | 腾讯云 API SecretId |
| `AIBO_TENCENTCLOUD_SECRET_KEY` | ✅ | 腾讯云 API SecretKey |
| `AIBO_TENCENTCLOUD_REGION` | ❌ | 服务地域，默认 `ap-guangzhou` |

### Composio 集成

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_COMPOSIO_API_KEY` | ✅ | Composio 平台 API Key |
| `AIBO_COMPOSIO_EXTERNAL_USER_ID` | ✅ | Composio 外部用户 ID |

### Lark 飞书集成

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_LARK_APP_ID` | ✅ | 飞书自建应用 App ID |
| `AIBO_LARK_APP_SECRET` | ✅ | 飞书自建应用 App Secret |
| `AIBO_LARK_RECEIVE_ID` | ❌ | 默认消息接收方 ID |
| `AIBO_LARK_INTERACTIVE_TEMPLATE_ID` | ❌ | 飞书互动卡片模板 ID |

> 💡 当 `AIBO_LARK_APP_ID` 和 `AIBO_LARK_APP_SECRET` 均已配置时，`aibo` 将自动以飞书模式启动。可通过 `aibo --interaction=console` 或 `aibo --interaction=lark` 显式指定模式。

## 交互模式架构

### I/O 解耦设计
AIBO 采用 `Adapter` 接口实现 I/O 操作与核心逻辑的完全解耦：

- **Adapter 接口**: 定义标准的 I/O 操作接口，支持多种输出事件类型
- **TerminalAdapter**: 终端适配器实现，处理所有具体的终端输出逻辑
- **Session 类**: 会话管理类，通过依赖注入使用 Adapter
- **可扩展性**: 可轻松添加新的 I/O 适配器（如 Web UI、API、移动端等）
- **可测试性**: 核心逻辑不再直接依赖终端 API，可以轻松创建 mock 进行单元测试

### 工具函数模块化
- 所有交互模式相关的工具函数已从 `agent` 目录移动到 `utils` 目录
- 统一导出接口，简化导入路径
- 提高代码复用性和维护性

## 错误处理与恢复策略

### 错误分类与响应
1. **工具执行失败**: 立即分析根本原因，检查命令语法，验证权限
2. **文件系统错误**: 验证文件路径，检查权限，优雅处理竞态条件
3. **网络/API失败**: 实施指数退避，提供替代数据源
4. **逻辑/实现错误**: 跟踪执行流程，验证假设，测试边界情况
5. **资源限制**: 优化内存使用，实施分页，建议替代方案

### 恢复协议
1. **即时分析**: 诊断确切的故障点和根本原因
2. **策略调整**: 修改方法 - 尝试替代方法、工具、参数或工作流
3. **系统性重试**: 尝试修复并提供清晰推理，限制重试以防止无限循环（最多3次尝试）
4. **后备实现**: 如果主要方法失败，提出并实施替代解决方案
5. **透明沟通**: 向用户清楚解释错误、分析、调整策略和后续步骤
6. **持续执行**: 当单个工具失败时，绝不中断整个工作流。始终尝试恢复并继续执行剩余任务。

## 文档

| 文件 | 说明 |
|------|------|
| [docs/env.md](docs/env.md) | 所有环境变量的详细说明及获取步骤 |

## 贡献指南

我们欢迎贡献！请遵循以下步骤：

1. Fork 仓库
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

此项目在 MIT 许可证下发布 - 有关详细信息，请参阅 [LICENSE](LICENSE) 文件。

## 联系方式

如有问题或建议，请创建 GitHub Issue 或联系项目维护者。
