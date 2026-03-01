// Mock the fs module so we can control filesystem behavior
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock MultiServerMCPClient so we don't need real MCP servers in tests
jest.mock('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: jest.fn().mockImplementation(() => ({
    getTools: jest.fn().mockResolvedValue([]),
  })),
}));

import * as fs from 'fs';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

import getLocalMcpTools from '@/tools/local-mcp';

describe('Local MCP Tools - Additional Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array when no configs found (no mcps dir, no Claude config)', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should return empty array when mcps dir exists but has no JSON files', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['README.md', 'other.txt']);

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should skip config files missing required "name" field', async () => {
    const invalidConfig = JSON.stringify({ description: 'No name here', endpoint: 'http://localhost:3000' });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['invalid.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(invalidConfig);

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should skip file when JSON parsing fails', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['broken.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue('not valid json{');

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should return empty array when readdirSync throws an error', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied reading directory');
    });

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should connect to HTTP server and return discovered tools', async () => {
    const fakeTool = { name: 'test-server_do-something', description: 'Does something' };
    const mockGetTools = jest.fn().mockResolvedValue([fakeTool]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const validConfig = JSON.stringify({
      name: 'test-server',
      description: 'A test MCP server',
      transport: 'http',
      endpoint: 'http://localhost:3000/mcp',
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['test-server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(validConfig);

    const tools = await getLocalMcpTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test-server_do-something');
    expect(mockGetTools).toHaveBeenCalled();
  });

  it('should infer http transport when endpoint is provided and transport is omitted', async () => {
    const fakeTool = { name: 'server_tool' };
    const mockGetTools = jest.fn().mockResolvedValue([fakeTool]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'server',
      endpoint: 'http://localhost:8080/mcp',
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    await getLocalMcpTools();

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    expect(constructorCall.mcpServers['server']).toHaveProperty('url', 'http://localhost:8080/mcp');
  });

  it('should infer stdio transport when command is provided and transport is omitted', async () => {
    const fakeTool = { name: 'fs_read' };
    const mockGetTools = jest.fn().mockResolvedValue([fakeTool]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['filesystem.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    await getLocalMcpTools();

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    expect(constructorCall.mcpServers['filesystem']).toMatchObject({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    });
  });

  it('should use explicit stdio transport when specified', async () => {
    const mockGetTools = jest.fn().mockResolvedValue([]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'my-server',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { MY_VAR: 'value' },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['my-server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    await getLocalMcpTools();

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    expect(constructorCall.mcpServers['my-server']).toMatchObject({
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { MY_VAR: 'value' },
    });
  });

  it('should inject bearer auth header for HTTP servers', async () => {
    const mockGetTools = jest.fn().mockResolvedValue([]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'secure-server',
      transport: 'http',
      endpoint: 'http://localhost:4000/mcp',
      authentication: { type: 'bearer', token: 'my-secret-token' },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['secure-server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    await getLocalMcpTools();

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    expect(constructorCall.mcpServers['secure-server'].headers).toMatchObject({
      Authorization: 'Bearer my-secret-token',
    });
  });

  it('should inject api_key auth header for HTTP servers', async () => {
    const mockGetTools = jest.fn().mockResolvedValue([]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'api-server',
      transport: 'http',
      endpoint: 'http://localhost:4000/mcp',
      authentication: { type: 'api_key', header: 'X-API-Key', apiKey: 'abc123' },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['api-server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    await getLocalMcpTools();

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    expect(constructorCall.mcpServers['api-server'].headers).toMatchObject({
      'X-API-Key': 'abc123',
    });
  });

  it('should skip config missing both endpoint and command for http transport', async () => {
    const mockGetTools = jest.fn().mockResolvedValue([]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'incomplete-server',
      transport: 'http',
      // no endpoint!
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['incomplete.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
    expect(MultiServerMCPClient).not.toHaveBeenCalled();
  });

  it('should load tools from multiple valid configs', async () => {
    const fakeTool1 = { name: 'server1_tool1' };
    const fakeTool2a = { name: 'server2_tool2a' };
    const fakeTool2b = { name: 'server2_tool2b' };
    const mockGetTools = jest.fn().mockResolvedValue([fakeTool1, fakeTool2a, fakeTool2b]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config1 = JSON.stringify({
      name: 'server1',
      transport: 'http',
      endpoint: 'http://localhost:3001/mcp',
    });
    const config2 = JSON.stringify({
      name: 'server2',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server2-package'],
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['server1.json', 'server2.json']);
    (fs.readFileSync as jest.Mock)
      .mockReturnValueOnce(config1)
      .mockReturnValueOnce(config2);

    const tools = await getLocalMcpTools();
    expect(tools).toHaveLength(3);
  });

  it('should continue loading when one file has invalid JSON', async () => {
    const fakeTool = { name: 'valid-server_tool1' };
    const mockGetTools = jest.fn().mockResolvedValue([fakeTool]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const validConfig = JSON.stringify({
      name: 'valid-server',
      transport: 'http',
      endpoint: 'http://localhost:3000/mcp',
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['broken.json', 'valid.json']);
    (fs.readFileSync as jest.Mock)
      .mockReturnValueOnce('INVALID JSON')
      .mockReturnValueOnce(validConfig);

    const tools = await getLocalMcpTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('valid-server_tool1');
  });

  it('should return empty array when MultiServerMCPClient.getTools throws', async () => {
    const mockGetTools = jest.fn().mockRejectedValue(new Error('Connection refused'));
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'server',
      transport: 'http',
      endpoint: 'http://localhost:3000/mcp',
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should use onConnectionError: ignore when creating MultiServerMCPClient', async () => {
    const mockGetTools = jest.fn().mockResolvedValue([]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    const config = JSON.stringify({
      name: 'server',
      endpoint: 'http://localhost:3000/mcp',
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(config);

    await getLocalMcpTools();

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    expect(constructorCall.onConnectionError).toBe('ignore');
  });

  it('should auto-discover from Claude Desktop config when available', async () => {
    const fakeClaudeTool = { name: 'filesystem_read' };
    const mockGetTools = jest.fn().mockResolvedValue([fakeClaudeTool]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    // mcps dir is missing, Claude Desktop config exists
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      return p.endsWith('claude_desktop_config.json');
    });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
        },
      })
    );

    const tools = await getLocalMcpTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('filesystem_read');

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    expect(constructorCall.mcpServers['filesystem']).toMatchObject({
      transport: 'stdio',
      command: 'npx',
    });
  });

  it('should deduplicate: mcps dir config takes priority over Claude Desktop config with same name', async () => {
    const mockGetTools = jest.fn().mockResolvedValue([]);
    (MultiServerMCPClient as jest.Mock).mockImplementation(() => ({ getTools: mockGetTools }));

    // Both mcps dir and Claude Desktop have a server named "filesystem"
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['filesystem.json']);
    (fs.readFileSync as jest.Mock)
      .mockReturnValueOnce(
        // mcps/filesystem.json
        JSON.stringify({
          name: 'filesystem',
          transport: 'http',
          endpoint: 'http://localhost:3333/mcp',
        })
      )
      .mockReturnValueOnce(
        // Claude Desktop config
        JSON.stringify({
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
          },
        })
      );

    await getLocalMcpTools();

    const constructorCall = (MultiServerMCPClient as jest.Mock).mock.calls[0][0];
    // The mcps dir version (http) should win, not the Claude Desktop version (stdio)
    expect(constructorCall.mcpServers['filesystem']).toHaveProperty(
      'url',
      'http://localhost:3333/mcp'
    );
    // Only one entry named "filesystem"
    expect(Object.keys(constructorCall.mcpServers)).toHaveLength(1);
  });
});

