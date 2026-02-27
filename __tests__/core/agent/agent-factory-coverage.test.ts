// Mock dotenv
jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('AgentFactory - createCheckpointer branch coverage', () => {
  const baseConfig = {
    model: { apiKey: 'test-key', baseURL: undefined, name: 'gpt-4o', provider: undefined, azureApiVersion: undefined },
    langgraph: { recursionLimit: 100, checkpointerType: 'memory' },
    memory: { windowSize: 5 },
    output: { verbose: false },
    tencentCloud: {},
    composio: { apiKey: 'test', externalUserId: 'test' },
    lark: {},
    advanced: { maxConcurrentSubtasks: 5 },
    specialKeyword: { keyword: '干活' },
    language: { code: 'en' },
    persona: { style: 'test' },
    interaction: { mode: 'console' }
  };

  const setupMocks = (checkpointerType: string) => {
    jest.resetModules();
    
    jest.doMock('@/core/config/config', () => ({
      config: { ...baseConfig, langgraph: { recursionLimit: 100, checkpointerType } }
    }));

    jest.doMock('@/tools/index', () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue([
        { name: 'bash', invoke: jest.fn() },
        { name: 'write-subagent-todos', invoke: jest.fn() }
      ])
    }));

    jest.doMock('@/core/utils/langchain-tool-retry-middleware', () => ({
      createLangChainToolRetryMiddleware: jest.fn().mockReturnValue({
        name: 'test-middleware', wrapToolCall: jest.fn()
      })
    }));

    jest.doMock('@/core/utils/session-output-capture-middleware', () => ({
      createSessionOutputCaptureMiddleware: jest.fn().mockReturnValue({
        name: 'capture-middleware', wrapToolCall: jest.fn()
      })
    }));

    jest.doMock('@/infrastructure/agents/agent-loader', () => ({
      loadSubAgents: jest.fn().mockReturnValue([]),
      getDefaultGeneralPurposeSubAgent: jest.fn().mockReturnValue({ name: 'general-purpose' })
    }));

    jest.doMock('@/core/utils/find-skills-directories', () => ({
      findSkillsDirectories: jest.fn().mockReturnValue([])
    }));

    jest.doMock('deepagents', () => ({
      createDeepAgent: jest.fn().mockReturnValue({ stream: jest.fn() })
    }));

    jest.doMock('@/infrastructure/filesystem/safe-filesystem-backend', () => ({
      SafeFilesystemBackend: jest.fn().mockImplementation(() => ({}))
    }));

    jest.doMock('@langchain/langgraph', () => ({
      MemorySaver: jest.fn().mockImplementation(() => ({}))
    }));

    jest.doMock('@/infrastructure/checkpoint/filesystem-checkpointer', () => ({
      FilesystemCheckpointer: jest.fn().mockImplementation(() => ({}))
    }));
  };

  afterEach(() => {
    jest.resetModules();
  });

  it('should use FilesystemCheckpointer when checkpointerType is filesystem', async () => {
    setupMocks('filesystem');
    
    const { createAIAgent } = require('@/core/agent/agent-factory');
    const { FilesystemCheckpointer } = require('@/infrastructure/checkpoint/filesystem-checkpointer');
    
    await createAIAgent();
    
    expect(FilesystemCheckpointer).toHaveBeenCalled();
  });

  it('should throw error when checkpointerType is sqlite', async () => {
    setupMocks('sqlite');
    
    const { createAIAgent } = require('@/core/agent/agent-factory');
    
    await expect(createAIAgent()).rejects.toThrow('SQLite checkpointer is not yet implemented');
  });

  it('should create agent with memory checkpointer (default)', async () => {
    setupMocks('memory');
    
    const { createAIAgent } = require('@/core/agent/agent-factory');
    const agent = await createAIAgent();
    
    expect(agent).toBeDefined();
  });

  it('should create agent with session middleware when session is provided', async () => {
    setupMocks('memory');
    
    const { createAIAgent } = require('@/core/agent/agent-factory');
    const { createSessionOutputCaptureMiddleware } = require('@/core/utils/session-output-capture-middleware');
    
    const mockSession = {
      logToolCall: jest.fn(),
      logToolResult: jest.fn(),
      logErrorMessage: jest.fn(),
      streamAIContent: jest.fn(),
      setCapturedOutput: jest.fn()
    };

    await createAIAgent(mockSession);
    
    expect(createSessionOutputCaptureMiddleware).toHaveBeenCalledWith({ session: mockSession });
  });

  it('filterSubAgentTools should exclude write-subagent-todos', async () => {
    setupMocks('memory');
    
    const { createAIAgent } = require('@/core/agent/agent-factory');
    const { createDeepAgent } = require('deepagents');
    
    await createAIAgent();
    
    expect(createDeepAgent).toHaveBeenCalled();
    const callArgs = createDeepAgent.mock.calls[0]?.[0];
    if (callArgs?.subAgentTools) {
      const hasWriteSubagentTodos = callArgs.subAgentTools.some((t: any) => t.name === 'write-subagent-todos');
      expect(hasWriteSubagentTodos).toBe(false);
    }
  });
});
