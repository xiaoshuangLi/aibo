// Mock MultiServerMCPClient so tests don't need real MCP servers
jest.mock('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: jest.fn().mockImplementation(() => ({
    getTools: jest.fn().mockResolvedValue([]),
  })),
}));

import getLocalMcpTools from '@/tools/local-mcp';

describe('Local MCP Tools', () => {
  test('should return an array without errors when no MCP servers are configured', async () => {
    const tools = await getLocalMcpTools();
    expect(Array.isArray(tools)).toBe(true);
  });
});