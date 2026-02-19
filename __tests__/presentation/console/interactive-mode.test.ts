import { onLine, gracefulShutdown, setupExitHandlers } from '@/presentation/console/interactive-mode';
import { Session } from '@/core/agent/session';
import { TerminalAdapter } from '@/presentation/console/terminal-adapter';

// Mock dependencies
jest.mock('@/core/agent/session');
jest.mock('@/presentation/console/terminal-adapter');
jest.mock('@/presentation/console/user-input-handler', () => ({
  handleUserInput: jest.fn()
}));
jest.mock('@/presentation/console/command-handlers', () => ({
  createHandleInternalCommand: jest.fn().mockReturnValue(jest.fn())
}));

describe('Interactive Mode Functions', () => {
  let mockSession: jest.Mocked<Session>;
  let mockHandleInternalCommand: jest.Mock;
  let mockAgent: any;

  beforeEach(() => {
    mockSession = new Session(null as any, {}) as jest.Mocked<Session>;
    mockHandleInternalCommand = jest.fn();
    mockAgent = {};
    
    // Mock session methods
    mockSession.requestUserInput = jest.fn();
    mockSession.addToHistory = jest.fn();
    mockSession.isVoiceRecordingActive = jest.fn().mockReturnValue(false);
    mockSession.getVoiceASR = jest.fn().mockReturnValue(null);
    mockSession.setVoiceRecording = jest.fn();
    mockSession.end = jest.fn();
    mockSession.isRunning = false;
    mockSession.abortController = null;
  });

  describe('onLine', () => {
    it('should handle internal commands (starting with /)', async () => {
      const handler = onLine(mockSession, mockHandleInternalCommand, mockAgent);
      await handler('/help');
      
      expect(mockHandleInternalCommand).toHaveBeenCalledWith('/help');
      expect(mockSession.requestUserInput).toHaveBeenCalled();
    });

    it('should handle empty input', async () => {
      const handler = onLine(mockSession, mockHandleInternalCommand, mockAgent);
      await handler('');
      
      expect(mockSession.requestUserInput).toHaveBeenCalled();
      expect(mockHandleInternalCommand).not.toHaveBeenCalled();
      expect(mockSession.addToHistory).not.toHaveBeenCalled();
    });

    it('should handle user queries', async () => {
      const handler = onLine(mockSession, mockHandleInternalCommand, mockAgent);
      await handler('Hello world');
      
      expect(mockSession.addToHistory).toHaveBeenCalledWith('Hello world');
      expect(mockSession.requestUserInput).not.toHaveBeenCalled();
      expect(mockHandleInternalCommand).not.toHaveBeenCalled();
    });
  });

  describe('gracefulShutdown', () => {
    it('should handle shutdown without active voice recording', () => {
      gracefulShutdown(mockSession);
      
      expect(mockSession.end).toHaveBeenCalledWith('SIGINT');
      expect(mockSession.getVoiceASR).not.toHaveBeenCalled();
    });

    it('should handle shutdown with active voice recording', () => {
      const mockASR = { stopManualRecording: jest.fn().mockResolvedValue(undefined) };
      mockSession.isVoiceRecordingActive.mockReturnValue(true);
      mockSession.getVoiceASR.mockReturnValue(mockASR as any);
      
      gracefulShutdown(mockSession);
      
      expect(mockASR.stopManualRecording).toHaveBeenCalled();
      expect(mockSession.setVoiceRecording).toHaveBeenCalledWith(false, null);
      expect(mockSession.end).toHaveBeenCalledWith('SIGINT');
    });
  });

  describe('setupExitHandlers', () => {
    it('should set up SIGINT and SIGTERM handlers', () => {
      const processOnSpy = jest.spyOn(process, 'on');
      const mockTerminalAdapter = new TerminalAdapter() as jest.Mocked<TerminalAdapter>;
      
      setupExitHandlers(mockSession, mockTerminalAdapter);
      
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });
  });
});