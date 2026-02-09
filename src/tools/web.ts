import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import * as cheerio from 'cheerio';

/**
 * Web tools for internet-based operations.
 */

/**
 * Clean HTML content by removing scripts, styles, and extracting readable text
 */
function cleanHtmlContent(html: string): string {
  try {
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();
    $('nav').remove();
    $('footer').remove();
    $('header').remove();
    $('aside').remove();
    
    // Remove common ad and tracking elements
    $('[class*="ad"]').remove();
    $('[class*="banner"]').remove();
    $('[id*="ad"]').remove();
    $('[id*="banner"]').remove();
    
    // Extract text content and normalize whitespace
    let text = $('body').text() || $.text();
    text = text.replace(/\s+/g, ' ').trim();
    
    // Limit to reasonable length
    if (text.length > 50000) {
      text = text.substring(0, 50000) + '... [content truncated]';
    }
    
    return text;
  } catch (error) {
    // If cleaning fails, return original content with warning
    console.warn('HTML cleaning failed, returning original content:', error);
    return html.substring(0, 50000);
  }
}

/**
 * Web search tool that searches using Bing search engine.
 */
export const webSearchByKeywordTool = tool(
  async ({ keyword }) => {
    try {
      const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(keyword)}`;
      
      // Fetch the actual search results page
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIBO Bot/1.0; +https://github.com/your-repo/aibo)'
        }
      });
      
      // Clean the HTML content to extract readable text
      const cleanedContent = cleanHtmlContent(response.data);
      
      return JSON.stringify({
        success: true,
        message: "Web search completed",
        search_url: searchUrl,
        keyword: keyword,
        content: cleanedContent,
        content_length: cleanedContent.length
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message || "SEARCH_ERROR",
        message: "Failed to perform web search"
      });
    }
  },
  {
    name: "WebSearchByKeyword",
    description: "Performs a web search using the default search engine (Bing China). Fetches and returns the actual search results page content with HTML tags cleaned.",
    schema: z.object({
      keyword: z.string().describe("The search keyword or phrase to look up")
    })
  }
);

/**
 * Web fetch tool that retrieves content from a given URL.
 */
export const webFetchByURLTool = tool(
  async ({ url, timeout = 10000, cleanHtml = true }) => {
    try {
      const response = await axios.get(url, {
        timeout: timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIBO Bot/1.0; +https://github.com/your-repo/aibo)'
        }
      });
      
      let originalContent = response.data;
      // Limit response size to prevent memory issues
      if (originalContent.length > 100000) {
        originalContent = originalContent.substring(0, 100000);
      }
      
      let content = originalContent;
      let cleaned = false;
      
      // Clean HTML content if requested and content appears to be HTML
      if (cleanHtml && (response.headers['content-type']?.includes('text/html') || 
          originalContent.trim().startsWith('<'))) {
        content = cleanHtmlContent(originalContent);
        cleaned = true;
      }
      
      return JSON.stringify({
        success: true,
        url: url,
        status_code: response.status,
        content_type: response.headers['content-type'] || 'unknown',
        original_content_length: originalContent.length,
        content_length: content.length,
        content: content,
        cleaned: cleaned
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.code || "FETCH_ERROR",
        message: error.message || "Failed to fetch URL",
        url: url
      });
    }
  },
  {
    name: "WebFetchByURL",
    description: "Fetches content from a specified URL. Supports HTTP/HTTPS protocols. Automatically cleans HTML content by default to remove tags and extract readable text.",
    schema: z.object({
      url: z.string().url().describe("The URL to fetch content from"),
      timeout: z.number().optional().default(10000).describe("Timeout in milliseconds (default: 10000 = 10 seconds)"),
      cleanHtml: z.boolean().optional().default(true).describe("Whether to clean HTML content and extract readable text (default: true)")
    })
  }
);

/**
 * GitHub fetch tool that retrieves content from GitHub repositories.
 */
export const webFetchFromGithubTool = tool(
  async ({ owner, repo, path, branch = "main" }) => {
    try {
      const githubUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      
      const response = await axios.get(githubUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIBO Bot/1.0; +https://github.com/your-repo/aibo)'
        }
      });
      
      // Limit response size to prevent memory issues
      const content = response.data.substring(0, 100000); // Limit to 100KB
      
      return JSON.stringify({
        success: true,
        github_url: githubUrl,
        owner: owner,
        repo: repo,
        path: path,
        branch: branch,
        content_length: content.length,
        content: content
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.code || "GITHUB_FETCH_ERROR",
        message: error.message || "Failed to fetch from GitHub",
        github_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
      });
    }
  },
  {
    name: "WebFetchFromGithub",
    description: "Fetches content from a GitHub repository file using the raw content API.",
    schema: z.object({
      owner: z.string().describe("GitHub repository owner/organization name"),
      repo: z.string().describe("Repository name"),
      path: z.string().describe("File path within the repository"),
      branch: z.string().optional().default("main").describe("Branch name (default: main)")
    })
  }
);

export default [webSearchByKeywordTool, webFetchByURLTool, webFetchFromGithubTool];