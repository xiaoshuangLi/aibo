import axios from 'axios';
import { webFetchTool } from '../../src/tools/web-fetch';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('webFetchTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should have correct tool schema', () => {
    expect(webFetchTool.name).toBe('web_fetch');
    expect(webFetchTool.description).toContain('public URL');
    const schema = webFetchTool.schema;
    expect(schema.shape.url).toBeDefined();
    expect(schema.shape.timeout).toBeDefined();
    expect(schema.shape.max_length).toBeDefined();
  });

  test('should return content from successful fetch', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html><body>Hello World</body></html>',
    });

    const result = await webFetchTool.invoke({ url: 'https://example.com' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.status).toBe(200);
    expect(parsed.content).toContain('Hello World');
    expect(parsed.truncated).toBe(false);
  });

  test('should truncate content exceeding max_length', async () => {
    const longContent = 'x'.repeat(200);
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      data: longContent,
    });

    const result = await webFetchTool.invoke({
      url: 'https://example.com/long',
      max_length: 100,
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.content.length).toBe(100);
    expect(parsed.truncated).toBe(true);
  });

  test('should handle non-string response data (JSON object)', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { key: 'value', nested: { arr: [1, 2, 3] } },
    });

    const result = await webFetchTool.invoke({ url: 'https://api.example.com/data' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(typeof parsed.content).toBe('string');
    expect(parsed.content).toContain('key');
  });

  test('should handle network error', async () => {
    const networkError: any = new Error('connect ECONNREFUSED');
    networkError.code = 'ECONNREFUSED';
    mockedAxios.get = jest.fn().mockRejectedValue(networkError);

    const result = await webFetchTool.invoke({ url: 'https://offline.example.com' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.url).toBe('https://offline.example.com');
    expect(parsed.error).toBe('ECONNREFUSED');
  });

  test('should handle HTTP 404 error', async () => {
    const httpError: any = new Error('Request failed with status code 404');
    httpError.response = { status: 404 };
    httpError.code = undefined;
    mockedAxios.get = jest.fn().mockRejectedValue(httpError);

    const result = await webFetchTool.invoke({ url: 'https://example.com/notfound' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.status).toBe(404);
  });

  test('should handle error with no response', async () => {
    const error: any = new Error('timeout');
    error.code = 'ECONNABORTED';
    error.response = undefined;
    mockedAxios.get = jest.fn().mockRejectedValue(error);

    const result = await webFetchTool.invoke({ url: 'https://slow.example.com' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.status).toBeNull();
  });

  test('should use default timeout of 15000ms', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      data: 'ok',
    });

    await webFetchTool.invoke({ url: 'https://example.com' });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ timeout: 15000 })
    );
  });

  test('should use custom timeout when provided', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      data: 'ok',
    });

    await webFetchTool.invoke({ url: 'https://example.com', timeout: 5000 });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ timeout: 5000 })
    );
  });

  test('should report content-type from response headers', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      data: '{"ok":true}',
    });

    const result = await webFetchTool.invoke({ url: 'https://api.example.com' });
    const parsed = JSON.parse(result);

    expect(parsed.content_type).toBe('application/json; charset=utf-8');
  });

  test('should default content-type to unknown when missing', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      data: 'plain data',
    });

    const result = await webFetchTool.invoke({ url: 'https://example.com' });
    const parsed = JSON.parse(result);

    expect(parsed.content_type).toBe('unknown');
  });
});
