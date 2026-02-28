# AIBO - 高级多智能体自主编程AI助手

一款基于多智能体架构的自主编程 AI 助手，支持终端和飞书两种交互方式，可接入主流 AI 模型服务。

## 功能特性

- ✅ **自主编程**: 跨语言编写、修改、调试和优化代码，具备完整的本地文件系统访问能力
- ✅ **多模型支持**: 兼容 OpenAI、Anthropic、Google Gemini、Mistral、Groq、Ollama、Azure OpenAI 及任意 OpenAI 兼容接口
- ✅ **飞书企业集成**: 作为飞书机器人接入企业群/私聊，支持互动卡片消息和 `/rebot` 重启命令
- ✅ **语音输入**: 通过腾讯云 ASR 实现实时语音转文字输入（需配置腾讯云密钥）
- ✅ **网页搜索与抓取**: 内置 Web 搜索和网页内容获取能力，辅助信息收集与研究
- ✅ **中英双语**: 支持中文和英文系统提示，可通过 `AIBO_LANGUAGE` 切换

## 快速开始

### 先决条件
- Node.js 18+

### 全局安装

```bash
npm install -g aibo
```

### 配置

在任意工作目录创建 `.env` 文件，至少填写 AI 模型相关配置：

```dotenv
# 必填：AI 模型（以 OpenAI 为例）
AIBO_API_KEY=sk-...
AIBO_MODEL_NAME=gpt-4o

# 可选：语言（zh / en，默认 en）
AIBO_LANGUAGE=zh
```

完整变量说明请参阅 **[docs/env.md](docs/env.md)**。

### 使用场景

#### 场景一：终端交互模式

适合本地开发、日常编程辅助。

```bash
aibo
# 或显式指定
aibo --interaction=console
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
aibo --interaction=lark
```

> 💡 同时配置了 `AIBO_LARK_APP_ID` 和 `AIBO_LARK_APP_SECRET` 时，`aibo` 默认以飞书模式启动。

#### 场景三：语音输入模式

在终端交互模式下，额外配置腾讯云 ASR 密钥后可直接通过麦克风语音输入：

```dotenv
AIBO_TENCENTCLOUD_APP_ID=1234567890
AIBO_TENCENTCLOUD_SECRET_ID=AKIDxxxxxxxxxxxxxxxx
AIBO_TENCENTCLOUD_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 本地开发

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
>
> 📖 详细配置步骤（含飞书卡片搭建说明）请参阅 **[docs/env.md — Lark 飞书配置](docs/env.md#lark-飞书配置)**。

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
