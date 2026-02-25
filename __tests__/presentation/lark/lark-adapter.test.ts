import { LarkAdapter } from '@/presentation/lark/lark-adapter';
import { config } from '@/core/config/config';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const mockConsoleWarn = jest.fn();
console.log = mockConsoleLog;
console.error = mockConsoleError;
console.warn = mockConsoleWarn;

// Mock lark SDK
const mockLarkClient = {
  im: {
    message: {
      create: jest.fn()
    }
  }
};

const mockWSClient = {
  start: jest.fn(),
  // Add other methods if needed
};

const mockEventDispatcher = {
  register: jest.fn().mockReturnThis()
};

jest.mock('@larksuiteoapi/node-sdk', () => ({
  Client: jest.fn().mockImplementation(() => mockLarkClient),
  WSClient: jest.fn().mockImplementation(() => mockWSClient),
  EventDispatcher: jest.fn().mockImplementation(() => mockEventDispatcher),
  AppType: {
    SelfBuild: 'self_build'
  },
  Domain: {
    Feishu: 'feishu'
  },
  LoggerLevel: {
    info: 'info'
  }
}));

// Mock styled
jest.mock('@/presentation/styling/output-styler', () => ({
  styled: {
    assistant: jest.fn((text) => `Assistant: ${text}`),
    system: jest.fn((msg) => msg),
    error: jest.fn((msg) => msg),
    hint: jest.fn((msg) => msg),
    toolCall: jest.fn((name, args) => `Tool: ${name}(${JSON.stringify(args)})`),
    toolResult: jest.fn((name, success, preview) => `Result: ${name} - ${success ? 'success' : 'failure'} - ${preview}`),
    thinkingProcess: jest.fn((steps) => `Thinking: ${JSON.stringify(steps)}`),
    truncated: jest.fn((original, limit) => {
      if (typeof original === 'string') {
        return original.substring(0, limit);
      } else {
        return JSON.stringify(original).substring(0, limit);
      }
    })
  }
}));

describe('LarkAdapter', () => {
  let originalLarkConfig: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    
    // Store original config and set test config
    originalLarkConfig = { ...config.lark };
    config.lark = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      receiveId: 'test-receive-id',
      interactiveTemplateId: 'test-template-id'
    };
  });

  afterEach(() => {
    // Restore original config
    config.lark = originalLarkConfig;
  });

  describe('constructor', () => {
    it('should throw error when appId is missing', () => {
      config.lark.appId = undefined;
      
      expect(() => new LarkAdapter()).toThrow('Missing required Lark environment variables');
    });

    it('should throw error when appSecret is missing', () => {
      config.lark.appSecret = undefined;
      
      expect(() => new LarkAdapter()).toThrow('Missing required Lark environment variables');
    });

    it('should initialize successfully with valid config', () => {
      const adapter = new LarkAdapter();
      
      expect(require('@larksuiteoapi/node-sdk').Client).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'test-app-id',
          appSecret: 'test-app-secret',
          appType: 'self_build',
          domain: 'feishu'
        })
      );
      
      expect(require('@larksuiteoapi/node-sdk').WSClient).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'test-app-id',
          appSecret: 'test-app-secret',
          loggerLevel: 'info'
        })
      );
      
      expect(mockWSClient.start).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ 飞书长连接已启动，等待用户消息...');
    });

    it('should handle startup errors', () => {
      mockWSClient.start.mockImplementationOnce(() => {
        throw new Error('WebSocket connection failed');
      });
      
      expect(() => new LarkAdapter()).toThrow('WebSocket connection failed');
      expect(mockConsoleError).toHaveBeenCalledWith('❌ 启动飞书长连接失败:', expect.any(Error));
    });
  });

  describe('setUserMessageCallback', () => {
    it('should set the user message callback', () => {
      const adapter = new LarkAdapter();
      const callback = jest.fn();
      
      adapter.setUserMessageCallback(callback);
      
      // Access private property for testing (not ideal but necessary)
      expect((adapter as any).userMessageCallback).toBe(callback);
    });
  });

  describe('setAbortSignal', () => {
    it('should handle AbortSignal input and create controller', () => {
      const adapter = new LarkAdapter();
      const controller = new AbortController();
      const signal = controller.signal;
      
      adapter.setAbortSignal(signal);
      
      expect((adapter as any).abortController).toBeDefined();
    });

    it('should abort existing controller when setting new signal', () => {
      const adapter = new LarkAdapter();
      const oldController = new AbortController();
      (adapter as any).abortController = oldController;
      
      const newController = new AbortController();
      adapter.setAbortSignal(newController.signal);
      
      expect(oldController.signal.aborted).toBe(true);
      expect((adapter as any).abortController).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should destroy adapter and abort controller', () => {
      const adapter = new LarkAdapter();
      const controller = new AbortController();
      (adapter as any).abortController = controller;
      
      adapter.destroy();
      
      expect((adapter as any).isDestroyed).toBe(true);
      expect(controller.signal.aborted).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('🔌 飞书适配器已销毁');
    });

    it('should not destroy twice', () => {
      const adapter = new LarkAdapter();
      adapter.destroy();
      
      // Reset mock to check if destroy is called again
      mockConsoleLog.mockClear();
      adapter.destroy();
      
      // Should not log again
      expect(mockConsoleLog).not.toHaveBeenCalledWith('🔌 飞书适配器已销毁');
    });

    it('should handle error during destruction', () => {
      const adapter = new LarkAdapter();
      // Mock console.log to throw an error
      console.log = jest.fn().mockImplementationOnce(() => {
        throw new Error('Destruction error');
      });
      
      adapter.destroy();
      
      expect(mockConsoleError).toHaveBeenCalledWith('❌ 销毁飞书适配器时出错:', expect.any(Error));
      
      // Restore original console.log
      console.log = mockConsoleLog;
    });
  });

  describe('handleUserMessage', () => {
    it('should parse JSON content and call callback', async () => {
      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          content: JSON.stringify({ text: 'Hello World' })
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect(callback).toHaveBeenCalledWith('Hello World');
    });

    it('should handle plain text content', async () => {
      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          content: 'Plain text message'
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect(callback).toHaveBeenCalledWith('Plain text message');
    });

    it('should ignore empty messages', async () => {
      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          content: ''
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should abort current operation when new message arrives', async () => {
      const adapter = new LarkAdapter();
      const originalAbortController = (adapter as any).abortController;
      
      // Simulate an active operation
      const activeAbortController = new AbortController();
      (adapter as any).abortController = activeAbortController;
      
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          content: 'New message'
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect(activeAbortController.signal.aborted).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('🔄 检测到新用户消息，中断当前操作...');
      expect(callback).toHaveBeenCalledWith('New message');
    });

    it('should add message to queue when no callback is set', async () => {
      const adapter = new LarkAdapter();
      (adapter as any).userMessageCallback = null;
      
      // Mock processMessageQueue to not actually process the queue
      const originalProcessMessageQueue = (adapter as any).processMessageQueue;
      (adapter as any).processMessageQueue = jest.fn();
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          content: JSON.stringify({ text: 'Queued message' })
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect((adapter as any).messageQueue).toHaveLength(1);
      expect((adapter as any).messageQueue[0]).toEqual({
        content: 'Queued message',
        chatId: 'test-chat-id'
      });
      
      // Restore original method
      (adapter as any).processMessageQueue = originalProcessMessageQueue;
    });

    it('should handle parsing errors gracefully', async () => {
      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          content: 'invalid json {'
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect(callback).toHaveBeenCalledWith('invalid json {');
      expect(mockConsoleError).not.toHaveBeenCalled(); // Should not log error for this case
    });
  });

  describe('sendMessage', () => {
    it('should send message with proper formatting', async () => {
      const adapter = new LarkAdapter();
      mockLarkClient.im.message.create.mockResolvedValue({ code: 0 });
      
      await (adapter as any).sendMessage('Test message\nwith multiple lines');
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { receive_id_type: 'user_id' },
          data: expect.objectContaining({
            receive_id: 'test-receive-id',
            msg_type: 'text'
          })
        })
      );
      
      const contentArg = mockLarkClient.im.message.create.mock.calls[0][0].data.content;
      const parsedContent = JSON.parse(contentArg);
      expect(parsedContent.text).toContain('Test message');
      expect(parsedContent.text).toContain('with multiple lines');
    });

    it('should handle send errors and send fallback message', async () => {
      const adapter = new LarkAdapter();
      const mockError = new Error('Send failed') as any;
      mockError.response = {
        data: 'error response data',
        config: {
          data: 'request config data'
        }
      };
      mockLarkClient.im.message.create
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ code: 0 });
      
      await (adapter as any).sendMessage('Sensitive content');
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalledTimes(2);
      expect(mockConsoleError).toHaveBeenCalledWith('❌ 发送消息失败:', 'error response data');
      expect(mockConsoleError).toHaveBeenCalledWith('📃 发送消息内容:', 'request config data');
      
      const secondCallContent = mockLarkClient.im.message.create.mock.calls[1][0].data.content;
      const secondParsedContent = JSON.parse(secondCallContent);
      expect(secondParsedContent.text).toBe('【敏感内容】');
    });

    it('should warn when no receiveId is configured', async () => {
      config.lark.receiveId = undefined;
      const adapter = new LarkAdapter();
      
      await (adapter as any).sendMessage('Test message');
      
      expect(mockConsoleWarn).toHaveBeenCalledWith('⚠️ 无法发送消息：没有设置接收ID');
      expect(mockLarkClient.im.message.create).not.toHaveBeenCalled();
    });

    it('should throw error when adapter is destroyed', async () => {
      const adapter = new LarkAdapter();
      adapter.destroy();
      
      await expect((adapter as any).sendMessage('Test')).rejects.toThrow('Lark adapter is destroyed');
    });
  });

  describe('requestUserInput', () => {
    it('should send prompt message when provided', async () => {
      const adapter = new LarkAdapter();
      mockLarkClient.im.message.create.mockResolvedValue({ code: 0 });
      
      await adapter.requestUserInput('Please enter your input:');
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should not send message when prompt is empty', async () => {
      const adapter = new LarkAdapter();
      
      await adapter.requestUserInput('');
      await adapter.requestUserInput('   ');
      
      expect(mockLarkClient.im.message.create).not.toHaveBeenCalled();
    });

    it('should throw error when adapter is destroyed', async () => {
      const adapter = new LarkAdapter();
      adapter.destroy();
      
      await expect(adapter.requestUserInput('test')).rejects.toThrow('Lark adapter is destroyed');
    });
  });

  describe('setAbortSignal', () => {
    it('should handle AbortController instance', () => {
      const adapter = new LarkAdapter();
      const newController = new AbortController();
      
      adapter.setAbortSignal(newController.signal);
      
      expect((adapter as any).abortController).toBeDefined();
    });

    it('should handle AbortSignal instance', () => {
      const adapter = new LarkAdapter();
      const controller = new AbortController();
      const signal = controller.signal;
      
      adapter.setAbortSignal(signal);
      
      expect((adapter as any).abortController).toBeDefined();
      expect((adapter as any).abortController).not.toBe(controller);
    });

    it('should abort existing controller when setting new signal', () => {
      const adapter = new LarkAdapter();
      const originalController = (adapter as any).abortController;
      const newController = new AbortController();
      
      // Only test if original controller exists
      if (originalController) {
        adapter.setAbortSignal(newController.signal);
        expect(originalController.signal.aborted).toBe(true);
      } else {
        // If no original controller, just verify the new one is set
        adapter.setAbortSignal(newController.signal);
        expect((adapter as any).abortController).toBeDefined();
      }
    });
  });

  describe('destroy', () => {
    it('should destroy adapter only once', () => {
      const adapter = new LarkAdapter();
      const originalController = (adapter as any).abortController;
      
      adapter.destroy();
      adapter.destroy(); // Call again to test idempotency
      
      expect((adapter as any).isDestroyed).toBe(true);
      if (originalController) {
        expect(originalController.signal.aborted).toBe(true);
      }
      expect(mockConsoleLog).toHaveBeenCalledWith('🔌 飞书适配器已销毁');
    });
  });

  // Test event handlers
  describe('Event Handlers', () => {
    let adapter: LarkAdapter;
    
    beforeEach(() => {
      adapter = new LarkAdapter();
      mockLarkClient.im.message.create.mockResolvedValue({ code: 0 });
    });

    it('should handle aiResponse event', async () => {
      await (adapter as any).handleAIResponse({ content: 'AI response' });
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: expect.stringContaining('AI response')
          })
        })
      );
    });

    it('should handle toolCall event', async () => {
      await (adapter as any).handleToolCall({ name: 'testTool', args: { param: 'value' } });
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult event with different data structures', async () => {
      // Test with string result
      await (adapter as any).handleToolResult({ name: 'test-tool', result: 'string result' });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
      
      // Test with object result
      mockLarkClient.im.message.create.mockClear();
      await (adapter as any).handleToolResult({ name: 'test-tool', result: { key: 'value' } });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
      
      // Test with array result
      mockLarkClient.im.message.create.mockClear();
      await (adapter as any).handleToolResult({ name: 'test-tool', result: ['item1', 'item2'] });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle thinkingProcess event', async () => {
      await (adapter as any).handleThinkingProcess({ steps: [{ content: 'thinking step' }] });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle systemMessage event', async () => {
      await (adapter as any).handleSystemMessage({ message: 'system message' });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle errorMessage event', async () => {
      await (adapter as any).handleErrorMessage({ message: 'error message' });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle hintMessage event', async () => {
      await (adapter as any).handleHintMessage({ message: 'hint message' });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle stream events', async () => {
      const adapter = new LarkAdapter();
      // Ensure abortController is not aborted
      (adapter as any).abortController = new AbortController();
      
      await (adapter as any).handleStreamStart({ initialContent: 'stream start' });
      await (adapter as any).handleStreamChunk({ chunk: 'stream chunk' });
      await (adapter as any).handleStreamEnd({ message: 'stream end' });
      
      // Only handleStreamStart and handleStreamChunk send messages
      // handleStreamEnd does not send any message
      expect(mockLarkClient.im.message.create).toHaveBeenCalledTimes(2);
    });

    it('should handle session events', async () => {
      await (adapter as any).handleSessionStart({ message: 'session start' });
      await (adapter as any).handleSessionEnd({ message: 'session end' });
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalledTimes(2);
    });

    it('should handle commandExecuted event', async () => {
      await (adapter as any).handleCommandExecuted({ 
        command: '/test', 
        result: { success: true, message: 'command executed' } 
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle rawText event', async () => {
      await (adapter as any).handleRawText({ text: 'raw text' });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    // Test edge cases for event handlers
    it('should handle null/undefined data in event handlers', async () => {
      await (adapter as any).handleAIResponse(null as any);
      await (adapter as any).handleAIResponse({} as any);
      await (adapter as any).handleToolCall(null as any);
      await (adapter as any).handleToolCall({} as any);
      
      // Should not throw errors or call sendMessage
      expect(mockLarkClient.im.message.create).not.toHaveBeenCalled();
    });
  });

  // Restore original functions after all tests
  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });
});