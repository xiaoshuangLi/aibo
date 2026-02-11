import { TencentASR } from '../src/utils/tencent-asr';

// Mock the recorder module to simulate different scenarios
jest.mock('node-record-lpcm16', () => {
  const mockRecorder = {
    record: jest.fn(),
  };
  
  return mockRecorder;
});

// Import the mocked recorder
import recorder from 'node-record-lpcm16';

describe('TencentASR Manual Recording Full Flow', () => {
  let asr: TencentASR;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create ASR instance with test configuration
    asr = new TencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    });
  });

  test('should handle empty manual recording', async () => {
    // Create a mock stream that can store callbacks
    const mockStreamCallbacks: Record<string, Function[]> = {};
    
    const mockStream = {
      on: (event: string, callback: Function) => {
        if (!mockStreamCallbacks[event]) {
          mockStreamCallbacks[event] = [];
        }
        mockStreamCallbacks[event].push(callback);
        return mockStream;
      },
    };
    
    const mockRecorderInstance = {
      stream: () => mockStream,
      stop: jest.fn(),
    };
    
    (recorder.record as jest.Mock).mockReturnValue(mockRecorderInstance);

    // Start manual recording
    await expect(asr.startManualRecording()).resolves.toBeUndefined();
    expect(asr.isManualRecording()).toBe(true);

    // Stop manual recording without sending any data
    const audioBuffer = await asr.stopManualRecording();
    expect(audioBuffer).toBeNull();
    expect(asr.isManualRecording()).toBe(false);
  });

  test('should handle manual recording with audio data', async () => {
    // Create a mock stream that can store callbacks
    const mockStreamCallbacks: Record<string, Function[]> = {};
    
    const mockStream = {
      on: (event: string, callback: Function) => {
        if (!mockStreamCallbacks[event]) {
          mockStreamCallbacks[event] = [];
        }
        mockStreamCallbacks[event].push(callback);
        return mockStream;
      },
    };
    
    const mockRecorderInstance = {
      stream: () => mockStream,
      stop: jest.fn(),
    };
    
    (recorder.record as jest.Mock).mockReturnValue(mockRecorderInstance);

    // Start manual recording
    await expect(asr.startManualRecording()).resolves.toBeUndefined();
    expect(asr.isManualRecording()).toBe(true);

    // Simulate receiving audio data
    if (mockStreamCallbacks['data']) {
      mockStreamCallbacks['data'][0](Buffer.from([1, 2, 3, 4, 5, 6]));
    }

    // Stop manual recording
    const audioBuffer = await asr.stopManualRecording();
    expect(audioBuffer).not.toBeNull();
    expect(audioBuffer).toBeInstanceOf(Buffer);
    if (audioBuffer) {
      expect(audioBuffer.length).toBe(6);
    }
    expect(asr.isManualRecording()).toBe(false);
  });

  test('should handle manual recording initialization error', async () => {
    // Mock recorder.record to throw an error
    (recorder.record as jest.Mock).mockImplementation(() => {
      throw new Error('Failed to initialize audio recorder');
    });

    await expect(asr.startManualRecording()).rejects.toThrow('Failed to initialize audio recorder');
    expect(asr.isManualRecording()).toBe(false);
  });

  test('should reject starting recording when already recording', () => {
    // Create a fresh instance and manually set the isRecording state to true
    const freshAsr = new TencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    });
    
    // Manually set the isRecording state to true using Object.defineProperty
    Object.defineProperty(freshAsr, 'isRecording', { value: true, writable: true });

    expect(() => freshAsr.startManualRecording()).toThrow('Recording is already in progress');
  });

  test('should reject stopping recording when not recording', () => {
    // Use a fresh instance to ensure clean state
    const freshAsr = new TencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    });
    
    // Ensure we're not recording
    Object.defineProperty(freshAsr, 'isRecording', { value: false, writable: true });

    expect(() => freshAsr.stopManualRecording()).toThrow('No recording in progress');
  });
});