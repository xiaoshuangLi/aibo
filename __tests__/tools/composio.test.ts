import getComposioTools from '../../src/tools/composio';

jest.mock('@composio/core', () => ({
  Composio: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      mcp: { url: 'http://mock-url', headers: { Authorization: 'Bearer test' } },
    }),
  })),
}));

jest.mock('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: jest.fn().mockImplementation(() => ({
    getTools: jest.fn().mockResolvedValue([{ name: 'mock-tool' }]),
  })),
}));

jest.mock('@/core/config', () => ({
  config: {
    composio: { apiKey: 'test-key', externalUserId: 'user-123' },
  },
}));

describe('getComposioTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns tools array on success', async () => {
    const tools = await getComposioTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toHaveProperty('name', 'mock-tool');
  });

  test('returns empty array when Composio.create throws', async () => {
    const { Composio } = require('@composio/core');
    Composio.mockImplementationOnce(() => ({
      create: jest.fn().mockRejectedValue(new Error('Network error')),
    }));

    const tools = await getComposioTools();
    expect(tools).toEqual([]);
  });

  test('returns empty array when getTools throws', async () => {
    const { MultiServerMCPClient } = require('@langchain/mcp-adapters');
    MultiServerMCPClient.mockImplementationOnce(() => ({
      getTools: jest.fn().mockRejectedValue(new Error('MCP error')),
    }));

    const tools = await getComposioTools();
    expect(tools).toEqual([]);
  });
});
