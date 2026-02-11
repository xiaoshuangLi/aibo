import { TencentASR, createTencentASR } from '../src/utils/tencent-asr';

describe('TencentASR', () => {
  let asr: TencentASR;

  beforeAll(() => {
    // Create ASR instance with explicit configuration
    asr = createTencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    });
  });

  test('should create TencentASR instance', () => {
    expect(asr).toBeDefined();
  });

  test('should throw error when secretId is not set', () => {
    expect(() => new TencentASR({
      appId: 'test-app-id',
      secretId: '',
      secretKey: 'test-secret-key'
    })).toThrow('请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量');
  });

  test('should throw error when secretKey is not set', () => {
    expect(() => new TencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: ''
    })).toThrow('请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量');
  });

  test('should check recording capability', () => {
    // 这个测试会根据实际系统环境返回 true 或 false
    // 我们只测试方法存在且不抛出异常
    expect(() => {
      const canRecord = asr.canRecord();
      expect(typeof canRecord).toBe('boolean');
    }).not.toThrow();
  });

  test('should build sign string correctly', () => {
    const params = {
      secretid: 'test-secret-id',
      appid: 'test-app-id',
      engine_model_type: '16k_zh',
      voice_format: 'pcm'
    };
    
    const signStr = asr.buildSignString(params);
    expect(signStr).toBe('appid=test-app-id&engine_model_type=16k_zh&secretid=test-secret-id&voice_format=pcm');
  });

  test('should generate signature correctly', () => {
    const signStr = 'test-sign-string';
    const secretKey = 'test-secret-key';
    const signature = asr.sign(signStr, secretKey);
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
  });

  test('should have recognizeSpeech method', () => {
    expect(asr.recognizeSpeech).toBeDefined();
    expect(typeof asr.recognizeSpeech).toBe('function');
  });

  test('should have startContinuousRecognition method', () => {
    expect(asr.startContinuousRecognition).toBeDefined();
    expect(typeof asr.startContinuousRecognition).toBe('function');
  });
});