import { Session } from '@/core/agent/session';
import { Adapter } from '@/core/agent/adapter';
import { SessionManager } from '@/infrastructure/session/session-manager';

// Mock Adapter
const mockAdapter = {
  emit: jest.fn().mockResolvedValue(undefined),
  requestUserInput: jest.fn().mockResolvedValue('test input'),
  setAbortSignal: jest.fn(),
  destroy: jest.fn()
} as unknown as Adapter;

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
  let adapter: Adapter;

  beforeEach(() => {
    adapter = mockAdapter;
    jest.clearAllMocks();
    resetSessionManager(); // Reset singleton before each test
    session = new Session(adapter, { threadId: 'test-session', modelInfo: 'test-model' });
  });

  describe('constructor', () => {
    test('should initialize with provided options', () => {
      expect(session.threadId).toBe('test-session');
      expect(adapter.setAbortSignal).toHaveBeenCalled();
    });

    test('should use default values when options not provided', () => {
      const defaultSession = new Session(adapter);
      expect(defaultSession.threadId).toBe('test-thread-id');
    });
  });

  describe('start', () => {
    test('should emit sessionStart event', async () => {
      await session.start();
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sessionStart',
          data: { modelInfo: 'test-model' }
        })
      );
    });
  });

  describe('end', () => {
    test('should emit sessionEnd event and destroy adapter', async () => {
      await session.end('Goodbye!');
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sessionEnd',
          data: { exitMessage: 'Goodbye!' }
        })
      );
      expect(adapter.destroy).toHaveBeenCalled();
    });

    test('should use default exit message', async () => {
      await session.end();
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sessionEnd',
          data: { exitMessage: '再见！' }
        })
      );
    });
  });

  describe('requestUserInput', () => {
    test('should call adapter.requestUserInput', () => {
      session.requestUserInput('Enter command: ');
      expect(adapter.requestUserInput).toHaveBeenCalledWith('Enter command: ');
    });

    test('should not call adapter.requestUserInput when session is running', () => {
      session.isRunning = true;
      session.requestUserInput('Enter command: ');
      expect(adapter.requestUserInput).not.toHaveBeenCalled();
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
      expect(adapter.emit).toHaveBeenCalledWith(
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
      expect(adapter.emit).toHaveBeenCalledWith(
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
      expect(adapter.emit).toHaveBeenCalledWith(
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
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamStart',
          data: { placeholder: "..." }
        })
      );
    });

    test('should handle content streaming', async () => {
      await session.streamAIContent('Hello', false, false);
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamChunk',
          data: { chunk: 'Hello' }
        })
      );
    });

    test('should handle final content without period', async () => {
      await session.streamAIContent('Hello world', false, true);
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamEnd',
          data: { finalContent: 'Hello world' }
        })
      );
    });

    test('should not add streamEnd for content ending with period', async () => {
      await session.streamAIContent('Hello world.', false, true);
      // Should not call streamEnd
      const streamEndCalls = (adapter.emit as jest.Mock).mock.calls
        .filter(call => call[0].type === 'streamEnd');
      expect(streamEndCalls).toHaveLength(0);
    });
  });

  describe('logSystemMessage', () => {
    test('should emit systemMessage event with structured data', () => {
      session.logSystemMessage('System message');
      expect(adapter.emit).toHaveBeenCalledWith(
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
      expect(adapter.emit).toHaveBeenCalledWith(
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
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rawText',
          data: { text: 'Raw text' }
        })
      );
    });
  });

  describe('destroy', () => {
    test('should abort controller and destroy adapter', () => {
      const abortSpy = jest.spyOn(session.abortController!, 'abort');
      session.destroy();
      expect(abortSpy).toHaveBeenCalled();
      expect(adapter.destroy).toHaveBeenCalled();
      expect(session.abortController).toBeNull();
    });

    test('should handle null abortController', () => {
      session.abortController = null;
      session.destroy();
      expect(adapter.destroy).toHaveBeenCalled();
    });
  });
});