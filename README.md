# 🤖 AIBO - 高级多智能体自主编程AI助手

一款基于多智能体架构的自主编程 AI 助手，支持终端和飞书两种交互方式，可接入主流 AI 模型服务。

## ✨ 功能特性

- 🧠 **自主编程**: 跨语言编写、修改、调试和优化代码，具备完整的本地文件系统访问能力
- 🔌 **多模型支持**: 兼容 OpenAI、Anthropic Claude、Google Gemini、Mistral、Groq、Ollama、Azure OpenAI 及任意 OpenAI 兼容接口
- 🤝 **多智能体协作**: 内置 15 个专业 Agent（协调者、架构师、编码者、测试者等），支持并行任务分解与执行
- 🛠️ **技能扩展（Skills）**: 通过 `skills/` 目录扩展 AI 的专项能力，内置 45+ 技能（代码审查、CI/CD、前端开发、整理代码等）
- 🔗 **MCP 工具集成**: 通过 `mcps/` 目录接入 GitHub、Slack 等外部服务，扩展 AI 工具调用范围
- 🖥️ **本机 CLI 工具集成**: 自动检测并调用本机已安装的编程 CLI 工具（Claude Code、Cursor、Gemini CLI、Codex），将编码子任务委派给这些工具执行
- 🏢 **飞书企业集成**: 作为飞书机器人接入企业群/私聊，支持互动卡片消息和 `/rebot` 重启命令
- 🎙️ **语音输入**: 通过腾讯云 ASR 实现实时语音转文字输入（需配置腾讯云密钥）
- 🌐 **网页搜索与抓取**: 内置 Web 搜索和网页内容获取能力，辅助信息收集与研究
- 🌍 **中英双语**: 支持中文和英文系统提示，可通过 `AIBO_LANGUAGE` 切换

## 🚀 快速开始

### 📋 先决条件
- Node.js 18+

### 📦 全局安装

```bash
npm install -g @boay/aibo
```

### ⚙️ 配置

在任意工作目录创建 `.env` 文件，至少填写 AI 模型相关配置：

```dotenv
# 必填：AI 模型（以 OpenAI 为例）
AIBO_API_KEY=sk-...
AIBO_MODEL_NAME=gpt-4o

# 可选：语言（zh / en，默认 en）
AIBO_LANGUAGE=zh
```

完整变量说明请参阅 **[docs/env.md](docs/env.md)**。

### 🖥️ 使用场景

#### 场景一：终端交互模式

适合本地开发、日常编程辅助。

```bash
aibo
# 或显式指定
aibo --mode=console
```

启动后直接在终端与 AIBO 对话，输入任务描述即可。

#### 场景二：飞书机器人模式

适合企业团队，通过飞书群聊或私聊与 AIBO 交互。

在 `.env` 中额外配置飞书应用信息（详见 **[docs/env.md — Lark 飞书配置](docs/env.md#lark-飞书配置)**）：

```dotenv
AIBO_LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
AIBO_LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

配置完成后启动：

```bash
aibo
# 或显式指定
aibo --mode=lark
```

> 💡 当 `AIBO_LARK_APP_ID`、`AIBO_LARK_APP_SECRET`、`AIBO_LARK_RECEIVE_ID`、`AIBO_LARK_INTERACTIVE_TEMPLATE_ID` 四个变量均已配置时，`aibo` 默认以飞书模式启动。

#### 场景三：语音输入模式

在终端交互模式下，额外配置腾讯云 ASR 密钥后可直接通过麦克风语音输入：

```dotenv
AIBO_TENCENTCLOUD_APP_ID=1234567890
AIBO_TENCENTCLOUD_SECRET_ID=AKIDxxxxxxxxxxxxxxxx
AIBO_TENCENTCLOUD_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 🖥️ 命令行参数

`aibo` 命令支持以下参数：

| 参数 | 说明 | 可选值 | 默认值 |
|------|------|--------|--------|
| `--mode <mode>` | 指定交互模式 | `console` \| `lark` | 自动检测（有 Lark 配置时为 `lark`，否则为 `console`） |
| `--type <type>` | 指定飞书交互类型（仅 `--mode=lark` 生效） | `user_chat` \| `group_chat` | `user_chat` |

示例：

```bash
# 强制使用终端模式
aibo --mode=console

# 强制使用飞书模式
aibo --mode=lark

# 飞书群聊模式
aibo --mode=lark --type=group_chat

# 也可以通过子命令方式调用
aibo interact --mode=lark --type=group_chat
```

### 🔧 本地开发

```bash
git clone https://github.com/xiaoshuangLi/aibo.git
cd aibo
npm install
cp .env.example .env  # 按需编辑

# 终端模式
npm run dev

# 飞书模式
npm run dev:lark

# 构建
npm run build

# 测试
npm test
```

---

## 🔌 对接 AI 模型

AIBO 支持市面上主流的 AI 模型服务商，只需在 `.env` 中配置对应的 API Key 和模型名称即可。

### 🟣 Anthropic Claude（推荐）

Claude 是 Anthropic 开发的高性能大语言模型，在编程和推理任务上表现出色。

```dotenv
AIBO_API_KEY=sk-ant-api03-...
AIBO_MODEL_NAME=claude-opus-4-5
# 也可以使用其他 Claude 版本：
# AIBO_MODEL_NAME=claude-3-5-sonnet-20241022
# AIBO_MODEL_NAME=claude-3-5-haiku-20241022
```

> 🔑 **获取 API Key**：访问 [https://console.anthropic.com](https://console.anthropic.com) → Settings → API Keys → Create Key

### 🟢 OpenAI GPT

```dotenv
AIBO_API_KEY=sk-...
AIBO_MODEL_NAME=gpt-4o
# 其他可选模型：gpt-4o-mini、o1、o3-mini
```

> 🔑 **获取 API Key**：访问 [https://platform.openai.com](https://platform.openai.com) → API keys → Create new secret key

### 🔵 Google Gemini

```dotenv
AIBO_API_KEY=AIzaSy-...
AIBO_MODEL_NAME=gemini-2.0-flash
# 其他可选模型：gemini-2.0-pro、gemini-1.5-flash
```

> 🔑 **获取 API Key**：访问 [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### 🟡 Groq（超高速推理）

```dotenv
AIBO_API_KEY=gsk_...
AIBO_MODEL_NAME=llama-3.3-70b-versatile
AIBO_MODEL_PROVIDER=groq
```

> 🔑 **获取 API Key**：访问 [https://console.groq.com](https://console.groq.com) → API Keys

### 🟠 Mistral

```dotenv
AIBO_API_KEY=...
AIBO_MODEL_NAME=mistral-large-latest
```

### 🏠 Ollama（本地部署，完全免费）

无需 API Key，在本地运行开源模型，保护数据隐私。

```dotenv
AIBO_BASE_URL=http://localhost:11434
AIBO_MODEL_NAME=llama3
AIBO_MODEL_PROVIDER=ollama
```

> 💻 **安装 Ollama**：访问 [https://ollama.com](https://ollama.com) 下载，然后执行 `ollama pull llama3`

### ☁️ Azure OpenAI

```dotenv
AIBO_API_KEY=...
AIBO_BASE_URL=https://<your-instance>.openai.azure.com
AIBO_MODEL_NAME=<your-deployment-name>
AIBO_MODEL_PROVIDER=azure
AIBO_AZURE_API_VERSION=2024-02-15-preview
```

### 🇨🇳 国产模型（DeepSeek、Qwen 等 OpenAI 兼容接口）

```dotenv
# DeepSeek
AIBO_API_KEY=...
AIBO_BASE_URL=https://api.deepseek.com
AIBO_MODEL_NAME=deepseek-chat

# 阿里云百炼（Qwen）
AIBO_API_KEY=...
AIBO_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AIBO_MODEL_NAME=qwen-max
```

---

## 🤝 多智能体系统（Agents）

AIBO 内置了 15 个专业 Agent，通过多智能体协作完成复杂任务。这些 Agent 定义在 `agents/` 目录中，每个 Agent 拥有独立的专业能力和职责边界。

| 🤖 Agent | 职责 |
|----------|------|
| 🎯 `coordinator` | **协调者** — 任务分解、多 Agent 调度、依赖管理 |
| 🏗️ `architect` | **架构师** — 系统设计、技术选型、架构评审 |
| 💻 `coder` | **编码者** — 功能实现、Bug 修复、代码重构 |
| 🧪 `testing` | **测试工程师** — 测试用例编写、自动化测试 |
| ✅ `validator` | **验证者** — 代码质量验证、规范检查 |
| 🔐 `security` | **安全专家** — 安全漏洞扫描、安全加固建议 |
| ⚡ `performance` | **性能工程师** — 性能分析、优化方案 |
| 🚀 `devops` | **DevOps 工程师** — CI/CD、部署、运维 |
| 📖 `documentation` | **文档工程师** — 文档撰写、API 文档生成 |
| 🔬 `researcher` | **研究员** — 技术调研、方案比较、信息收集 |
| 🔄 `refactoring` | **重构专家** — 代码重构、技术债务清理 |
| 💡 `innovator` | **创新者** — 创意方案、新技术探索 |
| 📊 `data-analyst` | **数据分析师** — 数据处理、可视化方案 |
| ✏️ `prompt_engineer` | **提示词工程师** — Prompt 优化、AI 交互设计 |
| 🌐 `nexus` | **枢纽** — 跨 Agent 信息整合与汇报 |

**📁 自定义 Agent**：在 `agents/` 目录下新建 Markdown 文件，按照现有格式定义 Agent 的名称、描述和能力，即可扩展自己的专属 Agent。

---

## 🛠️ 技能系统（Skills）

Skills 是 AIBO 的专项能力模块，定义在 `skills/` 目录中，每个 Skill 为 AI 提供特定场景下的工作流指导。

### 🎨 内置技能一览

| 分类 | 技能 |
|------|------|
| 💻 **编程开发** | `autonomous-coding`、`debugging`、`self-debugging`、`code-review`、`refactoring` |
| 🌐 **前端** | `react-development`、`vue-development`、`typescript-frontend`、`frontend-design`、`web-artifacts-builder` |
| 🧪 **测试** | `test-driven-development`、`webapp-testing`、`playwright-skill` |
| 🔧 **工程化** | `ci-cd`、`git-workflow`、`using-git-worktrees`、`spec-driven-development`、`claude-code-hooks` |
| 📄 **文档与内容** | `doc-coauthoring`、`pdf`、`docx`、`pptx`、`xlsx` |
| 🤖 **AI & Agent** | `coding-agent-router`、`parallel-agents`、`subagent-driven-development`、`write-subagent-todos`、`mcp-builder`、`skill-creator` |
| 🎨 **设计** | `canvas-design`、`brand-guidelines`、`theme-factory`、`algorithmic-art`、`d3js-skill` |
| ☁️ **平台集成** | `github-automation`、`gitlab-automation`、`slack-gif-creator`、`tencent-wsa` |
| 📋 **项目管理** | `project-context`、`context-management`、`feature-organizer`、`internal-comms`、`file-organizer` |
| 🧠 **提示词** | `chain-of-thought`、`few-shot-prompting`、`api-design` |

**📁 自定义技能**：在 `skills/` 目录下创建新文件夹，添加 `SKILL.md` 文件，按照现有格式描述技能的触发条件、工作流程和最佳实践。

---

## 🔗 MCP 工具集成（Model Context Protocol）

MCP（Model Context Protocol）允许 AIBO 连接外部工具和服务，极大扩展其能力边界。工具配置定义在 `mcps/` 目录中。

### 🎯 功能场景

AIBO 通过 MCP 协议接入外部工具和服务，扩展 AI 的工具调用范围：

- 🐙 **GitHub / Slack 等**：通过标准 MCP 配置接入第三方服务 API，实现自动化操作
- 🌐 **自定义服务**：接入任意支持 MCP 协议的 HTTP 服务，灵活扩展能力边界

> 💡 **与本机 CLI 工具集成的区别**：AIBO 还支持直接调用本机已安装的编程 CLI 工具（Claude Code、Cursor、Gemini CLI、Codex 等），这是独立于 MCP 的另一项功能特性，无需额外配置，AIBO 启动时会自动检测并加载。

### ➕ 添加 MCP 工具

在 `mcps/` 目录下创建 JSON 配置文件，格式如下：

```json
{
  "name": "my-tool",
  "description": "工具描述",
  "endpoint": "http://localhost:8080/mcp",
  "authentication": {
    "type": "none"
  }
}
```

> `tools` 字段可选，省略时由 MCP Server 自动发现可用工具。

> 📖 详细说明请参阅 **[docs/mcp.md](docs/mcp.md)**

---

## 📊 环境变量概览

以下列出所有支持的环境变量及其简要说明，完整配置步骤请查阅 **[docs/env.md](docs/env.md)**。

### 🧠 模型配置

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_API_KEY` | 视服务商而定 | 统一 API 密钥（OpenAI / Anthropic / Google 等） |
| `AIBO_BASE_URL` | 视服务商而定 | 自定义 API 基础 URL（Azure / Ollama / 兼容接口必填） |
| `AIBO_MODEL_NAME` | ✅ | 模型名称，如 `gpt-4o`、`claude-opus-4-5` |
| `AIBO_MODEL_PROVIDER` | 部分必填 | 显式指定服务商，Groq / Ollama / Azure 必须设置 |
| `AIBO_AZURE_API_VERSION` | 仅 Azure | Azure OpenAI API 版本，默认 `2024-02-15-preview` |

### ⚙️ 运行时配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `AIBO_RECURSION_LIMIT` | ❌ | `1000` | LangGraph 递归深度上限 |
| `AIBO_CHECKPOINTER_TYPE` | ❌ | `memory` | 检查点存储类型：`memory` / `sqlite` / `filesystem` |
| `AIBO_VERBOSE_OUTPUT` | ❌ | `false` | 是否开启调试输出 |
| `AIBO_LANGUAGE` | ❌ | `en` | 提示语言：`en` / `zh` |
| `AIBO_PERSONA` | ❌ | 魅魔人设 | 自定义 AI 人设描述 |
| `AIBO_MAX_CONCURRENT_SUBTASKS` | ❌ | `5` | 最大并发子任务数（1–50） |
| `AIBO_SPECIAL_KEYWORD` | ❌ | `干活` | 触发特殊行为的关键词 |

### 🎙️ 腾讯云 ASR（语音功能）

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_TENCENTCLOUD_APP_ID` | ✅ | 腾讯云账号 AppID |
| `AIBO_TENCENTCLOUD_SECRET_ID` | ✅ | 腾讯云 API SecretId |
| `AIBO_TENCENTCLOUD_SECRET_KEY` | ✅ | 腾讯云 API SecretKey |
| `AIBO_TENCENTCLOUD_REGION` | ❌ | 服务地域，默认 `ap-guangzhou` |

### 🔗 Composio 集成

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_COMPOSIO_API_KEY` | ✅ | Composio 平台 API Key |
| `AIBO_COMPOSIO_EXTERNAL_USER_ID` | ✅ | Composio 外部用户 ID |

### 🏢 Lark 飞书集成

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AIBO_LARK_APP_ID` | ✅ | 飞书自建应用 App ID |
| `AIBO_LARK_APP_SECRET` | ✅ | 飞书自建应用 App Secret |
| `AIBO_LARK_RECEIVE_ID` | ❌ | 默认消息接收方 ID |
| `AIBO_LARK_INTERACTIVE_TEMPLATE_ID` | ❌ | 飞书互动卡片模板 ID |

> 💡 当 `AIBO_LARK_APP_ID`、`AIBO_LARK_APP_SECRET`、`AIBO_LARK_RECEIVE_ID`、`AIBO_LARK_INTERACTIVE_TEMPLATE_ID` 四个变量均已配置时，`aibo` 将自动以飞书模式启动。可通过 `aibo --mode=console` 或 `aibo --mode=lark` 显式指定模式。
>
> 📖 详细配置步骤（含飞书卡片搭建说明）请参阅 **[docs/env.md — Lark 飞书配置](docs/env.md#lark-飞书配置)**。

---

## 📚 文档

| 📄 文件 | 说明 |
|---------|------|
| [docs/env.md](docs/env.md) | 所有环境变量的详细说明及获取步骤 |
| [docs/mcp.md](docs/mcp.md) | MCP 工具集成说明（接入 GitHub、Slack 等外部服务） |
| [agents/](agents/) | 内置 Agent 定义，可扩展自定义 Agent |
| [skills/](skills/) | 内置技能列表，可扩展自定义技能 |

---

## 🤝 贡献指南

我们欢迎贡献！请遵循以下步骤：

1. Fork 仓库
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📜 许可证

此项目在 MIT 许可证下发布 - 有关详细信息，请参阅 [LICENSE](LICENSE) 文件。

## 📬 联系方式

如有问题或建议，请创建 GitHub Issue 或联系项目维护者。
