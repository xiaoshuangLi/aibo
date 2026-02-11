import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";

/**
 * GitHub fetch tool that retrieves content from GitHub repositories.
 */
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
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.code || "GITHUB_FETCH_ERROR",
        message: error.message || "Failed to fetch from GitHub",
        github_url: `https://raw.githubusercontent.com/${owner}/${repo}/ref/heads/${branch}/${path}`
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

export default [webFetchFromGithubTool];