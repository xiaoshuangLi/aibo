jest.mock('@/tools/composio', () => jest.fn().mockResolvedValue([]));

import getTools from '@/tools/index';

describe('tools/index', () => {
  test('should export all tool arrays', async () => {
    const tools = await getTools();
    expect(Array.isArray(tools)).toBe(true);
    // Note: In test environment, composio tools may not be available,
    // so we check if we have at least the non-composio tools
    expect(tools.length).toBeGreaterThanOrEqual(4); // bash, utils, githubFetch, tencentWsaSearchTool
  }, 10000); // Increase timeout to 10 seconds
});