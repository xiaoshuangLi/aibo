import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";

/**
 * GitHub内容获取工具
 * 
 * 中文名称：GitHub内容获取工具
 * 
 * 预期行为：
 * - 接收仓库所有者、仓库名、文件路径和分支参数
 * - 构建GitHub Raw Content API URL
 * - 使用axios发送HTTP GET请求
 * - 设置10秒超时和自定义User-Agent
 * - 限制响应内容大小以防止内存问题（最多100KB）
 * - 返回结构化的JSON响应
 * 
 * 行为分支：
 * 1. 正常获取：成功从GitHub获取文件内容，返回包含内容、URL、元数据和success:true的JSON
 * 2. 网络错误：请求失败（超时、连接错误等），返回包含错误代码和消息的JSON
 * 3. HTTP错误：GitHub返回4xx/5xx状态码，返回包含错误信息的JSON
 * 4. 内容截断：响应内容超过100KB时自动截断，但仍标记为成功
 * 5. 分支未指定：使用"main"作为默认分支
 * 6. URL构建：始终使用raw.githubusercontent.com域名和ref/heads/路径格式
 * 
 * @param owner - GitHub仓库所有者或组织名称
 * @param repo - 仓库名称
 * @param path - 仓库内的文件路径
 * @param branch - 分支名称，默认为"main"
 * @returns Promise<string> - 包含获取结果的JSON字符串，包含success、github_url、owner、repo、path、branch、content_length、content等字段
 * 
 * @example
 * ```typescript
 * // 获取README文件
 * const result = await webFetchFromGithubTool.invoke({
 *   owner: "facebook",
 *   repo: "react",
 *   path: "README.md"
 * });
 * 
 * // 获取特定分支的文件
 * const result = await webFetchFromGithubTool.invoke({
 *   owner: "microsoft",
 *   repo: "vscode",
 *   path: "package.json",
 *   branch: "release"
 * });
 * ```
 * 
 * @note
 * - 该工具使用GitHub Raw Content API，只能获取公开仓库的文件
 * - 私有仓库需要额外的认证机制，当前不支持
 * - 响应内容被限制在100KB以内以防止内存溢出
 */
/**
 * 处理GitHub获取错误
 * 
 * 中文名称：处理GitHub获取错误
 * 
 * 预期行为：
 * - 统一处理GitHub内容获取过程中的错误
 * - 返回标准化的错误响应
 * 
 * @param error - 原始错误对象
 * @param owner - 仓库所有者
 * @param repo - 仓库名称
 * @param path - 文件路径
 * @param branch - 分支名称
 * @returns 标准化的错误JSON字符串
 */
function handleGithubFetchError(error: unknown, owner: string, repo: string, path: string, branch: string): string {
  let errorMessage: string;
  let errorCode: string = "GITHUB_FETCH_ERROR";
  
  // Handle different error types
  if (error instanceof Error) {
    errorMessage = error.message;
    errorCode = (error as any).code || errorCode;
  } else if (typeof error === 'object' && error !== null) {
    // Handle object errors (like axios error objects)
    errorMessage = (error as any).message || String(error);
    errorCode = (error as any).code || errorCode;
  } else {
    // Handle primitive errors
    errorMessage = String(error);
  }
  
  const githubUrl = `https://raw.githubusercontent.com/${owner}/${repo}/ref/heads/${branch}/${path}`;
  
  return JSON.stringify({
    success: false,
    error: errorCode,
    message: errorMessage || "Failed to fetch from GitHub",
    github_url: githubUrl
  });
}

export const webFetchFromGithubTool = tool(
  async ({ owner, repo, path, branch = "main" }) => {
    try {
      const githubUrl = `https://raw.githubusercontent.com/${owner}/${repo}/ref/heads/${branch}/${path}`;
      
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
    } catch (error) {
      return handleGithubFetchError(error, owner, repo, path, branch);
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

export default [webFetchFromGithubTool];