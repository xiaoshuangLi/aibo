import { getTextFromUrl, createBrowser, closeBrowser } from '../../src/utils/puppeteer';
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

  describe('createBrowser', () => {
    test('should create new browser instance in test environment', async () => {
      process.env.NODE_ENV = 'test';
      const browser1 = await createBrowser();
      const browser2 = await createBrowser();
      
      // In test environment, should create new instances each time
      expect(browser1).not.toBe(browser2);
    });

    test('should cache browser instance in production environment', async () => {
      // Temporarily set to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const browser1 = await createBrowser();
        const browser2 = await createBrowser();
        
        // In production environment, should return cached instance
        expect(browser1).toBe(browser2);
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should accept custom options', async () => {
      const customOptions = { headless: false, timeout: 5000 };
      await createBrowser(customOptions);
      
      expect(puppeteer.launch).toHaveBeenCalledWith(expect.objectContaining({
        headless: false,
        timeout: 5000
      }));
    });
  });

  describe('closeBrowser', () => {
    test('should close cached browser and clear cache', async () => {
      // Set to production to enable caching
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const browser = await createBrowser();
        await closeBrowser();
        
        // Browser should be closed and cache cleared
        expect(browser.close).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should do nothing when no cached browser', async () => {
      // Ensure no cached browser
      await closeBrowser();
      
      // Should not throw any error
      expect(true).toBe(true);
    });
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
});