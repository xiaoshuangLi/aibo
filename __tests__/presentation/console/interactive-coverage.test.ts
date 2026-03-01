import { gracefulShutdown, setupExitHandlers } from '@/presentation/console/interactive';
import { Session } from '@/core/agent/session';
import { TerminalAdapter } from '@/presentation/console/adapter';

jest.mock('@/core/agent/factory', () => ({
  createAIAgent: jest.fn().mockResolvedValue({ stream: jest.fn() }),
}));
jest.mock('@/core/agent/session');
jest.mock('@/presentation/console/adapter');
jest.mock('@/presentation/console/input', () => ({
  handleUserInput: jest.fn()
}));
jest.mock('@/presentation/console/commander', () => ({
  createHandleInternalCommand: jest.fn().mockReturnValue(jest.fn())
}));
jest.mock('@/features/voice-input/manager', () => ({
  createKeypressHandler: jest.fn().mockReturnValue(jest.fn())
}));

describe('Interactive Mode - Additional Coverage', () => {
  let mockSession: any;
  let mockTerminalAdapter: any;
  let mockASR: any;
  let processOnSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockASR = {
      stopManualRecording: jest.fn().mockResolvedValue(undefined)
    };

    mockSession = {
      threadId: 'test-thread',
      isRunning: false,
      abortController: null,
      end: jest.fn(),
      start: jest.fn(),
      requestUserInput: jest.fn(),
      addToHistory: jest.fn(),
      isVoiceRecordingActive: jest.fn().mockReturnValue(false),
      getVoiceASR: jest.fn().mockReturnValue(null),
      setVoiceRecording: jest.fn()
    };

    mockTerminalAdapter = {
      rl: {
        on: jest.fn(),
        close: jest.fn(),
        prompt: jest.fn(),
        line: '',
        write: jest.fn()
      },
      destroy: jest.fn()
    };

    processOnSpy = jest.spyOn(process, 'on').mockImplementation(jest.fn());
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(jest.fn() as any);
  });

  afterEach(() => {
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('setupExitHandlers - SIGINT handler', () => {
    it('should call stopManualRecording on SIGINT when voice ASR is active', () => {
      mockSession.getVoiceASR.mockReturnValue(mockASR);
      mockSession.isVoiceRecordingActive.mockReturnValue(true);

      let sigintHandler: Function = () => {};
      processOnSpy.mockImplementation((event: string, handler: Function) => {
        if (event === 'SIGINT') sigintHandler = handler;
        return process;
      });

      setupExitHandlers(mockSession, mockTerminalAdapter);
      sigintHandler();

      expect(mockASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.setVoiceRecording).toHaveBeenCalledWith(false, null);
    });

    it('should handle error in stopManualRecording gracefully on SIGINT', () => {
      mockASR.stopManualRecording = jest.fn().mockRejectedValue(new Error('ASR error'));
      mockSession.getVoiceASR.mockReturnValue(mockASR);
      mockSession.isVoiceRecordingActive.mockReturnValue(true);

      let sigintHandler: Function = () => {};
      processOnSpy.mockImplementation((event: string, handler: Function) => {
        if (event === 'SIGINT') sigintHandler = handler;
        return process;
      });

      setupExitHandlers(mockSession, mockTerminalAdapter);
      // Should not throw
      expect(() => sigintHandler()).not.toThrow();
      expect(mockSession.setVoiceRecording).toHaveBeenCalledWith(false, null);
    });

    it('should call gracefulShutdown when no voice recording on SIGINT', () => {
      mockSession.isVoiceRecordingActive.mockReturnValue(false);
      mockSession.getVoiceASR.mockReturnValue(null);

      let sigintHandler: Function = () => {};
      processOnSpy.mockImplementation((event: string, handler: Function) => {
        if (event === 'SIGINT') sigintHandler = handler;
        return process;
      });

      setupExitHandlers(mockSession, mockTerminalAdapter);
      sigintHandler();

      expect(mockSession.end).toHaveBeenCalledWith('SIGINT');
    });
  });

  describe('setupExitHandlers - SIGTERM handler', () => {
    it('should call stopManualRecording on SIGTERM when voice ASR is active', () => {
      mockSession.getVoiceASR.mockReturnValue(mockASR);
      mockSession.isVoiceRecordingActive.mockReturnValue(true);

      let sigtermHandler: Function = () => {};
      processOnSpy.mockImplementation((event: string, handler: Function) => {
        if (event === 'SIGTERM') sigtermHandler = handler;
        return process;
      });

      setupExitHandlers(mockSession, mockTerminalAdapter);
      sigtermHandler();

      expect(mockASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.setVoiceRecording).toHaveBeenCalledWith(false, null);
    });

    it('should handle error in stopManualRecording gracefully on SIGTERM', () => {
      mockASR.stopManualRecording = jest.fn().mockImplementation(() => {
        throw new Error('ASR error');
      });
      mockSession.getVoiceASR.mockReturnValue(mockASR);
      mockSession.isVoiceRecordingActive.mockReturnValue(true);

      let sigtermHandler: Function = () => {};
      processOnSpy.mockImplementation((event: string, handler: Function) => {
        if (event === 'SIGTERM') sigtermHandler = handler;
        return process;
      });

      setupExitHandlers(mockSession, mockTerminalAdapter);
      expect(() => sigtermHandler()).not.toThrow();
      expect(mockSession.setVoiceRecording).toHaveBeenCalledWith(false, null);
    });

    it('should call gracefulShutdown without voice recording on SIGTERM', () => {
      mockSession.isVoiceRecordingActive.mockReturnValue(false);

      let sigtermHandler: Function = () => {};
      processOnSpy.mockImplementation((event: string, handler: Function) => {
        if (event === 'SIGTERM') sigtermHandler = handler;
        return process;
      });

      setupExitHandlers(mockSession, mockTerminalAdapter);
      sigtermHandler();

      expect(mockSession.end).toHaveBeenCalledWith('SIGINT');
    });
  });

  describe('setupExitHandlers - rl SIGINT handler branches', () => {
    it('should abort current operation when isRunning and has abortController', () => {
      const abortController = new AbortController();
      mockSession.isRunning = true;
      mockSession.abortController = abortController;

      let rlSigintHandler: Function = () => {};
      mockTerminalAdapter.rl = {
        on: jest.fn().mockImplementation((event: string, handler: Function) => {
          if (event === 'SIGINT') rlSigintHandler = handler;
        }),
        close: jest.fn(),
        prompt: jest.fn()
      };

      processOnSpy.mockReturnValue(process as any);

      setupExitHandlers(mockSession, mockTerminalAdapter);
      rlSigintHandler();

      expect(abortController.signal.aborted).toBe(true);
      expect(mockSession.isRunning).toBe(false);
    });

    it('should cancel voice recording via rl SIGINT when voice recording is active', () => {
      mockSession.isRunning = false;
      mockSession.abortController = null;
      mockSession.isVoiceRecordingActive.mockReturnValue(true);
      mockSession.getVoiceASR.mockReturnValue(mockASR);

      let rlSigintHandler: Function = () => {};
      mockTerminalAdapter.rl = {
        on: jest.fn().mockImplementation((event: string, handler: Function) => {
          if (event === 'SIGINT') rlSigintHandler = handler;
        }),
        close: jest.fn(),
        prompt: jest.fn()
      };

      processOnSpy.mockReturnValue(process as any);

      setupExitHandlers(mockSession, mockTerminalAdapter);
      rlSigintHandler();

      expect(mockASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.setVoiceRecording).toHaveBeenCalledWith(false, null);
      expect(mockSession.requestUserInput).toHaveBeenCalled();
    });

    it('should handle error in voice ASR stop via rl SIGINT gracefully', () => {
      mockSession.isRunning = false;
      mockSession.abortController = null;
      mockSession.isVoiceRecordingActive.mockReturnValue(true);
      mockASR.stopManualRecording = jest.fn().mockRejectedValue(new Error('error'));
      mockSession.getVoiceASR.mockReturnValue(mockASR);

      let rlSigintHandler: Function = () => {};
      mockTerminalAdapter.rl = {
        on: jest.fn().mockImplementation((event: string, handler: Function) => {
          if (event === 'SIGINT') rlSigintHandler = handler;
        }),
        close: jest.fn(),
        prompt: jest.fn()
      };

      processOnSpy.mockReturnValue(process as any);

      setupExitHandlers(mockSession, mockTerminalAdapter);
      expect(() => rlSigintHandler()).not.toThrow();
    });

    it('should exit on double ctrl+c via rl SIGINT', () => {
      mockSession.isRunning = false;
      mockSession.abortController = null;
      mockSession.isVoiceRecordingActive.mockReturnValue(false);

      let rlSigintHandler: Function = () => {};
      mockTerminalAdapter.rl = {
        on: jest.fn().mockImplementation((event: string, handler: Function) => {
          if (event === 'SIGINT') rlSigintHandler = handler;
        }),
        close: jest.fn(),
        prompt: jest.fn()
      };

      processOnSpy.mockReturnValue(process as any);

      setupExitHandlers(mockSession, mockTerminalAdapter);
      
      // First press - should show "再次 Ctrl+C" message
      rlSigintHandler();
      
      // Wait and then second press within 500ms interval - simulate by calling quickly
      // Override Date.now to simulate quick double-press
      const originalDateNow = Date.now;
      const firstPressTime = Date.now();
      let callCount = 0;
      Date.now = jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? firstPressTime + 1 : firstPressTime + 200;
      });
      
      // Second press within 500ms should trigger exit
      rlSigintHandler();
      
      Date.now = originalDateNow;
    });
  });

  describe('gracefulShutdown - error handling', () => {
    it('should handle stopManualRecording throwing error', () => {
      mockSession.isVoiceRecordingActive.mockReturnValue(true);
      mockSession.getVoiceASR.mockReturnValue({
        stopManualRecording: jest.fn().mockImplementation(() => {
          throw new Error('Recording stop error');
        })
      });

      // Should not throw
      expect(() => gracefulShutdown(mockSession)).not.toThrow();
      expect(mockSession.end).toHaveBeenCalledWith('SIGINT');
    });
  });
});
