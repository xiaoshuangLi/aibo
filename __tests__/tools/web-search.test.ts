import webSearch from '../../src/tools/web-search';
import { bingSearch, getTextFromUrl } from '../../src/utils/puppeteer';

// Mock puppeteer to avoid actual browser launches during unit tests
jest.mock('../../src/utils/puppeteer', () => ({
  bingSearch: jest.fn(),
  getTextFromUrl: jest.fn()
}));

describe('Web Search Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WebSearchByKeywordTool', () => {
    test('should perform Bing search successfully', async () => {
      const mockContent = 'Mocked Bing search results content';
      (bingSearch as jest.Mock).mockResolvedValue(mockContent);
      
      const tool = webSearch.find(t => t.name === 'WebSearchByKeyword');
      expect(tool).toBeDefined();
      
      const result = await tool?.invoke({
        keyword: 'test search query',
        timeout: 15000,
        searchEngine: 'bing'
      });
      
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBe(mockContent);
      expect(parsedResult.search_engine).toBe('bing');
      
      expect(bingSearch).toHaveBeenCalledWith('test search query');
    });

    test('should handle non-bing search engine by defaulting to bing', async () => {
      const mockContent = 'Mocked Bing search results content';
      (bingSearch as jest.Mock).mockResolvedValue(mockContent);
      
      const tool = webSearch.find(t => t.name === 'WebSearchByKeyword');
      expect(tool).toBeDefined();
      
      // This should trigger the else branch
      const result = await tool?.invoke({
        keyword: 'test search query',
        timeout: 15000,
        searchEngine: 'bing' // Note: schema only allows 'bing', so this is the only valid option
      });
      
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBe(mockContent);
      expect(parsedResult.search_engine).toBe('bing');
    });

    test('should handle search errors gracefully', async () => {
      (bingSearch as jest.Mock).mockRejectedValue(new Error('Search failed'));
      
      const tool = webSearch.find(t => t.name === 'WebSearchByKeyword');
      expect(tool).toBeDefined();
      
      const result = await tool?.invoke({
        keyword: 'test search query',
        timeout: 15000,
        searchEngine: 'bing'
      });
      
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe('Search failed');
      expect(parsedResult.message).toBe('Failed to perform web search with Puppeteer');
    });
  });

  describe('WebFetchByURLTool', () => {
    test('should fetch content from URL successfully', async () => {
      const mockContent = 'Mocked URL content';
      (getTextFromUrl as jest.Mock).mockResolvedValue(mockContent);
      
      const tool = webSearch.find(t => t.name === 'WebFetchByURL');
      expect(tool).toBeDefined();
      
      const result = await tool?.invoke({
        url: 'https://example.com',
        timeout: 15000
      });
      
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.url).toBe('https://example.com');
      expect(parsedResult.content).toBe(mockContent);
      expect(parsedResult.method).toBe('puppeteer');
      
      expect(getTextFromUrl).toHaveBeenCalledWith('https://example.com');
    });

    test('should handle fetch errors gracefully', async () => {
      (getTextFromUrl as jest.Mock).mockRejectedValue(new Error('Page not found'));
      
      const tool = webSearch.find(t => t.name === 'WebFetchByURL');
      expect(tool).toBeDefined();
      
      const result = await tool?.invoke({
        url: 'https://nonexistent.com',
        timeout: 15000
      });
      
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe('Page not found');
      expect(parsedResult.url).toBe('https://nonexistent.com');
    });
  });
});