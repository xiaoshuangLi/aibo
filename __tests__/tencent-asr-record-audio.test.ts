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

describe('TencentASR recordAudio Error Handling', () => {
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

  test('should handle recorder initialization error', async () => {
    // Mock recorder.record to throw an error
    (recorder.record as jest.Mock).mockImplementation(() => {
      throw new Error('Failed to initialize audio recorder');
    });

    await expect(asr['recordAudio'](1000)).rejects.toThrow('Failed to initialize audio recorder');
  });

  test('should handle recorder stream error', async () => {
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

    // Call recordAudio and wait for it to start
    const recordPromise = asr['recordAudio'](1000);
    
    // Trigger the error callback after a short delay
    setTimeout(() => {
      if (mockStreamCallbacks['error']) {
        mockStreamCallbacks['error'][0](new Error('Audio recording failed'));
      }
    }, 10);

    await expect(recordPromise).rejects.toThrow('Audio recording failed');
  });

  test('should handle successful recording', async () => {
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

    // Call recordAudio
    const recordPromise = asr['recordAudio'](100);
    
    // Simulate receiving audio data and then completion
    setTimeout(() => {
      if (mockStreamCallbacks['data']) {
        // Send some audio data
        mockStreamCallbacks['data'][0](Buffer.from([1, 2, 3, 4]));
        
        // After 150ms (more than duration), the recording should complete
        setTimeout(() => {
          if (mockStreamCallbacks['data']) {
            mockStreamCallbacks['data'][0](Buffer.from([5, 6, 7, 8]));
          }
        }, 150);
      }
    }, 10);

    const result = await recordPromise;
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});