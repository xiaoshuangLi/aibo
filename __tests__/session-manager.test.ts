import { createSessionState, setupExitHandlers, createGracefulShutdownHandler } from '../src/core/session/session-manager';
import { createConsoleThreadId } from '../src/core/session/interactive-logic';

// Mock dependencies
jest.mock('../src/core/session/interactive-logic');
jest.mock('../src/presentation/console/user-input-handler', () => ({
  showPrompt: jest.fn(),
}));

describe('Session Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSessionState', () => {
    test('should create session state with all required properties', () => {
      const mockRl = { on: jest.fn(), close: jest.fn() };
      (createConsoleThreadId as jest.Mock).mockReturnValue('test-thread-id');
      
      const session = createSessionState(mockRl);
      
      expect(session).toEqual({
        threadId: 'test-thread-id',
        isRunning: false,
        abortController: null,
        rl: mockRl,
        commandHistory: [],
        historyIndex: 0,
        isVoiceRecording: false,
        voiceASR: null,
      });
    });
  });

  describe('setupExitHandlers', () => {
    let mockRl: any;
    let mockSession: any;
    let mockGracefulShutdown: any;
    let originalProcessOn: any;
    let processOnMock: jest.Mock;

    beforeEach(() => {
      mockRl = {
        on: jest.fn(),
        close: jest.fn(),
      };
      mockSession = {
        isRunning: false,
        abortController: null,
        isVoiceRecording: false,
        voiceASR: null,
        rl: mockRl,
      };
      mockGracefulShutdown = jest.fn();
      
      // Mock process.on
      originalProcessOn = process.on;
      processOnMock = jest.fn();
      (process.on as any) = processOnMock;
    });

    afterEach(() => {
      (process.on as any) = originalProcessOn;
    });

    test('should register SIGINT and SIGTERM handlers', () => {
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      expect(processOnMock).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnMock).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockRl.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    test('should handle SIGINT with voice recording active', () => {
      const mockVoiceASR = { stopManualRecording: jest.fn().mockResolvedValue(undefined) };
      mockSession.isVoiceRecording = true;
      mockSession.voiceASR = mockVoiceASR;
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      // Get the SIGINT handler
      const sigintHandler = processOnMock.mock.calls.find(call => call[0] === 'SIGINT')[1];
      sigintHandler();
      
      expect(mockVoiceASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.isVoiceRecording).toBe(false);
      expect(mockSession.voiceASR).toBe(null);
      expect(mockGracefulShutdown).toHaveBeenCalledWith('SIGINT');
    });

    test('should handle SIGINT without voice recording', () => {
      mockSession.isVoiceRecording = false;
      mockSession.voiceASR = null;
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      const sigintHandler = processOnMock.mock.calls.find(call => call[0] === 'SIGINT')[1];
      sigintHandler();
      
      expect(mockGracefulShutdown).toHaveBeenCalledWith('SIGINT');
    });

    test('should handle SIGTERM with voice recording active', () => {
      const mockVoiceASR = { stopManualRecording: jest.fn().mockResolvedValue(undefined) };
      mockSession.isVoiceRecording = true;
      mockSession.voiceASR = mockVoiceASR;
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      const sigtermHandler = processOnMock.mock.calls.find(call => call[0] === 'SIGTERM')[1];
      sigtermHandler();
      
      expect(mockVoiceASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.isVoiceRecording).toBe(false);
      expect(mockSession.voiceASR).toBe(null);
      expect(mockGracefulShutdown).toHaveBeenCalledWith('SIGTERM');
    });

    test('should handle SIGTERM without voice recording', () => {
      mockSession.isVoiceRecording = false;
      mockSession.voiceASR = null;
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      const sigtermHandler = processOnMock.mock.calls.find(call => call[0] === 'SIGTERM')[1];
      sigtermHandler();
      
      expect(mockGracefulShutdown).toHaveBeenCalledWith('SIGTERM');
    });

    test('should handle readline SIGINT with running operation', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockSession.isRunning = true;
      mockSession.abortController = { abort: jest.fn() };
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      const rlSigintHandler = mockRl.on.mock.calls[0][1];
      rlSigintHandler();
      
      expect(mockSession.abortController.abort).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('\x1b[33m⚠️  正在中断当前操作... (再次 Ctrl+C 强制退出)\x1b[0m');
      consoleLogSpy.mockRestore();
    });

    test('should handle readline SIGINT with voice recording', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const showPromptSpy = require('../src/presentation/console/user-input-handler').showPrompt;
      const mockVoiceASR = { stopManualRecording: jest.fn().mockResolvedValue(undefined) };
      mockSession.isRunning = false;
      mockSession.isVoiceRecording = true;
      mockSession.voiceASR = mockVoiceASR;
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      const rlSigintHandler = mockRl.on.mock.calls[0][1];
      rlSigintHandler();
      
      expect(mockVoiceASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.isVoiceRecording).toBe(false);
      expect(mockSession.voiceASR).toBe(null);
      expect(consoleLogSpy).toHaveBeenCalledWith('\x1b[36m🎙️ 语音输入已取消\x1b[0m');
      expect(showPromptSpy).toHaveBeenCalledWith(mockSession, mockRl);
      consoleLogSpy.mockRestore();
    });

    test('should handle readline SIGINT with voice recording and stopManualRecording error', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const showPromptSpy = require('../src/presentation/console/user-input-handler').showPrompt;
      const mockVoiceASR = { stopManualRecording: jest.fn().mockRejectedValue(new Error('stop failed')) };
      mockSession.isRunning = false;
      mockSession.isVoiceRecording = true;
      mockSession.voiceASR = mockVoiceASR;
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      const rlSigintHandler = mockRl.on.mock.calls[0][1];
      rlSigintHandler();
      
      expect(mockVoiceASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.isVoiceRecording).toBe(false);
      expect(mockSession.voiceASR).toBe(null);
      expect(consoleLogSpy).toHaveBeenCalledWith('\x1b[36m🎙️ 语音输入已取消\x1b[0m');
      expect(showPromptSpy).toHaveBeenCalledWith(mockSession, mockRl);
      consoleLogSpy.mockRestore();
    });

    test('should handle readline SIGINT with double-press confirmation', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
      const rlCloseSpy = jest.spyOn(mockRl, 'close').mockImplementation();
      
      mockSession.isRunning = false;
      mockSession.isVoiceRecording = false;
      
      setupExitHandlers(mockSession, mockRl, mockGracefulShutdown);
      
      const rlSigintHandler = mockRl.on.mock.calls[0][1];
      
      // First press
      rlSigintHandler();
      expect(consoleLogSpy).toHaveBeenCalledWith('\x1b[36m\n👋 检测到退出请求 (再次 Ctrl+C 确认退出)\x1b[0m');
      
      // Second press within 500ms
      rlSigintHandler();
      expect(consoleLogSpy).toHaveBeenCalledWith('\x1b[36m\n👋 双击确认，立即退出...\x1b[0m');
      expect(rlCloseSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
      
      consoleLogSpy.mockRestore();
      processExitSpy.mockRestore();
      rlCloseSpy.mockRestore();
    });
  });

  describe('createGracefulShutdownHandler', () => {
    test('should create a shutdown handler that closes rl and exits', () => {
      const mockRl = { close: jest.fn() };
      const mockSession = { rl: mockRl };
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      const gracefulShutdown = createGracefulShutdownHandler(mockSession);
      gracefulShutdown('SIGINT');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\n收到 SIGINT 信号，正在安全退出...');
      expect(mockRl.close).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
      
      consoleLogSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });
});