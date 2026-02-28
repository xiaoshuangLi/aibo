import * as library from '@/shared/utils/library';
import { SessionManager } from '@/infrastructure/session/manager';

// Mock the SessionManager to isolate library function tests
jest.mock('@/infrastructure/session/manager');

describe('Library Knowledge Functions', () => {
  let mockSessionManager: jest.Mocked<SessionManager>;
  
  beforeEach(() => {
    // Create a fresh mock session manager instance for each test
    mockSessionManager = {
      addKnowledgeToCurrentSession: jest.fn(),
      getAllKnowledgeFromCurrentSession: jest.fn(),
      getKnowledgeSummariesFromCurrentSession: jest.fn(),
      searchKnowledgeInCurrentSession: jest.fn(),
      clearCurrentSessionKnowledge: jest.fn(),
      getInstance: jest.fn(),
    } as unknown as jest.Mocked<SessionManager>;
    
    // Mock the static getInstance method to return our mock instance
    (SessionManager.getInstance as jest.Mock).mockReturnValue(mockSessionManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addKnowledge', () => {
    it('should call session manager with correct parameters', () => {
      const content = 'Test content';
      const title = 'Test title';
      const keywords = ['keyword1', 'keyword2'];
      
      library.addKnowledge(content, title, keywords);
      
      expect(mockSessionManager.addKnowledgeToCurrentSession).toHaveBeenCalledWith(
        content, title, keywords
      );
    });

    it('should handle empty keywords array', () => {
      const content = 'Test content';
      const title = 'Test title';
      const keywords: string[] = [];
      
      library.addKnowledge(content, title, keywords);
      
      expect(mockSessionManager.addKnowledgeToCurrentSession).toHaveBeenCalledWith(
        content, title, keywords
      );
    });
  });

  describe('getAllKnowledge', () => {
    it('should return knowledge items from session manager', () => {
      const mockKnowledgeItems = [
        { content: 'Content 1', title: 'Title 1', keywords: ['kw1'] },
        { content: 'Content 2', title: 'Title 2', keywords: ['kw2'] }
      ];
      
      mockSessionManager.getAllKnowledgeFromCurrentSession.mockReturnValue(mockKnowledgeItems);
      
      const result = library.getAllKnowledge();
      
      expect(result).toEqual(mockKnowledgeItems);
      expect(mockSessionManager.getAllKnowledgeFromCurrentSession).toHaveBeenCalled();
    });

    it('should return empty array when no knowledge exists', () => {
      mockSessionManager.getAllKnowledgeFromCurrentSession.mockReturnValue([]);
      
      const result = library.getAllKnowledge();
      
      expect(result).toEqual([]);
      expect(mockSessionManager.getAllKnowledgeFromCurrentSession).toHaveBeenCalled();
    });
  });

  describe('getKnowledgeSummaries', () => {
    it('should return knowledge summaries from session manager', () => {
      const mockSummaries = [
        { title: 'Summary 1', keywords: ['kw1'] },
        { title: 'Summary 2', keywords: ['kw2'] }
      ];
      
      mockSessionManager.getKnowledgeSummariesFromCurrentSession.mockReturnValue(mockSummaries);
      
      const result = library.getKnowledgeSummaries();
      
      expect(result).toEqual(mockSummaries);
      expect(mockSessionManager.getKnowledgeSummariesFromCurrentSession).toHaveBeenCalled();
    });

    it('should return empty array when no summaries exist', () => {
      mockSessionManager.getKnowledgeSummariesFromCurrentSession.mockReturnValue([]);
      
      const result = library.getKnowledgeSummaries();
      
      expect(result).toEqual([]);
      expect(mockSessionManager.getKnowledgeSummariesFromCurrentSession).toHaveBeenCalled();
    });
  });

  describe('searchKnowledge', () => {
    it('should search knowledge with given query', () => {
      const query = 'test query';
      const mockResults = [
        { content: 'Content 1', title: 'Title 1', keywords: ['test'] }
      ];
      
      mockSessionManager.searchKnowledgeInCurrentSession.mockReturnValue(mockResults);
      
      const result = library.searchKnowledge(query);
      
      expect(result).toEqual(mockResults);
      expect(mockSessionManager.searchKnowledgeInCurrentSession).toHaveBeenCalledWith(query);
    });

    it('should return empty array when no matches found', () => {
      const query = 'nonexistent';
      
      mockSessionManager.searchKnowledgeInCurrentSession.mockReturnValue([]);
      
      const result = library.searchKnowledge(query);
      
      expect(result).toEqual([]);
      expect(mockSessionManager.searchKnowledgeInCurrentSession).toHaveBeenCalledWith(query);
    });
  });

  describe('clearKnowledge', () => {
    it('should call session manager to clear knowledge', () => {
      library.clearKnowledge();
      
      expect(mockSessionManager.clearCurrentSessionKnowledge).toHaveBeenCalled();
    });
  });

  describe('getSessionManager', () => {
    it('should return the session manager instance', () => {
      const result = library.getSessionManager();
      
      expect(result).toBe(mockSessionManager);
      expect(SessionManager.getInstance).toHaveBeenCalled();
    });
  });
});