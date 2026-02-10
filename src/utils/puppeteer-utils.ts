import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin to bypass anti-bot detection
puppeteerExtra.use(StealthPlugin());

/**
 * Configuration for Puppeteer browser instance
 */
interface PuppeteerConfig {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
  args?: string[];
}

/**
 * Default configuration for Puppeteer
 */
const DEFAULT_CONFIG: PuppeteerConfig = {
  headless: true,
  timeout: 10000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--lang=en-US,en;q=0.9',
    '--disable-features=VizDisplayCompositor',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
  ]
};

/**
 * Singleton class for managing Puppeteer browser instances
 */
class PuppeteerManager {
  private static instance: PuppeteerManager;
  private browser: Browser | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): PuppeteerManager {
    if (!PuppeteerManager.instance) {
      PuppeteerManager.instance = new PuppeteerManager();
    }
    return PuppeteerManager.instance;
  }

  /**
   * Initialize the browser instance
   */
  public async initialize(config: PuppeteerConfig = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const launchConfig: LaunchOptions = {
      headless: config.headless ?? DEFAULT_CONFIG.headless,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
      args: config.args ?? DEFAULT_CONFIG.args,
      defaultViewport: config.viewport ?? DEFAULT_CONFIG.viewport
    };

    try {
      this.browser = await puppeteerExtra.launch(launchConfig);
      this.isInitialized = true;
      console.log('Puppeteer browser initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Puppeteer browser:', error);
      throw error;
    }
  }

  /**
   * Get a new page instance
   */
  public async getPage(userAgent?: string): Promise<Page> {
    if (!this.isInitialized || !this.browser) {
      await this.initialize();
    }
    
    const page = await this.browser!.newPage();
    
    // Set user agent if provided, otherwise use default
    const finalUserAgent = userAgent ?? DEFAULT_CONFIG.userAgent!;
    await page.setUserAgent(finalUserAgent);
    
    // Additional stealth settings
    await page.setJavaScriptEnabled(true);
    await page.setViewport(DEFAULT_CONFIG.viewport!);
    
    return page;
  }

  /**
   * Close the browser instance
   */
  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      console.log('Puppeteer browser closed');
    }
  }

  /**
   * Check if browser is initialized
   */
  public isBrowserInitialized(): boolean {
    return this.isInitialized;
  }
}

/**
 * Utility function to fetch content using Puppeteer with anti-bot bypass
 */
export async function fetchWithPuppeteer(
  url: string,
  options: {
    timeout?: number;
    userAgent?: string;
    waitForSelector?: string;
    waitForTimeout?: number;
    cleanHtml?: boolean;
  } = {}
): Promise<{
  success: boolean;
  content: string;
  status?: number;
  error?: string;
  originalContentLength?: number;
  contentLength?: number;
}> {
  const manager = PuppeteerManager.getInstance();
  let page: Page | null = null;
  
  try {
    // Get a new page
    page = await manager.getPage(options.userAgent);
    
    // Set timeout for navigation
    const timeout = options.timeout || 10000;
    
    // Navigate to the URL
    const response = await page.goto(url, {
      timeout,
      waitUntil: ['domcontentloaded', 'networkidle0']
    });
    
    // Wait for specific selector if provided
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.waitForTimeout || timeout
      });
    }
    
    // Wait a bit more to ensure dynamic content is loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the page content
    const content = await page.content();
    const status = response?.status() || 200;
    
    let finalContent = content;
    let cleaned = false;
    
    // Clean HTML content if requested
    if (options.cleanHtml !== false) {
      finalContent = cleanHtmlContent(content);
      cleaned = true;
    }
    
    return {
      success: true,
      content: finalContent,
      status,
      originalContentLength: content.length,
      contentLength: finalContent.length
    };
    
  } catch (error: any) {
    console.error('Error fetching with Puppeteer:', error);
    return {
      success: false,
      content: '',
      error: error.message || 'Unknown error'
    };
  } finally {
    // Close the page if it was created
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Clean HTML content by removing scripts, styles, and extracting readable text
 * Similar to the existing cleanHtmlContent function but optimized for Puppeteer
 */
export function cleanHtmlContent(html: string): string {
  try {
    // Use DOMParser to parse HTML (available in Node.js via jsdom or similar)
    // For now, we'll use a simple regex-based approach
    let cleaned = html;
    
    // Remove script tags and content
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove style tags and content
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove noscript, iframe, nav, footer, header, aside
    const tagsToRemove = ['noscript', 'iframe', 'nav', 'footer', 'header', 'aside'];
    tagsToRemove.forEach(tag => {
      const regex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Remove common ad and tracking elements by class/id patterns
    cleaned = cleaned.replace(/\s*class\s*=\s*["'][^"']*?(ad|banner|tracking|analytics)[^"']*?["']/gi, '');
    cleaned = cleaned.replace(/\s*id\s*=\s*["'][^"']*?(ad|banner|tracking|analytics)[^"']*?["']/gi, '');
    
    // Extract text content by removing all remaining tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Limit to reasonable length
    if (cleaned.length > 50000) {
      cleaned = cleaned.substring(0, 50000) + '... [content truncated]';
    }
    
    return cleaned;
  } catch (error) {
    console.warn('HTML cleaning failed, returning original content:', error);
    return html.substring(0, 50000);
  }
}

/**
 * Search function using Puppeteer to bypass search engine anti-bot measures
 */
export async function searchWithPuppeteer(
  keyword: string,
  options: {
    timeout?: number;
    userAgent?: string;
    searchEngine?: 'google' | 'bing';
  } = {}
): Promise<{
  success: boolean;
  content: string;
  searchUrl: string;
  error?: string;
}> {
  const searchEngine = options.searchEngine || 'google';
  let searchUrl: string;
  
  switch (searchEngine) {
    case 'google':
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
      break;
    case 'bing':
      searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}`;
      break;
    default:
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
  }
  
  try {
    const result = await fetchWithPuppeteer(searchUrl, {
      timeout: options.timeout || 10000,
      userAgent: options.userAgent,
      waitForSelector: 'div#search' // Google search results container
    });
    
    if (result.success) {
      return {
        success: true,
        content: result.content,
        searchUrl
      };
    } else {
      return {
        success: false,
        content: '',
        searchUrl,
        error: result.error
      };
    }
  } catch (error: any) {
    return {
      success: false,
      content: '',
      searchUrl,
      error: error.message || 'Search failed'
    };
  }
}

// Export the manager instance for direct access if needed
export const puppeteerManager = PuppeteerManager.getInstance();

export default {
  fetchWithPuppeteer,
  searchWithPuppeteer,
  cleanHtmlContent,
  puppeteerManager
};