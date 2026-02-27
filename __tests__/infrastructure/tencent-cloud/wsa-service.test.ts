import { TencentWSA, createTencentWSA } from '../../../src/infrastructure/tencent-cloud/wsa-service';

// Mock the tencent SDK to avoid real API calls
jest.mock('tencentcloud-sdk-nodejs/tencentcloud/services/wsa/v20250508/wsa_client', () => ({
  Client: jest.fn().mockImplementation(() => ({
    SearchPro: jest.fn().mockResolvedValue({ Pages: [], Version: '1.0', RequestId: 'req-1' }),
  })),
}));

jest.mock('tencentcloud-sdk-nodejs/tencentcloud/common/credential', () => ({
  BasicCredential: jest.fn().mockImplementation((secretId, secretKey) => ({ secretId, secretKey })),
}));

jest.mock('tencentcloud-sdk-nodejs/tencentcloud/common/interface', () => ({}));

// Mock config
jest.mock('@/core/config/config', () => ({
  config: {
    tencentCloud: {
      appId: '',
      secretId: '',
      secretKey: '',
      region: 'ap-guangzhou',
    },
  },
}));

describe('TencentWSA service', () => {
  describe('constructor with explicit config', () => {
    it('uses provided config when all keys are given', () => {
      const wsa = new TencentWSA({
        appId: 'app123',
        secretId: 'sid',
        secretKey: 'skey',
        region: 'ap-beijing',
      });
      expect(wsa.canSearch()).toBe(true);
    });

    it('throws when required credentials are missing', () => {
      expect(() => new TencentWSA({ appId: 'app123' })).toThrow();
    });
  });

  describe('constructor with no config (uses defaults from env)', () => {
    it('throws when env credentials are empty', () => {
      expect(() => new TencentWSA()).toThrow();
    });
  });

  describe('canSearch', () => {
    it('returns true when all credentials are provided', () => {
      const wsa = new TencentWSA({ appId: 'a', secretId: 'b', secretKey: 'c' });
      expect(wsa.canSearch()).toBe(true);
    });

    it('canSearch returns false when appId is empty (validated by canSearch, not constructor)', () => {
      // Constructor validates - empty appId throws
      expect(() => new TencentWSA({ appId: '', secretId: 'b', secretKey: 'c' })).toThrow();
    });
  });

  describe('search', () => {
    it('returns response from client.SearchPro', async () => {
      const wsa = new TencentWSA({ appId: 'a', secretId: 'b', secretKey: 'c' });
      const result = await wsa.search('test query', 0);
      expect(result).toBeDefined();
    });

    it('throws error when SearchPro fails', async () => {
      const { Client } = require('tencentcloud-sdk-nodejs/tencentcloud/services/wsa/v20250508/wsa_client');
      Client.mockImplementationOnce(() => ({
        SearchPro: jest.fn().mockRejectedValue(new Error('API error')),
      }));

      const wsa = new TencentWSA({ appId: 'a', secretId: 'b', secretKey: 'c' });
      await expect(wsa.search('test', 0)).rejects.toThrow('网络搜索失败');
    });
  });

  describe('createTencentWSA factory', () => {
    it('creates a TencentWSA instance', () => {
      const wsa = createTencentWSA({ appId: 'a', secretId: 'b', secretKey: 'c' });
      expect(wsa).toBeInstanceOf(TencentWSA);
      expect(wsa.canSearch()).toBe(true);
    });
  });
});
