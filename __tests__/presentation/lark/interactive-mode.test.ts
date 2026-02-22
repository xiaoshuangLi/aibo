import { Session } from '@/core/agent/session';
import { createAIAgent } from '@/core/agent/agent-factory';
import {
  startLarkInteractiveMode,
  handleUserMessage,
  shouldExitInteractiveMode,
  isEmptyInput
} from '@/presentation/lark/interactive-mode';
import { createHandleInternalCommand } from '@/presentation/lark/command-handlers';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
console.log = mockConsoleLog;
console.error = mockConsoleError;

// Mock process methods
const originalProcessOn = process.on;
const originalProcessExit = process.exit;
const mockProcessOn = jest.fn();
const mockProcessExit = jest.fn();
process.on = mockProcessOn;
process.exit = mockProcessExit as any;

// Mock LarkAdapter
jest.mock('@/presentation/lark/lark-adapter', () => {
  return {
    LarkAdapter: jest.fn().mockImplementation(() => ({
      setUserMessageCallback: jest.fn(),
      // Add other methods if needed
    }))
  };
});

// Mock agent factory
jest.mock('@/core/agent/agent-factory', () => ({
  createAIAgent: jest.fn()
}));

// Mock stream handler
jest.mock('@/core/utils/stream-handler', () => ({
  processStreamChunks: jest.fn()
}));

// Mock command handlers
jest.mock('@/presentation/lark/command-handlers', () => ({
  createHandleInternalCommand: jest.fn()
}));

describe('Lark Interactive Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessOn.mockClear();
    mockProcessExit.mockClear();
  });

  describe('shouldExitInteractiveMode', () => {
    it('should return true for exit commands', () => {
      const exitCommands = ['exit', 'quit', 'bye', '再见', '退出', '拜拜'];
      
      exitCommands.forEach(command => {
        expect(shouldExitInteractiveMode(command)).toBe(true);
        expect(shouldExitInteractiveMode(`  ${command}  `)).toBe(true);
        expect(shouldExitInteractiveMode(command.toUpperCase())).toBe(true);
      });
    });

    it('should return false for non-exit commands', () => {
      const nonExitCommands = ['hello', 'help', '/help', 'continue', 'test'];
      
      nonExitCommands.forEach(command => {
        expect(shouldExitInteractiveMode(command)).toBe(false);
      });
    });
  });

  describe('isEmptyInput', () => {
    it('should return true for empty or whitespace-only input', () => {
      expect(isEmptyInput('')).toBe(true);
      expect(isEmptyInput('   ')).toBe(true);
      expect(isEmptyInput('\t\n\r')).toBe(true);
    });

    it('should return false for non-empty input', () => {
      expect(isEmptyInput('hello')).toBe(false);
      expect(isEmptyInput(' hello ')).toBe(false);
      expect(isEmptyInput('123')).toBe(false);
    });
  });

  describe('handleUserMessage', () => {
    let mockSession: any;
    let mockAgent: any;

    beforeEach(() => {
      mockSession = {
        threadId: 'test-session',
        isRunning: false,
        abortController: null,
        end: jest.fn()
      };
      
      mockAgent = {
        stream: jest.fn()
      };
      
      // Mock createHandleInternalCommand to return a function that returns true
      (createHandleInternalCommand as jest.Mock).mockImplementation(() => 
        jest.fn().mockResolvedValue(true)
      );
      
      // Mock processStreamChunks
      require('@/core/utils/stream-handler').processStreamChunks.mockResolvedValue(undefined);
    });

    it('should end session and return when exit command is detected', async () => {
      await handleUserMessage('exit', mockSession, mockAgent);
      
      expect(mockSession.end).toHaveBeenCalledWith('再见！');
      expect(mockAgent.stream).not.toHaveBeenCalled();
    });

    it('should return early when input is empty', async () => {
      await handleUserMessage('', mockSession, mockAgent);
      await handleUserMessage('   ', mockSession, mockAgent);
      
      expect(mockSession.end).not.toHaveBeenCalled();
      expect(mockAgent.stream).not.toHaveBeenCalled();
    });

    it('should handle internal commands and return early', async () => {
      await handleUserMessage('/help', mockSession, mockAgent);
      
      expect(createHandleInternalCommand).toHaveBeenCalledWith(mockSession);
      expect(mockAgent.stream).not.toHaveBeenCalled();
    });

    it('should process user message through AI agent when not a command', async () => {
      const testMessage = 'Hello, how are you?';
      mockAgent.stream.mockResolvedValue('test-stream');
      
      await handleUserMessage(testMessage, mockSession, mockAgent);
      
      expect(mockAgent.stream).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: testMessage }] },
        expect.objectContaining({
          configurable: { thread_id: 'test-session' },
          modelKwargs: { enable_thinking: true }
        })
      );
      expect(require('@/core/utils/stream-handler').processStreamChunks).toHaveBeenCalled();
    });

    // it('should handle errors during message processing', async () => {
    //   const testMessage = 'Hello';
    //   const testError = new Error('Test error');
    //   mockAgent.stream.mockRejectedValue(testError);
    //   
    //   // Mock processStreamChunks to throw the error
    //   const originalProcessStreamChunks = require('@/core/utils/stream-handler').processStreamChunks;
    //   jest.spyOn(require('@/core/utils/stream-handler'), 'processStreamChunks').mockRejectedValue(testError);
    //   
    //   // The function should handle the error internally and not throw
    //   await expect(handleUserMessage(testMessage, mockSession, mockAgent)).resolves.toBeUndefined();
    //   
    //   expect(mockConsoleError).toHaveBeenCalledWith('❌ 处理用户消息时出错:', testError);
    //   expect(mockSession.isRunning).toBe(false);
    //   
    //   // Restore original function
    //   jest.restoreAllMocks();
    // });

    it('should create new AbortController after processing', async () => {
      const originalAbortController = mockSession.abortController;
      await handleUserMessage('test', mockSession, mockAgent);
      
      expect(mockSession.abortController).not.toBe(originalAbortController);
      expect(mockSession.abortController).toBeDefined();
    });
  });

  describe('startLarkInteractiveMode', () => {
    it('should initialize Lark adapter and start interactive mode', async () => {
      // Just test that the function doesn't throw an error
      const LarkAdapterMock = require('@/presentation/lark/lark-adapter').LarkAdapter;
      LarkAdapterMock.mockImplementation(() => ({
        setUserMessageCallback: jest.fn()
      }));
      
      (createAIAgent as jest.Mock).mockResolvedValue({ stream: jest.fn() });
      
      await expect(startLarkInteractiveMode()).resolves.toBeUndefined();
    });

    it('should handle startup errors and exit with code 1', async () => {
      const LarkAdapterMock = require('@/presentation/lark/lark-adapter').LarkAdapter;
      LarkAdapterMock.mockImplementation(() => {
        throw new Error('Lark initialization failed');
      });
      
      await startLarkInteractiveMode();
      
      expect(mockConsoleError).toHaveBeenCalledWith('❌ 启动飞书交互模式失败:', expect.any(Error));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  // Restore original functions after all tests
  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });
});