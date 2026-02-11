import { TencentASR, createTencentASR } from '../src/utils/tencent-asr';

describe('TencentASR Simple Tests', () => {
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

  test('should have recognizeSpeech method', () => {
    expect(asr.recognizeSpeech).toBeDefined();
    expect(typeof asr.recognizeSpeech).toBe('function');
  });

  test('should have startContinuousRecognition method', () => {
    expect(asr.startContinuousRecognition).toBeDefined();
    expect(typeof asr.startContinuousRecognition).toBe('function');
  });
});