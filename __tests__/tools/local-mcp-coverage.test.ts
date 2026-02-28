// Mock the fs module so we can control filesystem behavior
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn()
}));

import * as fs from 'fs';

import getLocalMcpTools from '@/tools/local-mcp';

describe('Local MCP Tools - Additional Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array when mcps directory does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should return empty array when no JSON files exist in mcps dir', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['README.md', 'other.txt']);

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should skip invalid config files missing required fields', async () => {
    const invalidConfig = JSON.stringify({ description: 'Missing name and tools' });

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

  it('should return empty array when outer readdirSync throws error', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied reading directory');
    });

    const tools = await getLocalMcpTools();
    expect(tools).toEqual([]);
  });

  it('should load tools successfully from valid config', async () => {
    const validConfig = JSON.stringify({
      name: 'test-server',
      description: 'A test MCP server',
      endpoint: 'http://localhost:3000',
      tools: [
        {
          name: 'do-something',
          description: 'Does something',
          parameters: {
            required: ['param1'],
            properties: {
              param1: { type: 'string', description: 'First param' }
            }
          }
        }
      ]
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['test-server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(validConfig);

    const tools = await getLocalMcpTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test-server_do-something');
    expect(tools[0].server).toBe('test-server');
  });

  it('should load tools from multiple valid configs', async () => {
    const config1 = JSON.stringify({
      name: 'server1',
      description: 'Server 1',
      endpoint: 'http://localhost:3001',
      tools: [
        { name: 'tool1', description: 'Tool 1', parameters: { properties: {} } }
      ]
    });
    const config2 = JSON.stringify({
      name: 'server2',
      description: 'Server 2',
      endpoint: 'http://localhost:3002',
      tools: [
        { name: 'tool2a', description: 'Tool 2a', parameters: { properties: {} } },
        { name: 'tool2b', description: 'Tool 2b', parameters: { properties: {} } }
      ]
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['server1.json', 'server2.json']);
    (fs.readFileSync as jest.Mock)
      .mockReturnValueOnce(config1)
      .mockReturnValueOnce(config2);

    const tools = await getLocalMcpTools();
    expect(tools).toHaveLength(3);
  });

  it('should continue loading other files when one file has invalid JSON', async () => {
    const validConfig = JSON.stringify({
      name: 'valid-server',
      description: 'Valid server',
      endpoint: 'http://localhost:3000',
      tools: [{ name: 'tool1', description: 'Tool 1', parameters: { properties: {} } }]
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

  it('should include authentication and endpoint in tool definition', async () => {
    const configWithAuth = JSON.stringify({
      name: 'auth-server',
      description: 'Server with auth',
      endpoint: 'http://localhost:4000',
      authentication: {
        type: 'api_key',
        header: 'X-API-Key',
        apiKey: 'secret-key'
      },
      tools: [
        { name: 'secure-tool', description: 'Secure tool', parameters: { properties: {} } }
      ]
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue(['auth-server.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue(configWithAuth);

    const tools = await getLocalMcpTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].endpoint).toBe('http://localhost:4000');
    expect(tools[0].authentication).toBeDefined();
    expect(tools[0].originalToolName).toBe('secure-tool');
  });
});
