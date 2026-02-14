import { VoiceRecognition, createVoiceRecognition } from '@/features/voice-input/voice-recognition';

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

  let asr: VoiceRecognition;

  beforeEach(() => {
    jest.clearAllMocks();
    asr = createVoiceRecognition(validConfig);
  });

  test('constructor validates required config', () => {
    // When no config is provided, it should use defaults but still validate
    // The validation only happens when explicit empty values are provided
    expect(() => new VoiceRecognition({ appId: '', secretId: 'test', secretKey: 'test' })).toThrow();
    expect(() => new VoiceRecognition({ appId: 'test', secretId: '', secretKey: 'test' })).toThrow();
    expect(() => new VoiceRecognition({ appId: 'test', secretId: 'test', secretKey: '' })).toThrow();
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
    
    const result = await asr.recordAudio(50);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  test('recordAudio handles initialization error', async () => {
    require('node-record-lpcm16').record.mockImplementationOnce(() => {
      throw new Error('init failed');
    });
    
    await expect(asr.recordAudio(100)).rejects.toThrow('Failed to initialize audio recorder');
  });

  test('recordAudio handles stream error', async () => {
    const mockStream = require('node-record-lpcm16').record().stream();
    
    mockStream.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'error') {
        setTimeout(() => callback(new Error('stream error')), 10);
      }
      return mockStream;
    });
    
    await expect(asr.recordAudio(100)).rejects.toThrow('Audio recording failed');
  });

  test('startManualRecording handles success', async () => {
    await expect(asr.startManualRecording()).resolves.toBeUndefined();
    expect(asr.isManualRecording()).toBe(true);
  });

  test('startManualRecording throws when already recording', () => {
    asr.startManualRecording();
    expect(() => asr.startManualRecording()).toThrow('Manual recording is already in progress');
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
    const mockData = Buffer.from([1, 2, 3]);
    
    // Mock the underlying AudioRecorder methods
    jest.spyOn((asr as any).audioRecorder, 'startManualRecording').mockResolvedValue(undefined);
    jest.spyOn((asr as any).audioRecorder, 'stopManualRecording').mockResolvedValue(mockData);
    jest.spyOn((asr as any).audioRecorder, 'isManualRecording').mockReturnValue(true);
    
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

  test('stopManualRecording returns null when not recording', async () => {
    const result = await asr.stopManualRecording();
    expect(result).toBeNull();
  });

  test('recognizeSpeech handles successful recognition', async () => {
    // Mock the underlying AudioRecorder's recordAudio method
    const recordAudioSpy = jest.spyOn((asr as any).audioRecorder, 'recordAudio').mockResolvedValue(Buffer.from([1, 2, 3]));
    
    // Mock ASR response
    mockSentenceRecognition.mockResolvedValue({ Result: 'Hello world' });
    
    const result = await asr.recognizeSpeech(100);
    expect(result).toBe('Hello world');
    
    recordAudioSpy.mockRestore();
  });

  test('recognizeSpeech returns null when no speech recognized', async () => {
    const recordAudioSpy = jest.spyOn((asr as any).audioRecorder, 'recordAudio').mockResolvedValue(Buffer.from([1, 2, 3]));
    mockSentenceRecognition.mockResolvedValue({ Result: '' });
    
    const result = await asr.recognizeSpeech(100);
    expect(result).toBeNull();
    
    recordAudioSpy.mockRestore();
  });

  test('recognizeSpeech handles ASR errors', async () => {
    const recordAudioSpy = jest.spyOn((asr as any).audioRecorder, 'recordAudio').mockResolvedValue(Buffer.from([1, 2, 3]));
    mockSentenceRecognition.mockRejectedValue(new Error('ASR error'));
    
    await expect(asr.recognizeSpeech(100)).rejects.toThrow('ASR error');
    
    recordAudioSpy.mockRestore();
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
    const recordAudioSpy = jest.spyOn((asr as any).audioRecorder, 'recordAudio').mockResolvedValue(Buffer.from([1, 2, 3]));
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
    
    recordAudioSpy.mockRestore();
  });

  test('startContinuousRecognition handles errors', async () => {
    const recordAudioSpy = jest.spyOn((asr as any).audioRecorder, 'recordAudio').mockResolvedValue(Buffer.from([1, 2, 3]));
    mockSentenceRecognition.mockRejectedValue(new Error('Continuous error'));
    
    const onResult = jest.fn();
    const onError = jest.fn();
    
    const stop = asr.startContinuousRecognition(onResult, onError);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    stop();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    
    recordAudioSpy.mockRestore();
  });



  test('startManualRecording handles stream error during recording', async () => {
    // Mock the AudioRecorder's startManualRecording to throw an error
    const originalStart = (asr as any).audioRecorder.startManualRecording;
    (asr as any).audioRecorder.startManualRecording = jest.fn().mockRejectedValue(new Error('Audio recording failed'));
    
    await expect(asr.startManualRecording()).rejects.toThrow('Audio recording failed');
    expect(asr.isManualRecording()).toBe(false);
    
    // Restore original method
    (asr as any).audioRecorder.startManualRecording = originalStart;
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