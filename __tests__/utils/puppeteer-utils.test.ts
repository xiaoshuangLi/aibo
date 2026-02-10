import { puppeteerManager, fetchWithPuppeteer, searchWithPuppeteer } from '../../src/utils/puppeteer-utils';

// Skip Puppeteer integration tests by default to avoid long test times and performance issues
const skipPuppeteerIntegrationTests = process.env.SKIP_PUPPETEER_INTEGRATION_TESTS !== 'false';

describe('Puppeteer Utils', () => {
  beforeAll(async () => {
    if (!skipPuppeteerIntegrationTests) {
      await puppeteerManager.initialize({
        headless: true,
        timeout: 15000
      });
    }
  });

  afterAll(async () => {
    if (!skipPuppeteerIntegrationTests) {
      await puppeteerManager.close();
    }
  });

  test('puppeteerManager should be a singleton', () => {
    const instance1 = puppeteerManager;
    const instance2 = require('../../src/utils/puppeteer-utils').puppeteerManager;
    expect(instance1).toBe(instance2);
  });

  test('fetchWithPuppeteer should fetch content successfully', async () => {
    if (skipPuppeteerIntegrationTests) {
      console.log('Skipping Puppeteer fetch utility test');
      return;
    }

    const result = await fetchWithPuppeteer('https://httpbin.org/html', {
      timeout: 10000,
      cleanHtml: true
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeTruthy();
    expect(result.contentLength).toBeGreaterThan(0);
  }, 20000);

  test('searchWithPuppeteer should perform search successfully', async () => {
    if (skipPuppeteerIntegrationTests) {
      console.log('Skipping Puppeteer search utility test');
      return;
    }

    const result = await searchWithPuppeteer('test query', {
      timeout: 15000,
      searchEngine: 'google'
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeTruthy();
    expect(result.searchUrl).toContain('google.com');
  }, 25000);
});