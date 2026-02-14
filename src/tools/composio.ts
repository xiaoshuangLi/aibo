import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { Composio } from "@composio/core";
import { config } from '@/core/config/config';

/**
 * 异步获取 Composio 工具的方法
 * 
 * @returns Promise<Array<any>> - 包含所有 Composio 工具的数组
 */
export default async function getComposioTools() {
  // Initialize Composio with environment variables
  const composio = new Composio({
    apiKey: config.composio.apiKey,
  });

  // Create a tool router session
  const session = await composio.create(config.composio.externalUserId);

  try {
    // Create MCP client
    const client = new MultiServerMCPClient({
      composio: {
        transport: "http",
        url: session.mcp.url,
        headers: session.mcp.headers,
      },
    });

    // Get tools from MCP
    const tools = await client.getTools();

    return tools;
  } catch (error) {
    console.error(error);
    return [];
  }
}

