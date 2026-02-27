import * as fs from 'fs';
import * as path from 'path';

/**
 * 本地 MCP Server 配置接口
 */
interface LocalMcpConfig {
  name: string;
  description: string;
  endpoint: string;
  authentication?: {
    type: 'api_key' | 'bearer' | 'basic' | 'none';
    header?: string;
    apiKey?: string;
  };
  tools: Array<{
    name: string;
    description: string;
    parameters: {
      required?: string[];
      properties: Record<string, {
        type: string;
        description: string;
      }>;
    };
  }>;
}

/**
 * 从本地 mcps 目录加载 MCP 配置并创建工具
 * 
 * 这个工具不依赖外部 MCP Server 连接，而是基于配置文件提供工具定义
 * 实际的工具执行需要在 Agent 层面实现具体的调用逻辑
 */
export default async function getLocalMcpTools() {
  const tools: any[] = [];
  const mcpsDir = path.join(process.cwd(), 'mcps');
  
  try {
    // 检查 mcps 目录是否存在
    if (!fs.existsSync(mcpsDir)) {
      console.log('Local MCP directory not found, skipping local MCP tools');
      return [];
    }
    
    // 读取 mcps 目录下所有 .json 文件（排除 README.md）
    const files = fs.readdirSync(mcpsDir)
      .filter(file => file.endsWith('.json') && file !== 'README.md');
    
    if (files.length === 0) {
      console.log('No MCP configuration files found in mcps directory');
      return [];
    }
    
    console.log(`Found ${files.length} MCP configuration file(s) in mcps directory`);
    
    for (const file of files) {
      try {
        const configPath = path.join(mcpsDir, file);
        const config: LocalMcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // 验证必需字段
        if (!config.name || !config.tools) {
          console.warn(`Skipping invalid MCP config ${file}: missing required fields`);
          continue;
        }
        
        console.log(`Loading MCP server configuration: ${config.name}`);
        
        // 创建工具定义（不实际连接到 MCP Server）
        const serverTools = config.tools.map(tool => ({
          name: `${config.name}_${tool.name}`,
          description: `[${config.name}] ${tool.description || tool.name}`,
          parameters: tool.parameters || {},
          server: config.name,
          endpoint: config.endpoint,
          authentication: config.authentication,
          originalToolName: tool.name
        }));
        
        tools.push(...serverTools);
        console.log(`Loaded ${serverTools.length} tool definitions from ${config.name}`);
        
      } catch (error) {
        console.warn(`Failed to parse MCP config ${file}:`, (error as Error).message);
        continue;
      }
    }
    
    console.log(`Total local MCP tools loaded: ${tools.length}`);
    return tools;
    
  } catch (error) {
    console.error('Error loading local MCP tools:', (error as Error).message);
    return [];
  }
}