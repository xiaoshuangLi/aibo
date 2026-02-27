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

// Mock console.log to capture output
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

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

    it('should produce a different session ID than the previous one', () => {
      // Set up two different IDs returned by createConsoleThreadId
      const { createConsoleThreadId } = require('@/core/utils/interactive-logic');
      (createConsoleThreadId as jest.Mock)
        .mockReturnValueOnce('session-old')
        .mockReturnValueOnce('session-new');

      // Establish an initial session
      sessionManager.createSession(); // session-old
      expect((sessionManager as any).currentSessionId).toBe('session-old');

      // Clearing must produce a different ID
      const newId = sessionManager.clearCurrentSession(); // session-new
      expect(newId).toBe('session-new');
      expect(newId).not.toBe('session-old');
    });

    it('should update currentSessionId so subsequent calls use the new session', () => {
      const { createConsoleThreadId } = require('@/core/utils/interactive-logic');
      (createConsoleThreadId as jest.Mock)
        .mockReturnValueOnce('session-before')
        .mockReturnValueOnce('session-after');

      sessionManager.createSession();
      sessionManager.clearCurrentSession();

      // getCurrentSessionId should now return the post-clear session ID
      expect(sessionManager.getCurrentSessionId()).toBe('session-after');
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

    describe('AI Monitoring Metadata Functions', () => {
      describe('formatTokenCount', () => {
        it('should format 0 tokens as "0"', () => {
          const result = (sessionManager as any).formatTokenCount(0);
          expect(result).toBe('0');
        });

        it('should format tokens less than 1000 as string', () => {
          const result = (sessionManager as any).formatTokenCount(500);
          expect(result).toBe('500');
        });

        it('should format tokens between 1000 and 999999 as K', () => {
          const result = (sessionManager as any).formatTokenCount(1500);
          expect(result).toBe('1.50K');
        });

        it('should format tokens >= 1000000 as M', () => {
          const result = (sessionManager as any).formatTokenCount(1500000);
          expect(result).toBe('1.50M');
        });

        it('should handle exact boundaries correctly', () => {
          expect((sessionManager as any).formatTokenCount(999)).toBe('999');
          expect((sessionManager as any).formatTokenCount(1000)).toBe('1.00K');
          expect((sessionManager as any).formatTokenCount(999999)).toBe('1000.00K');
          expect((sessionManager as any).formatTokenCount(1000000)).toBe('1.00M');
        });
      });

      describe('groupTokenUsageByModel', () => {
        it('should return empty object for empty array', () => {
          const result = (sessionManager as any).groupTokenUsageByModel([]);
          expect(result).toEqual({});
        });

        it('should group single model call', () => {
          const modelCalls = [{
            model_name: 'gpt-4',
            model_version: '1.0',
            provider: 'openai',
            engine: '',
            call_id: 'call-1',
            sequence_number: 1,
            start_time: '2023-01-01T00:00:00Z',
            end_time: '2023-01-01T00:00:01Z',
            duration_ms: 1000,
            input_tokens: 100,
            output_tokens: 200,
            total_tokens: 300,
            cost: 0.01,
            input_content: 'Hello',
            output_content: 'World',
            finish_reason: 'stop',
            tool_calls: [],
            metadata: {}
          }];

          const result = (sessionManager as any).groupTokenUsageByModel(modelCalls);
          expect(result).toEqual({
            'openai/gpt-4': {
              input_tokens: 100,
              output_tokens: 200,
              total_tokens: 300
            }
          });
        });

        it('should group multiple calls to same model', () => {
          const modelCalls = [
            {
              model_name: 'gpt-4',
              model_version: '1.0',
              provider: 'openai',
              engine: '',
              call_id: 'call-1',
              sequence_number: 1,
              start_time: '2023-01-01T00:00:00Z',
              end_time: '2023-01-01T00:00:01Z',
              duration_ms: 1000,
              input_tokens: 100,
              output_tokens: 200,
              total_tokens: 300,
              cost: 0.01,
              input_content: 'Hello',
              output_content: 'World',
              finish_reason: 'stop',
              tool_calls: [],
              metadata: {}
            },
            {
              model_name: 'gpt-4',
              model_version: '1.0',
              provider: 'openai',
              engine: '',
              call_id: 'call-2',
              sequence_number: 2,
              start_time: '2023-01-01T00:00:02Z',
              end_time: '2023-01-01T00:00:03Z',
              duration_ms: 1000,
              input_tokens: 80,
              output_tokens: 120,
              total_tokens: 200,
              cost: 0.008,
              input_content: 'Hi',
              output_content: 'There',
              finish_reason: 'stop',
              tool_calls: [],
              metadata: {}
            }
          ];

          const result = (sessionManager as any).groupTokenUsageByModel(modelCalls);
          expect(result).toEqual({
            'openai/gpt-4': {
              input_tokens: 180,
              output_tokens: 320,
              total_tokens: 500
            }
          });
        });

        it('should group multiple different models', () => {
          const modelCalls = [
            {
              model_name: 'gpt-4',
              model_version: '1.0',
              provider: 'openai',
              engine: '',
              call_id: 'call-1',
              sequence_number: 1,
              start_time: '2023-01-01T00:00:00Z',
              end_time: '2023-01-01T00:00:01Z',
              duration_ms: 1000,
              input_tokens: 100,
              output_tokens: 200,
              total_tokens: 300,
              cost: 0.01,
              input_content: 'Hello',
              output_content: 'World',
              finish_reason: 'stop',
              tool_calls: [],
              metadata: {}
            },
            {
              model_name: 'claude-2',
              model_version: '1.0',
              provider: 'anthropic',
              engine: '',
              call_id: 'call-2',
              sequence_number: 2,
              start_time: '2023-01-01T00:00:02Z',
              end_time: '2023-01-01T00:00:03Z',
              duration_ms: 1000,
              input_tokens: 80,
              output_tokens: 120,
              total_tokens: 200,
              cost: 0.008,
              input_content: 'Hi',
              output_content: 'There',
              finish_reason: 'stop',
              tool_calls: [],
              metadata: {}
            }
          ];

          const result = (sessionManager as any).groupTokenUsageByModel(modelCalls);
          expect(result).toEqual({
            'openai/gpt-4': {
              input_tokens: 100,
              output_tokens: 200,
              total_tokens: 300
            },
            'anthropic/claude-2': {
              input_tokens: 80,
              output_tokens: 120,
              total_tokens: 200
            }
          });
        });
      });

      describe('extractInputContent', () => {
        it('should return empty string for invalid currentIndex', () => {
          const messages = [
            { type: 'constructor', id: [null, null, 'HumanMessage'], kwargs: { content: 'Hello' } }
          ];
          
          const result1 = (sessionManager as any).extractInputContent(messages, -1);
          expect(result1).toBe('');
          
          const result2 = (sessionManager as any).extractInputContent(messages, 1);
          expect(result2).toBe('');
        });

        it('should return content from valid HumanMessage', () => {
          const messages = [
            { type: 'constructor', id: [null, null, 'HumanMessage'], kwargs: { content: 'Hello User' } },
            { type: 'constructor', id: [null, null, 'AIMessage'], kwargs: { content: 'Hello AI' } }
          ];
          
          const result = (sessionManager as any).extractInputContent(messages, 0);
          expect(result).toBe('Hello User');
        });

        it('should return empty string for non-HumanMessage', () => {
          const messages = [
            { type: 'constructor', id: [null, null, 'AIMessage'], kwargs: { content: 'Hello AI' } },
            { type: 'constructor', id: [null, null, 'AIMessage'], kwargs: { content: 'Hello Again' } }
          ];
          
          const result = (sessionManager as any).extractInputContent(messages, 0);
          expect(result).toBe('');
        });

        it('should return empty string when HumanMessage has no content', () => {
          const messages = [
            { type: 'constructor', id: [null, null, 'HumanMessage'], kwargs: {} },
            { type: 'constructor', id: [null, null, 'AIMessage'], kwargs: { content: 'Hello AI' } }
          ];
          
          const result = (sessionManager as any).extractInputContent(messages, 0);
          expect(result).toBe('');
        });
      });

      describe('extractSubagentInfo', () => {
        it('should return task_manager subagent for write_subagent_todos tool call', () => {
          const kwargs = {
            content: 'Creating subagent todos',
            tool_calls: [{
              name: 'write_subagent_todos',
              id: 'tool-123',
              args: { todos: ['task1', 'task2'] }
            }]
          };
          
          const result = (sessionManager as any).extractSubagentInfo(kwargs, 1);
          expect(result).not.toBeNull();
          expect(result!.agent_type).toBe('task_manager');
          expect(result!.agent_name).toBe('write-subagent-todos');
          expect(result!.status).toBe('completed');
        });

        it('should return generic_subagent for content containing "subagent"', () => {
          const kwargs = {
            content: 'This is a subagent test',
            tool_calls: []
          };
          
          const result = (sessionManager as any).extractSubagentInfo(kwargs, 1);
          expect(result).not.toBeNull();
          expect(result!.agent_type).toBe('generic_subagent');
          expect(result!.agent_name).toBe('generic-subagent');
        });

        it('should return generic_subagent for content containing "子代理"', () => {
          const kwargs = {
            content: '这是一个子代理测试',
            tool_calls: []
          };
          
          const result = (sessionManager as any).extractSubagentInfo(kwargs, 1);
          expect(result).not.toBeNull();
          expect(result!.agent_type).toBe('generic_subagent');
          expect(result!.agent_name).toBe('generic-subagent');
        });

        it('should return generic_subagent for content containing "子任务"', () => {
          const kwargs = {
            content: '处理子任务',
            tool_calls: []
          };
          
          const result = (sessionManager as any).extractSubagentInfo(kwargs, 1);
          expect(result).not.toBeNull();
          expect(result!.agent_type).toBe('generic_subagent');
          expect(result!.agent_name).toBe('generic-subagent');
        });

        it('should return null for content without subagent keywords', () => {
          const kwargs = {
            content: 'Regular content',
            tool_calls: []
          };
          
          const result = (sessionManager as any).extractSubagentInfo(kwargs, 1);
          expect(result).toBeNull();
        });

        it('should return null for empty content', () => {
          const kwargs = {
            content: '',
            tool_calls: []
          };
          
          const result = (sessionManager as any).extractSubagentInfo(kwargs, 1);
          expect(result).toBeNull();
        });
      });

      describe('generateSessionMetadata', () => {
        const testSessionId = 'session-test';
        const mockSessionData = {
          checkpoint: {
            ts: '2023-01-01T00:00:00Z',
            channel_values: {
              messages: [
                { type: 'constructor', id: [null, null, 'HumanMessage'], kwargs: { content: 'Hello' } },
                { 
                  type: 'constructor', 
                  id: [null, null, 'AIMessage'], 
                  kwargs: { 
                    content: 'World',
                    id: 'msg-1',
                    usage_metadata: { input_tokens: 10, output_tokens: 20 },
                    response_metadata: { 
                      model_name: 'gpt-4',
                      model_provider: 'openai',
                      finish_reason: 'stop'
                    }
                  } 
                }
              ]
            }
          },
          lastUpdated: '2023-01-01T00:00:01Z'
        };

        beforeEach(() => {
          consoleLogSpy.mockClear();
        });

        it('should return false when session.json does not exist', () => {
          (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
          
          const result = sessionManager.generateSessionMetadata(testSessionId);
          
          expect(result).toBe(false);
          // Note: fs.readFileSync may still be called for metadata.json, but that's expected
        });

        it('should return false when session.json read fails', () => {
          (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
          (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
            throw new Error('Read error');
          });
          
          const result = sessionManager.generateSessionMetadata(testSessionId);
          
          expect(result).toBe(false);
        });

        it('should return true when session.json exists and metadata is generated successfully', () => {
          (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
          (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockSessionData));
          (fs.existsSync as jest.Mock).mockReturnValueOnce(true); // for session dir check
          
          const result = sessionManager.generateSessionMetadata(testSessionId);
          
          expect(result).toBe(true);
          expect(fs.writeFileSync).toHaveBeenCalled();
          expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should handle save errors gracefully and return false', () => {
          (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
          (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockSessionData));
          (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
          (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
            throw new Error('Write error');
          });
          
          const result = sessionManager.generateSessionMetadata(testSessionId);
          
          expect(result).toBe(false);
        });
      });

      describe('extractAIMonitoringMetadata', () => {
        const testSessionId = 'session-test';
        
        it('should extract metadata from session data with AIMessage', () => {
          const sessionData = {
            checkpoint: {
              ts: '2023-01-01T00:00:00Z',
              channel_values: {
                messages: [
                  { type: 'constructor', id: [null, null, 'HumanMessage'], kwargs: { content: 'Hello' } },
                  { 
                    type: 'constructor', 
                    id: [null, null, 'AIMessage'], 
                    kwargs: { 
                      content: 'World',
                      id: 'msg-1',
                      usage_metadata: { input_tokens: 10, output_tokens: 20 },
                      response_metadata: { 
                        model_name: 'gpt-4',
                        model_provider: 'openai',
                        finish_reason: 'stop'
                      }
                    } 
                  }
                ]
              }
            },
            lastUpdated: '2023-01-01T00:00:01Z'
          };
          
          const result = (sessionManager as any).extractAIMonitoringMetadata(sessionData, testSessionId);
          
          expect(result.request_id).toBe(testSessionId);
          expect(result.token_usage.input_tokens).toBe(10);
          expect(result.token_usage.output_tokens).toBe(20);
          expect(result.model_info.model_name).toBe('gpt-4');
          expect(result.outputs.response).toBe('World');
          expect(result.error.has_error).toBe(false);
        });

        it('should handle session data without messages', () => {
          const sessionData = {
            checkpoint: {
              ts: '2023-01-01T00:00:00Z'
            },
            lastUpdated: '2023-01-01T00:00:01Z'
          };
          
          const result = (sessionManager as any).extractAIMonitoringMetadata(sessionData, testSessionId);
          
          expect(result.request_id).toBe(testSessionId);
          expect(result.token_usage.input_tokens).toBe(0);
          expect(result.token_usage.output_tokens).toBe(0);
        });

        it('should handle error in AIMessage', () => {
          const sessionData = {
            checkpoint: {
              ts: '2023-01-01T00:00:00Z',
              channel_values: {
                messages: [
                  { type: 'constructor', id: [null, null, 'HumanMessage'], kwargs: { content: 'Hello' } },
                  { 
                    type: 'constructor', 
                    id: [null, null, 'AIMessage'], 
                    kwargs: { 
                      content: 'Error occurred',
                      response_metadata: { 
                        finish_reason: 'error'
                      }
                    } 
                  }
                ]
              }
            }
          };
          
          const result = (sessionManager as any).extractAIMonitoringMetadata(sessionData, testSessionId);
          
          expect(result.error.has_error).toBe(true);
          expect(result.error.error_message).toBe('Error occurred');
        });

        it('should handle tool calls in AIMessage', () => {
          const sessionData = {
            checkpoint: {
              ts: '2023-01-01T00:00:00Z',
              channel_values: {
                messages: [
                  { type: 'constructor', id: [null, null, 'HumanMessage'], kwargs: { content: 'Hello' } },
                  { 
                    type: 'constructor', 
                    id: [null, null, 'AIMessage'], 
                    kwargs: { 
                      content: 'Processing tool call',
                      tool_calls: [{
                        name: 'test_tool',
                        id: 'tool-1',
                        args: { param: 'value' }
                      }],
                      usage_metadata: { input_tokens: 5, output_tokens: 15 }
                    } 
                  }
                ]
              }
            }
          };
          
          const result = (sessionManager as any).extractAIMonitoringMetadata(sessionData, testSessionId);
          
          expect(result.tool_calls).toHaveLength(1);
          expect(result.tool_calls[0].tool_name).toBe('test_tool');
          expect(result.performance_summary.total_tool_calls).toBe(1);
        });
      });

      describe('generateAllSessionsMetadata', () => {
        it('should handle empty session list', () => {
          (fs.readdirSync as jest.Mock).mockReturnValue([]);
          
          // This should not throw an error
          sessionManager.generateAllSessionsMetadata();
          
          // Verify console.log was called with the summary
          expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining('Generated metadata for 0 sessions')
          );
        });

        it('should process all sessions and log results', () => {
          (fs.readdirSync as jest.Mock).mockReturnValue(['session-1', 'session-2']);
          (fs.existsSync as jest.Mock).mockReturnValue(true);
          const mockSessionData = JSON.stringify({
            checkpoint: { ts: '2023-01-01T00:00:00Z' },
            lastUpdated: '2023-01-01T00:00:01Z'
          });
          (fs.readFileSync as jest.Mock).mockReturnValue(mockSessionData);
          
          sessionManager.generateAllSessionsMetadata();
          
          expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining('Generated metadata for 2 sessions')
          );
        });
      });

      describe('printTokenUsageInfo', () => {
        it('should print token usage info for single model', () => {
          const metadata = {
            metadata: {
              token_usage_formatted: {
                input_tokens_formatted: '1.50K',
                output_tokens_formatted: '2.00K',
                total_tokens_formatted: '3.50K'
              },
              model_token_usage: {
                'openai/gpt-4': {
                  input_tokens: 1500,
                  output_tokens: 2000,
                  total_tokens: 3500
                }
              }
            },
            token_usage: {
              input_tokens: 1500,
              output_tokens: 2000,
              total_tokens: 3500
            }
          } as any;
          
          (sessionManager as any).printTokenUsageInfo(metadata);
          
          expect(consoleLogSpy).toHaveBeenCalled();
          // Verify that the output contains expected information
          const logCalls = consoleLogSpy.mock.calls;
          const logOutput = logCalls.map(call => call[0]).join('\n');
          expect(logOutput).toContain('📊 **AI监控元数据 - Token使用量统计**');
          expect(logOutput).toContain('📈 总体Token使用量:');
          expect(logOutput).toContain('🤖 按模型分组的Token使用量:');
        });

        it('should print token usage info without model breakdown when no models', () => {
          const metadata = {
            metadata: {
              token_usage_formatted: {
                input_tokens_formatted: '100',
                output_tokens_formatted: '200',
                total_tokens_formatted: '300'
              },
              model_token_usage: {}
            },
            token_usage: {
              input_tokens: 100,
              output_tokens: 200,
              total_tokens: 300
            }
          } as any;
          
          (sessionManager as any).printTokenUsageInfo(metadata);
          
          expect(consoleLogSpy).toHaveBeenCalled();
          const logCalls = consoleLogSpy.mock.calls;
          const logOutput = logCalls.map(call => call[0]).join('\n');
          expect(logOutput).toContain('📈 总体Token使用量:');
          expect(logOutput).not.toContain('🤖 按模型分组的Token使用量:');
        });
      });
    });
  });
});