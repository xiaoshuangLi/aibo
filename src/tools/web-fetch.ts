import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";

const MAX_CONTENT_LENGTH = 100_000; // 100 KB

/**
 * Generic HTTP fetch tool - fetches content from any public URL.
 * Equivalent to Claude Code's WebFetch tool.
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

      const limit = max_length || MAX_CONTENT_LENGTH;
      const rawContent: string =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      const content = rawContent.substring(0, limit);
      const truncated = rawContent.length > limit;

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
