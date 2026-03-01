import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";

const GITHUB_API_BASE = "https://api.github.com";
const MAX_CONTENT_BYTES = 100 * 1024; // 100 KB cap on any single response

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "AIBO-Bot/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || process.env.AIBO_GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function githubGet(path: string): Promise<any> {
  const url = `${GITHUB_API_BASE}${path}`;
  const response = await axios.get(url, {
    headers: buildHeaders(),
    timeout: 15000,
  });
  return response.data;
}

function errorResult(error: unknown, context: Record<string, string> = {}): string {
  const err = error as any;
  const status: number | undefined = err?.response?.status;
  const message: string =
    err?.response?.data?.message ||
    err?.message ||
    String(error);
  return JSON.stringify(
    { success: false, error: status ?? err?.code ?? "GITHUB_API_ERROR", message, ...context },
    null,
    2
  );
}

/**
 * github_repo_info — get metadata for any public GitHub repository.
 */
export const githubRepoInfoTool = tool(
  async ({ owner, repo }) => {
    try {
      const data = await githubGet(`/repos/${owner}/${repo}`);
      return JSON.stringify(
        {
          success: true,
          owner,
          repo,
          full_name: data.full_name,
          description: data.description ?? null,
          homepage: data.homepage ?? null,
          language: data.language ?? null,
          topics: data.topics ?? [],
          default_branch: data.default_branch,
          stars: data.stargazers_count,
          forks: data.forks_count,
          open_issues: data.open_issues_count,
          visibility: data.visibility,
          created_at: data.created_at,
          updated_at: data.updated_at,
          pushed_at: data.pushed_at,
          license: data.license?.spdx_id ?? null,
          html_url: data.html_url,
        },
        null,
        2
      );
    } catch (error) {
      return errorResult(error, { owner, repo });
    }
  },
  {
    name: "github_repo_info",
    description: `Get metadata for a GitHub repository: description, primary language, topics, stars, forks, default branch, license, and timestamps.
Use this as the first step when exploring an unfamiliar GitHub repository.
Requires no authentication for public repos; set GITHUB_TOKEN env var to raise the rate limit.`,
    schema: z.object({
      owner: z.string().describe("GitHub owner (user or organisation name)"),
      repo: z.string().describe("Repository name"),
    }),
  }
);

/**
 * github_repo_tree — list files and directories in a GitHub repository.
 */
export const githubRepoTreeTool = tool(
  async ({ owner, repo, branch, path }) => {
    try {
      // Resolve the commit SHA for the branch.
      // When no branch is given, look up the repo's default branch first.
      let resolvedBranch = branch;
      if (!resolvedBranch) {
        const repoData = await githubGet(`/repos/${owner}/${repo}`);
        resolvedBranch = repoData.default_branch;
      }
      const refData = await githubGet(
        `/repos/${owner}/${repo}/git/ref/heads/${resolvedBranch}`
      );

      const treeSha: string = refData.object.sha;

      const treeData = await githubGet(
        `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`
      );

      let items: Array<{ path: string; type: string; size?: number }> =
        treeData.tree
          .filter((item: any) => item.type === "blob" || item.type === "tree")
          .map((item: any) => ({
            path: item.path,
            type: item.type === "blob" ? "file" : "dir",
            size: item.size,
          }));

      // Filter by path prefix when requested
      if (path) {
        const prefix = path.endsWith("/") ? path : `${path}/`;
        items = items.filter(
          (item) => item.path === path || item.path.startsWith(prefix)
        );
      }

      const truncated = treeData.truncated === true;

      return JSON.stringify(
        {
          success: true,
          owner,
          repo,
          branch: resolvedBranch,
          path: path ?? "/",
          total: items.length,
          truncated,
          items,
        },
        null,
        2
      );
    } catch (error) {
      return errorResult(error, { owner, repo });
    }
  },
  {
    name: "github_repo_tree",
    description: `List all files and directories in a GitHub repository (recursive).
Returns each entry with its path and type (file or dir).
Optionally filter to a sub-directory by providing a 'path' prefix.
Use this to map the structure of any GitHub repository before reading individual files.
Requires no authentication for public repos; set GITHUB_TOKEN env var to raise the rate limit.`,
    schema: z.object({
      owner: z.string().describe("GitHub owner (user or organisation name)"),
      repo: z.string().describe("Repository name"),
      branch: z.string().optional().describe("Branch to read the tree from (defaults to the repository's default branch)"),
      path: z.string().optional().describe("Sub-directory path to filter results to (e.g. 'src/tools')"),
    }),
  }
);

/**
 * github_repo_commits — list recent commits for a GitHub repository.
 */
export const githubRepoCommitsTool = tool(
  async ({ owner, repo, branch, max_count, author, since }) => {
    try {
      const params: Record<string, string | number> = {
        per_page: Math.min(max_count ?? 20, 100),
      };
      if (branch) params.sha = branch;
      if (author) params.author = author;
      if (since) params.since = since;

      const query = Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");

      const data: any[] = await githubGet(
        `/repos/${owner}/${repo}/commits?${query}`
      );

      const commits = data.map((c: any) => ({
        sha: c.sha,
        short_sha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0],
        author: c.commit.author?.name ?? c.author?.login ?? "unknown",
        date: c.commit.author?.date ?? null,
        html_url: c.html_url,
      }));

      return JSON.stringify(
        { success: true, owner, repo, branch: branch ?? "(default)", count: commits.length, commits },
        null,
        2
      );
    } catch (error) {
      return errorResult(error, { owner, repo });
    }
  },
  {
    name: "github_repo_commits",
    description: `List recent commits for a GitHub repository.
Returns each commit with short SHA, subject line, author, and date.
Use this to understand what a repository has been working on recently, or to review the history of a specific branch.
Requires no authentication for public repos; set GITHUB_TOKEN env var to raise the rate limit.`,
    schema: z.object({
      owner: z.string().describe("GitHub owner (user or organisation name)"),
      repo: z.string().describe("Repository name"),
      branch: z.string().optional().describe("Branch or commit SHA to start from (defaults to the repository's default branch)"),
      max_count: z.number().int().min(1).max(100).optional().default(20).describe("Maximum number of commits to return (default: 20, max: 100)"),
      author: z.string().optional().describe("Filter commits by author (GitHub username or email)"),
      since: z.string().optional().describe("Only show commits after this ISO 8601 timestamp (e.g. '2024-01-01T00:00:00Z')"),
    }),
  }
);

/**
 * Returns all GitHub repository understanding tools.
 */
export default async function getGithubRepoTools() {
  return [githubRepoInfoTool, githubRepoTreeTool, githubRepoCommitsTool];
}
