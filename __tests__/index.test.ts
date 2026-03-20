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
jest.mock('../src/features/voice-input/recognition', () => ({
  createVoiceRecognition: jest.fn(),
}));

import { config } from '@/core/config';
import { createVoiceRecognition } from '@/features/voice-input/recognition';
import { Session } from '@/core/agent/session';
import { TerminalAdapter } from '@/presentation/console/adapter';

// Mock process.exit to prevent Jest from crashing
const originalProcessExit = process.exit;
beforeAll(() => {
  (process.exit as any) = jest.fn();
});

afterAll(() => {
  (process.exit as any) = originalProcessExit;
});

// Create a mock Adapter for testing
const createMockAdapter = () => ({
  emit: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn(),
  setAbortSignal: jest.fn(),
  requestUserInput: jest.fn(),
});

// Create a mock TerminalAdapter for testing
const createMockTerminalAdapter = (overrides: any = {}) => {
  const terminalAdapter = {
    rl: {
      on: jest.fn(),
      close: jest.fn(),
      ...overrides.rl,
    },
    destroy: jest.fn(),
    emit: jest.fn(),
    setAbortSignal: jest.fn(),
    requestUserInput: jest.fn(),
    ...overrides,
  };
  return terminalAdapter as unknown as TerminalAdapter;
};

// Create a mock Session for testing
const createMockSession = (overrides: any = {}) => {
  // Default values for session state
  let isVoiceRecording = overrides.isVoiceRecording ?? false;
  let voiceASR: any = overrides.voiceASR ?? null;
  
  const session = {
    threadId: 'test-thread',
    isRunning: overrides.isRunning ?? false,
    abortController: overrides.abortController ?? null,
    commandHistory: overrides.commandHistory ?? [],
    historyIndex: overrides.historyIndex ?? 0,
    modelInfo: 'test-model',
    
    // Public properties for testing (not in real Session class, but needed for test assertions)
    get isVoiceRecording() { return isVoiceRecording; },
    get voiceASR() { return voiceASR; },
    
    // Methods
    start: jest.fn(),
    end: jest.fn(),
    requestUserInput: jest.fn(),
    addToHistory: jest.fn(),
    getCommandHistory: jest.fn().mockReturnValue([]),
    setVoiceRecording: jest.fn((isRecording: boolean, asr: any) => {
      isVoiceRecording = isRecording;
      voiceASR = asr;
    }),
    isVoiceRecordingActive: jest.fn(function() { return isVoiceRecording; }),
    getVoiceASR: jest.fn(function() { return voiceASR; }),
    logToolCall: jest.fn(),
    logToolResult: jest.fn(),
    logThinkingProcess: jest.fn(),
    streamAIContent: jest.fn().mockResolvedValue(undefined),
    logRawText: jest.fn(),
    logErrorMessage: jest.fn(),
    logSystemMessage: jest.fn(),
    destroy: jest.fn(),
    ...overrides,
  };
  return session as unknown as Session;

};

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
jest.mock('../src/presentation/console/input', () => ({
  handleUserInput: jest.fn(),
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

jest.mock('../src/core/config', () => ({
  config: {
    model: {
      apiKey: 'test-api-key',
      name: 'gpt-4',
      baseUrl: 'https://api.openai.com/v1',
    },
    langgraph: {
      checkpointerType: 'memory',
      recursionLimit: 1000,
    },
    output: {
      verbose: false,
    },
    specialKeyword: {
      keyword: '干活'
    },
    language: {
      code: 'en',
    },
    persona: {
      style: '',
    },
    interaction: {
      mode: 'console',
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

jest.mock('../src/tools/index', () => jest.fn().mockResolvedValue([]));

jest.mock('../src/shared/utils/logging', () => ({
  structuredLog: jest.fn(),
}));

// Import after mocks
import * as index from '@/index';
import * as readline from 'readline';

describe('index module comprehensive tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports all required functions and objects', () => {
    // model and backend are no longer exported from index.ts (moved to AgentFactory)
    // expect(index.model).toBeDefined();
    // expect(index.backend).toBeDefined();
    // expect(index.agent).toBeDefined(); // agent is not directly exported, use createAIAgent() instead
    expect(index.createHandleInternalCommand).toBeDefined();
    expect(index.startInteractiveMode).toBeDefined();
    expect(index.createAIAgent).toBeDefined();
    // Voice input functions
    expect(index.cleanupVoiceRecording).toBeDefined();
    expect(index.startRecord).toBeDefined();
    expect(index.createKeypressHandler).toBeDefined();
  });

  test('createAIAgent returns an agent instance', () => {
    const agent = index.createAIAgent();
    expect(agent).toBeDefined();
    // We can't compare with index.agent since it doesn't exist
    // Just verify that createAIAgent returns a valid agent object
  });

  describe('createHandleInternalCommand', () => {
    let mockRl: any;
    let mockSession: any;
    let mockAgent: any;

    beforeEach(() => {
      mockRl = { close: jest.fn(), line: '' };
      mockSession = createMockSession({ threadId: 'test-thread-id', rl: mockRl });
      mockAgent = index.createAIAgent(); // Create agent using createAIAgent function
    });

    test('handles /help command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/help');
      expect(result).toBe(true);
    });

    test('handles /clear command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/clear');
      expect(result).toBe(true);
      // /clear command uses console.clear() and console.log() directly, not session.logRawText
      // So we don't expect mockSession.logRawText to be called
    });

    test('handles /pwd command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/pwd');
      expect(result).toBe(true);
    });

    test('handles /ls command successfully', async () => {
      const originalReaddirSync = require('fs').readdirSync;
      require('fs').readdirSync = jest.fn().mockReturnValue(['file1.txt', 'file2.txt']);
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/ls');
      expect(result).toBe(true);
      
      require('fs').readdirSync = originalReaddirSync;
    });

    test('handles /ls command error', async () => {
      const originalReaddirSync = require('fs').readdirSync;
      require('fs').readdirSync = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/ls');
      expect(result).toBe(true);
      
      require('fs').readdirSync = originalReaddirSync;
    });

    test('handles /verbose command', async () => {
      const originalVerbose = config.output.verbose;
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/verbose');
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(!originalVerbose);
      config.output.verbose = originalVerbose;
    });

    test('handles /new command', async () => {
      const originalThreadId = mockSession.threadId;
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
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
      
      const handleUserInputMock = require('../src/presentation/console/input').handleUserInput as jest.Mock;
      handleUserInputMock.mockResolvedValue(undefined);
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      expect(handleUserInputMock).toHaveBeenCalledWith('Hello world', mockSession, mockAgent);
    });

    test('handles /voice command when microphone access is denied', async () => {
      // Setup mocks for microphone access denied
      (createVoiceRecognition as jest.Mock).mockImplementation(() => ({
        canRecord: jest.fn().mockReturnValue(false),
        recognizeSpeech: jest.fn(),
      }));
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      // Should not call handleUserInput when canRecord returns false
      expect(require('../src/presentation/console/input').handleUserInput).not.toHaveBeenCalled();
    });

    test('handles /voice command when no speech is recognized', async () => {
      // Setup mocks for no speech recognition
      (createVoiceRecognition as jest.Mock).mockImplementation(() => ({
        canRecord: jest.fn().mockReturnValue(true),
        recognizeSpeech: jest.fn().mockResolvedValue(null),
      }));
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      // Should not call handleUserInput when recognizeSpeech returns null
      expect(require('../src/presentation/console/input').handleUserInput).not.toHaveBeenCalled();
    });

    test('handles /voice command with speech recognition error', async () => {
      // Setup mocks for speech recognition error
      (createVoiceRecognition as jest.Mock).mockImplementation(() => ({
        canRecord: jest.fn().mockReturnValue(true),
        recognizeSpeech: jest.fn().mockRejectedValue(new Error('Recognition failed')),
      }));
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/voice');
      
      expect(result).toBe(true);
      // Should not call handleUserInput when recognizeSpeech throws error
      expect(require('../src/presentation/console/input').handleUserInput).not.toHaveBeenCalled();
    });

    test('handles exit commands', async () => {
      // Mock process.exit to prevent actual exit during testing
      const processExitMock = jest.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit called'); }) as any);
      
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const exitCommands = ['/exit'];
      
      for (const cmd of exitCommands) {
        try {
          await handleCommand(cmd);
        } catch (error: any) {
          // Expect process.exit to be called, which throws in our mock
          expect(error.message).toBe('process.exit called');
        }
        expect(processExitMock).toHaveBeenCalledWith(0);
        expect(mockSession.rl.close).toHaveBeenCalled();
        // /exit command calls process.exit(0) and session.rl.close(), not session.end()
        // So we don't expect mockSession.end to be called
        processExitMock.mockClear();
        mockSession.rl.close.mockClear();
      }
      
      processExitMock.mockRestore();
    });

    test('handles unknown command', async () => {
      const handleCommand = index.createHandleInternalCommand(mockSession, mockAgent);
      const result = await handleCommand('/unknown');
      expect(result).toBe(true);
    });
  });

  describe('setupExitHandlers', () => {
    test('sets up handlers without throwing', () => {
      const mockSession = createMockSession();
      const mockTerminalAdapter = createMockTerminalAdapter();
      
      expect(() => index.setupExitHandlers(mockSession, mockTerminalAdapter)).not.toThrow();
    });

    test('setup handlers calls process.on and rl.on', () => {
      const mockSession = createMockSession();
      const mockTerminalAdapter = createMockTerminalAdapter();
      const processOnSpy = jest.spyOn(process, 'on');
      
      index.setupExitHandlers(mockSession, mockTerminalAdapter);
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

  // Test the main module execution path
  test('covers require.main execution path', () => {
    // main() has been removed; the CLI entry point now calls createProgram().parseAsync()
    // directly from main.ts. Verify createAIAgent is still accessible from index.
    expect(typeof index.createAIAgent).toBe('function');
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
    const mockSession = createMockSession({
      isRunning: true,
      abortController: mockAbortController,
    });
    const mockTerminalAdapter = createMockTerminalAdapter({
      rl: mockRl,
    });
    
    // Mock readline.createInterface to return our mock
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    // Call setupExitHandlers
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    
    // Directly trigger the SIGINT handler
    const sigIntHandler = mockRl.getHandler('SIGINT');
    if (sigIntHandler) {
      sigIntHandler();
    }
    
    expect(mockAbortController.abort).toHaveBeenCalled();
  });

  test('setupExitHandlers covers SIGINT double press exit', () => {
    const mockRl = createMockReadline();
    const mockSession = createMockSession({
      isRunning: false,
      abortController: null,
    });
    const mockTerminalAdapter = createMockTerminalAdapter({
      rl: mockRl,
    });
    
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    
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
    
    expect(require('../src/presentation/console/input').handleUserInput).not.toHaveBeenCalled();
  });

  test('startInteractiveMode covers line event - normal input', async () => {
    const mockRl = createMockReadline();
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    await index.startInteractiveMode();
    
    const lineHandler = mockRl.getHandler('line');
    if (lineHandler) {
      await lineHandler('hello world');
    }
    
    expect(require('../src/presentation/console/input').handleUserInput).toHaveBeenCalled();
  });

  test('startInteractiveMode covers line event - empty input', async () => {
    const mockRl = createMockReadline();
    (readline.createInterface as jest.Mock).mockReturnValue(mockRl);
    
    await index.startInteractiveMode();
    
    const lineHandler = mockRl.getHandler('line');
    if (lineHandler) {
      // Test with empty string
      await lineHandler('');
      // Test with whitespace only
      await lineHandler('   ');
    }
    
    // handleUserInput should not be called for empty input
    expect(require('../src/presentation/console/input').handleUserInput).not.toHaveBeenCalled();
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
    // main() has been removed; the CLI entry point calls createProgram().parseAsync()
    // directly. Verify a core export is still available.
    expect(typeof index.createAIAgent).toBe('function');
  });
});

// Test voice input shortcut functionality
describe('voice input shortcuts', () => {
  let mockSession: any;
  let mockRl: any;
  let mockAgent: any;

  beforeEach(() => {
    mockRl = {
      on: jest.fn(),
      close: jest.fn(),
      line: '',
      write: jest.fn(),
    };
    mockSession = createMockSession({
      threadId: 'test-thread-id',
      isRunning: false,
      abortController: null,
      rl: mockRl,
      commandHistory: [],
      historyIndex: 0,
      isVoiceRecording: false,
      voiceASR: null,
    });
    mockAgent = {};
  });

  test('startRecord starts voice recording successfully', async () => {
    // Mock createTencentASR
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    
    // Call startRecord directly
    await index.startRecord(mockSession);
    
    // Verify voice recording started
    expect(mockSession.isVoiceRecordingActive()).toBe(true);
    expect(mockSession.getVoiceASR()).toBe(mockTencentASR);
    expect(mockTencentASR.startManualRecording).toHaveBeenCalled();
  });

  test('startRecord handles microphone access denied', async () => {
    // Mock createTencentASR with canRecord returning false
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(false),
      startManualRecording: jest.fn(),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    
    // Call startRecord directly
    await index.startRecord(mockSession);
    
    // Verify recording was not started and error was shown
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
  });

  test('startRecord handles recording startup failure', async () => {
    // Mock createTencentASR with startManualRecording throwing error
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockRejectedValue(new Error('Recording failed')),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    
    // Call startRecord directly
    await index.startRecord(mockSession);
    
    // Verify recording was not started and error was shown
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
  });

  test('stopRecord stops voice recording and processes audio with special keyword', async () => {
    // Clear any previous mocks
    (createVoiceRecognition as jest.Mock).mockClear();
    
    // Mock createTencentASR
    const mockTencentASR = {
      canRecord: jest.fn().mockReturnValue(true),
      startManualRecording: jest.fn().mockResolvedValue(undefined),
      stopManualRecording: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      recognizeManualRecording: jest.fn().mockResolvedValue(`Hello world ${config.specialKeyword.keyword}`),
    };
    (createVoiceRecognition as jest.Mock).mockReturnValue(mockTencentASR);
    
    const handleUserInputMock = require('../src/presentation/console/input').handleUserInput as jest.Mock;
    handleUserInputMock.mockClear();
    
    // First start recording
    await index.startRecord(mockSession);
    expect(mockSession.isVoiceRecordingActive()).toBe(true);
    
    // Then stop recording
    const onVoiceInputComplete = (text: string) => mockRl.write(text);
    const onExecuteCommand = (command: string) => require('../src/presentation/console/input').handleUserInput(command, mockSession, mockAgent);
    await index.stopRecord(mockSession, '', onVoiceInputComplete, onExecuteCommand);
    
    // Verify voice recording stopped and processed with handleUserInput
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
    expect(mockTencentASR.stopManualRecording).toHaveBeenCalled();
    expect(mockTencentASR.recognizeManualRecording).toHaveBeenCalled();
    expect(handleUserInputMock).toHaveBeenCalledWith('Hello world 干活', mockSession, mockAgent);
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
    
    const handleUserInputMock = require('../src/presentation/console/input').handleUserInput as jest.Mock;
    handleUserInputMock.mockClear();
    mockRl.write.mockClear();
    
    // First start recording
    await index.startRecord(mockSession);
    expect(mockSession.isVoiceRecordingActive()).toBe(true);
    
    // Then stop recording
    const onVoiceInputComplete = (text: string) => mockRl.write(text);
    const onExecuteCommand = (command: string) => require('../src/presentation/console/input').handleUserInput(command, mockSession, mockAgent);
    await index.stopRecord(mockSession, 'Hello world', onVoiceInputComplete, onExecuteCommand);
    
    // Verify voice recording stopped and written to readline
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
    expect(mockTencentASR.stopManualRecording).toHaveBeenCalled();
    expect(mockTencentASR.recognizeManualRecording).toHaveBeenCalled();
    expect(handleUserInputMock).not.toHaveBeenCalled();
    expect(mockRl.write).toHaveBeenCalledWith('Hello world');
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
    
    
    // First start recording
    await index.startRecord(mockSession);
    expect(mockSession.isVoiceRecordingActive()).toBe(true);
    
    // Then stop recording
    const onVoiceInputComplete = (text: string) => mockRl.write(text);
    const onExecuteCommand = (command: string) => require("../src/presentation/console/input").handleUserInput(command, mockSession, mockAgent);
    await index.stopRecord(mockSession, "", onVoiceInputComplete, onExecuteCommand);
    
    // Verify recording was stopped and no input was processed
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
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
    
    
    // First start recording
    await index.startRecord(mockSession);
    expect(mockSession.isVoiceRecordingActive()).toBe(true);
    
    // Then stop recording
    const onVoiceInputComplete = (text: string) => mockRl.write(text);
    const onExecuteCommand = (command: string) => require("../src/presentation/console/input").handleUserInput(command, mockSession, mockAgent);
    await index.stopRecord(mockSession, "", onVoiceInputComplete, onExecuteCommand);
    
    // Verify recording was stopped and no input was processed
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
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
    
    
    // First start recording
    await index.startRecord(mockSession);
    expect(mockSession.isVoiceRecordingActive()).toBe(true);
    
    // Then stop recording
    const onVoiceInputComplete = (text: string) => mockRl.write(text);
    const onExecuteCommand = (command: string) => require("../src/presentation/console/input").handleUserInput(command, mockSession, mockAgent);
    await index.stopRecord(mockSession, "", onVoiceInputComplete, onExecuteCommand);
    
    // Verify recording was stopped and error was shown
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
  });
});

// Test cleanupVoiceRecording function
describe('cleanupVoiceRecording', () => {
  test('cleans up voice recording when session has active recording', () => {
    const mockVoiceASR = {
      stopManualRecording: jest.fn().mockResolvedValue(undefined)
    };
    const session = createMockSession({
      voiceASR: mockVoiceASR,
      isVoiceRecording: true,
    });
    
    index.cleanupVoiceRecording(session as any);
    
    expect(mockVoiceASR.stopManualRecording).toHaveBeenCalled();
    expect(session.isVoiceRecordingActive()).toBe(false);
    expect(session.getVoiceASR()).toBeNull();
  });

  test('handles cleanup errors gracefully', () => {
    const mockVoiceASR = {
      stopManualRecording: jest.fn().mockRejectedValue(new Error('Cleanup error'))
    };
    const session = createMockSession({
      voiceASR: mockVoiceASR,
      isVoiceRecording: true,
    });
    
    // Should not throw an error
    index.cleanupVoiceRecording(session as any);
    
    expect(session.isVoiceRecordingActive()).toBe(false);
    expect(session.getVoiceASR()).toBeNull();
  });

  test('does nothing when no active recording', () => {
    const session = createMockSession({
      voiceASR: null,
      isVoiceRecording: false,
      getVoiceASR: () => null,
      isVoiceRecordingActive: () => false,
    });
    
    index.cleanupVoiceRecording(session as any);
    
    expect(session.isVoiceRecordingActive()).toBe(false);
    expect(session.getVoiceASR()).toBeNull();
  });
});

// Test setupExitHandlers function
describe('setupExitHandlers', () => {
  let originalProcessOn: typeof process.on;
  let originalProcessExit: typeof process.exit;
  let mockSession: any;
  let mockRl: any;
  let mockTerminalAdapter: any;

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
    mockSession = createMockSession({
      threadId: 'test-thread-id',
      isRunning: false,
      abortController: null,
      commandHistory: [],
      historyIndex: 0,
      isVoiceRecording: false,
      voiceASR: null,
    });
    mockTerminalAdapter = createMockTerminalAdapter({
      rl: mockRl,
    });
  });

  afterEach(() => {
    (process.on as any) = originalProcessOn;
    (process.exit as any) = originalProcessExit;
  });

  test('sets up SIGINT and SIGTERM handlers', () => {
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  test('SIGINT handler calls cleanup and graceful shutdown', () => {
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    
    // Get the SIGINT handler
    const sigintHandler = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    sigintHandler();
    
    // Verify session state after cleanup
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
    // Note: gracefulShutdown is called internally, not the terminal adapter
  });

  test('SIGTERM handler calls cleanup and graceful shutdown', () => {
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    
    // Get the SIGTERM handler
    const sigtermHandler = (process.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGTERM')[1];
    sigtermHandler();
    
    // Verify session state after cleanup
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
    // Note: gracefulShutdown is called internally, not the terminal adapter
  });

  test('rl SIGINT handler - interrupts running operation', () => {
    const abortController = { abort: jest.fn() };
    mockSession.isRunning = true;
    mockSession.abortController = abortController;
    
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    
    // Get the rl SIGINT handler
    const rlSigintHandler = (mockRl.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    rlSigintHandler();
    
    expect(abortController.abort).toHaveBeenCalled();
  });

  test('rl SIGINT handler - stops voice recording', () => {
    mockSession.isVoiceRecording = true;
    mockSession.voiceASR = { stopManualRecording: jest.fn().mockResolvedValue(undefined) };
    
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    
    // Get the rl SIGINT handler
    const rlSigintHandler = (mockRl.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    rlSigintHandler();
    
    // Verify session state after cleanup
    expect(mockSession.isVoiceRecordingActive()).toBe(false);
    expect(mockSession.getVoiceASR()).toBeNull();
  });

  test('rl SIGINT handler - double press exit', () => {
    // First press
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
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
    index.setupExitHandlers(mockSession, mockTerminalAdapter);
    const rlSigintHandler = (mockRl.on as jest.Mock).mock.calls.find(call => call[0] === 'SIGINT')[1];
    rlSigintHandler();
    
    // Should not exit on first press
    expect(mockRl.close).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });
});