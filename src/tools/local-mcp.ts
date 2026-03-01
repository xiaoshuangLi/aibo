import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { Connection } from '@langchain/mcp-adapters';

/**
 * 扩展的 MCP Server 配置接口
 *
 * 支持两种传输方式：
 * - HTTP / Streamable-HTTP（使用 endpoint 字段）
 * - stdio（使用 command + args 字段）
 *
 * `tools` 字段为可选：省略时通过 MCP 协议自动发现工具列表。
 */
interface LocalMcpConfig {
  /** 服务器唯一标识（用于工具名称前缀） */
  name: string;
  /** 服务器描述 */
  description?: string;
  /**
   * 传输方式
   * - `http`（或省略）：使用 Streamable HTTP / SSE 连接远程服务器
   * - `stdio`：以子进程方式启动本地服务器
   */
  transport?: 'http' | 'stdio';
  /** HTTP 传输：服务器地址（如 "http://localhost:8080/mcp"） */
  endpoint?: string;
  /** HTTP 传输：认证方式 */
  authentication?: {
    type: 'api_key' | 'bearer' | 'basic' | 'none';
    header?: string;
    apiKey?: string;
    token?: string;
  };
  /** stdio 传输：可执行命令（如 "npx"） */
  command?: string;
  /** stdio 传输：命令行参数（如 ["-y", "@modelcontextprotocol/server-filesystem"]） */
  args?: string[];
  /** stdio 传输：额外的环境变量 */
  env?: Record<string, string>;
  /**
   * 工具列表（可选）
   * 省略时自动从 MCP Server 协议层发现可用工具。
   */
  tools?: Array<{
    name: string;
    description: string;
    parameters: {
      required?: string[];
      properties: Record<string, { type: string; description: string }>;
    };
  }>;
}

/**
 * Claude Desktop 配置文件的 mcpServers 格式
 */
interface ClaudeDesktopServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * 返回当前操作系统上 Claude Desktop 配置文件的可能路径列表
 */
function getClaudeDesktopConfigPaths(): string[] {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    return [path.join(appData, 'Claude', 'claude_desktop_config.json')];
  }
  if (process.platform === 'darwin') {
    return [
      path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    ];
  }
  // Linux / other Unix
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(home, '.config');
  return [
    path.join(xdgConfig, 'Claude', 'claude_desktop_config.json'),
    path.join(home, '.claude', 'claude_desktop_config.json'),
  ];
}

/**
 * 从 Claude Desktop 配置文件中读取 MCP Server 定义
 *
 * Claude Desktop 使用 stdio 方式管理 MCP 服务器，其配置文件格式为：
 * ```json
 * {
 *   "mcpServers": {
 *     "server-name": {
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-filesystem"],
 *       "env": {}
 *     }
 *   }
 * }
 * ```
 *
 * @returns 发现的 MCP Server 配置数组，若未找到配置文件则返回空数组
 */
function loadClaudeDesktopConfigs(): LocalMcpConfig[] {
  const candidatePaths = getClaudeDesktopConfigPaths();

  for (const configPath of candidatePaths) {
    try {
      if (!fs.existsSync(configPath)) {
        continue;
      }

      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      const mcpServers: Record<string, ClaudeDesktopServerEntry> =
        parsed?.mcpServers ?? {};

      const configs: LocalMcpConfig[] = Object.entries(mcpServers).map(
        ([name, entry]) => ({
          name,
          transport: 'stdio' as const,
          command: entry.command,
          args: entry.args ?? [],
          env: entry.env,
        })
      );

      if (configs.length > 0) {
        console.log(
          `Auto-discovered ${configs.length} MCP server(s) from Claude Desktop config: ${configPath}`
        );
      }

      return configs;
    } catch (error) {
      console.debug(
        `Failed to read Claude Desktop config at ${configPath}:`,
        (error as Error).message
      );
    }
  }

  return [];
}

/**
 * 从 mcps/ 目录读取用户自定义 MCP Server 配置
 *
 * @param mcpsDir - mcps 目录的绝对路径
 * @returns 解析后的配置数组
 */
function loadMcpDirConfigs(mcpsDir: string): LocalMcpConfig[] {
  if (!fs.existsSync(mcpsDir)) {
    return [];
  }

  let files: string[];
  try {
    files = fs
      .readdirSync(mcpsDir)
      .filter((f) => f.endsWith('.json') && f !== 'README.md');
  } catch (error) {
    console.warn(`Failed to read mcps directory ${mcpsDir}:`, (error as Error).message);
    return [];
  }

  if (files.length === 0) {
    return [];
  }

  const configs: LocalMcpConfig[] = [];
  for (const file of files) {
    try {
      const configPath = path.join(mcpsDir, file);
      const config: LocalMcpConfig = JSON.parse(
        fs.readFileSync(configPath, 'utf8')
      );

      if (!config.name) {
        console.warn(`Skipping invalid MCP config ${file}: missing "name" field`);
        continue;
      }

      // Infer transport from fields present in the config
      if (!config.transport) {
        config.transport = config.command ? 'stdio' : 'http';
      }

      configs.push(config);
    } catch (error) {
      console.warn(
        `Failed to parse MCP config ${file}:`,
        (error as Error).message
      );
    }
  }

  return configs;
}

/**
 * 将单个 LocalMcpConfig 转换为 MultiServerMCPClient 所需的连接配置
 *
 * @param config - 服务器配置
 * @returns MultiServerMCPClient mcpServers 记录中的单个条目，或 null（如配置不完整）
 */
function buildConnectionEntry(
  config: LocalMcpConfig
): Connection | null {
  const transport = config.transport ?? (config.command ? 'stdio' : 'http');

  if (transport === 'stdio') {
    if (!config.command) {
      console.warn(
        `MCP config "${config.name}" uses stdio transport but is missing "command"`
      );
      return null;
    }
    return {
      transport: 'stdio',
      command: config.command,
      args: config.args ?? [],
      ...(config.env ? { env: config.env } : {}),
    };
  }

  // HTTP / Streamable-HTTP transport
  if (!config.endpoint) {
    console.warn(
      `MCP config "${config.name}" uses http transport but is missing "endpoint"`
    );
    return null;
  }

  const headers: Record<string, string> = {};
  if (config.authentication) {
    const auth = config.authentication;
    if (auth.type === 'bearer' && auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'api_key' && auth.apiKey) {
      headers[auth.header ?? 'X-API-Key'] = auth.apiKey;
    }
  }

  return {
    url: config.endpoint,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };
}

/**
 * 加载所有 MCP 工具
 *
 * 发现顺序：
 * 1. 读取工作目录下 `mcps/` 目录中的 JSON 配置文件
 * 2. 自动读取 Claude Desktop 配置文件（如已安装）
 *
 * 每个服务器的工具通过 MCP 协议自动发现（无需在配置中手动列出 tools）。
 * 若某个服务器连接失败，将跳过该服务器并继续加载其他服务器的工具。
 *
 * @returns 所有已连接 MCP Server 提供的 LangChain DynamicStructuredTool 数组
 */
export default async function getLocalMcpTools() {
  const mcpsDir = path.join(process.cwd(), 'mcps');

  // 1. Collect configs from mcps/ directory
  const dirConfigs = loadMcpDirConfigs(mcpsDir);

  // 2. Auto-discover from Claude Desktop (deduplicate by name)
  const claudeConfigs = loadClaudeDesktopConfigs();
  const dirNames = new Set(dirConfigs.map((c) => c.name));
  const uniqueClaudeConfigs = claudeConfigs.filter((c) => !dirNames.has(c.name));

  const allConfigs = [...dirConfigs, ...uniqueClaudeConfigs];

  if (allConfigs.length === 0) {
    console.log('No MCP server configurations found, skipping MCP tools');
    return [];
  }

  // 3. Build mcpServers map for MultiServerMCPClient
  const mcpServers: Record<string, Connection> = {};
  for (const config of allConfigs) {
    const entry = buildConnectionEntry(config);
    if (entry) {
      mcpServers[config.name] = entry;
    }
  }

  if (Object.keys(mcpServers).length === 0) {
    return [];
  }

  console.log(
    `Connecting to ${Object.keys(mcpServers).length} MCP server(s): ${Object.keys(mcpServers).join(', ')}`
  );

  // 4. Connect and auto-discover tools via MCP protocol
  try {
    const client = new MultiServerMCPClient({
      mcpServers,
      // Don't fail the whole startup if one server is unavailable
      onConnectionError: 'ignore',
    });

    const tools = await client.getTools();

    if (tools.length > 0) {
      console.log(`Loaded ${tools.length} tool(s) from MCP servers`);
    }

    return tools;
  } catch (error) {
    console.error('Error loading MCP tools:', (error as Error).message);
    return [];
  }
}