# MCP Servers 连接配置目录

这个目录用于存放已注册的 MCP Server 连接配置。

## 配置文件格式

每个 MCP Server 配置文件必须包含以下信息：

```json
{
  "serverName": "github", // MCP Server 名称（必须与 Composio 支持的工具包名称匹配）
  "displayName": "GitHub Integration",
  "description": "Access GitHub repositories, issues, and pull requests",
  "connectionRequired": true, // 是否需要用户授权连接
  "tools": ["GITHUB_CREATE_ISSUE", "GITHUB_FETCH_REPOSITORY"], // 可用的工具列表
  "categories": ["development", "git"] // 分类标签
}
```

## 支持的 MCP Server

当前支持的 MCP Server 包括：
- github, gitlab, gmail, outlook, slack, notion, jira, linear, trello
- google_sheets, google_docs, google_drive, google_calendar  
- microsoft_teams, microsoft_onedrive
- x_twitter, instagram, facebook_pages
- figma, web_search, browser_automation
- 等等（完整列表请参考 Composio 文档）

## 使用方法

1. 在 `mcps/` 目录下创建配置文件（如 `github.json`）
2. Agent 启动时会读取这些配置
3. 当用户请求相关功能时，Agent 会自动使用对应的 MCP Server 工具
4. 如果需要授权，会提示用户进行连接

## 示例配置

查看现有的配置文件了解详细格式。