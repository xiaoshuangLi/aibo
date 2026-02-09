import { getSearchUrl, getCurrentSearchEngine, forceRedetectSearchEngine } from '../../src/utils/search-engine-detector';

describe('Search Engine Detector', () => {
  // Reset the detection cache before each test
  beforeEach(() => {
    // We can't directly access the internal cache, so we'll use the forceRedetect function
    // to reset the state for testing purposes
  });

  describe('getSearchUrl', () => {
    it('should return a valid search URL for a given keyword', async () => {
      const keyword = 'test search';
      const url = await getSearchUrl(keyword);
      
      expect(typeof url).toBe('string');
      expect(url).toContain(encodeURIComponent(keyword));
      
      // The URL should be either Google or Bing
      expect(url).toMatch(/^(https:\/\/www\.google\.com\/search\?q=|https:\/\/cn\.bing\.com\/search\?q=)/);
    });

    it('should handle special characters in search keywords', async () => {
      const keyword = 'test & search + "quotes"';
      const url = await getSearchUrl(keyword);
      
      expect(typeof url).toBe('string');
      expect(url).toContain(encodeURIComponent(keyword));
    });
  });

  describe('getCurrentSearchEngine', () => {
    it('should return either "google" or "bing"', async () => {
      const searchEngine = await getCurrentSearchEngine();
      
      expect(['google', 'bing']).toContain(searchEngine);
    });
  });

  describe('forceRedetectSearchEngine', () => {
    it('should return either "google" or "bing" after forced re-detection', async () => {
      const searchEngine = await forceRedetectSearchEngine();
      
      expect(['google', 'bing']).toContain(searchEngine);
    });
  });

  // Integration test to ensure the detection works consistently
  it('should return consistent results for multiple calls', async () => {
    const engine1 = await getCurrentSearchEngine();
    const engine2 = await getCurrentSearchEngine();
    const url1 = await getSearchUrl('test');
    const url2 = await getSearchUrl('test');
    
    expect(engine1).toEqual(engine2);
    
    if (engine1 === 'google') {
      expect(url1).toContain('google.com');
      expect(url2).toContain('google.com');
    } else {
      expect(url1).toContain('cn.bing.com');
      expect(url2).toContain('cn.bing.com');
    }
  });
});