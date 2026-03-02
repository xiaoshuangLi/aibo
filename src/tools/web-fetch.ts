import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import TurndownService from "turndown";

const MAX_CONTENT_LENGTH = 5_000; // 100 KB
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

// Remove script and style elements before converting to markdown
turndown.remove(["script", "style", "noscript", "iframe"]);

/**
 * Generic HTTP fetch tool - fetches content from any public URL.
 * Equivalent to Claude Code's WebFetch tool.
 * HTML responses are automatically converted to Markdown to reduce noise and token usage.
 */
export const webFetchTool = tool(
  async ({ url, timeout, max_length }) => {
    try {
      const response = await axios.get(url, {
        timeout: timeout || 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AIBO/1.0)",
          "Accept": "text/html,application/json,text/plain,*/*",
        },
        maxContentLength: MAX_CONTENT_LENGTH * 2,
        responseType: "text",
        transformResponse: [(data) => data], // keep raw string
      });

      const contentType: string = response.headers["content-type"] || "unknown";
      const limit = max_length || MAX_CONTENT_LENGTH;
      const rawString: string =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);

      // Convert HTML to Markdown to reduce noise and token usage
      const processedContent = contentType.includes("text/html")
        ? turndown.turndown(rawString)
        : rawString;

      const content = processedContent.substring(0, limit);
      const truncated = processedContent.length > limit;

      return JSON.stringify({
        success: true,
        url,
        status: response.status,
        content_type: response.headers["content-type"] || "unknown",
        content_length: content.length,
        truncated,
        content,
      }, null, 2);
    } catch (error: any) {
      const status = error?.response?.status;
      return JSON.stringify({
        success: false,
        url,
        status: status || null,
        error: error?.code || "FETCH_ERROR",
        message: error?.message || "Failed to fetch URL",
      }, null, 2);
    }
  },
  {
    name: "web_fetch",
    description: `Fetch content from any public URL via HTTP GET.
Supports HTML pages, JSON APIs, plain text, and other text-based content.
HTML pages are automatically converted to Markdown to reduce noise and token usage.
Returns up to 100KB of content (configurable via max_length).
Use this to fetch documentation, APIs, web pages, or any public resource.`,
    schema: z.object({
      url: z.string().url().describe("The URL to fetch (must be a valid HTTP/HTTPS URL)"),
      timeout: z.number().optional().describe("Request timeout in milliseconds (default: 15000)"),
      max_length: z.number().optional().describe("Maximum content length in characters to return (default: 100000)"),
    }),
  }
);

/**
 * Returns the web_fetch tool.
 */
export default async function getWebFetchTools() {
  return [webFetchTool];
}
