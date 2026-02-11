import githubFetch from '../../src/tools/github-fetch';
import axios from 'axios';

// Mock axios to prevent actual network calls during testing
jest.mock('axios');

describe('GitHub Fetch Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should have correct tool schema', () => {
    const tool = githubFetch[0];
    expect(tool.name).toBe('WebFetchFromGithub');
    expect(tool.description).toContain('Fetches content from a GitHub repository file');
    
    const schema = tool.schema;
    expect(schema.shape.owner).toBeDefined();
    expect(schema.shape.repo).toBeDefined();
    expect(schema.shape.path).toBeDefined();
    expect(schema.shape.branch).toBeDefined();
  });

  test('should fetch content from GitHub successfully', async () => {
    const mockGithubContent = 'console.log("Hello World");\n// This is a test file';
    
    (axios.get as jest.Mock).mockResolvedValue({
      data: mockGithubContent,
      status: 200,
      headers: { 'content-type': 'text/plain' }
    });

    const tool = githubFetch[0];
    const result = await tool.invoke({ 
      owner: 'testuser', 
      repo: 'testrepo', 
      path: 'test.js' 
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.github_url).toBe('https://raw.githubusercontent.com/testuser/testrepo/ref/heads/main/test.js');
    expect(parsedResult.owner).toBe('testuser');
    expect(parsedResult.repo).toBe('testrepo');
    expect(parsedResult.path).toBe('test.js');
    expect(parsedResult.branch).toBe('main');
    expect(parsedResult.content).toBe(mockGithubContent);
    expect(parsedResult.content_length).toBe(mockGithubContent.length);
  });

  test('should handle custom branch', async () => {
    const mockGithubContent = 'Custom branch content';
    
    (axios.get as jest.Mock).mockResolvedValue({
      data: mockGithubContent,
      status: 200,
      headers: { 'content-type': 'text/plain' }
    });

    const tool = githubFetch[0];
    const result = await tool.invoke({ 
      owner: 'testuser', 
      repo: 'testrepo', 
      path: 'test.txt',
      branch: 'develop'
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.github_url).toBe('https://raw.githubusercontent.com/testuser/testrepo/ref/heads/develop/test.txt');
    expect(parsedResult.branch).toBe('develop');
  });

  test('should handle GitHub fetch error', async () => {
    (axios.get as jest.Mock).mockRejectedValue({ 
      code: 'GITHUB_FETCH_ERROR',
      message: 'File not found'
    });

    const tool = githubFetch[0];
    const result = await tool.invoke({ 
      owner: 'nonexistent', 
      repo: 'nonexistent', 
      path: 'nonexistent.txt' 
    });
    const parsedResult = JSON.parse(result);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toBe('GITHUB_FETCH_ERROR');
    expect(parsedResult.message).toBe('File not found');
    expect(parsedResult.github_url).toBe('https://raw.githubusercontent.com/nonexistent/nonexistent/ref/heads/main/nonexistent.txt');
  });
});