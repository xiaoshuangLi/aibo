import { tencentWsaSearchTool } from '@/tools/tencent-wsa';
import * as wsaService from '@/infrastructure/tencent-cloud/wsa-service';

jest.mock('@/infrastructure/tencent-cloud/wsa-service');

describe('Tencent WSA Search Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Skip actual API calls in tests to avoid external dependencies
  // These tests verify the tool structure and error handling
  
  it('should have correct tool name', () => {
    expect(tencentWsaSearchTool.name).toBe('TencentWsaSearch');
  });

  it('should have correct tool description', () => {
    expect(tencentWsaSearchTool.description).toContain('Tencent Cloud WSA');
    expect(tencentWsaSearchTool.description).toContain('Sogou search');
  });

  it('should have correct schema', () => {
    const schema = tencentWsaSearchTool.schema;
    expect(schema).toBeDefined();
    
    // Check that schema has the expected properties
    const parsed = schema.safeParse({ query: 'test' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.query).toBe('test');
      expect(parsed.data.mode).toBe(0);
    }
  });

  it('should return MISSING_CONFIG when canSearch() returns false', async () => {
    const mockWsa = { canSearch: jest.fn().mockReturnValue(false), search: jest.fn() };
    (wsaService.createTencentWSA as jest.Mock).mockReturnValue(mockWsa);

    const result = await tencentWsaSearchTool.invoke({ query: 'test' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toBe('MISSING_CONFIG');
  });

  it('should return results when search succeeds', async () => {
    const mockResponse = {
      Pages: [{ Title: 'Result 1', Url: 'https://example.com' }],
      Version: '1.0',
      RequestId: 'req-123',
    };
    const mockWsa = {
      canSearch: jest.fn().mockReturnValue(true),
      search: jest.fn().mockResolvedValue(mockResponse),
    };
    (wsaService.createTencentWSA as jest.Mock).mockReturnValue(mockWsa);

    const result = await tencentWsaSearchTool.invoke({ query: 'JavaScript', mode: 1 });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.query).toBe('JavaScript');
    expect(parsedResult.results).toHaveLength(1);
    expect(parsedResult.version).toBe('1.0');
    expect(parsedResult.requestId).toBe('req-123');
  });

  it('should handle search exception', async () => {
    const mockWsa = {
      canSearch: jest.fn().mockReturnValue(true),
      search: jest.fn().mockRejectedValue(new Error('Network error')),
    };
    (wsaService.createTencentWSA as jest.Mock).mockReturnValue(mockWsa);

    const result = await tencentWsaSearchTool.invoke({ query: 'test' });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toBe('Network error');
  });
});