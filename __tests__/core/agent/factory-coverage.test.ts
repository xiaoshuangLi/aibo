// Mock dotenv
jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('AgentFactory - createCheckpointer branch coverage', () => {
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

  const setupMocks = (checkpointerType: string) => {
    jest.resetModules();
    
    jest.doMock('@/core/config', () => ({
      config: { ...baseConfig, langgraph: { recursionLimit: 100, checkpointerType } }
    }));

    jest.doMock('@/tools/index', () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue([
        { name: 'bash', invoke: jest.fn() },
        { name: 'write-subagent-todos', invoke: jest.fn() }
      ])
    }));

    jest.doMock('@/core/middlewares', () => ({
      createLangChainToolRetryMiddleware: jest.fn().mockReturnValue({
        name: 'test-middleware', wrapToolCall: jest.fn()
      }),
      createSessionOutputCaptureMiddleware: jest.fn().mockReturnValue({
        name: 'capture-middleware', wrapToolCall: jest.fn()
      }),
      createImageUploadMiddleware: jest.fn().mockReturnValue({
        name: 'image-upload-middleware', wrapModelCall: jest.fn()
      }),
      createFilterDuplicateToolsMiddleware: jest.fn().mockReturnValue({
        name: 'FilterDuplicateToolsMiddleware', wrapModelCall: jest.fn()
      })
    }));

    jest.doMock('@/infrastructure/agents/loader', () => ({
      loadSubAgents: jest.fn().mockReturnValue([]),
      getDefaultGeneralPurposeSubAgent: jest.fn().mockReturnValue({ name: 'general-purpose' })
    }));

    jest.doMock('@/core/utils/skills', () => ({
      findSkillsDirectories: jest.fn().mockReturnValue([])
    }));

    jest.doMock('deepagents', () => ({
      createDeepAgent: jest.fn().mockReturnValue({ stream: jest.fn() }),
      createSummarizationMiddleware: jest.fn().mockReturnValue({ name: 'ProactiveSummarizationMiddleware' })
    }));

    jest.doMock('@/infrastructure/filesystem/safe-backend', () => ({
      SafeFilesystemBackend: jest.fn().mockImplementation(() => ({}))
    }));

    jest.doMock('@langchain/langgraph', () => ({
      MemorySaver: jest.fn().mockImplementation(() => ({}))
    }));

    jest.doMock('@/infrastructure/checkpoint/checkpointer', () => ({
      FilesystemCheckpointer: jest.fn().mockImplementation(() => ({}))
    }));
  };

  afterEach(() => {
    jest.resetModules();
  });

  it('should use FilesystemCheckpointer when checkpointerType is filesystem', async () => {
    setupMocks('filesystem');
    
    const { createAIAgent } = require('@/core/agent/factory');
    const { FilesystemCheckpointer } = require('@/infrastructure/checkpoint/checkpointer');
    
    await createAIAgent();
    
    expect(FilesystemCheckpointer).toHaveBeenCalled();
  });

  it('should throw error when checkpointerType is sqlite', async () => {
    setupMocks('sqlite');
    
    const { createAIAgent } = require('@/core/agent/factory');
    
    await expect(createAIAgent()).rejects.toThrow('SQLite checkpointer is not yet implemented');
  });

  it('should create agent with memory checkpointer (default)', async () => {
    setupMocks('memory');
    
    const { createAIAgent } = require('@/core/agent/factory');
    const agent = await createAIAgent();
    
    expect(agent).toBeDefined();
  });

  it('should create agent with session middleware when session is provided', async () => {
    setupMocks('memory');
    
    const { createAIAgent } = require('@/core/agent/factory');
    const { createSessionOutputCaptureMiddleware } = require('@/core/middlewares');
    
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
    
    const { createAIAgent } = require('@/core/agent/factory');
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

describe('buildCodingAgentHint', () => {
  it('should return empty string when no coding agent tools are available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    expect(buildCodingAgentHint(false, false, false, false)).toBe('');
  });

  it('should return empty string with default params (backward-compat)', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    expect(buildCodingAgentHint(false, false)).toBe('');
  });

  it('should include claude hint when only claude is available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(true, false);
    expect(hint).toContain('claude_execute');
    expect(hint).not.toContain('cursor_execute');
    expect(hint).not.toContain('gemini_execute');
    expect(hint).not.toContain('codex_execute');
    expect(hint).toContain('PRIORITY');
  });

  it('should include cursor hint when only cursor is available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(false, true);
    expect(hint).toContain('cursor_execute');
    expect(hint).not.toContain('claude_execute');
    expect(hint).toContain('PRIORITY');
  });

  it('should include gemini hint when only gemini is available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(false, false, true, false);
    expect(hint).toContain('gemini_execute');
    expect(hint).not.toContain('claude_execute');
    expect(hint).not.toContain('codex_execute');
    expect(hint).toContain('PRIORITY');
    expect(hint).toContain('EVERY coding task');
  });

  it('should include codex hint when only codex is available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(false, false, false, true);
    expect(hint).toContain('codex_execute');
    expect(hint).not.toContain('claude_execute');
    expect(hint).not.toContain('gemini_execute');
    expect(hint).toContain('PRIORITY');
    expect(hint).toContain('EVERY coding task');
  });

  it('should include all four agents when all tools are available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(true, true, true, true);
    expect(hint).toContain('claude_execute');
    expect(hint).toContain('cursor_execute');
    expect(hint).toContain('gemini_execute');
    expect(hint).toContain('codex_execute');
    expect(hint).toContain('PRIORITY');
    expect(hint).toContain('Routing rules');
  });

  it('should include copilot hint when only copilot is available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(false, false, false, false, true);
    expect(hint).toContain('copilot_execute');
    expect(hint).not.toContain('claude_execute');
    expect(hint).not.toContain('gemini_execute');
    expect(hint).not.toContain('codex_execute');
    expect(hint).not.toContain('cursor_execute');
    expect(hint).toContain('PRIORITY');
    expect(hint).toContain('EVERY coding task');
  });

  it('should include all five agents when all tools including copilot are available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(true, true, true, true, true);
    expect(hint).toContain('claude_execute');
    expect(hint).toContain('cursor_execute');
    expect(hint).toContain('gemini_execute');
    expect(hint).toContain('codex_execute');
    expect(hint).toContain('copilot_execute');
    expect(hint).toContain('PRIORITY');
  });

  it('should include routing table when multiple tools are available', () => {
    const { buildCodingAgentHint } = require('@/core/utils');
    const hint = buildCodingAgentHint(true, false, true, true);
    expect(hint).toContain('| Tool | Best for |');
    expect(hint).toContain('claude_execute');
    expect(hint).toContain('gemini_execute');
    expect(hint).toContain('codex_execute');
  });

  it('should append hint to system prompt when claude tool is present in tools list', async () => {
    jest.resetModules();

    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('@/core/config', () => ({
      config: {
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
        persona: { style: undefined },
        interaction: { mode: 'console' }
      }
    }));

    jest.doMock('@/tools/index', () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue([
        { name: 'bash', invoke: jest.fn() },
        { name: 'claude_execute', invoke: jest.fn() },
        { name: 'gemini_execute', invoke: jest.fn() },
      ])
    }));

    jest.doMock('@/core/middlewares', () => ({
      createLangChainToolRetryMiddleware: jest.fn().mockReturnValue({ name: 'mw', wrapToolCall: jest.fn() }),
      createSessionOutputCaptureMiddleware: jest.fn().mockReturnValue({ name: 'mw2', wrapToolCall: jest.fn() }),
      createFilterDuplicateToolsMiddleware: jest.fn().mockReturnValue({ name: 'FilterDuplicateToolsMiddleware', wrapModelCall: jest.fn() }),
    }));
    jest.doMock('@/infrastructure/agents/loader', () => ({
      loadSubAgents: jest.fn().mockReturnValue([]),
      getDefaultGeneralPurposeSubAgent: jest.fn().mockReturnValue({ name: 'general-purpose' }),
    }));
    jest.doMock('@/core/utils/skills', () => ({ findSkillsDirectories: jest.fn().mockReturnValue([]) }));
    jest.doMock('deepagents', () => ({ createDeepAgent: jest.fn().mockReturnValue({ stream: jest.fn() }), createSummarizationMiddleware: jest.fn().mockReturnValue({ name: 'ProactiveSummarizationMiddleware' }) }));
    jest.doMock('@/infrastructure/filesystem/safe-backend', () => ({ SafeFilesystemBackend: jest.fn().mockImplementation(() => ({})) }));
    jest.doMock('@langchain/langgraph', () => ({ MemorySaver: jest.fn().mockImplementation(() => ({})) }));
    jest.doMock('@/infrastructure/checkpoint/checkpointer', () => ({ FilesystemCheckpointer: jest.fn().mockImplementation(() => ({})) }));

    const { createAIAgent } = require('@/core/agent/factory');
    const { createDeepAgent } = require('deepagents');

    await createAIAgent();

    expect(createDeepAgent).toHaveBeenCalled();
    const callArgs = createDeepAgent.mock.calls[0]?.[0];
    expect(callArgs.systemPrompt).toContain('claude_execute');
    expect(callArgs.systemPrompt).toContain('gemini_execute');
    expect(callArgs.systemPrompt).toContain('PRIORITY');

    jest.resetModules();
  });
});
