import puppeteerWeb from '../../src/tools/puppeteer-web';
import { puppeteerManager } from '../../src/utils/puppeteer-utils';

// Skip Puppeteer integration tests by default to avoid long test times and performance issues
// These tests require actual browser instances and internet connectivity
// Set SKIP_PUPPETEER_INTEGRATION_TESTS=false to run integration tests
const skipPuppeteerIntegrationTests = process.env.SKIP_PUPPETEER_INTEGRATION_TESTS !== 'false';

describe('Puppeteer Web Tools', () => {
  beforeAll(async () => {
    if (!skipPuppeteerIntegrationTests) {
      // Initialize Puppeteer manager
      await puppeteerManager.initialize({
        headless: true,
        timeout: 15000
      });
    }
  });

  afterAll(async () => {
    if (!skipPuppeteerIntegrationTests) {
      // Close Puppeteer browser
      await puppeteerManager.close();
    }
  });

  describe('WebSearchByKeywordPuppeteer', () => {
    test('should perform basic search with Google', async () => {
      if (skipPuppeteerIntegrationTests) {
        console.log('Skipping Puppeteer search integration test');
        return;
      }

      const tool = puppeteerWeb.find(t => t.name === 'WebSearchByKeywordPuppeteer');
      expect(tool).toBeDefined();

      const result = await tool?.invoke({
        keyword: 'test search query',
        timeout: 15000,
        searchEngine: 'google'
      });

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBeTruthy();
      expect(parsedResult.content_length).toBeGreaterThan(0);
      expect(parsedResult.search_engine).toBe('google');
      expect(parsedResult.method).toBe('puppeteer');
    }, 30000); // Increased timeout for Puppeteer

    test('should perform basic search with Bing', async () => {
      if (skipPuppeteerIntegrationTests) {
        console.log('Skipping Puppeteer search test');
        return;
      }

      const tool = puppeteerWeb.find(t => t.name === 'WebSearchByKeywordPuppeteer');
      expect(tool).toBeDefined();

      const result = await tool?.invoke({
        keyword: 'test search query',
        timeout: 15000,
        searchEngine: 'bing'
      });

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBeTruthy();
      expect(parsedResult.content_length).toBeGreaterThan(0);
      expect(parsedResult.search_engine).toBe('bing');
      expect(parsedResult.method).toBe('puppeteer');
    }, 30000);
  });

  describe('WebFetchByURLPuppeteer', () => {
    test('should fetch content from a simple URL', async () => {
      if (skipPuppeteerIntegrationTests) {
        console.log('Skipping Puppeteer fetch test');
        return;
      }

      const tool = puppeteerWeb.find(t => t.name === 'WebFetchByURLPuppeteer');
      expect(tool).toBeDefined();

      const result = await tool?.invoke({
        url: 'https://httpbin.org/html',
        timeout: 15000,
        cleanHtml: true
      });

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBeTruthy();
      expect(parsedResult.content_length).toBeGreaterThan(0);
      expect(parsedResult.method).toBe('puppeteer');
      expect(parsedResult.url).toBe('https://httpbin.org/html');
    }, 30000);

    test('should fetch content without cleaning HTML', async () => {
      if (skipPuppeteerIntegrationTests) {
        console.log('Skipping Puppeteer fetch test');
        return;
      }

      const tool = puppeteerWeb.find(t => t.name === 'WebFetchByURLPuppeteer');
      expect(tool).toBeDefined();

      const result = await tool?.invoke({
        url: 'https://httpbin.org/html',
        timeout: 15000,
        cleanHtml: false
      });

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content).toBeTruthy();
      expect(parsedResult.cleaned).toBe(false);
      expect(parsedResult.method).toBe('puppeteer');
    }, 30000);

    test('should handle non-existent URL gracefully', async () => {
      if (skipPuppeteerIntegrationTests) {
        console.log('Skipping Puppeteer error test');
        return;
      }

      const tool = puppeteerWeb.find(t => t.name === 'WebFetchByURLPuppeteer');
      expect(tool).toBeDefined();

      const result = await tool?.invoke({
        url: 'https://this-domain-does-not-exist-12345.com',
        timeout: 5000
      });

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBeTruthy();
    }, 10000);
  });
});

// Unit tests for utility functions (these don't require Puppeteer)
describe('Puppeteer Utility Functions', () => {
  test('cleanHtmlContent should remove scripts and styles', () => {
    const { cleanHtmlContent } = require('../../src/utils/puppeteer-utils');
    
    const htmlWithScripts = `
      <html>
        <head>
          <script>alert('test');</script>
          <style>body { color: red; }</style>
        </head>
        <body>
          <h1>Test Content</h1>
          <script>console.log('another script');</script>
          <p>This is a paragraph.</p>
        </body>
      </html>
    `;
    
    const cleaned = cleanHtmlContent(htmlWithScripts);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<style>');
    expect(cleaned).toContain('Test Content');
    expect(cleaned).toContain('This is a paragraph.');
  });

  test('cleanHtmlContent should handle empty input', () => {
    const { cleanHtmlContent } = require('../../src/utils/puppeteer-utils');
    
    const cleaned = cleanHtmlContent('');
    expect(cleaned).toBe('');
  });

  test('cleanHtmlContent should truncate long content', () => {
    const { cleanHtmlContent } = require('../../src/utils/puppeteer-utils');
    
    const longContent = '<p>' + 'a'.repeat(60000) + '</p>';
    const cleaned = cleanHtmlContent(longContent);
    expect(cleaned.length).toBeLessThanOrEqual(50000 + '... [content truncated]'.length);
    expect(cleaned).toContain('... [content truncated]');
  });
});