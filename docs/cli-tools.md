# 本机 CLI 工具集成

AIBO 支持直接调用本机已安装的 AI 编程 CLI 工具，将编码子任务委派给这些工具执行。这是独立于 MCP 协议的另一项功能特性，**无需额外配置**——AIBO 启动时会自动检测本机可用工具并加载。

> 💡 **注意**：除了本机 CLI 工具集成，AIBO 还内置了多种 LangChain 工具，包括 **Playwright 浏览器自动化工具集**（支持网页导航、交互、内容提取、截图等），这些内置工具无需安装，开箱即用。

## 工作原理

AIBO 启动时会依次检测以下 CLI 命令是否可用（通过 `<tool> --version` 探测）：

| 工具 | 命令 | 提供方 | 擅长场景 |
|------|------|--------|---------|
| **Claude Code** | `claude` | Anthropic | 架构决策、代码审查、跨文件重构、复杂逻辑调试 |
| **Gemini CLI** | `gemini` | Google | 前端 UI 组件（React/Vue/HTML/CSS）、需要超长上下文的任务、多模态（图像 + 代码）|
| **OpenAI Codex** | `codex` | OpenAI | 后端 API（REST/GraphQL）、数据库/ORM、服务端逻辑、脚本 |
| **Cursor** | `cursor` | Anysphere | 通用编程：任意编码任务、文件编辑、Shell 命令、代码库搜索 |
| **GitHub Copilot** | `copilot` | GitHub | 通用编程：任意编码任务、文件编辑、Shell 命令、代码库搜索 |

所有检测到的工具都会被注册为可调用的 LangChain 工具，并动态写入系统提示中的路由指南。

---

## 安装各工具 CLI

### Claude Code

```bash
npm install -g @anthropic-ai/claude-code
# 然后登录
claude login
```

> 🔑 需要 Anthropic 账号，详见 [https://claude.ai/code](https://claude.ai/code)

### Gemini CLI

```bash
npm install -g @google/gemini-cli
# 然后登录
gemini login
```

> 🔑 需要 Google 账号，详见 [https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)

### OpenAI Codex

```bash
npm install -g @openai/codex
# 设置 API Key
export OPENAI_API_KEY=sk-...
```

> 🔑 需要 OpenAI API Key，详见 [https://github.com/openai/codex](https://github.com/openai/codex)

### Cursor

Cursor 是一款 AI 编程 IDE，安装桌面版后自带 `cursor` CLI 命令：

1. 前往 [https://cursor.com](https://cursor.com) 下载并安装 Cursor。
2. 在 Cursor 设置中启用 "Install cursor command in PATH"。
3. 验证安装：`cursor --version`

### GitHub Copilot CLI

```bash
# 安装 GitHub CLI（gh）
# macOS: brew install gh
# 其他平台见 https://cli.github.com

# 安装 Copilot CLI 扩展
gh extension install github/gh-copilot

# 登录（按提示完成认证）
gh auth login
```

> 🔑 需要 GitHub Copilot 订阅，详见 [https://github.com/features/copilot](https://github.com/features/copilot)

---

## 任务路由策略

当多个 CLI 工具同时可用时，AIBO 会根据任务类型自动路由：

- **前端 UI / 组件** → `gemini_execute`
- **后端 API / 数据库** → `codex_execute`
- **架构分析 / 代码审查** → `claude_execute`
- **通用编程任务** → `cursor_execute` 或 `copilot_execute`（按此优先级）

当只有一个工具可用时，所有编码任务都委派给该工具。

> 📖 详细路由决策树请参阅 **[skills/coding-agent-router/SKILL.md](../skills/coding-agent-router/SKILL.md)**

---

## 与 MCP 工具集成的区别

| 特性 | 本机 CLI 工具集成 | MCP 工具集成 |
|------|-----------------|------------|
| 配置方式 | 无需配置，启动时自动检测 | 需在 `mcps/` 目录下创建 JSON 配置文件 |
| 工具来源 | 本机安装的 AI 编程 CLI | 任意 MCP 兼容服务（GitHub、Slack 等）|
| 主要用途 | 编码任务委派给 AI 编程代理 | 扩展 AI 的工具调用（API 操作、数据查询等）|
| 网络要求 | 各 CLI 工具各自处理 | 依赖各 MCP Server 的网络连接 |

> 📖 MCP 工具集成详情请参阅 **[docs/mcp.md](mcp.md)**
