import getLocalMcpTools from '@/tools/local-mcp';

describe('Local MCP Tools', () => {
  test('should load local MCP tools without errors', async () => {
    const tools = await getLocalMcpTools();
    // Should not throw an error
    expect(Array.isArray(tools)).toBe(true);
  });
});