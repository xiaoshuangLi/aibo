import { TencentASR, createTencentASR } from '../src/utils/tencent-asr';

// Mock external dependencies
jest.mock('node-record-lpcm16', () => {
  const mockStream = {
    on: jest.fn(),
    pipe: jest.fn(),
  };
  
  return {
    record: jest.fn().mockReturnValue({
      stream: () => mockStream,
      stop: jest.fn(),
    }),
  };
});

// Mock the tencentcloud SDK
const mockSentenceRecognition = jest.fn();
jest.mock('tencentcloud-sdk-nodejs/tencentcloud/services/asr/v20190614/asr_client', () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return {
        SentenceRecognition: mockSentenceRecognition,
      };
    }),
  };
});

// Mock fs
jest.mock('fs', () => ({
  createWriteStream: jest.fn(),
}));

describe('TencentASR Coverage Tests', () => {
  const validConfig = {
    appId: 'test-app-id',
    secretId: 'test-secret-id',
    secretKey: 'test-secret-key',
  };

  let asr: TencentASR;

  beforeEach(() => {
    jest.clearAllMocks();
    asr = createTencentASR(validConfig);
  });

  test('constructor validates required config', () => {
    // When no config is provided, it should use defaults but still validate
    // The validation only happens when explicit empty values are provided
    expect(() => new TencentASR({ appId: '', secretId: 'test', secretKey: 'test' })).toThrow();
    expect(() => new TencentASR({ appId: 'test', secretId: '', secretKey: 'test' })).toThrow();
    expect(() => new TencentASR({ appId: 'test', secretId: 'test', secretKey: '' })).toThrow();
  });

  test('canRecord returns true', () => {
    expect(asr.canRecord()).toBe(true);
  });

  test('buildSignString sorts keys and formats correctly', () => {
    const params = { b: '2', a: '1', c: '3' };
    expect(asr.buildSignString(params)).toBe('a=1&b=2&c=3');
  });

  test('sign generates HMAC-SHA1 signature', () => {
    const signature = asr.sign('test', 'key');
    expect(typeof signature).toBe('string');
    expect(signature).toBeTruthy();
  });

  test('getClient creates and reuses client instance', () => {
    const client1 = (asr as any).getClient();
    const client2 = (asr as any).getClient();
    expect(client1).toBe(client2);
  });

  test('recordAudio handles success case', async () => {
    const mockStream = require('node-record-lpcm16').record().stream();
    const mockData = Buffer.from([1, 2, 3]);
    
    // Mock the stream to emit data
    mockStream.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        setTimeout(() => callback(mockData), 10);
      }
      return mockStream;
    });
    
    const result = await (asr as any).recordAudio(50);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  test('recordAudio handles initialization error', async () => {
    require('node-record-lpcm16').record.mockImplementationOnce(() => {
      throw new Error('init failed');
    });
    
    await expect((asr as any).recordAudio(100)).rejects.toThrow('Failed to initialize audio recorder');
  });

  test('recordAudio handles stream error', async () => {
    const mockStream = require('node-record-lpcm16').record().stream();
    
    mockStream.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'error') {
        setTimeout(() => callback(new Error('stream error')), 10);
      }
      return mockStream;
    });
    
    await expect((asr as any).recordAudio(100)).rejects.toThrow('Audio recording failed');
  });

  test('startManualRecording handles success', async () => {
    await expect(asr.startManualRecording()).resolves.toBeUndefined();
    expect(asr.isManualRecording()).toBe(true);
  });

  test('startManualRecording throws when already recording', () => {
    asr.startManualRecording();
    expect(() => asr.startManualRecording()).toThrow('Recording is already in progress');
    asr.stopManualRecording(); // cleanup
  });

  test('startManualRecording handles initialization error', async () => {
    require('node-record-lpcm16').record.mockImplementationOnce(() => {
      throw new Error('init failed');
    });
    
    await expect(asr.startManualRecording()).rejects.toThrow('Failed to initialize audio recorder');
    expect(asr.isManualRecording()).toBe(false);
  });

  test('stopManualRecording returns audio data', async () => {
    // Mock stream to provide data
    const mockStream = require('node-record-lpcm16').record().stream();
    const mockData = Buffer.from([1, 2, 3]);
    
    mockStream.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        (asr as any).recordingChunks.push(mockData);
      }
      return mockStream;
    });
    
    await asr.startManualRecording();
    const result = await asr.stopManualRecording();
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.length).toBeGreaterThan(0);
  });

  test('stopManualRecording returns null when no data', async () => {
    // Mock stream to NOT provide any data
    const mockStream = require('node-record-lpcm16').record().stream();
    
    mockStream.on.mockImplementation((event: string, callback: Function) => {
      // Don't emit any 'data' events
      return mockStream;
    });
    
    await asr.startManualRecording();
    const result = await asr.stopManualRecording();
    expect(result).toBeNull();
  });

  test('stopManualRecording throws when not recording', () => {
    expect(() => asr.stopManualRecording()).toThrow('No recording in progress');
  });

  test('recognizeSpeech handles successful recognition', async () => {
    // Mock recordAudio
    (asr as any).recordAudio = jest.fn().mockResolvedValue(Buffer.from([1, 2, 3]));
    
    // Mock ASR response
    mockSentenceRecognition.mockResolvedValue({ Result: 'Hello world' });
    
    const result = await asr.recognizeSpeech(100);
    expect(result).toBe('Hello world');
  });

  test('recognizeSpeech returns null when no speech recognized', async () => {
    (asr as any).recordAudio = jest.fn().mockResolvedValue(Buffer.from([1, 2, 3]));
    mockSentenceRecognition.mockResolvedValue({ Result: '' });
    
    const result = await asr.recognizeSpeech(100);
    expect(result).toBeNull();
  });

  test('recognizeSpeech handles ASR errors', async () => {
    (asr as any).recordAudio = jest.fn().mockResolvedValue(Buffer.from([1, 2, 3]));
    mockSentenceRecognition.mockRejectedValue(new Error('ASR error'));
    
    await expect(asr.recognizeSpeech(100)).rejects.toThrow('ASR error');
  });

  test('recognizeManualRecording handles successful recognition', async () => {
    mockSentenceRecognition.mockResolvedValue({ Result: 'Manual hello' });
    const result = await asr.recognizeManualRecording(Buffer.from([1, 2, 3]));
    expect(result).toBe('Manual hello');
  });

  test('recognizeManualRecording returns null for empty buffer', async () => {
    const result = await asr.recognizeManualRecording(Buffer.from([]));
    expect(result).toBeNull();
  });

  test('recognizeManualRecording returns null for null input', async () => {
    // @ts-ignore
    const result = await asr.recognizeManualRecording(null);
    expect(result).toBeNull();
  });

  test('recognizeManualRecording handles ASR errors', async () => {
    mockSentenceRecognition.mockRejectedValue(new Error('Manual ASR error'));
    await expect(asr.recognizeManualRecording(Buffer.from([1, 2, 3]))).rejects.toThrow('Manual ASR error');
  });

  test('startContinuousRecognition works', async () => {
    (asr as any).recordAudio = jest.fn().mockResolvedValue(Buffer.from([1, 2, 3]));
    mockSentenceRecognition.mockResolvedValue({ Result: 'Continuous speech' });
    
    const onResult = jest.fn();
    const onError = jest.fn();
    
    const stop = asr.startContinuousRecognition(onResult, onError);
    
    // Wait for recognition to happen
    await new Promise(resolve => setTimeout(resolve, 100));
    stop();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(onResult).toHaveBeenCalledWith('Continuous speech');
    expect(onError).not.toHaveBeenCalled();
  });

  test('startContinuousRecognition handles errors', async () => {
    (asr as any).recordAudio = jest.fn().mockResolvedValue(Buffer.from([1, 2, 3]));
    mockSentenceRecognition.mockRejectedValue(new Error('Continuous error'));
    
    const onResult = jest.fn();
    const onError = jest.fn();
    
    const stop = asr.startContinuousRecognition(onResult, onError);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    stop();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  test('handleRecognitionError rethrows errors', () => {
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    try {
      expect(() => {
        (asr as any).handleRecognitionError(new Error('test error'), 'test');
      }).toThrow('test error');
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Speech recognition failed in test'),
        expect.any(Error)
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test('handleRecognitionError handles non-Error objects', () => {
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    try {
      expect(() => {
        (asr as any).handleRecognitionError('string error', 'test');
      }).toThrow('string error');
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Speech recognition failed in test'),
        'string error'
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  test('startManualRecording handles stream error during recording', async () => {
    const mockStream = require('node-record-lpcm16').record().stream();
    
    // Mock the stream to emit an error
    mockStream.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'error') {
        callback(new Error('stream error'));
      }
      return mockStream;
    });
    
    await expect(asr.startManualRecording()).rejects.toThrow('Audio recording failed');
    expect(asr.isManualRecording()).toBe(false);
  });

  test('recognizeManualRecording logs when no speech recognized', async () => {
    const originalConsoleLog = console.log;
    const logSpy = jest.spyOn(console, 'log');
    
    try {
      mockSentenceRecognition.mockResolvedValue({ Result: '' });
      const result = await asr.recognizeManualRecording(Buffer.from([1, 2, 3]));
      
      expect(result).toBeNull();
      expect(logSpy).toHaveBeenCalledWith('⚠️  No speech recognized');
    } finally {
      logSpy.mockRestore();
    }
  });
});