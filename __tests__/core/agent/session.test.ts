import { Session } from '@/core/agent/session';
import { IOChannel } from '@/core/agent/io-channel';
import { SessionManager } from '@/infrastructure/session/session-manager';

// Mock IOChannel
const mockIOChannel = {
  emit: jest.fn().mockResolvedValue(undefined),
  requestUserInput: jest.fn().mockResolvedValue('test input'),
  setAbortSignal: jest.fn(),
  destroy: jest.fn()
} as unknown as IOChannel;

// Mock createConsoleThreadId
jest.mock('@/core/utils/interactive-logic', () => ({
  createConsoleThreadId: jest.fn().mockReturnValue('test-thread-id')
}));

// Mock SessionManager to return the mocked thread ID
jest.mock('@/infrastructure/session/session-manager', () => {
  const mockSessionManager = {
    getInstance: jest.fn().mockReturnValue({
      getCurrentSessionId: jest.fn().mockReturnValue('test-thread-id')
    })
  };
  return { SessionManager: mockSessionManager };
});

// Mock config
jest.mock('@/core/config/config', () => ({
  config: {
    openai: {
      modelName: 'gpt-4o-mini'
    }
  }
}));



// Helper to reset SessionManager singleton
const resetSessionManager = () => {
  (SessionManager as any).instance = null;
};

describe('Session', () => {
  let session: Session;
  let ioChannel: IOChannel;

  beforeEach(() => {
    ioChannel = mockIOChannel;
    jest.clearAllMocks();
    resetSessionManager(); // Reset singleton before each test
    session = new Session(ioChannel, { threadId: 'test-session', modelInfo: 'test-model' });
  });

  describe('constructor', () => {
    test('should initialize with provided options', () => {
      expect(session.threadId).toBe('test-session');
      expect(ioChannel.setAbortSignal).toHaveBeenCalled();
    });

    test('should use default values when options not provided', () => {
      const defaultSession = new Session(ioChannel);
      expect(defaultSession.threadId).toBe('test-thread-id');
    });
  });

  describe('start', () => {
    test('should emit sessionStart event', async () => {
      await session.start();
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sessionStart',
          data: { modelInfo: 'test-model' }
        })
      );
    });
  });

  describe('end', () => {
    test('should emit sessionEnd event and destroy ioChannel', async () => {
      await session.end('Goodbye!');
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sessionEnd',
          data: { exitMessage: 'Goodbye!' }
        })
      );
      expect(ioChannel.destroy).toHaveBeenCalled();
    });

    test('should use default exit message', async () => {
      await session.end();
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sessionEnd',
          data: { exitMessage: '再见！' }
        })
      );
    });
  });

  describe('requestUserInput', () => {
    test('should call ioChannel.requestUserInput', () => {
      session.requestUserInput('Enter command: ');
      expect(ioChannel.requestUserInput).toHaveBeenCalledWith('Enter command: ');
    });

    test('should not call ioChannel.requestUserInput when session is running', () => {
      session.isRunning = true;
      session.requestUserInput('Enter command: ');
      expect(ioChannel.requestUserInput).not.toHaveBeenCalled();
    });
  });

  describe('addToHistory', () => {
    test('should add command to history', () => {
      session.addToHistory('ls -la');
      expect(session.getCommandHistory()).toEqual(['ls -la']);
    });

    test('should update history index', () => {
      session.addToHistory('command1');
      session.addToHistory('command2');
      expect(session.getCommandHistory()).toEqual(['command1', 'command2']);
    });
  });

  describe('getCommandHistory', () => {
    test('should return a copy of command history', () => {
      session.addToHistory('command1');
      const history = session.getCommandHistory();
      history.push('command2');
      expect(session.getCommandHistory()).toEqual(['command1']);
    });
  });

  describe('setVoiceRecording', () => {
    test('should set voice recording state', () => {
      const mockASR = { start: jest.fn() };
      session.setVoiceRecording(true, mockASR);
      expect(session.isVoiceRecordingActive()).toBe(true);
      expect(session.getVoiceASR()).toBe(mockASR);
    });

    test('should set voice recording state without ASR', () => {
      session.setVoiceRecording(false);
      expect(session.isVoiceRecordingActive()).toBe(false);
      expect(session.getVoiceASR()).toBeNull();
    });
  });

  describe('isVoiceRecordingActive', () => {
    test('should return current voice recording state', () => {
      expect(session.isVoiceRecordingActive()).toBe(false);
      session.setVoiceRecording(true);
      expect(session.isVoiceRecordingActive()).toBe(true);
    });
  });

  describe('getVoiceASR', () => {
    test('should return current voice ASR instance', () => {
      expect(session.getVoiceASR()).toBeNull();
      const mockASR = { start: jest.fn() };
      session.setVoiceRecording(true, mockASR);
      expect(session.getVoiceASR()).toBe(mockASR);
    });
  });

  describe('logToolCall', () => {
    test('should emit toolCall event with structured data', () => {
      session.logToolCall('testTool', { param: 'value' });
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'toolCall',
          data: { name: 'testTool', args: { param: 'value' } }
        })
      );
    });
  });

  describe('logToolResult', () => {
    test('should emit toolResult event with structured data', () => {
      session.logToolResult('testTool', true, 'preview');
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'toolResult',
          data: { name: 'testTool', success: true, preview: 'preview' }
        })
      );
    });
  });

  describe('logThinkingProcess', () => {
    test('should emit thinkingProcess event with structured data', () => {
      const steps = [
        { content: 'step 1' },
        { content: 'step 2', status: 'completed' }
      ];
      session.logThinkingProcess(steps);
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'thinkingProcess',
          data: { steps }
        })
      );
    });
  });

  describe('streamAIContent', () => {
    test('should handle initial empty content', async () => {
      await session.streamAIContent('', true, false);
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamStart',
          data: { placeholder: "..." }
        })
      );
    });

    test('should handle content streaming', async () => {
      await session.streamAIContent('Hello', false, false);
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamChunk',
          data: { chunk: 'Hello' }
        })
      );
    });

    test('should handle final content without period', async () => {
      await session.streamAIContent('Hello world', false, true);
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamEnd',
          data: { finalContent: 'Hello world' }
        })
      );
    });

    test('should not add streamEnd for content ending with period', async () => {
      await session.streamAIContent('Hello world.', false, true);
      // Should not call streamEnd
      const streamEndCalls = (ioChannel.emit as jest.Mock).mock.calls
        .filter(call => call[0].type === 'streamEnd');
      expect(streamEndCalls).toHaveLength(0);
    });
  });

  describe('logSystemMessage', () => {
    test('should emit systemMessage event with structured data', () => {
      session.logSystemMessage('System message');
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'systemMessage',
          data: { message: 'System message' }
        })
      );
    });
  });

  describe('logErrorMessage', () => {
    test('should emit errorMessage event with structured data', () => {
      session.logErrorMessage('Error message');
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'errorMessage',
          data: { message: 'Error message' }
        })
      );
    });
  });

  describe('logRawText', () => {
    test('should emit rawText event', () => {
      session.logRawText('Raw text');
      expect(ioChannel.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rawText',
          data: { text: 'Raw text' }
        })
      );
    });
  });

  describe('destroy', () => {
    test('should abort controller and destroy ioChannel', () => {
      const abortSpy = jest.spyOn(session.abortController!, 'abort');
      session.destroy();
      expect(abortSpy).toHaveBeenCalled();
      expect(ioChannel.destroy).toHaveBeenCalled();
      expect(session.abortController).toBeNull();
    });

    test('should handle null abortController', () => {
      session.abortController = null;
      session.destroy();
      expect(ioChannel.destroy).toHaveBeenCalled();
    });
  });
});