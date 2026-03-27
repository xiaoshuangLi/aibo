import { LarkAdapter } from '@/presentation/lark/adapter';
import { config } from '@/core/config';

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

// Shared styled mock factory - uses function declaration so it's hoisted above jest.mock calls
function mockStyledFactory() {
  return {
    assistant: jest.fn((text: string) => `Assistant: ${text}`),
    system: jest.fn((title: string, text?: string) => text ? `${title}: ${text}` : title),
    error: jest.fn((msg: string) => msg),
    hint: jest.fn((msg: string) => msg),
    toolCall: jest.fn((name: string, args: any) => `Tool: ${name}(${JSON.stringify(args)})`),
    toolResult: jest.fn((name: string, success: boolean, preview: string) => `Result: ${name} - ${success ? 'success' : 'failure'} - ${preview}`),
    thinkingProcess: jest.fn((steps: any) => `Thinking: ${JSON.stringify(steps)}`),
    truncated: jest.fn((original: any, limit: number) => {
      if (typeof original === 'string') {
        return original.substring(0, limit);
      } else {
        return JSON.stringify(original).substring(0, limit);
      }
    })
  };
}

// Mock styled
jest.mock('@/presentation/styling/styler', () => ({ styled: mockStyledFactory() }));
jest.mock('@/presentation/lark/styler', () => ({ styled: mockStyledFactory() }));

// Mock LarkChatService so the adapter's dependency is fully controlled in unit tests
const mockGetOrCreateChat = jest.fn();
const mockChatServiceUploadImage = jest.fn();
const mockChatServiceDownloadImage = jest.fn();
jest.mock('@/presentation/lark/chat', () => ({
  LarkChatService: jest.fn().mockImplementation(() => ({
    getOrCreateChat: mockGetOrCreateChat,
    uploadImage: mockChatServiceUploadImage,
    downloadImage: mockChatServiceDownloadImage,
  })),
}));

// Mock LarkWsClientManager — simulate primary role synchronously so adapter
// tests can still verify wsClient.start() and the startup log message.
jest.mock('@/presentation/lark/ws-client', () => ({
  LarkWsClientManager: jest.fn().mockImplementation((wsClient: any) => ({
    start: jest.fn().mockImplementation(() => {
      const larkSdk = require('@larksuiteoapi/node-sdk');
      try {
        wsClient.start({
          eventDispatcher: new larkSdk.EventDispatcher({}).register({
            'im.message.receive_v1': jest.fn(),
          }),
        });
        console.log('✅ 飞书长连接已启动，等待用户消息...');
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      }
    }),
  })),
}));

describe('LarkAdapter', () => {
  let originalLarkConfig: any;
  let originalModelConfig: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    
    // Store original config and set test config
    originalLarkConfig = { ...config.lark };
    originalModelConfig = { ...config.model };
    config.lark = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      receiveId: 'test-receive-id',
      interactiveTemplateId: 'test-template-id'
    };
    // Default to a non-Claude model so tests that don't specify a model get the upload path
    config.model = { ...config.model, name: 'gpt-4o' };
  });

  afterEach(() => {
    // Restore original config
    config.lark = originalLarkConfig;
    config.model = originalModelConfig;
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

    it('should log startup errors asynchronously', async () => {
      mockWSClient.start.mockImplementationOnce(() => {
        throw new Error('WebSocket connection failed');
      });

      // Constructor no longer throws; errors surface via the async start() rejection
      expect(() => new LarkAdapter()).not.toThrow();

      // Flush pending microtasks so the rejected promise catch handler runs
      await Promise.resolve();
      await Promise.resolve();

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

    it('should replay queued messages that arrived before the callback was registered', async () => {
      const adapter = new LarkAdapter();
      // Ensure no callback is set yet
      (adapter as any).userMessageCallback = null;

      // Simulate messages arriving before the callback is registered
      (adapter as any).messageQueue.push({ content: '说个笑话', chatId: 'chat-1' });
      (adapter as any).messageQueue.push({ content: '你好', chatId: 'chat-1' });

      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      // Both queued messages should have been forwarded to the callback
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, '说个笑话');
      expect(callback).toHaveBeenNthCalledWith(2, '你好');
      // Queue should be empty after draining
      expect((adapter as any).messageQueue).toHaveLength(0);
    });
  });

  describe('setAbortSignal', () => {
    it('should store the provided signal directly', () => {
      const adapter = new LarkAdapter();
      const controller = new AbortController();
      const signal = controller.signal;
      
      adapter.setAbortSignal(signal);
      
      expect((adapter as any).abortSignal).toBe(signal);
    });

    it('should update stored signal when called again with a new signal', () => {
      const adapter = new LarkAdapter();
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      
      adapter.setAbortSignal(controller1.signal);
      adapter.setAbortSignal(controller2.signal);
      
      expect((adapter as any).abortSignal).toBe(controller2.signal);
    });
  });

  describe('destroy', () => {
    it('should destroy adapter', () => {
      const adapter = new LarkAdapter();
      
      adapter.destroy();
      
      expect((adapter as any).isDestroyed).toBe(true);
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
          chat_type: 'p2p',
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
          chat_type: 'p2p',
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
          chat_type: 'p2p',
          content: ''
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call callback when new message arrives', async () => {
      const adapter = new LarkAdapter();
      
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: 'New message'
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
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
          chat_type: 'p2p',
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
          chat_type: 'p2p',
          content: 'invalid json {'
        }
      };
      
      await (adapter as any).handleUserMessage(testData);
      
      expect(callback).toHaveBeenCalledWith('invalid json {');
      expect(mockConsoleError).not.toHaveBeenCalled(); // Should not log error for this case
    });

    // --- message filtering tests ---

    it('without chatId: should ignore group messages (chat_type !== p2p)', async () => {
      const adapter = new LarkAdapter(); // no chatId → p2p-only mode
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          chat_id: 'some-group-id',
          chat_type: 'group',
          content: JSON.stringify({ text: 'group message' })
        }
      };

      await (adapter as any).handleUserMessage(testData);

      expect(callback).not.toHaveBeenCalled();
    });

    it('without chatId: should accept p2p messages', async () => {
      const adapter = new LarkAdapter(); // no chatId → p2p-only mode
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          chat_id: 'dm-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ text: 'direct message' })
        }
      };

      await (adapter as any).handleUserMessage(testData);

      expect(callback).toHaveBeenCalledWith('direct message');
    });

    it('with group_chat mode: should ignore messages from a different group', async () => {
      mockGetOrCreateChat.mockResolvedValue('my-group-id');
      const originalLarkType = (config as any).interaction?.larkType;
      (config as any).interaction = { ...((config as any).interaction ?? {}), larkType: 'group_chat' };

      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          chat_id: 'other-group-id',
          chat_type: 'group',
          content: JSON.stringify({ text: 'wrong group message' })
        }
      };

      await (adapter as any).handleUserMessage(testData);

      expect(callback).not.toHaveBeenCalled();

      (config as any).interaction = { ...((config as any).interaction ?? {}), larkType: originalLarkType };
    });

    it('with group_chat mode: should accept messages from the matching group', async () => {
      mockGetOrCreateChat.mockResolvedValue('my-group-id');
      const originalLarkType = (config as any).interaction?.larkType;
      (config as any).interaction = { ...((config as any).interaction ?? {}), larkType: 'group_chat' };

      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          chat_id: 'my-group-id',
          chat_type: 'group',
          content: JSON.stringify({ text: 'correct group message' })
        }
      };

      await (adapter as any).handleUserMessage(testData);

      expect(callback).toHaveBeenCalledWith('correct group message');

      (config as any).interaction = { ...((config as any).interaction ?? {}), larkType: originalLarkType };
    });

    // --- image message tests ---

    it('should download image, upload it, and call callback with the uploaded URL', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      const uploadedUrl = 'https://example.feishu.cn/tmp/image.png';
      mockChatServiceDownloadImage.mockResolvedValueOnce(imageBuffer);
      mockChatServiceUploadImage.mockResolvedValueOnce(uploadedUrl);

      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          message_id: 'om_test_message_id',
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ image_key: 'img_test_key' }),
          message_type: 'image',
        },
      };

      await (adapter as any).handleUserMessage(testData);

      expect(mockChatServiceDownloadImage).toHaveBeenCalledWith('om_test_message_id', 'img_test_key');
      expect(mockChatServiceUploadImage).toHaveBeenCalledWith(imageBuffer.toString('base64'));
      expect(callback).toHaveBeenCalledWith([
        { type: 'image_url', image_url: { url: uploadedUrl } },
      ]);
    });

    it('should queue image content (uploaded URL) when no callback is set yet', async () => {
      const imageBuffer = Buffer.from('another-fake-image');
      const uploadedUrl = 'https://example.feishu.cn/tmp/queued.png';
      mockChatServiceDownloadImage.mockResolvedValueOnce(imageBuffer);
      mockChatServiceUploadImage.mockResolvedValueOnce(uploadedUrl);

      const adapter = new LarkAdapter();
      (adapter as any).userMessageCallback = null;
      (adapter as any).processMessageQueue = jest.fn();

      const testData = {
        message: {
          message_id: 'om_queued_message_id',
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ image_key: 'img_queued_key' }),
          message_type: 'image',
        },
      };

      await (adapter as any).handleUserMessage(testData);

      expect((adapter as any).messageQueue).toHaveLength(1);
      expect((adapter as any).messageQueue[0]).toEqual({
        content: [{ type: 'image_url', image_url: { url: uploadedUrl } }],
        chatId: 'test-chat-id',
      });
    });

    it('should ignore image message when image_key is missing', async () => {
      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          message_id: 'om_no_key_message_id',
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({}),
          message_type: 'image',
        },
      };

      await (adapter as any).handleUserMessage(testData);

      expect(mockChatServiceDownloadImage).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should log error and not call callback when image download fails', async () => {
      mockChatServiceDownloadImage.mockRejectedValueOnce(new Error('download failed'));

      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          message_id: 'om_fail_message_id',
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ image_key: 'img_fail_key' }),
          message_type: 'image',
        },
      };

      await (adapter as any).handleUserMessage(testData);

      expect(mockConsoleError).toHaveBeenCalledWith('❌ 处理图片消息失败:', expect.any(Error));
      expect(callback).not.toHaveBeenCalled();
    });

    it('should log error and not call callback when image upload fails', async () => {
      mockChatServiceDownloadImage.mockResolvedValueOnce(Buffer.from('some-image'));
      mockChatServiceUploadImage.mockRejectedValueOnce(new Error('upload failed'));

      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          message_id: 'om_upload_fail_id',
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ image_key: 'img_upload_fail_key' }),
          message_type: 'image',
        },
      };

      await (adapter as any).handleUserMessage(testData);

      expect(mockConsoleError).toHaveBeenCalledWith('❌ 处理图片消息失败:', expect.any(Error));
      expect(callback).not.toHaveBeenCalled();
    });

    // --- Claude model: base64 data URI path ---

    it('should use base64 data URI (not upload) when model is Claude (via name prefix)', async () => {
      config.model = { ...config.model, name: 'claude-3-5-sonnet-20241022', provider: undefined };
      const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      mockChatServiceDownloadImage.mockResolvedValueOnce(pngMagic);

      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          message_id: 'om_claude_message_id',
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ image_key: 'img_claude_key' }),
          message_type: 'image',
        },
      };

      await (adapter as any).handleUserMessage(testData);

      expect(mockChatServiceDownloadImage).toHaveBeenCalledWith('om_claude_message_id', 'img_claude_key');
      // uploadImage must NOT be called for Claude
      expect(mockChatServiceUploadImage).not.toHaveBeenCalled();
      const expectedUrl = `data:image/png;base64,${pngMagic.toString('base64')}`;
      expect(callback).toHaveBeenCalledWith([
        { type: 'image_url', image_url: { url: expectedUrl } },
      ]);
    });

    it('should use base64 data URI when provider is explicitly set to anthropic', async () => {
      config.model = { ...config.model, name: 'some-custom-model', provider: 'anthropic' };
      const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
      mockChatServiceDownloadImage.mockResolvedValueOnce(jpegMagic);

      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      const testData = {
        message: {
          message_id: 'om_anthropic_message_id',
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ image_key: 'img_anthropic_key' }),
          message_type: 'image',
        },
      };

      await (adapter as any).handleUserMessage(testData);

      expect(mockChatServiceUploadImage).not.toHaveBeenCalled();
      const expectedUrl = `data:image/jpeg;base64,${jpegMagic.toString('base64')}`;
      expect(callback).toHaveBeenCalledWith([
        { type: 'image_url', image_url: { url: expectedUrl } },
      ]);
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
      
      const { styled: mockedStyled } = require('@/presentation/lark/styler');
      const expectedJson = JSON.stringify('error response data', null, 2);
      expect(mockedStyled.system).toHaveBeenCalledWith('❌ 发送消息失败', `\`\`\`json\n${expectedJson}\n\`\`\``);
      expect(mockLarkClient.im.message.create).toHaveBeenCalledTimes(2);
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

    it('should send up to 5 messages without delay', async () => {
      jest.useFakeTimers();
      mockLarkClient.im.message.create.mockResolvedValue({ code: 0 });
      const adapter = new LarkAdapter();

      // Send 5 messages simultaneously; all should resolve without any timer
      const promises = Array.from({ length: 5 }, (_, i) =>
        (adapter as any).sendMessage(`msg-${i}`)
      );

      // Flush microtasks so the queue processor advances
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      jest.runAllTimers();
      await Promise.all(promises);

      expect(mockLarkClient.im.message.create).toHaveBeenCalledTimes(5);
      jest.useRealTimers();
    });

    it('should delay the 6th message to respect the 5-per-second rate limit', async () => {
      jest.useFakeTimers();
      mockLarkClient.im.message.create.mockResolvedValue({ code: 0 });
      const adapter = new LarkAdapter();

      // Pre-fill 5 timestamps within the last second so the next send must wait
      const now = Date.now();
      (adapter as any).sendTimestamps = [now - 400, now - 300, now - 200, now - 100, now - 50];

      let sixthResolved = false;
      const sixthPromise = (adapter as any).sendMessage('msg-6').then(() => {
        sixthResolved = true;
      });

      // Advance queue processor so it hits the rate-limit wait
      await Promise.resolve();
      await Promise.resolve();

      // The 6th message has not been sent yet
      expect(sixthResolved).toBe(false);
      expect(mockLarkClient.im.message.create).toHaveBeenCalledTimes(0);

      // Advance time past the window so the oldest timestamp is evicted
      jest.advanceTimersByTime(1000);

      // Allow the deferred setTimeout inside processSendQueue to fire
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      await sixthPromise;

      expect(mockLarkClient.im.message.create).toHaveBeenCalledTimes(1);
      expect(sixthResolved).toBe(true);
      jest.useRealTimers();
    });

    it('destroy should resolve pending queued messages without sending them', async () => {
      mockLarkClient.im.message.create.mockResolvedValue({ code: 0 });
      const adapter = new LarkAdapter();

      // Manually block the queue processor so items pile up
      (adapter as any).isSendingQueue = true;
      const p1 = (adapter as any).sendMessage('queued-1');
      const p2 = (adapter as any).sendMessage('queued-2');

      expect((adapter as any).sendQueue).toHaveLength(2);

      // Destroying should drain and resolve all pending promises
      adapter.destroy();

      await expect(p1).resolves.toBeUndefined();
      await expect(p2).resolves.toBeUndefined();
      expect(mockLarkClient.im.message.create).not.toHaveBeenCalled();
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
    it('should store the signal directly', () => {
      const adapter = new LarkAdapter();
      const newController = new AbortController();
      
      adapter.setAbortSignal(newController.signal);
      
      expect((adapter as any).abortSignal).toBe(newController.signal);
    });

    it('should store the AbortSignal reference directly', () => {
      const adapter = new LarkAdapter();
      const controller = new AbortController();
      const signal = controller.signal;
      
      adapter.setAbortSignal(signal);

      expect((adapter as any).abortSignal).toBe(signal);
    });

    it('should update the stored signal when called again', () => {
      const adapter = new LarkAdapter();
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      
      adapter.setAbortSignal(controller1.signal);
      adapter.setAbortSignal(controller2.signal);
      
      expect((adapter as any).abortSignal).toBe(controller2.signal);
    });
  });

  describe('destroy', () => {
    it('should destroy adapter only once', () => {
      const adapter = new LarkAdapter();
      
      adapter.destroy();
      adapter.destroy(); // Call again to test idempotency
      
      expect((adapter as any).isDestroyed).toBe(true);
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
      // abortSignal is null by default, so chunks are not suppressed
      
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