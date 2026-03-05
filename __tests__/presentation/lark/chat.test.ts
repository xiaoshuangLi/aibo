import { LarkChatService } from '@/presentation/lark/chat';

// Mock lark SDK
const mockChatList = jest.fn();
const mockChatCreate = jest.fn();
const mockFileList = jest.fn();
const mockFileCreateFolder = jest.fn();
const mockBitableAppCreate = jest.fn();
const mockMediaUploadAll = jest.fn();
const mockMediaBatchGetTmpDownloadUrl = jest.fn();

jest.mock('@larksuiteoapi/node-sdk', () => ({
  Client: jest.fn().mockImplementation(() => ({
    im: {
      chat: {
        list: mockChatList,
        create: mockChatCreate,
      },
    },
    drive: {
      v1: {
        file: {
          list: mockFileList,
          createFolder: mockFileCreateFolder,
        },
        media: {
          uploadAll: mockMediaUploadAll,
          batchGetTmpDownloadUrl: mockMediaBatchGetTmpDownloadUrl,
        },
      },
    },
    bitable: {
      v1: {
        app: {
          create: mockBitableAppCreate,
        },
      },
    },
  })),
  AppType: { SelfBuild: 'self_build' },
  Domain: { Feishu: 'feishu' },
}));

// Mock config
jest.mock('@/core/config', () => ({
  config: {
    lark: {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      receiveId: 'test-receive-id',
    },
  },
}));

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('LarkChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('constructor', () => {
    it('should create client with correct config', () => {
      const service = new LarkChatService();
      expect(service).toBeDefined();
    });

    it('should throw when appId is missing', () => {
      jest.resetModules();
      jest.doMock('@/core/config', () => ({
        config: {
          lark: { appId: '', appSecret: 'secret', receiveId: 'id' },
        },
      }));
      const { LarkChatService: FreshService } = require('@/presentation/lark/chat');
      expect(() => new FreshService()).toThrow(
        'Missing required Lark environment variables'
      );
    });

    it('should throw when appSecret is missing', () => {
      jest.resetModules();
      jest.doMock('@/core/config', () => ({
        config: {
          lark: { appId: 'id', appSecret: '', receiveId: 'id' },
        },
      }));
      const { LarkChatService: FreshService } = require('@/presentation/lark/chat');
      expect(() => new FreshService()).toThrow(
        'Missing required Lark environment variables'
      );
    });
  });

  describe('getOrCreateChat', () => {
    it('should return existing chat id when found by description', async () => {
      const cwd = process.cwd();
      mockChatList.mockResolvedValueOnce({
        data: {
          items: [
            { chat_id: 'existing-chat-id', description: `【\`${cwd}\`】` },
          ],
          has_more: false,
        },
      });

      const service = new LarkChatService();
      const chatId = await service.getOrCreateChat();

      expect(chatId).toBe('existing-chat-id');
      expect(mockChatCreate).not.toHaveBeenCalled();
    });

    it('should create new chat when not found', async () => {
      mockChatList.mockResolvedValueOnce({
        data: { items: [], has_more: false },
      });
      mockChatCreate.mockResolvedValueOnce({
        data: { chat_id: 'new-chat-id' },
      });

      const service = new LarkChatService();
      const chatId = await service.getOrCreateChat();

      expect(chatId).toBe('new-chat-id');
      expect(mockChatCreate).toHaveBeenCalled();
    });

    it('should throw when receiveId is missing', async () => {
      jest.resetModules();
      jest.doMock('@/core/config', () => ({
        config: {
          lark: { appId: 'id', appSecret: 'secret', receiveId: '' },
        },
      }));
      jest.doMock('@larksuiteoapi/node-sdk', () => ({
        Client: jest.fn().mockImplementation(() => ({
          im: {
            chat: { list: mockChatList, create: mockChatCreate },
          },
        })),
        AppType: { SelfBuild: 'self_build' },
        Domain: { Feishu: 'feishu' },
      }));
      const { LarkChatService: FreshService } = require('@/presentation/lark/chat');
      const service = new FreshService();
      await expect(service.getOrCreateChat()).rejects.toThrow(
        'Missing required Lark config: AIBO_LARK_RECEIVE_ID'
      );
    });

    it('should paginate through chat list pages', async () => {
      const cwd = process.cwd();
      mockChatList
        .mockResolvedValueOnce({
          data: {
            items: [{ chat_id: 'other-chat', description: 'other' }],
            has_more: true,
            page_token: 'token-123',
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ chat_id: 'found-chat', description: `【\`${cwd}\`】` }],
            has_more: false,
          },
        });

      const service = new LarkChatService();
      const chatId = await service.getOrCreateChat();

      expect(chatId).toBe('found-chat');
      expect(mockChatList).toHaveBeenCalledTimes(2);
    });

    it('should throw when chat creation returns no chat_id', async () => {
      mockChatList.mockResolvedValueOnce({
        data: { items: [], has_more: false },
      });
      mockChatCreate.mockResolvedValueOnce({ data: {} });

      const service = new LarkChatService();
      await expect(service.getOrCreateChat()).rejects.toThrow('创建群聊失败');
    });

    it('should handle items with no description', async () => {
      const cwd = process.cwd();
      mockChatList
        .mockResolvedValueOnce({
          data: {
            items: [
              { chat_id: 'no-desc-chat' },
              { chat_id: 'found-chat', description: `【\`${cwd}\`】` },
            ],
            has_more: false,
          },
        });

      const service = new LarkChatService();
      const chatId = await service.getOrCreateChat();

      expect(chatId).toBe('found-chat');
    });
  });

  describe('uploadImage', () => {
    const setupUploadMocks = (fileToken = 'file-token-123', downloadUrl = 'https://example.com/img.jpg') => {
      // File list: folder exists
      mockFileList
        .mockResolvedValueOnce({
          data: {
            files: [{ token: 'folder-token', name: '【素材库】', type: 'folder' }],
            has_more: false,
          },
        })
        // Bitable exists
        .mockResolvedValueOnce({
          data: {
            files: [{ token: 'bitable-token', name: '【素材多维表格】', type: 'bitable' }],
            has_more: false,
          },
        });
      mockMediaUploadAll.mockResolvedValueOnce({ file_token: fileToken });
      mockMediaBatchGetTmpDownloadUrl.mockResolvedValueOnce({
        data: {
          tmp_download_urls: [{ file_token: fileToken, tmp_download_url: downloadUrl }],
        },
      });
    };

    it('should use jpg extension for JPEG buffer', async () => {
      setupUploadMocks();
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const base64 = jpegBuffer.toString('base64');

      const service = new LarkChatService();
      await service.uploadImage(base64);

      const uploadCall = mockMediaUploadAll.mock.calls[0][0];
      expect(uploadCall.data.file_name).toMatch(/\.jpg$/);
    });

    it('should use png extension for PNG buffer', async () => {
      setupUploadMocks();
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const base64 = pngBuffer.toString('base64');

      const service = new LarkChatService();
      await service.uploadImage(base64);

      const uploadCall = mockMediaUploadAll.mock.calls[0][0];
      expect(uploadCall.data.file_name).toMatch(/\.png$/);
    });

    it('should use gif extension for GIF buffer', async () => {
      setupUploadMocks();
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const base64 = gifBuffer.toString('base64');

      const service = new LarkChatService();
      await service.uploadImage(base64);

      const uploadCall = mockMediaUploadAll.mock.calls[0][0];
      expect(uploadCall.data.file_name).toMatch(/\.gif$/);
    });

    it('should use webp extension for WebP buffer', async () => {
      setupUploadMocks();
      const webpBuffer = Buffer.alloc(12);
      webpBuffer.write('RIFF', 0, 'ascii');
      webpBuffer.write('WEBP', 8, 'ascii');
      const base64 = webpBuffer.toString('base64');

      const service = new LarkChatService();
      await service.uploadImage(base64);

      const uploadCall = mockMediaUploadAll.mock.calls[0][0];
      expect(uploadCall.data.file_name).toMatch(/\.webp$/);
    });

    it('should fall back to png extension for unknown buffer format', async () => {
      setupUploadMocks();
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const base64 = unknownBuffer.toString('base64');

      const service = new LarkChatService();
      await service.uploadImage(base64);

      const uploadCall = mockMediaUploadAll.mock.calls[0][0];
      expect(uploadCall.data.file_name).toMatch(/\.png$/);
    });
  });
});
