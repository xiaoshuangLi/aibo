// knowledge.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { 
  addKnowledge,
  getKnowledgeSummaries,
  searchKnowledge,
  KnowledgeItem,
  KnowledgeSummary
} from '@/shared/utils';

/**
 * 添加知识项到知识库工具
 * 
 * 中文名称：添加知识项工具
 * 
 * 预期行为：
 * - 接收知识内容、标题和关键字数组参数
 * - 将知识项添加到内存中的知识库存储
 * - 验证输入参数的有效性
 * - 返回操作结果的JSON响应
 * 
 * 行为分支：
 * 1. 正常添加：所有参数有效，成功添加知识项，返回success:true
 * 2. 参数验证失败：内容或标题为空，返回包含错误信息的JSON
 * 3. 关键字处理：关键字数组可以为空，但必须是数组类型
 * 
 * @param content - 知识内容（必需，非空字符串）
 * @param title - 知识标题（必需，非空字符串）
 * @param keywords - 关键字数组（可选，默认为空数组）
 * @returns Promise<string> - 包含操作结果的JSON字符串
 * 
 * @example
 * ```typescript
 * // 添加带关键字的知识
 * const result = await addKnowledgeTool.invoke({ 
 *   content: "这是知识的详细内容", 
 *   title: "知识标题", 
 *   keywords: ["关键字1", "关键字2"] 
 * });
 * 
 * // 添加不带关键字的知识
 * const result = await addKnowledgeTool.invoke({ 
 *   content: "简单知识内容", 
 *   title: "简单标题" 
 * });
 * ```
 */
export const addKnowledgeTool = tool(
  async ({ content, title, keywords = [] }) => {
    try {
      // 参数验证
      if (!content || typeof content !== 'string' || content.trim() === '') {
        return JSON.stringify({
          success: false,
          error: "INVALID_CONTENT",
          message: "知识内容不能为空且必须是字符串"
        }, null, 2);
      }
      
      if (!title || typeof title !== 'string' || title.trim() === '') {
        return JSON.stringify({
          success: false,
          error: "INVALID_TITLE",
          message: "知识标题不能为空且必须是字符串"
        }, null, 2);
      }
      
      if (!Array.isArray(keywords)) {
        return JSON.stringify({
          success: false,
          error: "INVALID_KEYWORDS",
          message: "关键字必须是数组类型"
        }, null, 2);
      }
      
      // 确保关键字数组中的每个元素都是字符串
      const validKeywords = keywords.filter(keyword => 
        typeof keyword === 'string' && keyword.trim() !== ''
      ).map(keyword => keyword.trim());
      
      // 调用现有的知识库功能
      addKnowledge(content.trim(), title.trim(), validKeywords);
      
      return JSON.stringify({
        success: true,
        message: "知识项已成功添加到知识库",
        title: title.trim(),
        keywordCount: validKeywords.length
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: "ADD_KNOWLEDGE_ERROR",
        message: "添加知识项时发生错误",
        details: error instanceof Error ? error.message : "未知错误"
      }, null, 2);
    }
  },
  {
    name: "add_knowledge",
    description: `Add a knowledge item to the knowledge base.
- Content: The detailed content of the knowledge (required, non-empty string)
- Title: The title of the knowledge item (required, non-empty string)  
- Keywords: Array of keywords for the knowledge item (optional, default empty array)

Returns a JSON response indicating success or failure with appropriate error messages.`,
    schema: z.object({
      content: z.string().min(1).describe("The detailed content of the knowledge (required, non-empty string)"),
      title: z.string().min(1).describe("The title of the knowledge item (required, non-empty string)"),
      keywords: z.array(z.string()).optional().default([]).describe("Array of keywords for the knowledge item (optional, default empty array)"),
    }),
  }
);

/**
 * 获取知识摘要工具
 * 
 * 中文名称：获取知识摘要工具
 * 
 * 预期行为：
 * - 不需要任何参数
 * - 从知识库中获取所有知识项的摘要信息（只包含标题和关键字）
 * - 返回包含所有知识摘要的JSON响应
 * 
 * 行为分支：
 * 1. 正常获取：返回所有知识摘要的列表
 * 2. 空知识库：知识库为空时返回空数组
 * 
 * @returns Promise<string> - 包含所有知识摘要的JSON字符串
 * 
 * @example
 * ```typescript
 * // 获取所有知识摘要
 * const result = await getKnowledgeSummariesTool.invoke({});
 * ```
 */
export const getKnowledgeSummariesTool = tool(
  async () => {
    try {
      // 调用现有的知识库功能
      const summaries = getKnowledgeSummaries();
      
      return JSON.stringify({
        success: true,
        knowledgeSummaries: summaries,
        total: summaries.length
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: "GET_KNOWLEDGE_SUMMARIES_ERROR",
        message: "获取知识摘要时发生错误",
        details: error instanceof Error ? error.message : "未知错误"
      }, null, 2);
    }
  },
  {
    name: "get_knowledge_summaries",
    description: `Get knowledge summaries (titles and keywords only) from the knowledge base.
- No parameters required
- Returns summaries containing only titles and keywords for all knowledge items
- If the knowledge base is empty, returns an empty array

This is useful when you need to quickly browse available knowledge without loading full content.

Returns a JSON response containing knowledge summaries or an error message.`,
    schema: z.object({}),
  }
);

/**
 * 通过标题或关键字搜索知识项工具
 * 
 * 中文名称：搜索知识项工具
 * 
 * 预期行为：
 * - 接收搜索查询字符串参数
 * - 在知识库中搜索匹配标题或关键字的知识项
 * - 返回包含匹配知识项的JSON响应
 * 
 * 行为分支：
 * 1. 正常搜索：返回所有匹配的知识项
 * 2. 空查询：查询字符串为空时返回空结果
 * 3. 无匹配：没有找到匹配项时返回空数组
 * 
 * @param query - 搜索查询字符串（必需，非空字符串）
 * @returns Promise<string> - 包含匹配知识项的JSON字符串
 * 
 * @example
 * ```typescript
 * // 搜索包含特定关键词的知识
 * const result = await searchKnowledgeTool.invoke({ 
 *   query: "人工智能" 
 * });
 * ```
 */
export const searchKnowledgeTool = tool(
  async ({ query }) => {
    try {
      // 参数验证
      if (!query || typeof query !== 'string' || query.trim() === '') {
        return JSON.stringify({
          success: true,
          message: "查询字符串为空，返回空结果",
          knowledgeItems: [],
          total: 0
        }, null, 2);
      }
      
      // 调用现有的知识库功能
      const searchResults = searchKnowledge(query.trim());
      
      return JSON.stringify({
        success: true,
        message: `搜索完成，找到 ${searchResults.length} 个匹配项`,
        knowledgeItems: searchResults,
        total: searchResults.length
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: "SEARCH_KNOWLEDGE_ERROR",
        message: "搜索知识项时发生错误",
        details: error instanceof Error ? error.message : "未知错误"
      }, null, 2);
    }
  },
  {
    name: "search_knowledge",
    description: `Search knowledge items by title or keywords.
- Query: The search query string to match against titles or keywords (required, non-empty string)
- Returns knowledge items that match the search query in either their title or keywords
- If no matches are found, returns an empty array
- If the query is empty, returns an empty array

Returns a JSON response containing matching knowledge items or an error message.`,
    schema: z.object({
      query: z.string().min(1).describe("The search query string to match against titles or keywords (required, non-empty string)"),
    }),
  }
);

/**
 * 异步获取知识库工具的方法
 * 
 * @returns Promise<Array<any>> - 包含所有知识库工具的数组
 */
export default async function getKnowledgeTools() {
  return [
    addKnowledgeTool,
    getKnowledgeSummariesTool,
    searchKnowledgeTool
  ];
}