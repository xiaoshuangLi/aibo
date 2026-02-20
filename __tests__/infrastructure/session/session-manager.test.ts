import { SessionManager } from '@/infrastructure/session/session-manager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module to avoid actual file system operations
jest.mock('fs');
jest.mock('path');

// Mock createConsoleThreadId function
jest.mock('@/core/utils/interactive-logic', () => ({
  createConsoleThreadId: jest.fn().mockReturnValue('session-1234567890')
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const mockSessionsDir = '/mock/data/sessions';
  const mockMetadataFile = '/mock/data/metadata.json';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args) => {
      if (args.includes('.data') && args.includes('sessions')) {
        return mockSessionsDir;
      }
      if (args.includes('.data') && args.includes('metadata.json')) {
        return mockMetadataFile;
      }
      // For other path joins, just join with forward slashes
      return args.join('/');
    });
    
    // Mock process.cwd()
    jest.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
    
    // Mock fs.existsSync and other fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.renameSync as jest.Mock).mockImplementation(() => {});
    
    // Create a new session manager instance using getInstance
    // First, reset the singleton instance
    (SessionManager as any).instance = null;
    sessionManager = SessionManager.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create directories if they do not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(false);
      
      // Reset the singleton instance
      (SessionManager as any).instance = null;
      const manager = SessionManager.getInstance();
      
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(mockSessionsDir), { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockSessionsDir, { recursive: true });
    });

    it('should load current session on initialization', () => {
      const mockMetadata = { currentSessionId: 'session-existing' };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockMetadata));
      
      // Reset the singleton instance
      (SessionManager as any).instance = null;
      const manager = SessionManager.getInstance();
      
      // Access private method to check current session ID
      const currentSessionId = (manager as any).currentSessionId;
      expect(currentSessionId).toBe('session-existing');
    });

    it('should handle metadata file read errors gracefully', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });
      
      // Reset the singleton instance
      (SessionManager as any).instance = null;
      const manager = SessionManager.getInstance();
      
      const currentSessionId = (manager as any).currentSessionId;
      expect(currentSessionId).toBeNull();
    });
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = SessionManager.getInstance();
      const instance2 = SessionManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('getCurrentSessionId', () => {
    it('should return existing session ID if available', () => {
      (sessionManager as any).currentSessionId = 'session-existing';
      
      const result = sessionManager.getCurrentSessionId();
      
      expect(result).toBe('session-existing');
    });

    it('should create new session if no current session exists', () => {
      (sessionManager as any).currentSessionId = null;
      
      const result = sessionManager.getCurrentSessionId();
      
      expect(result).toBe('session-1234567890');
      expect((sessionManager as any).currentSessionId).toBe('session-1234567890');
    });
  });

  describe('createSession', () => {
    it('should create new session with unique ID', () => {
      const result = sessionManager.createSession();
      
      expect(result).toBe('session-1234567890');
      expect((sessionManager as any).currentSessionId).toBe('session-1234567890');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('switchToSession', () => {
    it('should switch to specified session and save metadata', () => {
      sessionManager.switchToSession('session-new');
      
      expect((sessionManager as any).currentSessionId).toBe('session-new');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('clearCurrentSession', () => {
    it('should create new session and return its ID', () => {
      const result = sessionManager.clearCurrentSession();
      
      expect(result).toBe('session-1234567890');
      expect((sessionManager as any).currentSessionId).toBe('session-1234567890');
    });
  });

  describe('getAllSessionIds', () => {
    it('should return session directories that start with session-', () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'session-1',
        'session-2',
        'other-file',
        '.hidden-session'
      ]);
      
      const result = sessionManager.getAllSessionIds();
      
      expect(result).toEqual(['session-1', 'session-2']);
    });

    it('should handle directory read errors gracefully', () => {
      (fs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });
      
      const result = sessionManager.getAllSessionIds();
      
      expect(result).toEqual([]);
    });
  });

  describe('Knowledge Store Management', () => {
    const testSessionId = 'session-test';
    const testKnowledgeItem = {
      content: 'Test content',
      title: 'Test title',
      keywords: ['test', 'keywords']
    };

    beforeEach(() => {
      // Reset the knowledge store
      (sessionManager as any).sessionKnowledgeStore.clear();
    });

    describe('addKnowledge', () => {
      it('should add knowledge item to session store and save to file', () => {
        sessionManager.addKnowledge(
          testSessionId,
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const knowledgeStore = (sessionManager as any).getKnowledgeStoreForSession(testSessionId);
        expect(knowledgeStore).toHaveLength(1);
        expect(knowledgeStore[0]).toEqual(testKnowledgeItem);
        expect(fs.writeFileSync).toHaveBeenCalled();
      });
    });

    describe('getAllKnowledge', () => {
      it('should return all knowledge items for session', () => {
        // Add knowledge first
        sessionManager.addKnowledge(
          testSessionId,
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.getAllKnowledge(testSessionId);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(testKnowledgeItem);
      });

      it('should return empty array for non-existent session', () => {
        const result = sessionManager.getAllKnowledge('non-existent-session');
        
        expect(result).toEqual([]);
      });
    });

    describe('getKnowledgeSummaries', () => {
      it('should return summaries with only title and keywords', () => {
        // Add knowledge first
        sessionManager.addKnowledge(
          testSessionId,
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.getKnowledgeSummaries(testSessionId);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          title: testKnowledgeItem.title,
          keywords: testKnowledgeItem.keywords
        });
      });
    });

    describe('searchKnowledge', () => {
      it('should find knowledge by title match', () => {
        sessionManager.addKnowledge(
          testSessionId,
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.searchKnowledge(testSessionId, 'Test title');
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(testKnowledgeItem);
      });

      it('should find knowledge by keyword match', () => {
        sessionManager.addKnowledge(
          testSessionId,
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.searchKnowledge(testSessionId, 'test');
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(testKnowledgeItem);
      });

      it('should return empty array for empty query', () => {
        const result = sessionManager.searchKnowledge(testSessionId, '');
        expect(result).toEqual([]);
      });

      it('should return empty array for whitespace-only query', () => {
        const result = sessionManager.searchKnowledge(testSessionId, '   ');
        expect(result).toEqual([]);
      });

      it('should return empty array for non-string query', () => {
        const result = sessionManager.searchKnowledge(testSessionId, 123 as any);
        expect(result).toEqual([]);
      });

      it('should return empty array when no matches found', () => {
        sessionManager.addKnowledge(
          testSessionId,
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.searchKnowledge(testSessionId, 'nonexistent');
        expect(result).toEqual([]);
      });
    });

    describe('clearKnowledge', () => {
      it('should clear knowledge store for session', () => {
        // Add knowledge first
        sessionManager.addKnowledge(
          testSessionId,
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        sessionManager.clearKnowledge(testSessionId);
        
        const result = sessionManager.getAllKnowledge(testSessionId);
        expect(result).toEqual([]);
        expect(fs.writeFileSync).toHaveBeenCalled();
      });
    });

    describe('loadKnowledgeStore', () => {
      it('should load valid knowledge store from file', () => {
        const mockKnowledgeStore = [testKnowledgeItem];
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockKnowledgeStore));
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        
        const result = (sessionManager as any).loadKnowledgeStore(testSessionId);
        
        expect(result).toEqual(mockKnowledgeStore);
      });

      it('should return empty array for invalid JSON', () => {
        (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        
        const result = (sessionManager as any).loadKnowledgeStore(testSessionId);
        
        expect(result).toEqual([]);
      });

      it('should return empty array for non-array JSON', () => {
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ not: 'an array' }));
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        
        const result = (sessionManager as any).loadKnowledgeStore(testSessionId);
        
        expect(result).toEqual([]);
      });

      it('should return empty array when file does not exist', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        
        const result = (sessionManager as any).loadKnowledgeStore(testSessionId);
        
        expect(result).toEqual([]);
      });

      it('should handle file read errors gracefully', () => {
        (fs.readFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('Read error');
        });
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        
        const result = (sessionManager as any).loadKnowledgeStore(testSessionId);
        
        expect(result).toEqual([]);
      });
    });

    describe('saveKnowledgeStore', () => {
      it('should save knowledge store to file with atomic write', () => {
        const knowledgeStore = [testKnowledgeItem];
        
        // Mock that the directory doesn't exist initially
        (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
        
        (sessionManager as any).saveKnowledgeStore(testSessionId, knowledgeStore);
        
        expect(fs.mkdirSync).toHaveBeenCalled();
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalled();
      });

      it('should save knowledge store when directory already exists', () => {
        const knowledgeStore = [testKnowledgeItem];
        
        // Mock that the directory already exists
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        
        (sessionManager as any).saveKnowledgeStore(testSessionId, knowledgeStore);
        
        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalled();
      });

      it('should handle save errors gracefully', () => {
        (fs.writeFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('Write error');
        });
        
        expect(() => {
          (sessionManager as any).saveKnowledgeStore(testSessionId, [testKnowledgeItem]);
        }).not.toThrow();
      });
    });

    describe('Convenience Methods (Current Session)', () => {
      beforeEach(() => {
        (sessionManager as any).currentSessionId = testSessionId;
      });

      it('should add knowledge to current session', () => {
        sessionManager.addKnowledgeToCurrentSession(
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const knowledgeStore = (sessionManager as any).getKnowledgeStoreForSession(testSessionId);
        expect(knowledgeStore).toHaveLength(1);
        expect(knowledgeStore[0]).toEqual(testKnowledgeItem);
      });

      it('should get all knowledge from current session', () => {
        sessionManager.addKnowledgeToCurrentSession(
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.getAllKnowledgeFromCurrentSession();
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(testKnowledgeItem);
      });

      it('should get knowledge summaries from current session', () => {
        sessionManager.addKnowledgeToCurrentSession(
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.getKnowledgeSummariesFromCurrentSession();
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          title: testKnowledgeItem.title,
          keywords: testKnowledgeItem.keywords
        });
      });

      it('should search knowledge in current session', () => {
        sessionManager.addKnowledgeToCurrentSession(
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        const result = sessionManager.searchKnowledgeInCurrentSession('Test title');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(testKnowledgeItem);
      });

      it('should clear current session knowledge', () => {
        sessionManager.addKnowledgeToCurrentSession(
          testKnowledgeItem.content,
          testKnowledgeItem.title,
          testKnowledgeItem.keywords
        );
        
        sessionManager.clearCurrentSessionKnowledge();
        
        const result = sessionManager.getAllKnowledgeFromCurrentSession();
        expect(result).toEqual([]);
      });
    });
  });
});