import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createTencentWSA } from '@/infrastructure/tencent-cloud/wsa-service';

/**
 * 腾讯云WSA网络搜索工具模块
 * 
 * 该模块提供基于腾讯云WSA（联网搜索API）的网络搜索功能，使用搜狗搜索的全网公开资源。
 */

/**
 * 处理WSA搜索错误
 * 
 * 中文名称：处理WSA搜索错误
 * 
 * 预期行为：
 * - 统一处理WSA搜索过程中的错误
 * - 返回标准化的错误响应
 * 
 * @param error - 原始错误对象
 * @returns 标准化的错误JSON字符串
 */
function handleWsaSearchError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return JSON.stringify({
    success: false,
    error: errorMessage || "SEARCH_ERROR",
    message: "Failed to perform web search with Tencent Cloud WSA"
  });
}

/**
 * 腾讯云WSA网络搜索工具
 * 
 * 中文名称：腾讯云WSA网络搜索工具
 * 
 * 预期行为：
 * - 接收搜索关键词、超时时间和搜索模式参数
 * - 使用腾讯云WSA服务执行网络搜索
 * - 获取并返回结构化的搜索结果
 * - 返回JSON格式的响应
 * 
 * 行为分支：
 * 1. 搜索成功：成功执行搜索并获取结果，返回包含搜索内容、关键词、结果等信息的JSON
 * 2. 搜索失败：WSA执行过程中出现错误，返回包含错误信息的JSON
 * 3. 配置缺失：缺少必要的腾讯云认证配置，返回错误信息
 * 
 * @param query - 要搜索的关键词或短语
 * @param mode - 搜索模式（0-自然检索结果(默认)，1-多模态VR结果，2-混合结果）
 * @returns Promise<string> - 包含搜索结果的JSON字符串，包含success、message、query、results、version等字段
 * 
 * @example
 * ```typescript
 * // 执行简单搜索
 * const result = await tencentWsaSearchTool.invoke({ query: "JavaScript tutorial" });
 * 
 * // 执行多模态VR搜索
 * const result = await tencentWsaSearchTool.invoke({ 
 *   query: "Node.js best practices", 
 *   mode: 1
 * });
 * ```
 * 
 * @note
 * - 该工具使用腾讯云WSA服务，基于搜狗搜索的全网公开资源
 * - 需要配置TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID和TENCENTCLOUD_SECRET_KEY环境变量
 * - 返回的内容是经过处理的结构化数据，包含标题、摘要、URL、发布时间等信息
 */
export const tencentWsaSearchTool = tool(
  async ({ query, mode = 0 }) => {
    try {
      // 检查配置是否有效
      const wsa = createTencentWSA();
      if (!wsa.canSearch()) {
        return JSON.stringify({
          success: false,
          error: "MISSING_CONFIG",
          message: "请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量"
        });
      }
      
      const response = await wsa.search(query, mode);
      
      return JSON.stringify({
        success: true,
        message: `Web search completed using Tencent Cloud WSA`,
        query: query,
        results: response.Pages || [],
        version: response.Version || 'unknown',
        requestId: response.RequestId || null
      });
    } catch (error) {
      return handleWsaSearchError(error);
    }
  },
  {
    name: "TencentWsaSearch",
    description: `Performs a web search using Tencent Cloud WSA (Web Search API). Uses Sogou search's public web resources to provide intelligent search enhancement.
Supports natural search results, multimodal VR results, and mixed results.`,
    schema: z.object({
      query: z.string().describe("The search keyword or phrase to look up"),
      mode: z.number().optional().default(0).describe("Search mode: 0-natural results (default), 1-multimodal VR results, 2-mixed results")
    })
  }
);

/**
 * 异步获取腾讯云 WSA 网络搜索工具的方法
 * 
 * @returns Promise<Array<any>> - 包含腾讯云 WSA 工具的数组
 */
export default async function getTencentWsaTools() {
  return [tencentWsaSearchTool];
}