import { TencentASR, createTencentASR } from '../src/utils/tencent-asr';

describe('TencentASR Manual Recording', () => {
  let asr: TencentASR;

  beforeAll(() => {
    // Create ASR instance with explicit configuration
    asr = createTencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    });
  });

  test('should have startManualRecording method', () => {
    expect(asr.startManualRecording).toBeDefined();
    expect(typeof asr.startManualRecording).toBe('function');
  });

  test('should have stopManualRecording method', () => {
    expect(asr.stopManualRecording).toBeDefined();
    expect(typeof asr.stopManualRecording).toBe('function');
  });

  test('should have isManualRecording method', () => {
    expect(asr.isManualRecording).toBeDefined();
    expect(typeof asr.isManualRecording).toBe('function');
  });

  test('should have recognizeManualRecording method', () => {
    expect(asr.recognizeManualRecording).toBeDefined();
    expect(typeof asr.recognizeManualRecording).toBe('function');
  });

  test('should return false for isManualRecording when not recording', () => {
    expect(asr.isManualRecording()).toBe(false);
  });

  test('should throw error when starting manual recording while already recording', () => {
    // Use a fresh instance for this test to avoid state contamination
    const freshAsr = createTencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id', 
      secretKey: 'test-secret-key'
    });
    
    // Mock the internal isRecording state using Jest's ability to spy on private properties
    Object.defineProperty(freshAsr, 'isRecording', { value: true, writable: true });
    
    expect(() => freshAsr.startManualRecording()).toThrow('Recording is already in progress');
  });

  test('should throw error when stopping manual recording when not recording', () => {
    // Use a fresh instance for this test to ensure clean state
    const freshAsr = createTencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    });
    
    // Ensure we're not recording by explicitly setting the state
    Object.defineProperty(freshAsr, 'isRecording', { value: false, writable: true });
    
    expect(freshAsr.isManualRecording()).toBe(false);
    expect(() => freshAsr.stopManualRecording()).toThrow('No recording in progress');
  });

  test('should handle empty buffer in recognizeManualRecording', async () => {
    const result = await asr.recognizeManualRecording(Buffer.from([]));
    expect(result).toBeNull();
  });

  test('should handle null buffer in recognizeManualRecording', async () => {
    // @ts-ignore - testing edge case
    const result = await asr.recognizeManualRecording(null);
    expect(result).toBeNull();
  });
});