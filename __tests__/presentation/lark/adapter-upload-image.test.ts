import { LarkAdapter } from '@/presentation/lark/adapter';
import { config } from '@/core/config';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = jest.fn();
console.error = jest.fn();

// Mocks for the Lark client methods used by uploadImage
const mockFileList = jest.fn();
const mockFileCreateFolder = jest.fn();
const mockBitableAppCreate = jest.fn();
const mockMediaUploadAll = jest.fn();
const mockMediaBatchGetTmpDownloadUrl = jest.fn();

const mockLarkClient = {
  im: {
    message: {
      create: jest.fn().mockResolvedValue({ code: 0 }),
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
};

const mockWSClient = { start: jest.fn() };

jest.mock('@larksuiteoapi/node-sdk', () => ({
  Client: jest.fn().mockImplementation(() => mockLarkClient),
  WSClient: jest.fn().mockImplementation(() => mockWSClient),
  EventDispatcher: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockReturnThis(),
  })),
  AppType: { SelfBuild: 'self_build' },
  Domain: { Feishu: 'feishu' },
  LoggerLevel: { info: 'info' },
}));

jest.mock('@/presentation/lark/styler', () => ({
  styled: {
    assistant: jest.fn((t: string) => t),
    system: jest.fn((t: string) => t),
    error: jest.fn((t: string) => t),
    hint: jest.fn((t: string) => t),
    toolCall: jest.fn((n: string) => n),
    toolResult: jest.fn((n: string) => n),
    thinkingProcess: jest.fn(() => ''),
    truncated: jest.fn((t: string) => String(t ?? '')),
  },
}));

describe('LarkAdapter - uploadImage', () => {
  let adapter: LarkAdapter;
  let originalLarkConfig: any;

  const TEST_BASE64 = Buffer.from('fake-image-data').toString('base64');
  const FOLDER_TOKEN = 'folder-token-123';
  const BITABLE_TOKEN = 'bitable-app-token-456';
  const FILE_TOKEN = 'file-token-789';
  const TMP_URL = 'https://example.com/tmp/image.png';

  beforeEach(() => {
    jest.clearAllMocks();
    originalLarkConfig = { ...config.lark };
    config.lark = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      receiveId: 'test-receive-id',
      interactiveTemplateId: 'test-template-id',
    };
    adapter = new LarkAdapter();
  });

  afterEach(() => {
    config.lark = originalLarkConfig;
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('full happy-path: folder and bitable do not exist yet', () => {
    it('creates folder, creates bitable, uploads image, and returns tmp URL', async () => {
      // Step 1: file list for root – no 【素材库】 folder found
      mockFileList.mockResolvedValueOnce({ data: { files: [], has_more: false } });
      // Step 1: create folder
      mockFileCreateFolder.mockResolvedValueOnce({ data: { token: FOLDER_TOKEN } });
      // Step 2: file list inside folder – no 【素材多维表格】 found
      mockFileList.mockResolvedValueOnce({ data: { files: [], has_more: false } });
      // Step 2: create bitable
      mockBitableAppCreate.mockResolvedValueOnce({ data: { app: { app_token: BITABLE_TOKEN } } });
      // Step 3: upload image
      mockMediaUploadAll.mockResolvedValueOnce({ file_token: FILE_TOKEN });
      // Step 4: get tmp download URL
      mockMediaBatchGetTmpDownloadUrl.mockResolvedValueOnce({
        data: { tmp_download_urls: [{ file_token: FILE_TOKEN, tmp_download_url: TMP_URL }] },
      });

      const result = await adapter.uploadImage(TEST_BASE64);

      expect(result).toBe(TMP_URL);

      // Verify folder creation was called with correct args
      expect(mockFileCreateFolder).toHaveBeenCalledWith({
        data: { name: '【素材库】', folder_token: '' },
      });

      // Verify bitable creation was called with the folder token
      expect(mockBitableAppCreate).toHaveBeenCalledWith({
        data: { name: '【素材多维表格】', folder_token: FOLDER_TOKEN },
      });

      // Verify upload was called with the bitable token
      const uploadCall = mockMediaUploadAll.mock.calls[0][0];
      expect(uploadCall.data.parent_type).toBe('bitable_file');
      expect(uploadCall.data.parent_node).toBe(BITABLE_TOKEN);
      expect(uploadCall.data.file).toBeInstanceOf(Buffer);
      expect(uploadCall.data.size).toBeGreaterThan(0);

      // Verify batchGetTmpDownloadUrl was called with the file token
      expect(mockMediaBatchGetTmpDownloadUrl).toHaveBeenCalledWith({
        params: { file_tokens: [FILE_TOKEN] },
      });
    });
  });

  describe('folder already exists', () => {
    it('finds existing 【素材库】 folder instead of creating one', async () => {
      // Step 1: root folder list returns existing folder
      mockFileList.mockResolvedValueOnce({
        data: {
          files: [
            { token: FOLDER_TOKEN, name: '【素材库】', type: 'folder' },
          ],
          has_more: false,
        },
      });
      // Step 2: bitable list inside folder – none found
      mockFileList.mockResolvedValueOnce({ data: { files: [], has_more: false } });
      // Step 2: create bitable
      mockBitableAppCreate.mockResolvedValueOnce({ data: { app: { app_token: BITABLE_TOKEN } } });
      // Step 3: upload
      mockMediaUploadAll.mockResolvedValueOnce({ file_token: FILE_TOKEN });
      // Step 4: download URL
      mockMediaBatchGetTmpDownloadUrl.mockResolvedValueOnce({
        data: { tmp_download_urls: [{ file_token: FILE_TOKEN, tmp_download_url: TMP_URL }] },
      });

      const result = await adapter.uploadImage(TEST_BASE64);

      expect(result).toBe(TMP_URL);
      // createFolder should NOT have been called
      expect(mockFileCreateFolder).not.toHaveBeenCalled();
    });
  });

  describe('bitable already exists', () => {
    it('finds existing 【素材多维表格】 bitable instead of creating one', async () => {
      // Step 1: root has existing folder
      mockFileList.mockResolvedValueOnce({
        data: {
          files: [{ token: FOLDER_TOKEN, name: '【素材库】', type: 'folder' }],
          has_more: false,
        },
      });
      // Step 2: folder contents has existing bitable
      mockFileList.mockResolvedValueOnce({
        data: {
          files: [{ token: BITABLE_TOKEN, name: '【素材多维表格】', type: 'bitable' }],
          has_more: false,
        },
      });
      // Step 3: upload
      mockMediaUploadAll.mockResolvedValueOnce({ file_token: FILE_TOKEN });
      // Step 4: download URL
      mockMediaBatchGetTmpDownloadUrl.mockResolvedValueOnce({
        data: { tmp_download_urls: [{ file_token: FILE_TOKEN, tmp_download_url: TMP_URL }] },
      });

      const result = await adapter.uploadImage(TEST_BASE64);

      expect(result).toBe(TMP_URL);
      expect(mockBitableAppCreate).not.toHaveBeenCalled();
    });
  });

  describe('bitable token caching', () => {
    it('skips folder/bitable lookup on second call', async () => {
      // First call: full flow
      mockFileList
        .mockResolvedValueOnce({
          data: { files: [{ token: FOLDER_TOKEN, name: '【素材库】', type: 'folder' }], has_more: false },
        })
        .mockResolvedValueOnce({
          data: { files: [{ token: BITABLE_TOKEN, name: '【素材多维表格】', type: 'bitable' }], has_more: false },
        });
      mockMediaUploadAll.mockResolvedValue({ file_token: FILE_TOKEN });
      mockMediaBatchGetTmpDownloadUrl.mockResolvedValue({
        data: { tmp_download_urls: [{ file_token: FILE_TOKEN, tmp_download_url: TMP_URL }] },
      });

      await adapter.uploadImage(TEST_BASE64);

      // Second call: file.list should NOT be called again
      const listCallCount = mockFileList.mock.calls.length;

      await adapter.uploadImage(TEST_BASE64);

      expect(mockFileList.mock.calls.length).toBe(listCallCount); // no new list calls
    });
  });

  describe('pagination support', () => {
    it('iterates pages until folder is found', async () => {
      // Page 1: no match, has_more = true
      mockFileList.mockResolvedValueOnce({
        data: {
          files: [{ token: 'other-token', name: 'other-folder', type: 'folder' }],
          has_more: true,
          next_page_token: 'page2-token',
        },
      });
      // Page 2: match found
      mockFileList.mockResolvedValueOnce({
        data: {
          files: [{ token: FOLDER_TOKEN, name: '【素材库】', type: 'folder' }],
          has_more: false,
        },
      });
      // Step 2: bitable found in folder
      mockFileList.mockResolvedValueOnce({
        data: { files: [{ token: BITABLE_TOKEN, name: '【素材多维表格】', type: 'bitable' }], has_more: false },
      });
      mockMediaUploadAll.mockResolvedValueOnce({ file_token: FILE_TOKEN });
      mockMediaBatchGetTmpDownloadUrl.mockResolvedValueOnce({
        data: { tmp_download_urls: [{ file_token: FILE_TOKEN, tmp_download_url: TMP_URL }] },
      });

      const result = await adapter.uploadImage(TEST_BASE64);

      expect(result).toBe(TMP_URL);
      // Second page call should include page_token
      expect(mockFileList.mock.calls[1][0].params.page_token).toBe('page2-token');
    });
  });

  describe('error handling', () => {
    it('throws if createFolder returns no token', async () => {
      mockFileList.mockResolvedValueOnce({ data: { files: [], has_more: false } });
      mockFileCreateFolder.mockResolvedValueOnce({ data: {} }); // no token

      await expect(adapter.uploadImage(TEST_BASE64)).rejects.toThrow('创建「【素材库】」文件夹失败');
    });

    it('throws if bitable create returns no app_token', async () => {
      mockFileList.mockResolvedValueOnce({
        data: { files: [{ token: FOLDER_TOKEN, name: '【素材库】', type: 'folder' }], has_more: false },
      });
      mockFileList.mockResolvedValueOnce({ data: { files: [], has_more: false } });
      mockBitableAppCreate.mockResolvedValueOnce({ data: { app: {} } }); // no app_token

      await expect(adapter.uploadImage(TEST_BASE64)).rejects.toThrow('创建「【素材多维表格】」多维表格失败');
    });

    it('throws if media upload returns no file_token', async () => {
      mockFileList.mockResolvedValueOnce({
        data: { files: [{ token: FOLDER_TOKEN, name: '【素材库】', type: 'folder' }], has_more: false },
      });
      mockFileList.mockResolvedValueOnce({
        data: { files: [{ token: BITABLE_TOKEN, name: '【素材多维表格】', type: 'bitable' }], has_more: false },
      });
      mockMediaUploadAll.mockResolvedValueOnce({}); // no file_token

      await expect(adapter.uploadImage(TEST_BASE64)).rejects.toThrow('上传图片到多维表格失败');
    });

    it('throws if batchGetTmpDownloadUrl returns no URL', async () => {
      mockFileList.mockResolvedValueOnce({
        data: { files: [{ token: FOLDER_TOKEN, name: '【素材库】', type: 'folder' }], has_more: false },
      });
      mockFileList.mockResolvedValueOnce({
        data: { files: [{ token: BITABLE_TOKEN, name: '【素材多维表格】', type: 'bitable' }], has_more: false },
      });
      mockMediaUploadAll.mockResolvedValueOnce({ file_token: FILE_TOKEN });
      mockMediaBatchGetTmpDownloadUrl.mockResolvedValueOnce({ data: { tmp_download_urls: [] } });

      await expect(adapter.uploadImage(TEST_BASE64)).rejects.toThrow('获取素材临时下载链接失败');
    });
  });
});
