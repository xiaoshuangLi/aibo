# 环境变量配置说明

本文档详细说明 AIBO 所有环境变量的功能、配置方式，以及如何从各服务提供商处获取对应的密钥或参数。

将项目根目录下的 `.env.example` 复制为 `.env`，然后按照本文档填写各项配置：

```bash
cp .env.example .env
```

---

## 目录

- [模型配置](#模型配置)
- [LangChain 配置](#langchain-配置)
- [记忆配置](#记忆配置)
- [输出配置](#输出配置)
- [语言配置](#语言配置)
- [人设 / 交流风格配置](#人设--交流风格配置)
- [腾讯云 ASR 配置](#腾讯云-asr-配置)
- [Composio 配置](#composio-配置)
- [Lark 飞书配置](#lark-飞书配置)
- [子任务并发配置](#子任务并发配置)
- [特殊关键词配置](#特殊关键词配置)

---

## 模型配置

这组变量决定 AIBO 使用哪个 AI 模型服务商以及如何鉴权。

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_API_KEY` | 视服务商而定 | — | 统一 API 密钥（Ollama 不需要） |
| `AIBO_BASE_URL` | 视服务商而定 | — | 统一 API 基础 URL（Azure 必填；Ollama 默认 `http://localhost:11434`） |
| `AIBO_MODEL_NAME` | ✅ | `gpt-4o` | 模型名称，系统会根据前缀自动识别服务商 |
| `AIBO_MODEL_PROVIDER` | 部分必填 | 自动检测 | 显式指定服务商：`openai` / `anthropic` / `google` / `mistral` / `groq` / `ollama` / `azure`，Groq、Ollama、Azure 必须显式指定 |
| `AIBO_AZURE_API_VERSION` | 仅 Azure | `2024-02-15-preview` | Azure OpenAI API 版本号 |

### 快速示例

```dotenv
# OpenAI
AIBO_API_KEY=sk-...
AIBO_MODEL_NAME=gpt-4o

# Anthropic
AIBO_API_KEY=sk-ant-...
AIBO_MODEL_NAME=claude-3-5-sonnet-20241022

# Google Gemini
AIBO_API_KEY=AIzaSy-...
AIBO_MODEL_NAME=gemini-2.0-flash

# Mistral
AIBO_API_KEY=...
AIBO_MODEL_NAME=mistral-large-latest

# Groq
AIBO_API_KEY=gsk_...
AIBO_MODEL_NAME=llama-3.3-70b-versatile
AIBO_MODEL_PROVIDER=groq

# Ollama（本地部署，无需 API Key）
AIBO_BASE_URL=http://localhost:11434
AIBO_MODEL_NAME=llama3
AIBO_MODEL_PROVIDER=ollama

# Azure OpenAI
AIBO_API_KEY=...
AIBO_BASE_URL=https://<your-instance>.openai.azure.com
AIBO_MODEL_NAME=<your-deployment-name>
AIBO_MODEL_PROVIDER=azure
AIBO_AZURE_API_VERSION=2024-02-15-preview

# OpenAI 兼容接口（DeepSeek、Qwen 等）
AIBO_API_KEY=...
AIBO_BASE_URL=https://api.deepseek.com
AIBO_MODEL_NAME=deepseek-chat
```

### 如何获取 API Key

#### OpenAI

1. 访问 [https://platform.openai.com](https://platform.openai.com) 并登录（或注册）。
2. 点击右上角头像 → **API keys**。
3. 点击 **Create new secret key**，输入名称后点击 **Create secret key**。
4. 复制生成的密钥（格式：`sk-...`），**该密钥仅显示一次，请立即保存**。
5. 将密钥填入 `AIBO_API_KEY`。

#### Anthropic (Claude)

1. 访问 [https://console.anthropic.com](https://console.anthropic.com) 并登录。
2. 进入 **Settings → API Keys**。
3. 点击 **Create Key**，输入名称后确认。
4. 复制生成的密钥（格式：`sk-ant-...`），**仅显示一次**。
5. 将密钥填入 `AIBO_API_KEY`。

#### Google (Gemini)

1. 访问 [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)。
2. 点击 **Create API key**，选择一个 Google Cloud 项目（或新建项目）。
3. 复制生成的密钥（格式：`AIzaSy...`）。
4. 将密钥填入 `AIBO_API_KEY`。

#### Mistral

1. 访问 [https://console.mistral.ai](https://console.mistral.ai) 并登录。
2. 进入 **API Keys** 页面。
3. 点击 **Create new key**，填写名称后确认。
4. 复制密钥，**仅显示一次**。
5. 将密钥填入 `AIBO_API_KEY`。

#### Groq

1. 访问 [https://console.groq.com](https://console.groq.com) 并登录（或注册）。
2. 进入 **API Keys** 页面。
3. 点击 **Create API Key**，输入名称后确认。
4. 复制生成的密钥（格式：`gsk_...`）。
5. 将密钥填入 `AIBO_API_KEY`，并设置 `AIBO_MODEL_PROVIDER=groq`。

#### Ollama（本地）

1. 访问 [https://ollama.com](https://ollama.com) 下载并安装 Ollama。
2. 启动 Ollama 服务（安装后默认自动启动，监听 `http://localhost:11434`）。
3. 拉取所需模型，例如：
   ```bash
   ollama pull llama3
   ```
4. 设置 `AIBO_MODEL_PROVIDER=ollama`，`AIBO_MODEL_NAME=llama3`。无需填写 `AIBO_API_KEY`。

#### Azure OpenAI

1. 登录 [Azure Portal](https://portal.azure.com)，搜索并进入 **Azure OpenAI** 服务。
2. 创建或选择一个 Azure OpenAI 资源。
3. 在资源页面进入 **Keys and Endpoint**，复制 **Key 1** 或 **Key 2**。
4. 进入 **Model deployments**，记录你的部署名称（Deployment name）。
5. 填写对应变量：
   - `AIBO_API_KEY`：步骤 3 中复制的密钥
   - `AIBO_BASE_URL`：形如 `https://<your-resource-name>.openai.azure.com`
   - `AIBO_MODEL_NAME`：步骤 4 中的部署名称
   - `AIBO_MODEL_PROVIDER=azure`

#### DeepSeek / Qwen 等 OpenAI 兼容接口

1. 前往对应平台注册并生成 API Key。
   - DeepSeek：[https://platform.deepseek.com](https://platform.deepseek.com) → **API Keys**
   - 阿里云百炼（Qwen）：[https://bailian.console.aliyun.com](https://bailian.console.aliyun.com) → **API-Key 管理**
2. 将 API Key 填入 `AIBO_API_KEY`。
3. 将对应的 OpenAI 兼容基础 URL 填入 `AIBO_BASE_URL`，例如 `https://api.deepseek.com`。
4. 将模型名称填入 `AIBO_MODEL_NAME`，例如 `deepseek-chat`。

---

## LangChain 配置

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_RECURSION_LIMIT` | ❌ | `1000` | LangGraph 递归深度上限，防止无限循环 |
| `AIBO_CHECKPOINTER_TYPE` | ❌ | `memory` | 检查点存储类型：`memory`（内存）/ `sqlite`（SQLite 文件）/ `filesystem`（文件系统） |

```dotenv
AIBO_RECURSION_LIMIT=1000
AIBO_CHECKPOINTER_TYPE=memory
```

> **说明**：`AIBO_CHECKPOINTER_TYPE` 设为 `sqlite` 或 `filesystem` 时，会话状态将持久化到磁盘，重启后可恢复历史记录。

---

---

## 输出配置

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_VERBOSE_OUTPUT` | ❌ | `false` | 是否开启详细输出（调试模式），设为 `true` 可查看内部推理过程 |

```dotenv
AIBO_VERBOSE_OUTPUT=false
```

---

## 语言配置

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_LANGUAGE` | ❌ | `en` | 系统提示与响应的语言：`en`（英文）/ `zh`（中文） |

```dotenv
AIBO_LANGUAGE=zh
```

---

## 人设 / 交流风格配置

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_PERSONA` | ❌ | 魅魔人设（见下） | 自定义 AI 的人设描述，可完全替换为任意风格 |

```dotenv
# 专业顾问风格（简洁）
AIBO_PERSONA=你是一个专业的技术顾问，说话简洁明了，专注于解决问题，不使用过多的情感表达。

# 默认魅魔人设（活泼亲切）
AIBO_PERSONA=你的交流风格是魅魔人设：妩媚迷人、温柔体贴、善于撒娇。用甜蜜亲切的语气与用户互动，偶尔使用"主人"等称呼，举止优雅而富有魅力。在保持专业技术能力的同时，让每次对话都充满温情与趣味。
```

---

## 腾讯云 ASR 配置

用于语音输入（ASR，自动语音识别）功能。

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_TENCENTCLOUD_APP_ID` | ✅（语音功能） | — | 腾讯云账号的 AppID |
| `AIBO_TENCENTCLOUD_SECRET_ID` | ✅（语音功能） | — | 腾讯云 API 密钥 SecretId |
| `AIBO_TENCENTCLOUD_SECRET_KEY` | ✅（语音功能） | — | 腾讯云 API 密钥 SecretKey |
| `AIBO_TENCENTCLOUD_REGION` | ❌ | `ap-guangzhou` | 服务地域，可选 `ap-beijing`、`ap-shanghai` 等 |

```dotenv
AIBO_TENCENTCLOUD_APP_ID=1234567890
AIBO_TENCENTCLOUD_SECRET_ID=AKIDxxxxxxxxxxxxxxxx
AIBO_TENCENTCLOUD_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_TENCENTCLOUD_REGION=ap-guangzhou
```

### 如何获取腾讯云密钥

1. **登录腾讯云控制台**：访问 [https://console.cloud.tencent.com](https://console.cloud.tencent.com) 并登录。
2. **获取 AppID**：
   - 点击右上角头像 → **账号信息**。
   - 在**基本信息**中可以看到 **账号 ID（即 AppID）**，复制该数字。
3. **获取 SecretId 和 SecretKey**：
   - 访问 [https://console.cloud.tencent.com/cam/capi](https://console.cloud.tencent.com/cam/capi)（访问管理 → API 密钥管理）。
   - 若还没有密钥，点击 **新建密钥**。
   - 在密钥列表中复制 **SecretId** 和 **SecretKey**（SecretKey 默认隐藏，点击显示后复制）。
   - ⚠️ **SecretKey 仅在创建时可完整查看，请妥善保存。**
4. **开通语音识别服务**：
   - 访问 [https://console.cloud.tencent.com/asr](https://console.cloud.tencent.com/asr)。
   - 点击**立即开通**，按提示完成服务开通。
5. 将上述信息分别填入对应的环境变量。

---

## Composio 配置

用于通过 [Composio](https://composio.dev) 集成第三方工具与 SaaS 服务。

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_COMPOSIO_API_KEY` | ✅（Composio 功能） | — | Composio 平台 API Key |
| `AIBO_COMPOSIO_EXTERNAL_USER_ID` | ✅（Composio 功能） | — | 外部用户 ID，用于关联 Composio 账户 |

```dotenv
AIBO_COMPOSIO_API_KEY=your-composio-api-key
AIBO_COMPOSIO_EXTERNAL_USER_ID=your-external-user-id
```

### 如何获取 Composio API Key

1. 访问 [https://app.composio.dev](https://app.composio.dev) 并注册 / 登录。
2. 登录后进入控制台首页，点击左侧菜单 **Settings** 或 **API Keys**。
3. 点击 **Generate API Key**（或 **Create new key**），输入名称后确认。
4. 复制生成的 API Key，填入 `AIBO_COMPOSIO_API_KEY`。
5. `AIBO_COMPOSIO_EXTERNAL_USER_ID` 可以设为任意唯一字符串（如用户邮箱或自定义 ID），用于将 Composio 连接与特定用户绑定。

---

## Lark 飞书配置

用于将 AIBO 接入飞书（Lark）平台，实现企业级消息交互。

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_LARK_APP_ID` | ✅（飞书功能） | — | 飞书自建应用的 App ID |
| `AIBO_LARK_APP_SECRET` | ✅（飞书功能） | — | 飞书自建应用的 App Secret |
| `AIBO_LARK_RECEIVE_ID` | ❌ | — | 默认消息接收方 ID（用户 open_id 或群 chat_id） |
| `AIBO_LARK_INTERACTIVE_TEMPLATE_ID` | ❌ | — | 飞书互动卡片模板 ID |

```dotenv
AIBO_LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
AIBO_LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_LARK_RECEIVE_ID=ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_LARK_INTERACTIVE_TEMPLATE_ID=AAq0xxxxxxxxxxx
```

### 如何获取飞书应用凭证

1. **创建飞书自建应用**：
   - 访问 [https://open.feishu.cn/app](https://open.feishu.cn/app)（飞书开放平台）并登录。
   - 点击 **创建企业自建应用**，填写应用名称和描述后点击**确定创建**。
2. **获取 App ID 和 App Secret**：
   - 进入新建应用的 **凭证与基础信息** 页面。
   - 复制 **App ID**（格式：`cli_...`）和 **App Secret**（点击查看并复制）。
   - 填入 `AIBO_LARK_APP_ID` 和 `AIBO_LARK_APP_SECRET`。
3. **开启消息发送能力**：
   - 在应用页面进入 **功能** → **机器人**，开启机器人能力。
   - 在 **权限管理** 中申请以下权限（至少）：
     - `im:message`（读取和发送消息）
     - `im:message:send_as_bot`（以机器人身份发送消息）
4. **发布应用**：
   - 在 **版本管理与发布** 中点击**创建版本**，填写版本信息后提交审批发布。
   - 企业管理员审批通过后应用生效。
5. **获取 Receive ID（可选）**：
   - **用户 open_id**：可通过飞书开放平台的 [用户信息查询工具](https://open.feishu.cn/tool/user) 获取。
   - **群 chat_id**：在群设置中添加机器人后，可在事件日志或 API 调试工具中获取。
6. **获取互动卡片模板 ID（可选）**：
   - 访问 [飞书卡片搭建工具](https://open.feishu.cn/tool/cardkit)，创建或选择一个互动卡片模板。
   - ⚠️ **重要**：卡片模板中必须添加支持 `title` 和 `content` 两个变量，AIBO 将通过这两个变量动态填充消息标题和内容。
   - 复制模板 ID，填入 `AIBO_LARK_INTERACTIVE_TEMPLATE_ID`。

> **启动模式说明**：当 `AIBO_LARK_APP_ID`、`AIBO_LARK_APP_SECRET` 均已配置时，`aibo` 命令将自动以飞书模式启动。可通过命令行参数覆盖：
> ```bash
> aibo --interaction=console  # 强制使用终端模式
> aibo --interaction=lark     # 强制使用飞书模式
> ```

---

## 子任务并发配置

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_MAX_CONCURRENT_SUBTASKS` | ❌ | `5` | 最大并发子任务数量，取值范围 1–50 |

```dotenv
AIBO_MAX_CONCURRENT_SUBTASKS=5
```

> **提示**：增大此值可提高并行处理速度，但会相应增加 API 请求速率和费用。建议根据所使用模型的速率限制合理调整。

---

## 特殊关键词配置

| 变量名 | 是否必填 | 默认值 | 说明 |
|--------|----------|--------|------|
| `AIBO_SPECIAL_KEYWORD` | ❌ | `干活` | 触发特殊行为的关键词，在语音和终端输入中生效 |

```dotenv
AIBO_SPECIAL_KEYWORD=干活
```

---

## 完整配置示例

以下是一份使用 OpenAI + 腾讯云语音 + 飞书集成的完整 `.env` 示例：

```dotenv
# 模型
AIBO_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_MODEL_NAME=gpt-4o

# LangChain
AIBO_RECURSION_LIMIT=1000
AIBO_CHECKPOINTER_TYPE=memory

# 输出
AIBO_VERBOSE_OUTPUT=false

# 语言
AIBO_LANGUAGE=zh

# 人设
AIBO_PERSONA=你是一个专业的技术顾问，说话简洁明了，专注于解决问题。

# 腾讯云 ASR
AIBO_TENCENTCLOUD_APP_ID=1234567890
AIBO_TENCENTCLOUD_SECRET_ID=AKIDxxxxxxxxxxxxxxxx
AIBO_TENCENTCLOUD_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_TENCENTCLOUD_REGION=ap-guangzhou

# 飞书
AIBO_LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
AIBO_LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_LARK_RECEIVE_ID=ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 子任务
AIBO_MAX_CONCURRENT_SUBTASKS=5

# 特殊关键词
AIBO_SPECIAL_KEYWORD=干活
```
