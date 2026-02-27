import { handleUserInput } from '@/presentation/console/user-input-handler';
import { Session } from '@/core/agent/session';

// Mock dependencies
jest.mock('@/core/utils/interactive-logic', () => ({
  shouldExitInteractiveMode: jest.fn(),
  isEmptyInput: jest.fn(),
}));

jest.mock('@/core/utils/stream-handler', () => ({
  processStreamChunks: jest.fn(),
}));

describe('UserInputHandler - Comprehensive Tests', () => {
  let mockSession: any;
  let mockAgent: any;

  beforeEach(() => {
    mockSession = {
      end: jest.fn(),
      requestUserInput: jest.fn(),
      isRunning: false,
      threadId: 'test-thread',
      abortController: new AbortController(),
    };
    
    mockAgent = {
      stream: jest.fn().mockResolvedValue({}),
    };
    
    // Reset mocks
    require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReset();
    require('@/core/utils/interactive-logic').isEmptyInput.mockReset();
    require('@/core/utils/stream-handler').processStreamChunks.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exit command handling', () => {
    it('should handle exit commands properly', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(true);
      
      await handleUserInput('exit', mockSession, mockAgent);
      
      expect(mockSession.end).toHaveBeenCalledWith('再见！');
      expect(mockSession.requestUserInput).not.toHaveBeenCalled();
      expect(mockAgent.stream).not.toHaveBeenCalled();
    });
  });

  describe('empty input handling', () => {
    it('should handle empty inputs', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(false);
      require('@/core/utils/interactive-logic').isEmptyInput.mockReturnValue(true);
      
      await handleUserInput('', mockSession, mockAgent);
      
      expect(mockSession.requestUserInput).toHaveBeenCalled();
      expect(mockSession.end).not.toHaveBeenCalled();
      expect(mockAgent.stream).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only inputs', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(false);
      require('@/core/utils/interactive-logic').isEmptyInput.mockReturnValue(true);
      
      await handleUserInput('   ', mockSession, mockAgent);
      
      expect(mockSession.requestUserInput).toHaveBeenCalled();
    });
  });

  describe('valid input processing', () => {
    it('should process valid user input correctly', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(false);
      require('@/core/utils/interactive-logic').isEmptyInput.mockReturnValue(false);
      
      const mockStream = {};
      mockAgent.stream.mockReturnValue(mockStream);
      require('@/core/utils/stream-handler').processStreamChunks.mockResolvedValue('final response');
      
      await handleUserInput('Hello, how are you?', mockSession, mockAgent);
      
      // Verify agent stream was called with correct parameters
      expect(mockAgent.stream).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: 'Hello, how are you?' }] },
        expect.objectContaining({
          configurable: { thread_id: 'test-thread' },
          modelKwargs: { enable_thinking: true },
        })
      );
      
      // Verify processStreamChunks was called
      expect(require('@/core/utils/stream-handler').processStreamChunks).toHaveBeenCalledWith(
        mockStream,
        expect.objectContaining({
          fullResponse: '',
          hasDisplayedThinking: false,
        }),
        mockSession,
        'Hello, how are you?'
      );
      
      // Verify final state
      expect(mockSession.isRunning).toBe(false);
      expect(mockSession.requestUserInput).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and reset state', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(false);
      require('@/core/utils/interactive-logic').isEmptyInput.mockReturnValue(false);
      
      mockAgent.stream.mockImplementation(() => {
        throw new Error('Stream error');
      });
      
      await expect(handleUserInput('test input', mockSession, mockAgent)).rejects.toThrow('Stream error');
      
      // State should be reset even on error
      expect(mockSession.isRunning).toBe(false);
      expect(mockSession.abortController).toBeDefined();
    });
  });

  describe('session state management', () => {
    it('should manage session state correctly during execution', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(false);
      require('@/core/utils/interactive-logic').isEmptyInput.mockReturnValue(false);
      
      mockAgent.stream.mockResolvedValue({});
      require('@/core/utils/stream-handler').processStreamChunks.mockResolvedValue('response');
      
      await handleUserInput('test', mockSession, mockAgent);
      
      // During execution, isRunning should be true
      // After completion, isRunning should be false
      expect(mockSession.isRunning).toBe(false);
      
      // New abort controller should be created
      expect(mockSession.abortController).not.toBeUndefined();
    });

    it('should use the updated threadId after /new resets the session', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(false);
      require('@/core/utils/interactive-logic').isEmptyInput.mockReturnValue(false);

      mockAgent.stream.mockResolvedValue({});
      require('@/core/utils/stream-handler').processStreamChunks.mockResolvedValue('response');

      // Simulate /new: session.threadId is updated to a fresh ID
      mockSession.threadId = 'new-session-after-new-command';

      await handleUserInput('hello in new session', mockSession, mockAgent);

      // The agent must receive the NEW thread_id, not the original 'test-thread'
      expect(mockAgent.stream).toHaveBeenCalledWith(
        { messages: [{ role: 'user', content: 'hello in new session' }] },
        expect.objectContaining({
          configurable: { thread_id: 'new-session-after-new-command' },
        })
      );
    });

    it('should not use previous thread_id after session is reset', async () => {
      require('@/core/utils/interactive-logic').shouldExitInteractiveMode.mockReturnValue(false);
      require('@/core/utils/interactive-logic').isEmptyInput.mockReturnValue(false);

      mockAgent.stream.mockResolvedValue({});
      require('@/core/utils/stream-handler').processStreamChunks.mockResolvedValue('response');

      const originalThreadId = mockSession.threadId; // 'test-thread'

      // First message uses the original thread_id
      await handleUserInput('first message', mockSession, mockAgent);
      expect(mockAgent.stream).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ configurable: { thread_id: originalThreadId } })
      );

      // Simulate /new clearing the session
      mockSession.threadId = 'fresh-thread-id-after-reset';

      // Second message must use the NEW thread_id, confirming no prior context
      await handleUserInput('second message', mockSession, mockAgent);
      expect(mockAgent.stream).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ configurable: { thread_id: 'fresh-thread-id-after-reset' } })
      );
    });
  });
});