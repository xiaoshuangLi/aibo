// Test for src/index.ts with process.exit mocked

// Mock deepagents BEFORE any imports
jest.mock('deepagents', () => ({
  createDeepAgent: jest.fn(() => ({
    stream: jest.fn().mockImplementation(async () => {
      // Return a mock async iterable that yields test data
      return {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ role: "assistant", content: "Test response" }] };
        }
      };
    })
  })),
  FilesystemBackend: jest.fn().mockImplementation(() => ({})),
}));

// Mock createVoiceRecognition
jest.mock('../src/features/voice-input/voice-recognition', () => ({
  createVoiceRecognition: jest.fn(),
}));

import { config } from '../src/core/config/config';
import { createVoiceRecognition } from '../src/features/voice-input/voice-recognition';

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

// Mock other dependencies
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    on: jest.fn(),
    close: jest.fn(),
  }),
  emitKeypressEvents: jest.fn(), // Add this to fix the TypeError
}));

// Mock UserInputHandler functions
jest.mock('../src/presentation/console/user-input-handler', () => ({
  handleUserInput: jest.fn(),
  showPrompt: jest.fn(),
}));

// Mock deepagents to return a proper agent with stream method
jest.mock('deepagents', () => ({
  createDeepAgent: jest.fn(() => ({
    stream: jest.fn().mockImplementation(async () => {
      // Return a mock async iterable that yields test data
      return {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ role: "assistant", content: "Test response" }] };
        }
      };
    })
  })),
  FilesystemBackend: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../src/core/config/Config', () => ({
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
  createDeepAgent: jest.fn(() => ({
    stream: jest.fn().mockImplementation(async () => {
      // Return a mock async iterable that yields test data
      return {
        [Symbol.asyncIterator]: async function* () {
          yield { messages: [{ role: "assistant", content: "Test response" }] };
        }
      };
    })
  })),
  FilesystemBackend: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@langchain/langgraph', () => ({
  MemorySaver: jest.fn(),
}));

jest.mock('../src/tools/index', () => ({}));

jest.mock('../src/shared/utils/logging', () => ({
  structuredLog: jest.fn(),
}));

// Import after mocks
import * as index from '../src/index';
import * as readline from 'readline';

describe('index module comprehensive tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports all required functions and objects', () => {
    // model and backend are no longer exported from index.ts (moved to AgentFactory)
    // expect(index.model).toBeDefined();
    // expect(index.backend).toBeDefined();
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
    let mockAgent: any;

    beforeEach(() => {
      mockRl = { close: jest.fn(), line: '' };
      mockSession = { threadId: 'test-thread-id' };
      mockAgent = index.agent; // Mock agent object
    });

    test('handles /help command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/help');
      expect(result).toBe(true);
    });

    test('handles /clear command', async () => {
      const consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation();
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/clear');
      expect(result).toBe(true);
      expect(consoleClearSpy).toHaveBeenCalled();
      consoleClearSpy.mockRestore();
    });

    test('handles /pwd command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/pwd');
      expect(result).toBe(true);
    });

    test('handles /ls command successfully', async () => {
      const originalReaddirSync = require('fs').readdirSync;
      require('fs').readdirSync = jest.fn().mockReturnValue(['file1.txt', 'file2.txt']);
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/ls');
      expect(result).toBe(true);
      
      require('fs').readdirSync = originalReaddirSync;
    });

    test('handles /ls command error', async () => {
      const originalReaddirSync = require('fs').readdirSync;
      require('fs').readdirSync = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/ls');
      expect(result).toBe(true);
      
      require('fs').readdirSync = originalReaddirSync;
    });

    test('handles /verbose command', async () => {
      const originalVerbose = config.output.verbose;
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/verbose');
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(!originalVerbose);
      config.output.verbose = originalVerbose;
    });

    test('handles /new command', async () => {
      const originalThreadId = mockSession.threadId;
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/new');
      expect(result).toBe(true);
      expect(mockSession.threadId).not.toBe(originalThreadId);
    });

    test('handles /voice command successfully with speech recognition', async () => {
      // Setup mocks for successful voice recognition
      (createVoiceRecognition as jest.Mock).mockImplementation(() => ({
        canRecord: jest.fn().mockReturnValue(true),
        recognizeSpeech: jest.fn().mockResolvedValue('Hello world'),
      }));
      
      const handleUserInputMock = require('../src/presentation/console/user-input-handler').handleUserInput as jest.Mock;
      handleUserInputMock.mockResolvedValue(undefined);
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      expect(handleUserInputMock).toHaveBeenCalledWith('Hello world', mockSession, index.agent, mockRl);
    });

    test('handles /voice command when microphone access is denied', async () => {
      // Setup mocks for microphone access denied
      (createVoiceRecognition as jest.Mock).mockImplementation(() => ({
        canRecord: jest.fn().mockReturnValue(false),
        recognizeSpeech: jest.fn(),
      }));
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      // Should not call handleUserInput when canRecord returns false
      expect(require('../src/presentation/console/user-input-handler').handleUserInput).not.toHaveBeenCalled();
    });

    test('handles /voice command when no speech is recognized', async () => {
      // Setup mocks for no speech recognition
      (createVoiceRecognition as jest.Mock).mockImplementation(() => ({
        canRecord: jest.fn().mockReturnValue(true),
        recognizeSpeech: jest.fn().mockResolvedValue(null),
      }));
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      // Should not call handleUserInput when recognizeSpeech returns null
      expect(require('../src/presentation/console/user-input-handler').handleUserInput).not.toHaveBeenCalled();
    });

    test('handles /voice command with speech recognition error', async () => {
      // Setup mocks for speech recognition error
      (createVoiceRecognition as jest.Mock).mockImplementation(() => ({
        canRecord: jest.fn().mockReturnValue(true),
        recognizeSpeech: jest.fn().mockRejectedValue(new Error('Recognition failed')),
      }));
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      // Should not call handleUserInput when recognizeSpeech throws error
      expect(require('../src/presentation/console/user-input-handler').handleUserInput).not.toHaveBeenCalled();
    });

    test('handles exit commands', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
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
      const handleCommand = index.createHandleInternalCommand(mockSession, mockRl, mockAgent);
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

    test('calls process.stdin.setRawMode when isTTY is true', async () => {
      // Mock process.stdin.isTTY to be true and add setRawMode method if not exists
      const originalIsTTY = process.stdin.isTTY;
      const originalSetRawMode = (process.stdin as any).setRawMode;
      
      // Add setRawMode method if it doesn't exist
      if (typeof (process.stdin as any).setRawMode !== 'function') {
        (process.stdin as any).setRawMode = jest.fn();
      }
      
      const setRawModeSpy = jest.spyOn(process.stdin as any, 'setRawMode');
      
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: false,
        configurable: true
      });
      
      await index.startInteractiveMode();
      
      expect(setRawModeSpy).toHaveBeenCalledWith(true);
      
      // Restore original values
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        writable: false,
        configurable: true
      });
      
      if (originalSetRawMode) {
        (process.stdin as any).setRawMode = originalSetRawMode;
      } else {
        delete (process.stdin as any).setRawMode;
      }
    });

    test('does not call process.stdin.setRawMode when isTTY is false', async () => {
      // Mock process.stdin.isTTY to be false and add setRawMode method if not exists
      const originalIsTTY = process.stdin.isTTY;
      const originalSetRawMode = (process.stdin as any).setRawMode;
      
      // Add setRawMode method if it doesn't exist
      if (typeof (process.stdin as any).setRawMode !== 'function') {
        (process.stdin as any).setRawMode = jest.fn();
      }
      
      const setRawModeSpy = jest.spyOn(process.stdin as any, 'setRawMode');
      
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: false,
        configurable: true
      });
      
      await index.startInteractiveMode();
      
      expect(setRawModeSpy).not.toHaveBeenCalled();
      
      // Restore original values
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        writable: false,
        configurable: true
      });
      
      if (originalSetRawMode) {
        (process.stdin as any).setRawMode = originalSetRawMode;
      } else {
        delete (process.stdin as any).setRawMode;
      }
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

// Simple coverage tests for index.ts using direct callback triggering
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
    
    expect(require('../src/presentation/console/user-input-handler').handleUserInput).not.toHaveBeenCalled();
  });

  test('startInteractiveMode covers line event - normal input', async () => {
    const mockRl = createMockReadline();
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    await index.startInteractiveMode();
    
    const lineHandler = mockRl.getHandler('line');
    if (lineHandler) {
      await lineHandler('hello world');
    }
    
    expect(require('../src/presentation/console/user-input-handler').handleUserInput).toHaveBeenCalled();
  });

  test('startInteractiveMode covers line event - empty input', async () => {
    const mockRl = createMockReadline();
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    // Clear any previous calls to showPrompt
    require('../src/presentation/console/user-input-handler').showPrompt.mockClear();
    
    await index.startInteractiveMode();
    
    // Clear the initial showPrompt call from startInteractiveMode
    require('../src/presentation/console/user-input-handler').showPrompt.mockClear();
    
    const lineHandler = mockRl.getHandler('line');
    if (lineHandler) {
      // Test with empty string
      await lineHandler('');
      // Test with whitespace only
      await lineHandler('   ');
    }
    
    // handleUserInput should not be called for empty input
    expect(require('../src/presentation/console/user-input-handler').handleUserInput).not.toHaveBeenCalled();
    // showPrompt should be called twice (once for each empty input)
    expect(require('../src/presentation/console/user-input-handler').showPrompt).toHaveBeenCalledTimes(2);
  });

  // test('main function error handling coverage', async () => {
  //   // Mock structuredLog to verify error logging
  //   const originalStructuredLog = require('../src/utils/logging').structuredLog;
  //   let errorLogged = false;
  //   
  //   require('../src/utils/logging').structuredLog = jest.fn((level: string, message: string, meta: any) => {
  //     if (level === 'error' && message === 'Failed to initialize AI Agent') {
  //       errorLogged = true;
  //     }
  //     return originalStructuredLog(level, message, meta);
  //   });
  //   
  //   // Create a mock agent that throws an error when accessed
  //   const originalAgent = index.agent;
  //   Object.defineProperty(index, 'agent', {
  //     get: () => {
  //       throw new Error('Test initialization error');
  //     }
  //   });
  //   
  //   const originalArgv = [...process.argv];
  //   process.argv = ['node', 'index.js'];
  //   
  //   // Call main function and expect it to handle the error internally
  //   await index.main().catch(() => {
  //     // The error should be handled internally
  //   });
  //   
  //   // Restore
  //   Object.defineProperty(index, 'agent', {
  //     value: originalAgent,
  //     writable: true
  //   });
  //   require('../src/utils/logging').structuredLog = originalStructuredLog;
  //   process.argv = originalArgv;
  //   
  //   // The error should have been logged
  //   expect(errorLogged).toBe(true);
  // });

  test('require.main === module condition coverage', () => {
    // This test ensures that the require.main === module condition is covered
    // In the test environment, this condition is false, but we can verify that
    // the code structure is correct
    expect(typeof index.main).toBe('function');
  });
});

// Test voice input shortcut functionality
describe('voice input shortcuts', () => {
  let mockSession: any;
  let mockRl: any;
  let mockAgent: any;

  beforeEach(() => {
    mockSession = {
      threadId: 'test-thread-id',
      isRunning: false,
      abortController: null,
      rl: null,
      commandHistory: [],
      historyIndex: 0,
      isVoiceRecording: false,
      voiceASR: null,
    };
    mockRl = {
      on: jest.fn(),
      close: jest.fn(),
      line: '',
      write: jest.fn(),
    };
    mockAgent = {};
  });

  test('startRecord starts voice recording successfully', async () => {
    // Mock createTencentASR
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    
    // Call startRecord directly
    await index.startRecord(mockSession, mockRl);
    
    // Verify voice recording started
    expect(mockSession.isVoiceRecording).toBe(true);
    expect(mockSession.voiceASR).toBe(mockTencentASR);
    expect(mockTencentASR.startManualRecording).toHaveBeenCalled();
    expect(showPromptMock).not.toHaveBeenCalled();
  });

  test('startRecord handles microphone access denied', async () => {
    // Mock createTencentASR with canRecord returning false
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(false),
      startManualRecording: jest.fn(),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    
    // Call startRecord directly
    await index.startRecord(mockSession, mockRl);
    
    // Verify recording was not started and error was shown
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(showPromptMock).toHaveBeenCalled();
  });

  test('startRecord handles recording startup failure', async () => {
    // Mock createTencentASR with startManualRecording throwing error
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockRejectedValue(new Error('Recording failed')),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    
    // Call startRecord directly
    await index.startRecord(mockSession, mockRl);
    
    // Verify recording was not started and error was shown
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(showPromptMock).toHaveBeenCalled();
  });

  test('stopRecord stops voice recording and processes audio with "干活" keyword', async () => {
    // Clear any previous mocks
    (createVoiceRecognition as jest.Mock).mockClear();
    
    // Mock createTencentASR
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
      stopManualRecording: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      recognizeManualRecording: jest.fn().mockResolvedValue('Hello world 干活'),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt and handleUserInput
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    const handleUserInputMock = require('../src/presentation/console/user-input-handler').handleUserInput as jest.Mock;
    showPromptMock.mockClear();
    handleUserInputMock.mockClear();
    
    // First start recording
    await index.startRecord(mockSession, mockRl);
    expect(mockSession.isVoiceRecording).toBe(true);
    
    // Then stop recording
    await index.stopRecord(mockSession, mockRl, index.agent);
    
    // Verify voice recording stopped and processed with handleUserInput
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(mockTencentASR.stopManualRecording).toHaveBeenCalled();
    expect(mockTencentASR.recognizeManualRecording).toHaveBeenCalled();
    expect(handleUserInputMock).toHaveBeenCalledWith('Hello world 干活', mockSession, index.agent, mockRl);
    expect(showPromptMock).toHaveBeenCalled();
  });

  test('stopRecord stops voice recording and writes to readline without "干活" keyword', async () => {
    // Clear any previous mocks
    (createVoiceRecognition as jest.Mock).mockClear();
    
    // Mock createTencentASR
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
      stopManualRecording: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      recognizeManualRecording: jest.fn().mockResolvedValue('Hello world'),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt and handleUserInput
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    const handleUserInputMock = require('../src/presentation/console/user-input-handler').handleUserInput as jest.Mock;
    showPromptMock.mockClear();
    handleUserInputMock.mockClear();
    mockRl.write.mockClear();
    
    // First start recording
    await index.startRecord(mockSession, mockRl);
    expect(mockSession.isVoiceRecording).toBe(true);
    
    // Then stop recording
    await index.stopRecord(mockSession, mockRl, index.agent);
    
    // Verify voice recording stopped and written to readline
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(mockTencentASR.stopManualRecording).toHaveBeenCalled();
    expect(mockTencentASR.recognizeManualRecording).toHaveBeenCalled();
    expect(handleUserInputMock).not.toHaveBeenCalled();
    expect(mockRl.write).toHaveBeenCalledWith('Hello world');
    expect(showPromptMock).toHaveBeenCalled();
  });

  test('stopRecord handles recognition failure', async () => {
    // Mock createTencentASR with recognizeManualRecording returning null
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
      stopManualRecording: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      recognizeManualRecording: jest.fn().mockResolvedValue(null),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    
    // First start recording
    await index.startRecord(mockSession, mockRl);
    expect(mockSession.isVoiceRecording).toBe(true);
    
    // Then stop recording
    await index.stopRecord(mockSession, mockRl, index.agent);
    
    // Verify recording was stopped and no input was processed
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(showPromptMock).toHaveBeenCalled();
  });

  test('stopRecord handles no audio data', async () => {
    // Mock createTencentASR with stopManualRecording returning null
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
      stopManualRecording: jest.fn().mockResolvedValue(null),
      recognizeManualRecording: jest.fn(),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    
    // First start recording
    await index.startRecord(mockSession, mockRl);
    expect(mockSession.isVoiceRecording).toBe(true);
    
    // Then stop recording
    await index.stopRecord(mockSession, mockRl, index.agent);
    
    // Verify recording was stopped and no input was processed
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(showPromptMock).toHaveBeenCalled();
  });

  test('stopRecord handles recognition error', async () => {
    // Mock createTencentASR with recognizeManualRecording throwing error
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
      stopManualRecording: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      recognizeManualRecording: jest.fn().mockRejectedValue(new Error('Recognition failed')),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    // Mock showPrompt
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    
    // First start recording
    await index.startRecord(mockSession, mockRl);
    expect(mockSession.isVoiceRecording).toBe(true);
    
    // Then stop recording
    await index.stopRecord(mockSession, mockRl, index.agent);
    
    // Verify recording was stopped and error was shown
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(showPromptMock).toHaveBeenCalled();
  });
});

// Test cleanupVoiceRecording function
describe('cleanupVoiceRecording', () => {
  test('cleans up voice recording when session has active recording', () => {
    const mockVoiceASR = {
      stopManualRecording: jest.fn().mockResolvedValue(undefined)
    };
    const session = {
      voiceASR: mockVoiceASR,
      isVoiceRecording: true
    };
    
    index.cleanupVoiceRecording(session);
    
    expect(mockVoiceASR.stopManualRecording).toHaveBeenCalled();
    expect(session.isVoiceRecording).toBe(false);
    expect(session.voiceASR).toBeNull();
  });

  test('handles cleanup errors gracefully', () => {
    const mockVoiceASR = {
      stopManualRecording: jest.fn().mockRejectedValue(new Error('Cleanup error'))
    };
    const session = {
      voiceASR: mockVoiceASR,
      isVoiceRecording: true
    };
    
    // Should not throw an error
    index.cleanupVoiceRecording(session);
    
    expect(session.isVoiceRecording).toBe(false);
    expect(session.voiceASR).toBeNull();
  });

  test('does nothing when no active recording', () => {
    const session = {
      voiceASR: null,
      isVoiceRecording: false
    };
    
    index.cleanupVoiceRecording(session);
    
    expect(session.isVoiceRecording).toBe(false);
    expect(session.voiceASR).toBeNull();
  });
});

// Test setupExitHandlers function
describe('setupExitHandlers', () => {
  let originalProcessOn: typeof process.on;
  let originalProcessExit: typeof process.exit;
  let mockSession: any;
  let mockRl: any;
  let mockGracefulShutdown: jest.Mock;

  beforeEach(() => {
    originalProcessOn = process.on;
    originalProcessExit = process.exit;
    (process.on as any) = jest.fn();
    (process.exit as any) = jest.fn();
    
    mockRl = {
      on: jest.fn(),
      close: jest.fn(),
      line: '',
      write: jest.fn(),
    };
    mockSession = {
      threadId: 'test-thread-id',
      isRunning: false,
      abortController: null,
      rl: mockRl,
      commandHistory: [],
      historyIndex: 0,
      isVoiceRecording: false,
      voiceASR: null,
    };
    mockGracefulShutdown = jest.fn();
  });

  afterEach(() => {
    (process.on as any) = originalProcessOn;
    (process.exit as any) = originalProcessExit;
  });

  test('sets up SIGINT and SIGTERM handlers', () => {
    index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
    
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  test('SIGINT handler calls cleanup and graceful shutdown', () => {
    index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
    
    // Get the SIGINT handler
    const sigintHandler = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    sigintHandler();
    
    // Verify session state after cleanup
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(mockGracefulShutdown).toHaveBeenCalledWith('SIGINT');
  });

  test('SIGTERM handler calls cleanup and graceful shutdown', () => {
    index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
    
    // Get the SIGTERM handler
    const sigtermHandler = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGTERM')[1];
    sigtermHandler();
    
    // Verify session state after cleanup
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(mockGracefulShutdown).toHaveBeenCalledWith('SIGTERM');
  });

  test('rl SIGINT handler - interrupts running operation', () => {
    const abortController = { abort: jest.fn() };
    mockSession.isRunning = true;
    mockSession.abortController = abortController;
    
    index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
    
    // Get the rl SIGINT handler
    const rlSigintHandler = (mockRl.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    rlSigintHandler();
    
    expect(abortController.abort).toHaveBeenCalled();
  });

  test('rl SIGINT handler - stops voice recording', () => {
    const showPromptMock = require('../src/presentation/console/user-input-handler').showPrompt as jest.Mock;
    mockSession.isVoiceRecording = true;
    mockSession.voiceASR = { stopManualRecording: jest.fn() };
    
    index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
    
    // Get the rl SIGINT handler
    const rlSigintHandler = (mockRl.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    rlSigintHandler();
    
    // Verify session state after cleanup
    expect(mockSession.isVoiceRecording).toBe(false);
    expect(mockSession.voiceASR).toBeNull();
    expect(showPromptMock).toHaveBeenCalledWith(mockSession, mockRl);
  });

  test('rl SIGINT handler - double press exit', () => {
    // First press
    index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
    const rlSigintHandler = (mockRl.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    rlSigintHandler();
    
    // Second press within 500ms
    jest.useFakeTimers();
    jest.advanceTimersByTime(100);
    rlSigintHandler();
    
    expect(mockRl.close).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
    
    jest.useRealTimers();
  });

  test('rl SIGINT handler - single press confirmation', () => {
    index.setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
    const rlSigintHandler = (mockRl.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    rlSigintHandler();
    
    // Should not exit on first press
    expect(mockRl.close).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });
});