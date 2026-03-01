# MCP 工具集成（Model Context Protocol）

MCP（Model Context Protocol）允许 AIBO 连接外部工具和服务，极大扩展其能力边界。工具配置定义在 `mcps/` 目录中。

## 工作原理

AIBO 启动时会自动完成以下两步发现流程，无需手动管理工具列表：

1. **读取 `mcps/` 目录**：扫描工作目录下 `mcps/*.json` 配置文件，加载用户自定义的 MCP Server。
2. **自动读取 Claude Desktop 配置**（如已安装）：解析 Claude Desktop 的本地 MCP 配置，免去重复配置。

每个已配置的服务器通过 `@langchain/mcp-adapters` 的 `MultiServerMCPClient` 建立真实连接，并通过 MCP 协议自动发现工具列表——**无需在配置文件中手动枚举工具**。连接失败的服务器会被跳过，不影响其他服务器的加载。

> 💡 **与本机 CLI 工具集成的区别**：AIBO 还支持直接调用本机已安装的编程 CLI 工具（Claude Code、Cursor、Gemini CLI、Codex 等），这是独立于 MCP 的另一项功能特性，无需额外配置，AIBO 启动时会自动检测并加载可用工具。

---

## 配置文件格式

在 `mcps/` 目录下创建 `.json` 文件，支持两种传输方式：

### HTTP 传输（远程 MCP Server）

适用于已部署的 HTTP MCP 服务（如 GitHub MCP、Slack MCP 等）：

```json
{
  "name": "my-http-server",
  "description": "远程 MCP 服务器示例",
  "transport": "http",
  "endpoint": "http://localhost:8080/mcp",
  "authentication": {
    "type": "bearer",
    "token": "my-secret-token"
  }
}
```

认证方式支持：

| `type` | 说明 | 所需字段 |
|--------|------|---------|
| `bearer` | Bearer Token | `token` |
| `api_key` | API Key Header | `header`（默认 `X-API-Key`）、`apiKey` |
| `none` | 无认证 | — |

### stdio 传输（本地 MCP Server 进程）

适用于通过 npm 包或本地命令启动的 MCP Server：

```json
{
  "name": "filesystem",
  "description": "本地文件系统访问",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem"],
  "env": {
    "HOME": "/home/user"
  }
}
```

### 传输方式自动推断

`transport` 字段可省略——AIBO 根据其他字段自动推断：
- 有 `endpoint` → HTTP 传输
- 有 `command` → stdio 传输

### `tools` 字段（可选）

**无需填写**。AIBO 会在连接建立后通过 MCP 协议自动发现服务器提供的所有工具。若填写则以配置为准（向后兼容旧格式）。

---

## Claude Desktop 自动发现

如果本机安装了 Claude Desktop，AIBO 会在启动时自动读取其 MCP 配置：

| 平台 | 配置文件路径 |
|------|------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Claude Desktop 中配置的所有 MCP Server 会被自动加载为 stdio 传输服务器，**无需在 `mcps/` 目录中重复配置**。

若 `mcps/` 目录中存在同名服务器，以 `mcps/` 目录中的配置为准。

---

## 示例配置

### Claude Code（HTTP）

连接本机运行的 Claude Code MCP Server（默认端口 `8081`）：

```json
{
  "name": "claude-code",
  "description": "Claude Code MCP Server for autonomous coding and analysis",
  "transport": "http",
  "endpoint": "http://localhost:8081/mcp"
}
```

### Cursor（HTTP）

连接本机运行的 Cursor MCP Server（默认端口 `8080`）：

```json
{
  "name": "cursor",
  "description": "Cursor IDE MCP Server for autonomous coding capabilities",
  "transport": "http",
  "endpoint": "http://localhost:8080/mcp"
}
```

### GitHub（stdio）

通过 npx 启动 GitHub MCP Server：

```json
{
  "name": "github",
  "description": "GitHub API access via MCP",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
  }
}
```

### 文件系统（stdio）

```json
{
  "name": "filesystem",
  "description": "Local filesystem access",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
}
```

---

## 使用方法

1. 在 `mcps/` 目录下创建 JSON 配置文件（如 `github.json`）。
2. 对于 stdio 服务器，确保相关 npm 包或可执行文件可用（如 `npx -y @modelcontextprotocol/server-github`）。
3. 对于 HTTP 服务器，确保对应服务已启动并监听配置的端口。
4. 启动 AIBO，工具会在启动时自动连接并发现，无需额外操作。

> 📖 **Claude Desktop 用户**：若已在 Claude Desktop 中配置了 MCP 服务器，AIBO 启动时会自动读取这些配置，无需在 `mcps/` 目录中重复填写。

