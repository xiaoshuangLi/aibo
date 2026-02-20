import { addKnowledgeTool, getKnowledgeSummariesTool, searchKnowledgeTool } from '@/tools/knowledge';
import * as library from '@/shared/utils/library';

// Mock the library functions to isolate the tool tests
jest.mock('@/shared/utils/library', () => ({
  addKnowledge: jest.fn(),
  getKnowledgeSummaries: jest.fn(),
  searchKnowledge: jest.fn(),
}));

// Helper function to call the tool's internal function directly
async function callToolFunction(tool: any, args: any) {
  // Get the internal function from the tool
  const toolFunc = (tool as any).func;
  return await toolFunc(args);
}

describe('Knowledge Tools', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('addKnowledgeTool', () => {
    it('should successfully add knowledge with valid parameters', async () => {
      const mockContent = 'This is detailed knowledge content';
      const mockTitle = 'Knowledge Title';
      const mockKeywords = ['keyword1', 'keyword2'];
      
      (library.addKnowledge as jest.Mock).mockImplementation(() => {});
      
      const result = await addKnowledgeTool.invoke({
        content: mockContent,
        title: mockTitle,
        keywords: mockKeywords
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: "知识项已成功添加到知识库",
        title: mockTitle,
        keywordCount: mockKeywords.length
      });
      
      expect(library.addKnowledge).toHaveBeenCalledWith(
        mockContent,
        mockTitle,
        mockKeywords
      );
    });

    it('should successfully add knowledge without keywords', async () => {
      const mockContent = 'Simple knowledge content';
      const mockTitle = 'Simple Title';
      
      (library.addKnowledge as jest.Mock).mockImplementation(() => {});
      
      const result = await addKnowledgeTool.invoke({
        content: mockContent,
        title: mockTitle
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: "知识项已成功添加到知识库",
        title: mockTitle,
        keywordCount: 0
      });
      
      expect(library.addKnowledge).toHaveBeenCalledWith(
        mockContent,
        mockTitle,
        []
      );
    });

    // Test parameter validation by calling the internal function directly
    it('should filter out invalid keywords and only keep valid strings', async () => {
      const mockContent = 'Knowledge with mixed keywords';
      const mockTitle = 'Mixed Keywords Title';
      const mockKeywords = ['valid1', '', '   ', '123', 'null', 'valid2', 'undefined'];
      
      (library.addKnowledge as jest.Mock).mockImplementation(() => {});
      
      const result = await callToolFunction(addKnowledgeTool, {
        content: mockContent,
        title: mockTitle,
        keywords: mockKeywords
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: "知识项已成功添加到知识库",
        title: mockTitle,
        keywordCount: 5
      });
      
      expect(library.addKnowledge).toHaveBeenCalledWith(
        mockContent,
        mockTitle,
        ['valid1', '123', 'null', 'valid2', 'undefined']
      );
    });

    it('should return error for empty content', async () => {
      const result = await callToolFunction(addKnowledgeTool, {
        content: '',
        title: 'Valid Title',
        keywords: ['keyword']
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: false,
        error: "INVALID_CONTENT",
        message: "知识内容不能为空且必须是字符串"
      });
      
      expect(library.addKnowledge).not.toHaveBeenCalled();
    });

    it('should return error for whitespace-only content', async () => {
      const result = await callToolFunction(addKnowledgeTool, {
        content: '   ',
        title: 'Valid Title',
        keywords: ['keyword']
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: false,
        error: "INVALID_CONTENT",
        message: "知识内容不能为空且必须是字符串"
      });
      
      expect(library.addKnowledge).not.toHaveBeenCalled();
    });

    it('should return error for non-string content', async () => {
      const result = await callToolFunction(addKnowledgeTool, {
        content: 123 as any,
        title: 'Valid Title',
        keywords: ['keyword']
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: false,
        error: "INVALID_CONTENT",
        message: "知识内容不能为空且必须是字符串"
      });
      
      expect(library.addKnowledge).not.toHaveBeenCalled();
    });

    it('should return error for empty title', async () => {
      const result = await callToolFunction(addKnowledgeTool, {
        content: 'Valid Content',
        title: '',
        keywords: ['keyword']
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: false,
        error: "INVALID_TITLE",
        message: "知识标题不能为空且必须是字符串"
      });
      
      expect(library.addKnowledge).not.toHaveBeenCalled();
    });

    it('should return error for whitespace-only title', async () => {
      const result = await callToolFunction(addKnowledgeTool, {
        content: 'Valid Content',
        title: '   ',
        keywords: ['keyword']
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: false,
        error: "INVALID_TITLE",
        message: "知识标题不能为空且必须是字符串"
      });
      
      expect(library.addKnowledge).not.toHaveBeenCalled();
    });

    it('should return error for non-string title', async () => {
      const result = await callToolFunction(addKnowledgeTool, {
        content: 'Valid Content',
        title: 123 as any,
        keywords: ['keyword']
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: false,
        error: "INVALID_TITLE",
        message: "知识标题不能为空且必须是字符串"
      });
      
      expect(library.addKnowledge).not.toHaveBeenCalled();
    });

    it('should return error for non-array keywords', async () => {
      const result = await callToolFunction(addKnowledgeTool, {
        content: 'Valid Content',
        title: 'Valid Title',
        keywords: 'not an array' as any
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: false,
        error: "INVALID_KEYWORDS",
        message: "关键字必须是数组类型"
      });
      
      expect(library.addKnowledge).not.toHaveBeenCalled();
    });

    it('should handle internal errors gracefully', async () => {
      (library.addKnowledge as jest.Mock).mockImplementation(() => {
        throw new Error('Internal error occurred');
      });
      
      const result = await addKnowledgeTool.invoke({
        content: 'Valid Content',
        title: 'Valid Title',
        keywords: ['keyword']
      });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("ADD_KNOWLEDGE_ERROR");
      expect(parsedResult.message).toBe("添加知识项时发生错误");
      expect(parsedResult.details).toBe("Internal error occurred");
    });
  });

  describe('getKnowledgeSummariesTool', () => {
    it('should successfully get knowledge summaries when knowledge base has data', async () => {
      const mockSummaries = [
        { title: 'Summary 1', keywords: ['kw1', 'kw2'] },
        { title: 'Summary 2', keywords: ['kw3'] }
      ];
      
      (library.getKnowledgeSummaries as jest.Mock).mockReturnValue(mockSummaries);
      
      const result = await getKnowledgeSummariesTool.invoke({});
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        knowledgeSummaries: mockSummaries,
        total: mockSummaries.length
      });
      
      expect(library.getKnowledgeSummaries).toHaveBeenCalled();
    });

    it('should return empty array when knowledge base is empty', async () => {
      (library.getKnowledgeSummaries as jest.Mock).mockReturnValue([]);
      
      const result = await getKnowledgeSummariesTool.invoke({});
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        knowledgeSummaries: [],
        total: 0
      });
      
      expect(library.getKnowledgeSummaries).toHaveBeenCalled();
    });

    it('should handle internal errors gracefully', async () => {
      (library.getKnowledgeSummaries as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to fetch summaries');
      });
      
      const result = await getKnowledgeSummariesTool.invoke({});
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("GET_KNOWLEDGE_SUMMARIES_ERROR");
      expect(parsedResult.message).toBe("获取知识摘要时发生错误");
      expect(parsedResult.details).toBe("Failed to fetch summaries");
    });
  });

  describe('searchKnowledgeTool', () => {
    it('should successfully search knowledge with valid query', async () => {
      const mockQuery = 'search term';
      const mockResults = [
        { content: 'Content 1', title: 'Title 1', keywords: ['kw1'] },
        { content: 'Content 2', title: 'Title 2', keywords: ['kw2'] }
      ];
      
      (library.searchKnowledge as jest.Mock).mockReturnValue(mockResults);
      
      const result = await searchKnowledgeTool.invoke({ query: mockQuery });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: `搜索完成，找到 ${mockResults.length} 个匹配项`,
        knowledgeItems: mockResults,
        total: mockResults.length
      });
      
      expect(library.searchKnowledge).toHaveBeenCalledWith(mockQuery);
    });

    it('should return empty results for empty query', async () => {
      const result = await callToolFunction(searchKnowledgeTool, { query: '' });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: "查询字符串为空，返回空结果",
        knowledgeItems: [],
        total: 0
      });
      
      expect(library.searchKnowledge).not.toHaveBeenCalled();
    });

    it('should return empty results for whitespace-only query', async () => {
      const result = await callToolFunction(searchKnowledgeTool, { query: '   ' });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: "查询字符串为空，返回空结果",
        knowledgeItems: [],
        total: 0
      });
      
      expect(library.searchKnowledge).not.toHaveBeenCalled();
    });

    it('should return empty results for non-string query', async () => {
      const result = await callToolFunction(searchKnowledgeTool, { query: 123 as any });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: "查询字符串为空，返回空结果",
        knowledgeItems: [],
        total: 0
      });
      
      expect(library.searchKnowledge).not.toHaveBeenCalled();
    });

    it('should return empty results when no matches found', async () => {
      const mockQuery = 'nonexistent term';
      
      (library.searchKnowledge as jest.Mock).mockReturnValue([]);
      
      const result = await searchKnowledgeTool.invoke({ query: mockQuery });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toEqual({
        success: true,
        message: "搜索完成，找到 0 个匹配项",
        knowledgeItems: [],
        total: 0
      });
      
      expect(library.searchKnowledge).toHaveBeenCalledWith(mockQuery);
    });

    it('should handle internal errors gracefully', async () => {
      (library.searchKnowledge as jest.Mock).mockImplementation(() => {
        throw new Error('Search failed');
      });
      
      const result = await searchKnowledgeTool.invoke({ query: 'test' });
      
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe("SEARCH_KNOWLEDGE_ERROR");
      expect(parsedResult.message).toBe("搜索知识项时发生错误");
      expect(parsedResult.details).toBe("Search failed");
    });
  });

  describe('Integration Tests', () => {
    it('should work together to add, retrieve, and search knowledge', async () => {
      const mockContent = 'Integration test content';
      const mockTitle = 'Integration Test';
      const mockKeywords = ['integration', 'test'];
      const mockSummaries = [{ title: mockTitle, keywords: mockKeywords }];
      const mockSearchResults = [{ content: mockContent, title: mockTitle, keywords: mockKeywords }];
      
      // Mock all library functions
      (library.addKnowledge as jest.Mock).mockImplementation(() => {});
      (library.getKnowledgeSummaries as jest.Mock).mockReturnValue(mockSummaries);
      (library.searchKnowledge as jest.Mock).mockReturnValue(mockSearchResults);
      
      // Add knowledge
      const addResult = await addKnowledgeTool.invoke({
        content: mockContent,
        title: mockTitle,
        keywords: mockKeywords
      });
      const parsedAddResult = JSON.parse(addResult);
      
      expect(parsedAddResult.success).toBe(true);
      
      // Get summaries
      const summaryResult = await getKnowledgeSummariesTool.invoke({});
      const parsedSummaryResult = JSON.parse(summaryResult);
      
      expect(parsedSummaryResult.success).toBe(true);
      expect(parsedSummaryResult.total).toBe(1);
      
      // Search knowledge
      const searchResult = await searchKnowledgeTool.invoke({ query: 'integration' });
      const parsedSearchResult = JSON.parse(searchResult);
      
      expect(parsedSearchResult.success).toBe(true);
      expect(parsedSearchResult.total).toBe(1);
    });
  });
});