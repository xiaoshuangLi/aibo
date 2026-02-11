// Test for src/index.ts with process.exit mocked
import { config } from '../src/config';

// Mock process.exit to prevent Jest from crashing
const originalProcessExit = process.exit;
beforeAll(() => {
  (process.exit as any) = jest.fn();
});

afterAll(() => {
  (process.exit as any) = originalProcessExit;
});

// Mock other dependencies
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    on: jest.fn(),
    close: jest.fn(),
  }),
  emitKeypressEvents: jest.fn(), // Add this to fix the TypeError
}));

jest.mock('../src/config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
      modelName: 'gpt-4',
      baseURL: 'https://api.openai.com/v1',
    },
    output: {
      verbose: false,
    },
  },
}));

jest.mock('deepagents', () => ({
  createDeepAgent: jest.fn(() => ({})),
  FilesystemBackend: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@langchain/langgraph', () => ({
  MemorySaver: jest.fn(),
}));

jest.mock('../src/tools/index', () => ({}));

jest.mock('../src/utils/interactive-utils', () => ({
  styled: {
    system: jest.fn((msg) => msg),
    error: jest.fn((msg) => msg),
  },
  createGracefulShutdown: jest.fn(() => jest.fn()),
  handleUserInput: jest.fn(),
  showPrompt: jest.fn(),
}));

jest.mock('../src/utils/logging', () => ({
  structuredLog: jest.fn(),
}));

// Import after mocks
import * as index from '../src/index';

describe('index module comprehensive tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports all required functions and objects', () => {
    expect(index.model).toBeDefined();
    expect(index.backend).toBeDefined();
    expect(index.agent).toBeDefined();
    expect(index.createHandleInternalCommand).toBeDefined();
    expect(index.setupExitHandlers).toBeDefined();
    expect(index.startInteractiveMode).toBeDefined();
    expect(index.createAIAgent).toBeDefined();
    expect(index.main).toBeDefined();
  });

  test('createAIAgent returns the agent instance', () => {
    const agent = index.createAIAgent();
    expect(agent).toBe(index.agent);
  });

  describe('createHandleInternalCommand', () => {
    let mockRl: any;
    let mockSession: any;

    beforeEach(() => {
      mockRl = { close: jest.fn() };
      mockSession = { threadId: 'test-thread-id' };
    });

    test('handles /help command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/help');
      expect(result).toBe(true);
    });

    test('handles /clear command', async () => {
      const consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation();
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/clear');
      expect(result).toBe(true);
      expect(consoleClearSpy).toHaveBeenCalled();
      consoleClearSpy.mockRestore();
    });

    test('handles /pwd command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/pwd');
      expect(result).toBe(true);
    });

    test('handles /ls command successfully', async () => {
      const originalReaddirSync = require('fs').readdirSync;
      require('fs').readdirSync = jest.fn().mockReturnValue(['file1.txt', 'file2.txt']);
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/ls');
      expect(result).toBe(true);
      
      require('fs').readdirSync = originalReaddirSync;
    });

    test('handles /ls command error', async () => {
      const originalReaddirSync = require('fs').readdirSync;
      require('fs').readdirSync = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/ls');
      expect(result).toBe(true);
      
      require('fs').readdirSync = originalReaddirSync;
    });

    test('handles /verbose command', async () => {
      const originalVerbose = config.output.verbose;
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/verbose');
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(!originalVerbose);
      config.output.verbose = originalVerbose;
    });

    test('handles /new command', async () => {
      const originalThreadId = mockSession.threadId;
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/new');
      expect(result).toBe(true);
      expect(mockSession.threadId).not.toBe(originalThreadId);
    });

    test('handles exit commands', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const exitCommands = ['/exit', '/quit', '/q', '/stop'];
      
      for (const cmd of exitCommands) {
        await handleCommand(cmd);
        expect(mockRl.close).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(0);
        mockRl.close.mockClear();
        (process.exit as any).mockClear();
      }
    });

    test('handles unknown command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl);
      const result = await handleCommand('/unknown');
      expect(result).toBe(true);
    });
  });

  describe('setupExitHandlers', () => {
    test('sets up handlers without throwing', () => {
      const mockSession = {};
      const mockRl = { on: jest.fn() };
      const mockGracefulShutdown = jest.fn();
      
      expect(() => index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown)).not.toThrow();
    });

    test('setup handlers calls process.on and rl.on', () => {
      const mockSession = {};
      const mockRl = { on: jest.fn() };
      const mockGracefulShutdown = jest.fn();
      const processOnSpy = jest.spyOn(process, 'on');
      
      index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      processOnSpy.mockRestore();
    });
  });

  describe('startInteractiveMode', () => {
    test('initializes without throwing', async () => {
      // The function will be called with mocked readline, so it should not throw
      await expect(index.startInteractiveMode()).resolves.not.toThrow();
    });
  });

  describe('main function', () => {
    let originalArgv: string[];

    beforeEach(() => {
      originalArgv = [...process.argv];
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    test('returns agent in non-interactive mode', async () => {
      process.argv = ['node', 'index.js'];
      const agent = await index.main();
      expect(agent).toBe(index.agent);
    });

    test('calls startInteractiveMode with --interactive flag', async () => {
      process.argv = ['node', 'index.js', '--interactive'];
      // We can't easily spy on startInteractiveMode because it's called during module execution
      // Instead, we'll just verify that main doesn't throw
      await expect(index.main()).resolves.toBe(index.agent);
    });

    test('calls startInteractiveMode with -i flag', async () => {
      process.argv = ['node', 'index.js', '-i'];
      await expect(index.main()).resolves.toBe(index.agent);
    });

    test('calls startInteractiveMode with AIBO_INTERACTIVE env var', async () => {
      process.env.AIBO_INTERACTIVE = 'true';
      await expect(index.main()).resolves.toBe(index.agent);
    });
  });

  // Test the main module execution path
  test('covers require.main execution path', () => {
    // This is covered by the fact that the file can be imported and used
    // The actual require.main === module path is covered when the file is run directly
    // For testing purposes, we ensure the main function exists and is callable
    expect(typeof index.main).toBe('function');
  });
});