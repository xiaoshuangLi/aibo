import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { bingSearch, getTextFromUrl } from '../utils/puppeteer';

/**
 * Web搜索和获取工具模块
 * 
 * 该模块提供基于Puppeteer的Web搜索和内容获取功能，使用真实浏览器自动化来增强网络抓取能力。
 */

/**
 * Web搜索工具
 * 
 * 中文名称：Web搜索工具
 * 
 * 预期行为：
 * - 接收搜索关键词、超时时间和搜索引擎参数
 * - 使用Puppeteer浏览器自动化执行Bing搜索
 * - 获取并返回搜索结果页面的文本内容
 * - 返回结构化的JSON响应
 * 
 * 行为分支：
 * 1. 正常搜索：成功执行搜索并获取结果，返回包含搜索内容、关键词、引擎等信息的JSON
 * 2. 搜索失败：Puppeteer执行过程中出现错误，返回包含错误信息的JSON
 * 3. 超时处理：通过底层Puppeteer实现超时控制（30秒默认）
 * 4. 搜索引擎限制：当前仅支持Bing搜索引擎
 * 5. 内容提取：返回经过格式化处理的纯文本内容，包含链接信息
 * 
 * @param keyword - 要搜索的关键词或短语
 * @param timeout - 超时时间（毫秒），默认30000（30秒）
 * @param searchEngine - 搜索引擎，当前仅支持'bing'（默认值）
 * @returns Promise<string> - 包含搜索结果的JSON字符串，包含success、message、keyword、content、content_length、search_engine、method等字段
 * 
 * @example
 * ```typescript
 * // 执行简单搜索
 * const result = await webSearchByKeywordTool.invoke({ keyword: "JavaScript tutorial" });
 * 
 * // 执行带自定义超时的搜索
 * const result = await webSearchByKeywordTool.invoke({ 
 *   keyword: "Node.js best practices", 
 *   timeout: 60000 
 * });
 * ```
 * 
 * @note
 * - 该工具使用真实浏览器自动化，能更好地绕过反机器人措施
 * - 返回的内容是经过处理的纯文本，包含格式化的标题、列表和链接信息
 * - 当前仅支持Bing搜索引擎
 */
/**
 * 处理Web搜索错误
 * 
 * 中文名称：处理Web搜索错误
 * 
 * 预期行为：
 * - 统一处理Web搜索过程中的错误
 * - 返回标准化的错误响应
 * 
 * @param error - 原始错误对象
 * @returns 标准化的错误JSON字符串
 */
function handleWebSearchError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return JSON.stringify({
    success: false,
    error: errorMessage || "SEARCH_ERROR",
    message: "Failed to perform web search with Puppeteer"
  });
}

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
    } catch (error) {
      return handleWebSearchError(error);
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
 * Web内容获取工具
 * 
 * 中文名称：Web内容获取工具
 * 
 * 预期行为：
 * - 接收URL和超时时间参数
 * - 使用Puppeteer浏览器自动化访问指定URL
 * - 等待页面加载完成（networkidle0状态）
 * - 提取并返回页面的纯文本内容
 * - 返回结构化的JSON响应
 * 
 * 行为分支：
 * 1. 正常获取：成功访问URL并提取内容，返回包含URL、内容、长度等信息的JSON
 * 2. 页面加载失败：HTTP状态码>=400，抛出错误并返回失败JSON
 * 3. 网络错误：连接超时、DNS解析失败等，返回包含错误信息的JSON
 * 4. 内容处理：自动移除脚本、样式等无用元素，保留标题、列表、链接等有用结构
 * 5. 链接提取：自动提取页面中的链接并以参考格式附加到内容末尾
 * 6. 超时处理：30秒默认超时，可自定义
 * 
 * @param url - 要获取内容的URL（必须是有效的HTTP/HTTPS URL）
 * @param timeout - 超时时间（毫秒），默认30000（30秒）
 * @returns Promise<string> - 包含获取结果的JSON字符串，包含success、url、content、content_length、method等字段
 * 
 * @example
 * ```typescript
 * // 获取网页内容
 * const result = await webFetchByURLTool.invoke({ 
 *   url: "https://example.com" 
 * });
 * 
 * // 获取带自定义超时的网页内容
 * const result = await webFetchByURLTool.invoke({ 
 *   url: "https://slow-website.com", 
 *   timeout: 60000 
 * });
 * ```
 * 
 * @note
 * - 该工具能处理JavaScript渲染的动态网站内容
 * - 返回的内容是经过智能处理的纯文本，保留了重要的页面结构信息
 * - 自动提取并格式化页面中的链接作为参考信息
 * - 支持HTTP和HTTPS协议
 */
/**
 * 处理Web内容获取错误
 * 
 * 中文名称：处理Web内容获取错误
 * 
 * 预期行为：
 * - 统一处理Web内容获取过程中的错误
 * - 返回标准化的错误响应
 * 
 * @param error - 原始错误对象
 * @param url - 请求的URL
 * @returns 标准化的错误JSON字符串
 */
function handleWebFetchError(error: unknown, url: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return JSON.stringify({
    success: false,
    error: errorMessage || "FETCH_ERROR",
    message: "Failed to fetch URL with Puppeteer",
    url: url
  });
}

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
    } catch (error) {
      return handleWebFetchError(error, url);
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