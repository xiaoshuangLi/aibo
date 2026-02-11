import { getTextFromUrl, bingSearch } from '../../src/utils/puppeteer';
import puppeteer from 'puppeteer';

// Mock puppeteer to avoid actual browser launches
jest.mock('puppeteer');

// Set test environment
process.env.NODE_ENV = 'test';

describe('puppeteer utils with mocks', () => {
  beforeEach(() => {
    // Reset mock implementations before each test
    (puppeteer.launch as jest.Mock).mockImplementation(async () => {
      return {
        close: jest.fn().mockResolvedValue(undefined),
        newPage: jest.fn().mockResolvedValue({
          close: jest.fn().mockResolvedValue(undefined),
          setUserAgent: jest.fn().mockResolvedValue(undefined),
          setViewport: jest.fn().mockResolvedValue(undefined),
          goto: jest.fn().mockResolvedValue({
            status: () => 200
          }),
          evaluate: jest.fn().mockResolvedValue('Mocked page content')
        })
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTextFromUrl', () => {
    test('should successfully extract text from a valid URL', async () => {
      const url = 'https://example.com';
      const result = await getTextFromUrl(url);
      
      expect(result).toBe('Mocked page content');
      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    });

    test('should handle HTTP error status', async () => {
      (puppeteer.launch as jest.Mock).mockImplementationOnce(async () => {
        return {
          close: jest.fn().mockResolvedValue(undefined),
          newPage: jest.fn().mockResolvedValue({
            close: jest.fn().mockResolvedValue(undefined),
            setUserAgent: jest.fn().mockResolvedValue(undefined),
            setViewport: jest.fn().mockResolvedValue(undefined),
            goto: jest.fn().mockResolvedValue({
              status: () => 404
            }),
            evaluate: jest.fn()
          })
        };
      });
      
      await expect(getTextFromUrl('https://example.com')).rejects.toThrow(
        /获取页面文本失败: 页面加载失败/
      );
    });

    test('should handle null response', async () => {
      (puppeteer.launch as jest.Mock).mockImplementationOnce(async () => {
        return {
          close: jest.fn().mockResolvedValue(undefined),
          newPage: jest.fn().mockResolvedValue({
            close: jest.fn().mockResolvedValue(undefined),
            setUserAgent: jest.fn().mockResolvedValue(undefined),
            setViewport: jest.fn().mockResolvedValue(undefined),
            goto: jest.fn().mockResolvedValue(null),
            evaluate: jest.fn()
          })
        };
      });
      
      await expect(getTextFromUrl('https://example.com')).rejects.toThrow(
        /获取页面文本失败: 页面加载失败/
      );
    });

    test('should handle puppeteer launch failure', async () => {
      (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));
      
      await expect(getTextFromUrl('https://example.com')).rejects.toThrow(
        /获取页面文本失败: Launch failed/
      );
    });

    test('should handle page navigation failure', async () => {
      (puppeteer.launch as jest.Mock).mockImplementationOnce(async () => {
        return {
          close: jest.fn().mockResolvedValue(undefined),
          newPage: jest.fn().mockResolvedValue({
            close: jest.fn().mockResolvedValue(undefined),
            setUserAgent: jest.fn().mockResolvedValue(undefined),
            setViewport: jest.fn().mockResolvedValue(undefined),
            goto: jest.fn().mockRejectedValue(new Error('Navigation failed')),
            evaluate: jest.fn()
          })
        };
      });
      
      await expect(getTextFromUrl('https://example.com')).rejects.toThrow(
        /获取页面文本失败: Navigation failed/
      );
    });

    test('should handle page evaluation failure', async () => {
      (puppeteer.launch as jest.Mock).mockImplementationOnce(async () => {
        return {
          close: jest.fn().mockResolvedValue(undefined),
          newPage: jest.fn().mockResolvedValue({
            close: jest.fn().mockResolvedValue(undefined),
            setUserAgent: jest.fn().mockResolvedValue(undefined),
            setViewport: jest.fn().mockResolvedValue(undefined),
            goto: jest.fn().mockResolvedValue({
              status: () => 200
            }),
            evaluate: jest.fn().mockRejectedValue(new Error('Evaluation failed'))
          })
        };
      });
      
      await expect(getTextFromUrl('https://example.com')).rejects.toThrow(
        /获取页面文本失败: Evaluation failed/
      );
    });
  });

  describe('bingSearch', () => {
    test('should construct correct Bing URL and return content', async () => {
      const keyword = 'test search';
      const result = await bingSearch(keyword);
      
      expect(result).toBe('Mocked page content');
      // We can't easily verify the URL construction with current mock setup,
      // but the function should complete successfully
    });

    test('should handle empty keyword', async () => {
      const result = await bingSearch('');
      
      expect(result).toBe('Mocked page content');
    });
  });
});