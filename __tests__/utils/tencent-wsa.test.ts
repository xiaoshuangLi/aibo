import { TencentWSA, createTencentWSA } from '@/infrastructure/tencent-cloud/wsa-service';

describe('Tencent WSA', () => {
  it('should throw error when config is missing', () => {
    // Test with explicit empty strings
    expect(() => new TencentWSA({ 
      appId: '', 
      secretId: '', 
      secretKey: '' 
    })).toThrow('请设置 TENCENTCLOUD_APP_ID');
    
    // Test with partial config
    expect(() => new TencentWSA({ 
      appId: 'test', 
      secretId: '', 
      secretKey: '' 
    })).toThrow('请设置 TENCENTCLOUD_APP_ID');
    expect(() => new TencentWSA({ 
      appId: 'test', 
      secretId: 'test', 
      secretKey: '' 
    })).toThrow('请设置 TENCENTCLOUD_APP_ID');
  });

  it('should create instance with custom config', () => {
    const config = {
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key',
      region: 'ap-beijing'
    };
    
    const wsa = new TencentWSA(config);
    expect(wsa.canSearch()).toBe(true);
  });

  it('should validate partial config properly', () => {
    // Test with partial config - missing secretKey
    expect(() => new TencentWSA({ 
      appId: 'test', 
      secretId: 'test', 
      secretKey: '' 
    })).toThrow('请设置 TENCENTCLOUD_APP_ID');
    
    // Test with partial config - missing secretId
    expect(() => new TencentWSA({ 
      appId: 'test', 
      secretId: '', 
      secretKey: 'test' 
    })).toThrow('请设置 TENCENTCLOUD_APP_ID');
    
    // Test with partial config - missing appId
    expect(() => new TencentWSA({ 
      appId: '', 
      secretId: 'test', 
      secretKey: 'test' 
    })).toThrow('请设置 TENCENTCLOUD_APP_ID');
  });

  it('should create instance using factory function', () => {
    const config = {
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    };
    
    const wsa = createTencentWSA(config);
    expect(wsa).toBeInstanceOf(TencentWSA);
    expect(wsa.canSearch()).toBe(true);
  });
});