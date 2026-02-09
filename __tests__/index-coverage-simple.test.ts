// Simple coverage tests for index.ts using direct callback triggering
import { config } from '../src/config';

// Mock process.exit to prevent Jest from crashing
const originalProcessExit = process.exit;
beforeAll(() => {
  (process.exit as any) = jest.fn();
});

afterAll(() => {
  (process.exit as any) = originalProcessExit;
});

// Create a simple readline mock that allows direct callback access
const createMockReadline = () => {
  const handlers: Record<string, Function[]> = {};
  
  return {
    on: jest.fn((event: string, handler: Function) => {
      if (!handlers[event]) {
        handlers[event] = [];
      }
      handlers[event].push(handler);
      return this;
    }),
    close: jest.fn(),
    emitEvent: (event: string, ...args: any[]) => {
      if (handlers[event]) {
        handlers[event].forEach(handler => handler(...args));
      }
    },
    getHandler: (event: string) => {
      return handlers[event] ? handlers[event][0] : null;
    }
  };
};

jest.mock('readline', () => ({
  createInterface: jest.fn()
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

jest.mock('../src/interactive-logic', () => ({
  shouldExitInteractiveMode: jest.fn(),
  isEmptyInput: jest.fn(),
  createConsoleThreadId: jest.fn().mockReturnValue('test-thread-id'),
  isValidThreadId: jest.fn(),
}));

jest.mock('../src/agent-interaction', () => ({
  invokeAgent: jest.fn(),
  handleAgentResponse: jest.fn(),
  handleAgentError: jest.fn(),
}));

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

import * as index from '../src/index';
import * as readline from 'readline';

describe('index module - simple coverage tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('setupExitHandlers covers SIGINT with running operation', () => {
    const mockRl = createMockReadline();
    const mockAbortController = { abort: jest.fn() };
    const mockSession = {
      isRunning: true,
      abortController: mockAbortController,
    };
    const mockGracefulShutdown = jest.fn();
    
    // Mock readline.createInterface to return our mock
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    // Call setupExitHandlers
    index.setupExitHandlers(mockSession, mockRl as any, mockGracefulShutdown);
    
    // Directly trigger the SIGINT handler
    const sigIntHandler = mockRl.getHandler('SIGINT');
    if (sigIntHandler) {
      sigIntHandler();
    }
    
    expect(mockAbortController.abort).toHaveBeenCalled();
  });

  test('setupExitHandlers covers SIGINT double press exit', () => {
    const mockRl = createMockReadline();
    const mockSession = {
      isRunning: false,
      abortController: null,
    };
    const mockGracefulShutdown = jest.fn();
    
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    index.setupExitHandlers(mockSession, mockRl as any, mockGracefulShutdown);
    
    const sigIntHandler = mockRl.getHandler('SIGINT');
    if (sigIntHandler) {
      // First press
      sigIntHandler();
      // Second press
      sigIntHandler();
    }
    
    expect(mockRl.close).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  test('startInteractiveMode covers line event - internal command', async () => {
    const mockRl = createMockReadline();
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    await index.startInteractiveMode();
    
    const lineHandler = mockRl.getHandler('line');
    if (lineHandler) {
      await lineHandler('/help');
    }
    
    expect(require('../src/utils/interactive-utils').handleUserInput).not.toHaveBeenCalled();
  });

  test('startInteractiveMode covers line event - normal input', async () => {
    const mockRl = createMockReadline();
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    await index.startInteractiveMode();
    
    const lineHandler = mockRl.getHandler('line');
    if (lineHandler) {
      await lineHandler('hello world');
    }
    
    expect(require('../src/utils/interactive-utils').handleUserInput).toHaveBeenCalled();
  });

  test('main function error handling coverage', async () => {
    // Temporarily break the agent creation
    const originalAgent = index.agent;
    let agentErrorThrown = false;
    
    // Override the agent property to throw an error
    Object.defineProperty(index, 'agent', {
      get: () => {
        agentErrorThrown = true;
        throw new Error('Test initialization error');
      }
    });
    
    const originalArgv = [...process.argv];
    process.argv = ['node', 'index.js'];
    
    try {
      await index.main();
    } catch (error) {
      // Expected error
    }
    
    // Restore
    Object.defineProperty(index, 'agent', {
      value: originalAgent,
      writable: true
    });
    process.argv = originalArgv;
    
    // The error should have been logged
    expect(agentErrorThrown).toBe(true);
  });
});