// Mock dotenv
jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('AgentFactory - FilterDuplicateToolsMiddleware Integration', () => {
  const baseConfig = {
    model: { apiKey: 'test-key', baseUrl: undefined, name: 'gpt-4o', provider: undefined, azureApiVersion: undefined },
    langgraph: { recursionLimit: 100, checkpointerType: 'memory' },
    memory: {},
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

  let mockFilterDuplicateToolsMiddleware: jest.Mock;
  let mockToolRetryMiddleware: jest.Mock;
  let mockImageUploadMiddleware: jest.Mock;
  let mockSessionOutputCaptureMiddleware: jest.Mock;

  const setupMocks = () => {
    jest.resetModules();
    
    // Mock middlewares
    mockFilterDuplicateToolsMiddleware = jest.fn().mockReturnValue({
      name: 'FilterDuplicateToolsMiddleware',
      wrapModelCall: jest.fn()
    });
    
    mockToolRetryMiddleware = jest.fn().mockReturnValue({
      name: 'LangChainToolRetryMiddleware',
      wrapToolCall: jest.fn()
    });
    
    mockImageUploadMiddleware = jest.fn().mockReturnValue({
      name: 'ImageUploadMiddleware',
      wrapModelCall: jest.fn()
    });
    
    mockSessionOutputCaptureMiddleware = jest.fn().mockReturnValue({
      name: 'SessionOutputCaptureMiddleware',
      wrapToolCall: jest.fn()
    });

    jest.doMock('@/core/config', () => ({
      config: baseConfig
    }));

    jest.doMock('@/tools/index', () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue([
        { name: 'bash', invoke: jest.fn() },
        { name: 'write-subagent-todos', invoke: jest.fn() }
      ])
    }));

    jest.doMock('@/core/middlewares', () => ({
      createLangChainToolRetryMiddleware: mockToolRetryMiddleware,
      createSessionOutputCaptureMiddleware: mockSessionOutputCaptureMiddleware,
      createFilterDuplicateToolsMiddleware: mockFilterDuplicateToolsMiddleware,
      createImageUploadMiddleware: mockImageUploadMiddleware
    }));

    jest.doMock('@/infrastructure/agents/loader', () => ({
      loadSubAgents: jest.fn().mockReturnValue([]),
      getDefaultGeneralPurposeSubAgent: jest.fn().mockReturnValue({ name: 'general-purpose' })
    }));

    jest.doMock('@/core/utils/skills', () => ({
      findSkillsDirectories: jest.fn().mockReturnValue([]),
      buildSystemPromptFromTools: jest.fn().mockReturnValue('test prompt')
    }));

    jest.doMock('deepagents', () => ({
      createDeepAgent: jest.fn().mockReturnValue({ stream: jest.fn() })
    }));

    jest.doMock('@/infrastructure/filesystem/safe-backend', () => ({
      SafeFilesystemBackend: jest.fn().mockImplementation(() => ({}))
    }));

    jest.doMock('@langchain/langgraph', () => ({
      MemorySaver: jest.fn().mockImplementation(() => ({}))
    }));

    jest.doMock('@/core/agent/model', () => ({
      createModel: jest.fn().mockReturnValue({ model: 'test-model' })
    }));

    jest.doMock('@/core/agent/session', () => ({
      Session: jest.fn().mockImplementation(() => ({
        ioChannel: {
          emit: jest.fn(),
          requestUserInput: jest.fn(),
          setAbortSignal: jest.fn(),
          on: jest.fn(),
          off: jest.fn(),
          destroy: jest.fn()
        }
      }))
    }));

    jest.doMock('@/infrastructure/prompt/subagent-template', () => ({
      SubAgentPromptTemplate: jest.fn().mockImplementation(() => ({
        format: jest.fn().mockReturnValue('formatted prompt')
      }))
    }));
  };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should include FilterDuplicateToolsMiddleware in main agent middleware stack without session', async () => {
    setupMocks();
    
    const { createAIAgent } = require('@/core/agent/factory');
    const { createDeepAgent } = require('deepagents');
    
    await createAIAgent();
    
    // 验证FilterDuplicateToolsMiddleware被创建
    expect(mockFilterDuplicateToolsMiddleware).toHaveBeenCalled();
    
    // 验证createDeepAgent被调用，并且middleware数组包含FilterDuplicateToolsMiddleware
    expect(createDeepAgent).toHaveBeenCalled();
    const createDeepAgentCall = (createDeepAgent as jest.Mock).mock.calls[0][0];
    
    // 验证middleware数组包含正确的中间件（没有session时只有toolRetryMiddleware）
    expect(createDeepAgentCall.middleware).toEqual([
      expect.objectContaining({ name: 'LangChainToolRetryMiddleware' })
    ]);
  });

  it('should include FilterDuplicateToolsMiddleware in main agent middleware stack with session', async () => {
    setupMocks();
    
    const { createAIAgent } = require('@/core/agent/factory');
    const { Session } = require('@/core/agent/session');
    const { createDeepAgent } = require('deepagents');
    
    const mockSession = new Session();
    await createAIAgent(mockSession);
    
    // 验证所有中间件被创建
    expect(mockFilterDuplicateToolsMiddleware).toHaveBeenCalled();
    expect(mockToolRetryMiddleware).toHaveBeenCalled();
    expect(mockImageUploadMiddleware).toHaveBeenCalled();
    expect(mockSessionOutputCaptureMiddleware).toHaveBeenCalled();
    
    // 验证createDeepAgent被调用，并且middleware数组包含所有中间件
    expect(createDeepAgent).toHaveBeenCalled();
    const createDeepAgentCall = (createDeepAgent as jest.Mock).mock.calls[0][0];
    
    // 验证middleware数组包含正确的中间件顺序
    expect(createDeepAgentCall.middleware).toEqual([
      expect.objectContaining({ name: 'LangChainToolRetryMiddleware' }),
      expect.objectContaining({ name: 'FilterDuplicateToolsMiddleware' }),
      expect.objectContaining({ name: 'ImageUploadMiddleware' })
    ]);
  });

  it('should include FilterDuplicateToolsMiddleware in subagent middleware stacks without session', async () => {
    // Mock subagents
    const mockSubAgents = [
      {
        name: 'test-subagent-1',
        model: null,
        middleware: []
      },
      {
        name: 'test-subagent-2',
        model: { model: 'custom-model' },
        middleware: [{ name: 'custom-middleware' }]
      }
    ];

    setupMocks();
    
    // Override the loader mock after setupMocks
    jest.doMock('@/infrastructure/agents/loader', () => ({
      loadSubAgents: jest.fn().mockReturnValue(mockSubAgents),
      getDefaultGeneralPurposeSubAgent: jest.fn().mockReturnValue({ name: 'general-purpose' })
    }));
    
    // Clear the require cache for the factory module
    delete require.cache[require.resolve('@/core/agent/factory')];
    
    const { createAIAgent } = require('@/core/agent/factory');
    const { createDeepAgent } = require('deepagents');
    
    await createAIAgent();
    
    // 验证createDeepAgent被调用
    expect(createDeepAgent).toHaveBeenCalled();
    const createDeepAgentCall = (createDeepAgent as jest.Mock).mock.calls[0][0];
    
    // 验证subagents包含正确的中间件（没有session时使用agent.middleware或默认的toolRetryMiddleware）
    expect(createDeepAgentCall.subagents).toEqual([
      expect.objectContaining({
        name: 'test-subagent-1',
        middleware: [] // 因为agent.middleware是[]，所以使用空数组
      }),
      expect.objectContaining({
        name: 'test-subagent-2',
        middleware: [
          { name: 'custom-middleware' } // 因为agent.middleware存在，所以使用原有的middleware
        ]
      })
    ]);
  });

  it('should include FilterDuplicateToolsMiddleware in subagent middleware stacks with session', async () => {
    // Mock subagents
    const mockSubAgents = [
      {
        name: 'test-subagent-1',
        model: null,
        middleware: []
      }
    ];

    setupMocks();
    
    // Override the loader mock after setupMocks
    jest.doMock('@/infrastructure/agents/loader', () => ({
      loadSubAgents: jest.fn().mockReturnValue(mockSubAgents),
      getDefaultGeneralPurposeSubAgent: jest.fn().mockReturnValue({ name: 'general-purpose' })
    }));
    
    // Clear the require cache for the factory module
    delete require.cache[require.resolve('@/core/agent/factory')];
    
    const { createAIAgent } = require('@/core/agent/factory');
    const { Session } = require('@/core/agent/session');
    const { createDeepAgent } = require('deepagents');
    
    const mockSession = new Session();
    await createAIAgent(mockSession);
    
    // 验证createDeepAgent被调用
    expect(createDeepAgent).toHaveBeenCalled();
    const createDeepAgentCall = (createDeepAgent as jest.Mock).mock.calls[0][0];
    
    // 验证subagents包含所有中间件，包括FilterDuplicateToolsMiddleware
    expect(createDeepAgentCall.subagents).toEqual([
      expect.objectContaining({
        name: 'test-subagent-1',
        middleware: [
          // agent.middleware是[]，所以会是 [...[], toolRetryMiddleware, filterDuplicateToolsMiddleware, ...imageUploadMiddleware, ...sessionMiddleware]
          expect.objectContaining({ name: 'LangChainToolRetryMiddleware' }),
          expect.objectContaining({ name: 'FilterDuplicateToolsMiddleware' }),
          expect.objectContaining({ name: 'ImageUploadMiddleware' }),
          expect.objectContaining({ name: 'SessionOutputCaptureMiddleware' })
        ]
      })
    ]);
  });

  it('should maintain correct middleware order in all contexts', async () => {
    setupMocks();
    
    const { createAIAgent } = require('@/core/agent/factory');
    const { Session } = require('@/core/agent/session');
    const { createDeepAgent } = require('deepagents');
    
    const mockSession = new Session();
    await createAIAgent(mockSession);
    
    expect(createDeepAgent).toHaveBeenCalled();
    const createDeepAgentCall = (createDeepAgent as jest.Mock).mock.calls[0][0];
    
    // 验证主代理的中间件顺序：toolRetry -> filterDuplicateTools -> imageUpload
    const mainMiddleware = createDeepAgentCall.middleware;
    expect(mainMiddleware[0]).toEqual(expect.objectContaining({ name: 'LangChainToolRetryMiddleware' }));
    expect(mainMiddleware[1]).toEqual(expect.objectContaining({ name: 'FilterDuplicateToolsMiddleware' }));
    expect(mainMiddleware[2]).toEqual(expect.objectContaining({ name: 'ImageUploadMiddleware' }));
  });

  it('should create FilterDuplicateToolsMiddleware only once per agent creation', async () => {
    setupMocks();
    
    const { createAIAgent } = require('@/core/agent/factory');
    
    await createAIAgent();
    
    // 验证FilterDuplicateToolsMiddleware只被创建一次
    expect(mockFilterDuplicateToolsMiddleware).toHaveBeenCalledTimes(1);
    expect(mockFilterDuplicateToolsMiddleware).toHaveBeenCalledWith(); // 无参数调用
  });
});