import { LarkChatService } from '@/presentation/lark/chat';

// Mock lark SDK
const mockChatList = jest.fn();
const mockChatCreate = jest.fn();
const mockChatAnnouncementGet = jest.fn();
const mockChatAnnouncementPatch = jest.fn();

jest.mock('@larksuiteoapi/node-sdk', () => ({
  Client: jest.fn().mockImplementation(() => ({
    im: {
      chat: {
        list: mockChatList,
        create: mockChatCreate,
      },
      chatAnnouncement: {
        get: mockChatAnnouncementGet,
        patch: mockChatAnnouncementPatch,
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

    it('should create new chat and update announcement when not found', async () => {
      mockChatList.mockResolvedValueOnce({
        data: { items: [], has_more: false },
      });
      mockChatCreate.mockResolvedValueOnce({
        data: { chat_id: 'new-chat-id' },
      });
      mockChatAnnouncementGet.mockResolvedValueOnce({
        data: { revision: '5' },
      });
      mockChatAnnouncementPatch.mockResolvedValueOnce({});

      const service = new LarkChatService();
      const chatId = await service.getOrCreateChat();

      expect(chatId).toBe('new-chat-id');
      expect(mockChatCreate).toHaveBeenCalled();
      expect(mockChatAnnouncementPatch).toHaveBeenCalled();
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
            chatAnnouncement: {
              get: mockChatAnnouncementGet,
              patch: mockChatAnnouncementPatch,
            },
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

    it('should use revision 0 when announcement get fails', async () => {
      mockChatList.mockResolvedValueOnce({
        data: { items: [], has_more: false },
      });
      mockChatCreate.mockResolvedValueOnce({
        data: { chat_id: 'new-chat-id' },
      });
      mockChatAnnouncementGet.mockRejectedValueOnce(new Error('get failed'));
      mockChatAnnouncementPatch.mockResolvedValueOnce({});

      const service = new LarkChatService();
      const chatId = await service.getOrCreateChat();

      expect(chatId).toBe('new-chat-id');
      expect(mockChatAnnouncementPatch).toHaveBeenCalled();
      const patchCall = mockChatAnnouncementPatch.mock.calls[0][0];
      expect(patchCall.data.revision).toBe('0');
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
});
