import { config } from '@/core/config/config';
import { SessionManager } from '@/infrastructure/session/session-manager';
import {
  handleHelpCommand,
  handleVerboseCommand,
  handleNewCommand,
  handleAbortCommand,
  handleExitCommand,
  handleUnknownCommand,
  createHandleInternalCommand
} from '@/presentation/lark/command-handlers';

// Mock console.log to prevent actual output during tests
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

// Mock process.exit to prevent actual process termination
const originalProcessExit = process.exit;
const mockProcessExit = jest.fn();
process.exit = mockProcessExit as any;

// Mock styled system
jest.mock('@/presentation/styling/output-styler', () => ({
  styled: {
    system: jest.fn((msg) => msg),
    error: jest.fn((msg) => msg)
  }
}));

// Mock SessionManager
jest.mock('@/infrastructure/session/session-manager', () => {
  return {
    SessionManager: {
      getInstance: jest.fn(() => ({
        clearCurrentSession: jest.fn(() => 'new-session-id')
      }))
    }
  };
});

describe('Lark Command Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    
    // Reset config to default state
    config.output.verbose = false;
  });

  describe('handleHelpCommand', () => {
    it('should display help message and return true', async () => {
      const result = await handleHelpCommand();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('可用命令'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/help'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/exit'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/verbose'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/new'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/abort'));
    });
  });

  describe('handleVerboseCommand', () => {
    it('should toggle verbose mode from false to true', async () => {
      // Initial state: verbose = false
      expect(config.output.verbose).toBe(false);
      
      const result = await handleVerboseCommand();
      
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('详细模式'));
    });

    it('should toggle verbose mode from true to false', async () => {
      // Set initial state to true
      config.output.verbose = true;
      expect(config.output.verbose).toBe(true);
      
      const result = await handleVerboseCommand();
      
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('简略模式'));
    });
  });

  describe('handleNewCommand', () => {
    it('should create new session and return true', async () => {
      const mockSession = {
        threadId: 'old-session-id',
        ioChannel: {
          emit: jest.fn()
        }
      };

      const result = await handleNewCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockSession.threadId).toBe('new-session-id');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('已创建新会话'));
      expect(mockSession.ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/new',
            result: expect.objectContaining({
              success: true,
              sessionId: 'new-session-id'
            })
          })
        })
      );
    });
  });

  describe('handleAbortCommand', () => {
    it('should abort current operation when abortController exists and is not aborted', async () => {
      const mockAbortController = {
        signal: { aborted: false },
        abort: jest.fn()
      };
      const mockSession = {
        abortController: mockAbortController,
        ioChannel: {
          emit: jest.fn()
        }
      };

      const result = await handleAbortCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockAbortController.abort).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('当前操作已中断'));
      expect(mockSession.ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/abort',
            result: expect.objectContaining({
              success: true,
              message: '🔄 当前操作已中断'
            })
          })
        })
      );
    });

    it('should show no operation message when no abortController exists', async () => {
      const mockSession = {
        abortController: null,
        ioChannel: {
          emit: jest.fn()
        }
      };

      const result = await handleAbortCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('没有正在进行的操作'));
      expect(mockSession.ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/abort',
            result: expect.objectContaining({
              success: false,
              message: 'ℹ️ 没有正在进行的操作'
            })
          })
        })
      );
    });

    it('should show no operation message when abortController is already aborted', async () => {
      const mockAbortController = {
        signal: { aborted: true },
        abort: jest.fn()
      };
      const mockSession = {
        abortController: mockAbortController,
        ioChannel: {
          emit: jest.fn()
        }
      };

      const result = await handleAbortCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockAbortController.abort).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('没有正在进行的操作'));
      expect(mockSession.ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/abort',
            result: expect.objectContaining({
              success: false,
              message: 'ℹ️ 没有正在进行的操作'
            })
          })
        })
      );
    });
  });

  describe('handleExitCommand', () => {
    it('should log exit message, end session, and call process.exit', async () => {
      const mockSession = {
        end: jest.fn()
      };

      // This should not actually return because process.exit is called
      await handleExitCommand(mockSession as any);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('正在安全退出'));
      expect(mockSession.end).toHaveBeenCalledWith();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('handleUnknownCommand', () => {
    it('should display unknown command error and return true', async () => {
      const unknownCommand = '/unknown';
      const result = await handleUnknownCommand(unknownCommand);
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`未知命令: ${unknownCommand}`));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('输入 /help 查看可用命令'));
    });
  });

  describe('createHandleInternalCommand', () => {
    let mockSession: any;
    let handleCommand: (command: string) => Promise<boolean>;

    beforeEach(() => {
      mockSession = {
        threadId: 'test-session-id',
        ioChannel: {
          emit: jest.fn()
        },
        end: jest.fn(),
        abortController: {
          signal: { aborted: false },
          abort: jest.fn()
        }
      };
      handleCommand = createHandleInternalCommand(mockSession);
    });

    it('should handle /help command', async () => {
      const result = await handleCommand('/help');
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('可用命令'));
    });

    it('should handle /verbose command', async () => {
      const result = await handleCommand('/verbose');
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(true);
    });

    it('should handle /new command', async () => {
      const result = await handleCommand('/new');
      expect(result).toBe(true);
      expect(mockSession.threadId).toBe('new-session-id');
    });

    it('should handle /abort command', async () => {
      const result = await handleCommand('/abort');
      expect(result).toBe(true);
      expect(mockSession.abortController.abort).toHaveBeenCalled();
    });

    it('should handle /exit command', async () => {
      await handleCommand('/exit');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle /quit command', async () => {
      await handleCommand('/quit');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle /q command', async () => {
      await handleCommand('/q');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle /stop command', async () => {
      await handleCommand('/stop');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle unknown command', async () => {
      const result = await handleCommand('/unknown');
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('未知命令: /unknown'));
    });
  });

  // Restore original functions after all tests
  afterAll(() => {
    console.log = originalConsoleLog;
    process.exit = originalProcessExit;
  });
});