import { LarkAdapter } from '@/presentation/lark/adapter';
import { config } from '@/core/config';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
console.log = mockConsoleLog;
console.error = mockConsoleError;

// Capture the registered EventDispatcher callbacks
let registeredCallbacks: Record<string, Function> = {};
const mockLarkClient = {
  im: {
    message: {
      create: jest.fn().mockResolvedValue({ code: 0 })
    }
  }
};
const mockWSClient = {
  start: jest.fn()
};

jest.mock('@larksuiteoapi/node-sdk', () => ({
  Client: jest.fn().mockImplementation(() => mockLarkClient),
  WSClient: jest.fn().mockImplementation(() => mockWSClient),
  EventDispatcher: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockImplementation((handlers: Record<string, Function>) => {
      registeredCallbacks = handlers;
      return { register: jest.fn() };
    })
  })),
  AppType: { SelfBuild: 'self_build' },
  Domain: { Feishu: 'feishu' },
  LoggerLevel: { info: 'info' }
}));

jest.mock('@/presentation/lark/styler', () => ({
  styled: {
    assistant: jest.fn((text) => `Assistant: ${text}`),
    system: jest.fn((msg) => msg),
    error: jest.fn((msg) => msg),
    hint: jest.fn((msg) => msg),
    toolCall: jest.fn((name, args) => `Tool: ${name}`),
    toolResult: jest.fn((name, success, preview) => `Result: ${name}`),
    thinkingProcess: jest.fn((steps) => `Thinking`),
    truncated: jest.fn((text) => String(text ?? ''))
  }
}));

describe('LarkAdapter - Additional Coverage', () => {
  let originalLarkConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredCallbacks = {};
    originalLarkConfig = { ...config.lark };
    config.lark = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      receiveId: 'test-receive-id',
      interactiveTemplateId: 'test-template-id'
    };
  });

  afterEach(() => {
    config.lark = originalLarkConfig;
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('EventDispatcher callback (startLongConnection)', () => {
    it('should invoke handleUserMessage when event is received', async () => {
      const adapter = new LarkAdapter();
      const callback = jest.fn();
      adapter.setUserMessageCallback(callback);

      // The EventDispatcher should have captured callbacks
      expect(registeredCallbacks['im.message.receive_v1']).toBeDefined();
      
      const testData = {
        message: {
          chat_id: 'test-chat-id',
          chat_type: 'p2p',
          content: JSON.stringify({ text: 'Hello from WebSocket' })
        }
      };

      const result = await registeredCallbacks['im.message.receive_v1'](testData);
      
      expect(callback).toHaveBeenCalledWith('Hello from WebSocket');
      expect(result).toEqual({ code: 0, msg: 'success' });
    });
  });

  describe('handleUserMessage - error handling', () => {
    it('should log error when message processing throws', async () => {
      const adapter = new LarkAdapter();
      
      // Pass invalid data that will cause an error
      await (adapter as any).handleUserMessage(null);
      
      expect(mockConsoleError).toHaveBeenCalledWith('❌ 处理用户消息失败:', expect.any(Error));
    });
  });

  describe('setAbortSignal - already aborted signal', () => {
    it('should store the already-aborted signal directly', () => {
      const adapter = new LarkAdapter();
      
      // Create an already-aborted controller
      const abortedController = new AbortController();
      abortedController.abort();
      
      adapter.setAbortSignal(abortedController.signal);
      
      // The stored signal should be aborted
      expect((adapter as any).abortSignal?.aborted).toBe(true);
    });
  });

  describe('handleToolResult - additional branches', () => {
    let adapter: LarkAdapter;

    beforeEach(() => {
      adapter = new LarkAdapter();
    });

    it('should handle toolResult with preview field (backward compat)', async () => {
      await (adapter as any).handleToolResult({
        name: 'test-tool',
        success: true,
        preview: 'preview text'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isTaskResult and result containing ▸ 结果:', async () => {
      await (adapter as any).handleToolResult({
        name: '子代理任务',
        success: true,
        isTaskResult: true,
        result: '▸ 结果: task completed'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isTaskResult and simple result', async () => {
      await (adapter as any).handleToolResult({
        name: '子代理任务',
        success: true,
        isTaskResult: true,
        result: 'simple result'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isTextResult', async () => {
      await (adapter as any).handleToolResult({
        name: 'grep',
        success: true,
        isTextResult: true,
        result: 'grep output content'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isJsonResult and task tool with message', async () => {
      await (adapter as any).handleToolResult({
        name: '子代理任务',
        success: true,
        isJsonResult: true,
        result: { message: 'Task message' }
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isJsonResult and task tool with string result', async () => {
      await (adapter as any).handleToolResult({
        name: 'task',
        success: true,
        isJsonResult: true,
        result: 'direct string result'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isJsonResult and task tool with object (no message)', async () => {
      await (adapter as any).handleToolResult({
        name: 'task',
        success: true,
        isJsonResult: true,
        result: { stdout: 'some output', stderr: '(empty)' }
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isJsonResult and non-task object result', async () => {
      await (adapter as any).handleToolResult({
        name: 'bash',
        success: true,
        isJsonResult: true,
        result: { command: 'ls', stdout: 'files', stderr: '(empty)' }
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isJsonResult and JSON string result', async () => {
      await (adapter as any).handleToolResult({
        name: 'bash',
        success: true,
        isJsonResult: true,
        result: '{"key": "value"}'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isJsonResult and non-JSON string result', async () => {
      await (adapter as any).handleToolResult({
        name: 'bash',
        success: true,
        isJsonResult: true,
        result: 'plain string'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with isJsonResult and non-string non-object result', async () => {
      await (adapter as any).handleToolResult({
        name: 'bash',
        success: true,
        isJsonResult: true,
        result: 42
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with raw non-JSON string result', async () => {
      await (adapter as any).handleToolResult({
        name: 'view-file',
        success: true,
        result: 'plain text file content'
      });
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should handle toolResult with raw non-string result', async () => {
      await (adapter as any).handleToolResult({
        name: 'view-file',
        success: true,
        result: { data: 'object' }  // non-string raw result
      });
      // result is an object so it goes to the JSON stringify path
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });
  });

  describe('handleStreamStart - without initialContent', () => {
    it('should send default message when no initialContent is provided', async () => {
      const adapter = new LarkAdapter();
      
      await (adapter as any).handleStreamStart({});
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });

    it('should send default message when initialContent is undefined', async () => {
      const adapter = new LarkAdapter();
      
      await (adapter as any).handleStreamStart({ initialContent: undefined });
      
      expect(mockLarkClient.im.message.create).toHaveBeenCalled();
    });
  });
});
