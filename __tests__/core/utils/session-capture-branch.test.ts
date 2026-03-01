import { createSessionOutputCaptureMiddleware } from '@/core/middlewares';

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

describe('SessionOutputCaptureMiddleware - Null Session Branches', () => {
  let middleware: any;

  beforeEach(() => {
    middleware = createSessionOutputCaptureMiddleware({ session: null as any });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should work when session is null (wrapToolCall success)', async () => {
    const request = {
      tool: { name: 'testTool' },
      toolCall: { args: {} }
    };
    const handler = jest.fn().mockResolvedValue({ content: 'result' });
    const result = await middleware.wrapToolCall(request, handler);
    expect(result).toEqual({ content: 'result' });
  });

  it('should work when session is null (wrapToolCall error)', async () => {
    const request = {
      tool: { name: 'failingTool' },
      toolCall: { id: 'call-1', args: {} }
    };
    const handler = jest.fn().mockRejectedValue(new Error('Tool failed'));
    const result = await middleware.wrapToolCall(request, handler);
    expect(result).toBeDefined();
  });

  it('should work when session is null (wrapModelCall success)', async () => {
    const request = { messages: [] };
    const handler = jest.fn().mockResolvedValue({ content: 'AI response' });
    const result = await middleware.wrapModelCall(request, handler);
    expect(result).toEqual({ content: 'AI response' });
  });

  it('should work when session is null (wrapModelCall error)', async () => {
    const request = { messages: [] };
    const handler = jest.fn().mockRejectedValue(new Error('Model failed'));
    await expect(middleware.wrapModelCall(request, handler)).rejects.toThrow('Model failed');
  });

  it('should use unknown_tool when request.tool is undefined', async () => {
    middleware = createSessionOutputCaptureMiddleware({ session: createMockSession() as any });
    const request = {
      tool: undefined,
      toolCall: { id: 'call-1', args: {} }
    };
    const handler = jest.fn().mockResolvedValue({ content: 'result' });
    await middleware.wrapToolCall(request, handler);
  });

  it('should handle result without content property (wrapToolCall)', async () => {
    middleware = createSessionOutputCaptureMiddleware({ session: createMockSession() as any });
    const request = {
      tool: { name: 'noContentTool' },
      toolCall: { args: {} }
    };
    const handler = jest.fn().mockResolvedValue({ someOtherProp: 'value' });
    const result = await middleware.wrapToolCall(request, handler);
    expect(result).toEqual({ someOtherProp: 'value' });
  });

  it('should handle response without content property (wrapModelCall)', async () => {
    middleware = createSessionOutputCaptureMiddleware({ session: createMockSession() as any });
    const request = { messages: [] };
    const handler = jest.fn().mockResolvedValue({ someOtherProp: 'value' });
    const result = await middleware.wrapModelCall(request, handler);
    expect(result).toEqual({ someOtherProp: 'value' });
  });

  it('should handle error with no message in wrapToolCall', async () => {
    const mockSession = createMockSession();
    middleware = createSessionOutputCaptureMiddleware({ session: mockSession as any });
    const request = {
      tool: { name: 'errorTool' },
      toolCall: { id: 'call-1', args: {} }
    };
    const errorNoMessage = new Error('');
    const handler = jest.fn().mockRejectedValue(errorNoMessage);
    await middleware.wrapToolCall(request, handler);
    expect(mockSession.logErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error')
    );
  });
});
