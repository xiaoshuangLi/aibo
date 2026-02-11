import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { bingSearch, getTextFromUrl } from '../utils/puppeteer';

/**
 * Web search and fetch tools using Puppeteer for enhanced web scraping capabilities.
 */

/**
 * Web search tool that performs searches using Bing via Puppeteer.
 * This tool uses real browser automation to fetch search results, providing better
 * reliability for sites with anti-bot measures.
 */
export const webSearchByKeywordTool = tool(
  async ({ keyword, timeout = 30000, searchEngine = 'bing' }) => {
    try {
      const content = await bingSearch(keyword);
      
      return JSON.stringify({
        success: true,
        message: `Web search completed using ${searchEngine} search engine`,
        keyword: keyword,
        content: content,
        content_length: content.length,
        search_engine: searchEngine,
        method: 'puppeteer'
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "SEARCH_ERROR",
        message: "Failed to perform web search with Puppeteer"
      });
    }
  },
  {
    name: "WebSearchByKeyword",
    description: `Performs a web search using Puppeteer browser automation. Uses real browser to fetch search results from Bing, making it more reliable for sites with anti-bot measures.
Supports Bing search engines.`,
    schema: z.object({
      keyword: z.string().describe("The search keyword or phrase to look up"),
      timeout: z.number().optional().default(30000).describe("Timeout in milliseconds (default: 30000 = 30 seconds)"),
      searchEngine: z.enum(['bing']).optional().default('bing').describe("Search engine to use (default: bing)")
    })
  }
);

/**
 * Web fetch tool that retrieves content from a given URL using Puppeteer.
 * This tool uses real browser automation to fetch content, bypassing many anti-bot measures
 * and handling dynamic JavaScript-rendered content.
 */
export const webFetchByURLTool = tool(
  async ({ url, timeout = 30000 }) => {
    try {
      const content = await getTextFromUrl(url);
      
      return JSON.stringify({
        success: true,
        url: url,
        content: content,
        content_length: content.length,
        method: 'puppeteer'
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "FETCH_ERROR",
        message: "Failed to fetch URL with Puppeteer",
        url: url
      });
    }
  },
  {
    name: "WebFetchByURL",
    description: `Fetches content from a specified URL using Puppeteer browser automation. Supports HTTP/HTTPS protocols and can handle JavaScript-rendered content and dynamic websites.`,
    schema: z.object({
      url: z.string().url().describe("The URL to fetch content from"),
      timeout: z.number().optional().default(30000).describe("Timeout in milliseconds (default: 30000 = 30 seconds)")
    })
  }
);

export default [webSearchByKeywordTool, webFetchByURLTool];