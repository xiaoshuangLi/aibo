import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchWithPuppeteer, fetchWithPuppeteer, cleanHtmlContent } from '../utils/puppeteer-utils';

/**
 * Web tools using Puppeteer for enhanced anti-bot bypass capabilities.
 */

/**
 * Web search tool using Puppeteer to bypass anti-bot detection.
 * This tool uses a real browser to perform searches, making it much harder to detect as a bot.
 */
export const webSearchByKeywordPuppeteerTool = tool(
  async ({ keyword, timeout = 10000, searchEngine = 'google' }) => {
    try {
      // Use Puppeteer to perform the search
      const result = await searchWithPuppeteer(keyword, {
        timeout,
        searchEngine: searchEngine as 'google' | 'bing'
      });
      
      if (result.success) {
        return JSON.stringify({
          success: true,
          message: `Web search completed using Puppeteer with ${searchEngine} search engine`,
          search_url: result.searchUrl,
          keyword: keyword,
          content: result.content,
          content_length: result.content.length,
          search_engine: searchEngine,
          method: 'puppeteer'
        });
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || "SEARCH_ERROR",
          message: "Failed to perform web search with Puppeteer"
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "SEARCH_ERROR",
        message: "Failed to perform web search with Puppeteer"
      });
    }
  },
  {
    name: "WebSearchByKeywordPuppeteer",
    description: "Performs a web search using Puppeteer browser automation to bypass anti-bot detection. Uses real browser to fetch search results, making it more reliable for sites with strong anti-bot measures.",
    schema: z.object({
      keyword: z.string().describe("The search keyword or phrase to look up"),
      timeout: z.number().optional().default(10000).describe("Timeout in milliseconds (default: 10000 = 10 seconds)"),
      searchEngine: z.enum(['google', 'bing']).optional().default('google').describe("Search engine to use (default: google)")
    })
  }
);

/**
 * Web fetch tool using Puppeteer to retrieve content from a given URL.
 * This tool uses a real browser to fetch content, bypassing many anti-bot measures.
 */
export const webFetchByURLPuppeteerTool = tool(
  async ({ url, timeout = 10000, cleanHtml = true, waitForSelector, waitForTimeout }) => {
    try {
      const result = await fetchWithPuppeteer(url, {
        timeout,
        cleanHtml,
        waitForSelector,
        waitForTimeout
      });
      
      if (result.success) {
        return JSON.stringify({
          success: true,
          url: url,
          status_code: result.status,
          content_type: 'text/html',
          original_content_length: result.originalContentLength,
          content_length: result.contentLength,
          content: result.content,
          cleaned: cleanHtml,
          method: 'puppeteer'
        });
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || "FETCH_ERROR",
          message: "Failed to fetch URL with Puppeteer",
          url: url
        });
      }
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch URL with Puppeteer",
        url: url
      });
    }
  },
  {
    name: "WebFetchByURLPuppeteer",
    description: "Fetches content from a specified URL using Puppeteer browser automation to bypass anti-bot detection. Supports HTTP/HTTPS protocols and can wait for specific elements to load before capturing content.",
    schema: z.object({
      url: z.string().url().describe("The URL to fetch content from"),
      timeout: z.number().optional().default(10000).describe("Timeout in milliseconds (default: 10000 = 10 seconds)"),
      cleanHtml: z.boolean().optional().default(true).describe("Whether to clean HTML content and extract readable text (default: true)"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before capturing content (useful for dynamic content)"),
      waitForTimeout: z.number().optional().describe("Timeout for waiting for selector in milliseconds")
    })
  }
);

export default [webSearchByKeywordPuppeteerTool, webFetchByURLPuppeteerTool];