# MCP 工具集成（Model Context Protocol）

MCP（Model Context Protocol）允许 AIBO 连接外部工具和服务，极大扩展其能力边界。工具配置定义在 `mcps/` 目录中。

## 功能场景

AIBO 通过 MCP 协议对接用户本机已安装的编程 CLI 工具，例如 **Claude Code**、**Cursor** 等，让这些工具作为 AIBO 的子任务执行器使用。

典型使用场景：

- **Claude Code**：AIBO 调度本机的 Claude Code CLI，将具体编码子任务委派给它执行，充分利用其自主编码能力。
- **Cursor**：AIBO 通过 Cursor 的 MCP Server 实现代码编辑和生成，结合 Cursor IDE 的智能补全完成复杂改动。
- **GitHub / Slack 等服务**：通过标准 MCP 配置接入第三方服务 API，扩展 AIBO 的工具调用范围。

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
