import getGithubRepoTools, {
  githubRepoInfoTool,
  githubRepoTreeTool,
  githubRepoCommitsTool,
} from '../../src/tools/github-repo';
import axios from 'axios';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// githubRepoInfoTool
// ---------------------------------------------------------------------------
describe('githubRepoInfoTool', () => {
  test('should have correct tool name and schema', () => {
    expect(githubRepoInfoTool.name).toBe('github_repo_info');
    expect(githubRepoInfoTool.description).toContain('metadata');
    const schema = githubRepoInfoTool.schema;
    expect(schema.shape.owner).toBeDefined();
    expect(schema.shape.repo).toBeDefined();
  });

  test('should return repo metadata on success', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        full_name: 'acme/my-repo',
        description: 'A test repo',
        homepage: 'https://example.com',
        language: 'TypeScript',
        topics: ['ai', 'bot'],
        default_branch: 'main',
        stargazers_count: 42,
        forks_count: 3,
        open_issues_count: 5,
        visibility: 'public',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
        pushed_at: '2024-06-10T00:00:00Z',
        license: { spdx_id: 'MIT' },
        html_url: 'https://github.com/acme/my-repo',
      },
    });

    const result = await githubRepoInfoTool.invoke({ owner: 'acme', repo: 'my-repo' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.owner).toBe('acme');
    expect(parsed.repo).toBe('my-repo');
    expect(parsed.full_name).toBe('acme/my-repo');
    expect(parsed.description).toBe('A test repo');
    expect(parsed.language).toBe('TypeScript');
    expect(parsed.topics).toEqual(['ai', 'bot']);
    expect(parsed.default_branch).toBe('main');
    expect(parsed.stars).toBe(42);
    expect(parsed.forks).toBe(3);
    expect(parsed.license).toBe('MIT');
    expect(parsed.html_url).toBe('https://github.com/acme/my-repo');
  });

  test('should handle null description and license gracefully', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        full_name: 'acme/bare-repo',
        description: null,
        homepage: null,
        language: null,
        topics: [],
        default_branch: 'main',
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        visibility: 'public',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: '2024-01-01T00:00:00Z',
        license: null,
        html_url: 'https://github.com/acme/bare-repo',
      },
    });

    const result = await githubRepoInfoTool.invoke({ owner: 'acme', repo: 'bare-repo' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.description).toBeNull();
    expect(parsed.language).toBeNull();
    expect(parsed.license).toBeNull();
  });

  test('should return error on 404', async () => {
    mockedGet.mockRejectedValueOnce({
      response: { status: 404, data: { message: 'Not Found' } },
      message: 'Request failed with status code 404',
    });

    const result = await githubRepoInfoTool.invoke({ owner: 'nobody', repo: 'gone' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe(404);
    expect(parsed.message).toBe('Not Found');
  });

  test('should return error on network failure', async () => {
    mockedGet.mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });

    const result = await githubRepoInfoTool.invoke({ owner: 'acme', repo: 'my-repo' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).not.toBe('undefined');
  });
});

// ---------------------------------------------------------------------------
// githubRepoTreeTool
// ---------------------------------------------------------------------------
describe('githubRepoTreeTool', () => {
  test('should have correct tool name and schema', () => {
    expect(githubRepoTreeTool.name).toBe('github_repo_tree');
    expect(githubRepoTreeTool.description).toContain('files');
    const schema = githubRepoTreeTool.schema;
    expect(schema.shape.owner).toBeDefined();
    expect(schema.shape.repo).toBeDefined();
    expect(schema.shape.branch).toBeDefined();
    expect(schema.shape.path).toBeDefined();
  });

  test('should return file tree on success', async () => {
    // First call: resolve ref SHA
    mockedGet.mockResolvedValueOnce({ data: { object: { sha: 'abc123' } } });
    // Second call: get tree
    mockedGet.mockResolvedValueOnce({
      data: {
        truncated: false,
        tree: [
          { path: 'src', type: 'tree', size: undefined },
          { path: 'src/index.ts', type: 'blob', size: 512 },
          { path: 'README.md', type: 'blob', size: 1024 },
        ],
      },
    });

    const result = await githubRepoTreeTool.invoke({
      owner: 'acme',
      repo: 'my-repo',
      branch: 'main',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.total).toBe(3);
    expect(parsed.truncated).toBe(false);
    expect(parsed.items.some((i: any) => i.path === 'README.md')).toBe(true);
    expect(parsed.items.find((i: any) => i.path === 'src').type).toBe('dir');
    expect(parsed.items.find((i: any) => i.path === 'src/index.ts').type).toBe('file');
  });

  test('should filter items by path prefix', async () => {
    mockedGet.mockResolvedValueOnce({ data: { object: { sha: 'def456' } } });
    mockedGet.mockResolvedValueOnce({
      data: {
        truncated: false,
        tree: [
          { path: 'src', type: 'tree' },
          { path: 'src/tools', type: 'tree' },
          { path: 'src/tools/bash.ts', type: 'blob', size: 200 },
          { path: 'src/core.ts', type: 'blob', size: 300 },
          { path: 'README.md', type: 'blob', size: 400 },
        ],
      },
    });

    const result = await githubRepoTreeTool.invoke({
      owner: 'acme',
      repo: 'my-repo',
      branch: 'main',
      path: 'src/tools',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    // Should include 'src/tools' itself and 'src/tools/bash.ts'
    expect(parsed.items.every((i: any) => i.path.startsWith('src/tools'))).toBe(true);
    expect(parsed.items.some((i: any) => i.path === 'README.md')).toBe(false);
  });

  test('should resolve default branch when no branch is provided', async () => {
    // First call: get repo info to resolve default branch
    mockedGet.mockResolvedValueOnce({ data: { default_branch: 'main' } });
    // Second call: resolve ref SHA for the default branch
    mockedGet.mockResolvedValueOnce({ data: { object: { sha: 'default123' } } });
    // Third call: get tree
    mockedGet.mockResolvedValueOnce({
      data: {
        truncated: false,
        tree: [{ path: 'README.md', type: 'blob', size: 500 }],
      },
    });

    const result = await githubRepoTreeTool.invoke({ owner: 'acme', repo: 'my-repo' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.branch).toBe('main');
    expect(parsed.total).toBe(1);
  });

  test('should return error on API failure', async () => {
    mockedGet.mockRejectedValueOnce({
      response: { status: 403, data: { message: 'API rate limit exceeded' } },
      message: 'Request failed with status code 403',
    });

    const result = await githubRepoTreeTool.invoke({ owner: 'acme', repo: 'my-repo', branch: 'main' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe(403);
  });

  test('should indicate when tree is truncated', async () => {
    mockedGet.mockResolvedValueOnce({ data: { object: { sha: 'ghi789' } } });
    mockedGet.mockResolvedValueOnce({
      data: { truncated: true, tree: [{ path: 'a.ts', type: 'blob', size: 10 }] },
    });

    const result = await githubRepoTreeTool.invoke({
      owner: 'acme',
      repo: 'big-repo',
      branch: 'main',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// githubRepoCommitsTool
// ---------------------------------------------------------------------------
describe('githubRepoCommitsTool', () => {
  test('should have correct tool name and schema', () => {
    expect(githubRepoCommitsTool.name).toBe('github_repo_commits');
    expect(githubRepoCommitsTool.description).toContain('commits');
    const schema = githubRepoCommitsTool.schema;
    expect(schema.shape.owner).toBeDefined();
    expect(schema.shape.repo).toBeDefined();
    expect(schema.shape.branch).toBeDefined();
    expect(schema.shape.max_count).toBeDefined();
    expect(schema.shape.author).toBeDefined();
    expect(schema.shape.since).toBeDefined();
  });

  test('should return commits on success', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          sha: 'aabbccdd1122334455667788990011223344556677',
          commit: {
            message: 'feat: add new tool\n\nDetails here',
            author: { name: 'Alice', date: '2024-06-01T10:00:00Z' },
          },
          author: { login: 'alice' },
          html_url: 'https://github.com/acme/my-repo/commit/aabbccdd',
        },
        {
          sha: 'bbccddee1122334455667788990011223344556677',
          commit: {
            message: 'fix: resolve null pointer',
            author: { name: 'Bob', date: '2024-05-30T09:00:00Z' },
          },
          author: { login: 'bob' },
          html_url: 'https://github.com/acme/my-repo/commit/bbccddee',
        },
      ],
    });

    const result = await githubRepoCommitsTool.invoke({
      owner: 'acme',
      repo: 'my-repo',
      max_count: 10,
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.count).toBe(2);
    expect(parsed.commits[0].short_sha).toBe('aabbccd');
    expect(parsed.commits[0].message).toBe('feat: add new tool');
    expect(parsed.commits[0].author).toBe('Alice');
    expect(parsed.commits[0].date).toBe('2024-06-01T10:00:00Z');
  });

  test('should truncate multi-line commit messages to the subject line', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          sha: 'cc'.repeat(20),
          commit: {
            message: 'chore: update deps\n\nBump foo from 1.0 to 2.0',
            author: { name: 'Charlie', date: '2024-05-01T00:00:00Z' },
          },
          author: null,
          html_url: 'https://github.com/acme/my-repo/commit/cccccccc',
        },
      ],
    });

    const result = await githubRepoCommitsTool.invoke({ owner: 'acme', repo: 'my-repo' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.commits[0].message).toBe('chore: update deps');
    // Falls back to author.name when author login is null
    expect(parsed.commits[0].author).toBe('Charlie');
  });

  test('should return error on API failure', async () => {
    mockedGet.mockRejectedValueOnce({
      response: { status: 404, data: { message: 'Not Found' } },
      message: 'Request failed with status code 404',
    });

    const result = await githubRepoCommitsTool.invoke({ owner: 'nobody', repo: 'gone' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// getGithubRepoTools
// ---------------------------------------------------------------------------
describe('getGithubRepoTools', () => {
  test('should return array with all three tools', async () => {
    const tools = await getGithubRepoTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(3);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('github_repo_info');
    expect(names).toContain('github_repo_tree');
    expect(names).toContain('github_repo_commits');
  });
});
