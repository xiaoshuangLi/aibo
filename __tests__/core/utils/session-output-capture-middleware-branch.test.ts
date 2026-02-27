import { createSessionOutputCaptureMiddleware } from '@/core/utils/session-output-capture-middleware';

const createMockSession = () => ({
  logToolCall: jest.fn(),
  logToolResult: jest.fn(),
  logSystemMessage: jest.fn(),
  logErrorMessage: jest.fn(),
  streamAIContent: jest.fn(),
  setCapturedOutput: jest.fn(),
});

describe('SessionOutputCaptureMiddleware - Branch Coverage', () => {
  let mockSession: any;
  let middleware: any;

  beforeEach(() => {
    mockSession = createMockSession();
    middleware = createSessionOutputCaptureMiddleware({ session: mockSession });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('wrapToolCall - uncovered branches', () => {
    it('should handle circular reference in args (JSON.stringify throws)', async () => {
      const circular: any = { key: 'value' };
      circular.self = circular; // Create circular reference

      const request = {
        tool: { name: 'circularTool' },
        toolCall: { args: circular }
      };

      const handler = jest.fn().mockResolvedValue({ content: 'result' });

      await middleware.wrapToolCall(request, handler);

      // Should still log the tool call with a string fallback
      expect(mockSession.logToolCall).toHaveBeenCalledWith(
        'circularTool',
        expect.any(String)
      );
    });

    it('should handle non-string, non-array content in tool result', async () => {
      const request = {
        tool: { name: 'numericTool' },
        toolCall: { args: {} }
      };

      // Return content that is a number (not string, not array)
      const handler = jest.fn().mockResolvedValue({
        content: 42
      });

      await middleware.wrapToolCall(request, handler);

      expect(mockSession.logToolResult).toHaveBeenCalledWith(
        'numericTool',
        true,
        '42'
      );
    });

    it('should handle object content in tool result', async () => {
      const request = {
        tool: { name: 'objectTool' },
        toolCall: { args: {} }
      };

      const handler = jest.fn().mockResolvedValue({
        content: { key: 'value' }
      });

      await middleware.wrapToolCall(request, handler);

      expect(mockSession.logToolResult).toHaveBeenCalledWith(
        'objectTool',
        true,
        expect.any(String)
      );
    });
  });
});
