import { createSessionOutputCaptureMiddleware } from '@/core/middlewares';
import { ToolMessage } from 'langchain';
import { SessionManager } from '@/infrastructure/session/manager';

// Mock SessionManager to isolate middleware tests
jest.mock('@/infrastructure/session/manager', () => ({
  SessionManager: {
    getInstance: jest.fn().mockReturnValue({
      updateLiveTokenUsage: jest.fn(),
    }),
  },
}));

// Mock the session object with all required methods
const createMockSession = () => ({
  logToolCall: jest.fn(),
  logToolResult: jest.fn(),
  logSystemMessage: jest.fn(),
  logErrorMessage: jest.fn(),
  streamAIContent: jest.fn(),
  setCapturedOutput: jest.fn(),
});

describe('SessionOutputCaptureMiddleware - Comprehensive Tests', () => {
  let mockSession: any;
  let middleware: any;

  beforeEach(() => {
    mockSession = createMockSession();
    middleware = createSessionOutputCaptureMiddleware({ session: mockSession });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('wrapToolCall', () => {
    it('should log tool call and result for successful execution', async () => {
      const request = {
        tool: { name: 'testTool' },
        toolCall: { args: { param1: 'value1' } },
      };
      
      const handler = jest.fn().mockResolvedValue({
        content: 'Tool result content',
      } as ToolMessage);
      
      const result = await middleware.wrapToolCall(request, handler);
      
      // Verify tool call was logged
      expect(mockSession.logToolCall).toHaveBeenCalledWith(
        'testTool', 
        expect.stringContaining('param1')
      );
      
      // Verify tool result was logged
      expect(mockSession.logToolResult).toHaveBeenCalledWith(
        'testTool',
        true,
        expect.stringContaining('Tool result')
      );
      
      expect(result).toEqual({ content: 'Tool result content' });
    });

    it('should handle tool call with no args', async () => {
      const request = {
        tool: { name: 'noArgsTool' },
        toolCall: {},
      };
      
      const handler = jest.fn().mockResolvedValue({
        content: 'No args result',
      } as ToolMessage);
      
      await middleware.wrapToolCall(request, handler);
      
      expect(mockSession.logToolCall).toHaveBeenCalledWith('noArgsTool', '{}');
    });

    it('should handle tool call error gracefully', async () => {
      const request = {
        tool: { name: 'failingTool' },
        toolCall: { args: {} },
      };
      
      const handler = jest.fn().mockRejectedValue(new Error('Tool execution failed'));
      
      // The middleware should catch the error and return a ToolMessage with error content
      const result = await middleware.wrapToolCall(request, handler);
      
      // Verify error logging
      expect(mockSession.logToolResult).toHaveBeenCalledWith(
        'failingTool',
        false,
        expect.stringContaining('Tool execution failed')
      );
      
      expect(mockSession.logErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Tool execution failed')
      );
      
      // Should return a ToolMessage with error content
      expect(result).toBeDefined();
      expect(result.content).toContain('Error: Tool execution failed');
    });

    it('should handle array content in tool result', async () => {
      const request = {
        tool: { name: 'arrayTool' },
        toolCall: { args: {} },
      };
      
      const handler = jest.fn().mockResolvedValue({
        content: ['part1', 'part2', 'part3'],
      });
      
      await middleware.wrapToolCall(request, handler);
      
      expect(mockSession.logToolResult).toHaveBeenCalledWith(
        'arrayTool',
        true,
        expect.stringContaining('part1 part2 part3')
      );
    });
  });

  describe('wrapModelCall', () => {
    let mockUpdateLiveTokenUsage: jest.Mock;

    beforeEach(() => {
      mockUpdateLiveTokenUsage = (SessionManager.getInstance() as any).updateLiveTokenUsage;
      mockUpdateLiveTokenUsage.mockClear();
    });

    it('should log system message and AI response', async () => {
      const request = {
        messages: [{ content: 'user input' }],
      };
      
      const handler = jest.fn().mockResolvedValue({
        content: 'AI response content',
      });
      
      const result = await middleware.wrapModelCall(request, handler);
      
      // Verify AI content was streamed
      expect(mockSession.streamAIContent).toHaveBeenCalledWith(
        'AI response content',
        false,
        true
      );
      
      expect(result).toEqual({ content: 'AI response content' });
    });

    it('should handle array content in model response', async () => {
      const request = {
        messages: [{ content: 'user input' }],
      };
      
      const handler = jest.fn().mockResolvedValue({
        content: ['AI', 'response', 'parts'],
      });
      
      await middleware.wrapModelCall(request, handler);
      
      expect(mockSession.streamAIContent).toHaveBeenCalledWith(
        'AI response parts',
        false,
        true
      );
    });

    it('should handle model call error', async () => {
      const request = {
        messages: [{ content: 'user input' }],
      };
      
      const handler = jest.fn().mockRejectedValue(new Error('Model execution failed'));
      
      // The middleware should catch the error and log it
      await expect(middleware.wrapModelCall(request, handler)).rejects.toThrow('Model execution failed');
      
      expect(mockSession.logErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Model execution failed')
      );
    });

    it('should call updateLiveTokenUsage when usage_metadata is present', async () => {
      const request = { messages: [{ content: 'user input' }] };
      const handler = jest.fn().mockResolvedValue({
        content: 'AI response',
        usage_metadata: { input_tokens: 1200, output_tokens: 150 },
      });

      await middleware.wrapModelCall(request, handler);

      expect(mockUpdateLiveTokenUsage).toHaveBeenCalledWith(1200, 150);
    });

    it('should not call updateLiveTokenUsage when usage_metadata is absent', async () => {
      const request = { messages: [{ content: 'user input' }] };
      const handler = jest.fn().mockResolvedValue({ content: 'AI response' });

      await middleware.wrapModelCall(request, handler);

      expect(mockUpdateLiveTokenUsage).not.toHaveBeenCalled();
    });

    it('should not call updateLiveTokenUsage when both token counts are zero', async () => {
      const request = { messages: [{ content: 'user input' }] };
      const handler = jest.fn().mockResolvedValue({
        content: 'AI response',
        usage_metadata: { input_tokens: 0, output_tokens: 0 },
      });

      await middleware.wrapModelCall(request, handler);

      expect(mockUpdateLiveTokenUsage).not.toHaveBeenCalled();
    });
  });

  describe('middleware structure', () => {
    it('should have correct middleware properties', () => {
      expect(middleware).toBeDefined();
      expect(middleware.name).toBe('SessionOutputCaptureMiddleware');
      expect(middleware.wrapToolCall).toBeDefined();
      expect(middleware.wrapModelCall).toBeDefined();
      // beforeAgent and afterAgent are not implemented in this middleware
    });
  });
});