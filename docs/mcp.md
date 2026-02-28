# MCP 工具集成（Model Context Protocol）

MCP（Model Context Protocol）允许 AIBO 连接外部工具和服务，极大扩展其能力边界。工具配置定义在 `mcps/` 目录中。

## 功能场景

AIBO 通过 MCP 协议接入外部工具和服务，扩展 AI 的工具调用范围。

典型使用场景：

- **GitHub / Slack 等服务**：通过标准 MCP 配置接入第三方服务 API，扩展 AIBO 的工具调用范围。
- **自定义服务**：接入任意支持 MCP 协议的 HTTP 服务，灵活扩展能力边界。

> 💡 **与本机 CLI 工具集成的区别**：AIBO 还支持直接调用本机已安装的编程 CLI 工具（Claude Code、Cursor、Gemini CLI、Codex 等），这是独立于 MCP 的另一项功能特性，无需额外配置，AIBO 启动时会自动检测并加载可用工具。

## 配置文件格式

在 `mcps/` 目录下创建 JSON 配置文件，格式如下：

```json
{
  "name": "my-tool",
  "description": "工具描述",
  "endpoint": "http://localhost:8080/mcp",
  "authentication": {
    "type": "bearer"
  },
  "tools": [
    {
      "name": "tool_action",
      "description": "执行某操作",
      "parameters": {
        "required": ["param1"],
        "properties": {
          "param1": { "type": "string", "description": "参数说明" }
        }
      }
    }
  ]
}
```

> `tools` 字段为可选项。若省略，AIBO 将在运行时从 MCP Server 自动发现可用工具；若填写，则以配置为准。

## 示例配置

### Claude Code

连接本机运行的 Claude Code MCP Server（默认端口 `8081`）：

```json
{
  "name": "claude-code",
  "description": "Claude Code MCP Server for autonomous coding and analysis",
  "endpoint": "http://localhost:8081/mcp",
  "authentication": {
    "type": "none"
  }
}
```

### Cursor

连接本机运行的 Cursor MCP Server（默认端口 `8080`）：

```json
{
  "name": "cursor",
  "description": "Cursor IDE MCP Server for autonomous coding capabilities",
  "endpoint": "http://localhost:8080/mcp",
  "authentication": {
    "type": "none"
  }
}
```

## 使用方法

1. 在 `mcps/` 目录下创建 JSON 配置文件（如 `claude-code.json`）。
2. 确保对应的 MCP Server 已在本机启动并监听配置的端口。
3. 启动 AIBO 后，Agent 会自动发现并加载 `mcps/` 目录下的所有配置。
4. 当任务需要时，AIBO 会调用对应工具执行子任务。
