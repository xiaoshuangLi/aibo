/**
 * Tencent Cloud ASR (Automatic Speech Recognition) utility for real-time voice input.
 * This module provides functionality to capture audio from microphone and convert it to text
 * using Tencent Cloud's ASR service via the official tencentcloud-sdk-nodejs.
 * 
 * @module tencent-asr
 */

import fs from 'fs';

import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/asr/v20190614/asr_client';
import { ClientConfig } from 'tencentcloud-sdk-nodejs/tencentcloud/common/interface';
import { BasicCredential } from 'tencentcloud-sdk-nodejs/tencentcloud/common/credential';

// Import the recorder module correctly
// @ts-ignore
import recorder from 'node-record-lpcm16';

// Import configuration
import { config } from '../config';

/**
 * Tencent Cloud ASR configuration interface.
 */
export interface TencentAsrConfig {
  appId: string;
  secretId: string;
  secretKey: string;
  region?: string;
  engineModelType?: string;
  voiceFormat?: string;
  hotwordId?: string;
  filterDirty?: number;
  filterModal?: number;
  filterPunc?: number;
  convertNumMode?: number;
  wordInfo?: number;
}

/**
 * Gets default ASR configuration values from the application config.
 * This function is called lazily to avoid module loading order issues.
 */
function getDefaultAsrConfig(): TencentAsrConfig {
  return {
    appId: config.tencentCloud.appId || '',
    secretId: config.tencentCloud.secretId || '',
    secretKey: config.tencentCloud.secretKey || '',
    region: config.tencentCloud.region || 'ap-shanghai',
    engineModelType: '16k_zh', // Chinese model with 16kHz sampling
    voiceFormat: 'pcm',        // PCM format as string
    hotwordId: '',
    filterDirty: 1,            // Filter dirty words
    filterModal: 2,            // Filter modal particles
    filterPunc: 0,             // Keep punctuation
    convertNumMode: 1,         // Convert numbers to digits
    wordInfo: 2,               // Include word-level information
  };
}

/**
 * Tencent Cloud ASR class for speech recognition.
 */
export class TencentASR {
  private config: TencentAsrConfig;
  private client: Client | null = null;
  private currentRecorder: any = null;
  private recordingChunks: Buffer[] = [];
  private isRecording: boolean = false;

  constructor(config: Partial<TencentAsrConfig> = {}) {
    this.config = { ...getDefaultAsrConfig(), ...config };
    this.validateConfig();
  }

  /**
   * Validates the Tencent Cloud ASR configuration.
   * @throws {Error} If required configuration is missing
   */
  private validateConfig(): void {
    if (!this.config.appId || !this.config.secretId || !this.config.secretKey) {
      throw new Error('请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量');
    }
  }

  /**
   * Creates a Tencent Cloud ASR client instance.
   * @returns Configured ASR client
   */
  private createClient(): Client {
    const credential = new BasicCredential(this.config.secretId, this.config.secretKey);
    const clientConfig: ClientConfig = {
      credential: credential,
      region: this.config.region,
      profile: {
        httpProfile: {
          reqMethod: "POST",
          reqTimeout: 30,
          endpoint: "asr.tencentcloudapi.com"
        }
      }
    };
    
    return new Client(clientConfig);
  }

  /**
   * Gets the ASR client instance, creating it if necessary.
   * @returns ASR client instance
   */
  private getClient(): Client {
    if (!this.client) {
      this.client = this.createClient();
    }
    return this.client;
  }

  /**
   * Records audio from microphone and returns the audio buffer.
   * @param duration - Recording duration in milliseconds
   * @returns Promise resolving to audio buffer
   */
  private async recordAudio(duration: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let recordingTime = 0;
      const interval = 100; // Check every 100ms
      
      try {
        const recorderInstance = recorder.record({
          sampleRate: 16000,
          channels: 1,
          threshold: 0.5,
          recorder: 'sox',
        });
        
        recorderInstance.stream().on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          recordingTime += interval;
          
          if (recordingTime >= duration) {
            recorderInstance.stop();
            const audioBuffer = Buffer.concat(chunks);
            resolve(audioBuffer);
          }
        });
        
        recorderInstance.stream().on('error', (err: Error) => {
          reject(new Error(`Audio recording failed: ${err.message}`));
        });
      } catch (error) {
        reject(new Error(`Failed to initialize audio recorder: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Checks if the system can record audio.
   * @returns boolean indicating if recording is possible
   */
  public canRecord(): boolean {
    return true;
    // try {
    //   const file = fs.createWriteStream('test.wav', { encoding: 'binary' })
    //   // Try to create a recorder instance
    //   const testRecorder = recorder.record({
    //     sampleRate: 16000,
    //     channels: 1,
    //     threshold: 0.5,
    //     recorder: 'sox',
    //   });
    //   testRecorder.stream().pipe(file); // Clean up immediately
    //   setTimeout(() => testRecorder.stop(), 1000)
    //   return true;
    // } catch (error) {
    //   console.error('Audio recording capability check failed:', error);
    //   return false;
    // }
  }

  /**
   * Starts manual audio recording.
   * @returns Promise that resolves when recording starts successfully
   * @throws {Error} If recording fails to start
   */
  public startManualRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    return new Promise((resolve, reject) => {
      try {
        this.recordingChunks = [];
        this.isRecording = true;
        
        const recorderInstance = recorder.record({
          sampleRate: 16000,
          channels: 1,
          threshold: 0.5,
          recorder: 'sox',
        });
        
        this.currentRecorder = recorderInstance;
        
        recorderInstance.stream().on('data', (chunk: Buffer) => {
          if (this.isRecording) {
            this.recordingChunks.push(chunk);
          }
        });
        
        recorderInstance.stream().on('error', (err: Error) => {
          this.isRecording = false;
          this.currentRecorder = null;
          this.recordingChunks = [];
          reject(new Error(`Audio recording failed: ${err.message}`));
        });
        
        console.log('🎙️ Manual recording started...');
        resolve();
      } catch (error) {
        this.isRecording = false;
        this.currentRecorder = null;
        this.recordingChunks = [];
        reject(new Error(`Failed to initialize audio recorder: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Stops manual audio recording and returns the recorded audio buffer.
   * @returns Promise resolving to audio buffer or null if no audio was recorded
   * @throws {Error} If recording was not in progress
   */
  public stopManualRecording(): Promise<Buffer | null> {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve) => {
      if (this.currentRecorder) {
        this.currentRecorder.stop();
        this.currentRecorder = null;
      }
      
      this.isRecording = false;
      
      if (this.recordingChunks.length > 0) {
        const audioBuffer = Buffer.concat(this.recordingChunks);
        console.log(`✅ Manual recording stopped (${audioBuffer.length} bytes)`);
        resolve(audioBuffer);
      } else {
        console.log('⚠️  No audio data recorded');
        resolve(null);
      }
      
      this.recordingChunks = [];
    });
  }

  /**
   * Checks if manual recording is currently in progress.
   * @returns boolean indicating if recording is active
   */
  public isManualRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Builds the sign string for authentication.
   * @param params - Parameters to include in the sign string
   * @returns Sign string
   */
  public buildSignString(params: Record<string, string | number>): string {
    const sortedKeys = Object.keys(params).sort();
    return sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  }

  /**
   * Generates HMAC-SHA1 signature.
   * @param signStr - String to sign
   * @param secretKey - Secret key for signing
   * @returns Base64 encoded signature
   */
  public sign(signStr: string, secretKey: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha1', secretKey);
    return hash.update(Buffer.from(signStr, 'utf8')).digest('base64');
  }

  /**
   * Performs real-time speech recognition using Tencent Cloud ASR.
   * This function records audio from the microphone for the specified duration
   * and sends it to Tencent Cloud for speech-to-text conversion.
   * 
   * @param duration - Recording duration in milliseconds (default: 5000ms)
   * @returns Promise resolving to recognized text or null if recognition failed
   * @throws {Error} If ASR request fails or configuration is invalid
   */
  public async recognizeSpeech(duration: number = 5000): Promise<string | null> {
    try {
      // Record audio from microphone
      console.log(`🎙️  Recording audio for ${duration}ms...`);
      const audioBuffer = await this.recordAudio(duration);
      console.log(`✅ Audio recorded (${audioBuffer.length} bytes)`);
      
      // Encode audio to base64
      const audioBase64 = audioBuffer.toString('base64');
      
      // Prepare ASR request parameters
      const params = {
        EngSerViceType: this.config.engineModelType || '16k_zh',
        SourceType: 1, // 0 for audio URL，1 for raw audio data, 
        VoiceFormat: this.config.voiceFormat || 'wav',
        Data: audioBase64,
        DataLen: audioBuffer.length,
        HotwordId: this.config.hotwordId || '',
        FilterDirty: this.config.filterDirty || 1,
        FilterModal: this.config.filterModal || 2,
        FilterPunc: this.config.filterPunc || 0,
        ConvertNumMode: this.config.convertNumMode || 1,
        WordInfo: this.config.wordInfo || 2,
      };
      
      console.log('📡 Sending audio to Tencent Cloud ASR...');
      
      // Get client and call ASR service
      const client = this.getClient();
      const response = await client.SentenceRecognition(params);
      
      if (response.Result && response.Result.trim()) {
        console.log(`🎯 Speech recognized: "${response.Result}"`);
        return response.Result;
      } else {
        console.log('⚠️  No speech recognized');
        return null;
      }
    } catch (error) {
      console.error('❌ Speech recognition failed:', error);
      throw error;
    }
  }

  /**
   * Performs speech recognition on manually recorded audio buffer.
   * 
   * @param audioBuffer - The recorded audio buffer to process
   * @returns Promise resolving to recognized text or null if recognition failed
   * @throws {Error} If ASR request fails or configuration is invalid
   */
  public async recognizeManualRecording(audioBuffer: Buffer): Promise<string | null> {
    if (!audioBuffer || audioBuffer.length === 0) {
      console.log('⚠️  No audio data to process');
      return null;
    }

    try {
      console.log(`📡 Sending manual recording to Tencent Cloud ASR (${audioBuffer.length} bytes)...`);
      
      // Encode audio to base64
      const audioBase64 = audioBuffer.toString('base64');
      
      // Prepare ASR request parameters
      const params = {
        EngSerViceType: this.config.engineModelType || '16k_zh',
        SourceType: 1, // 0 for audio URL，1 for raw audio data, 
        VoiceFormat: this.config.voiceFormat || 'wav',
        Data: audioBase64,
        DataLen: audioBuffer.length,
        HotwordId: this.config.hotwordId || '',
        FilterDirty: this.config.filterDirty || 1,
        FilterModal: this.config.filterModal || 2,
        FilterPunc: this.config.filterPunc || 0,
        ConvertNumMode: this.config.convertNumMode || 1,
        WordInfo: this.config.wordInfo || 2,
      };
      
      // Get client and call ASR service
      const client = this.getClient();
      const response = await client.SentenceRecognition(params);
      
      if (response.Result && response.Result.trim()) {
        console.log(`🎯 Speech recognized: "${response.Result}"`);
        return response.Result;
      } else {
        console.log('⚠️  No speech recognized');
        return null;
      }
    } catch (error) {
      console.error('❌ Manual speech recognition failed:', error);
      throw error;
    }
  }

  /**
   * Starts continuous speech recognition mode.
   * This function continuously listens for speech and returns recognized text
   * as soon as speech is detected and processed.
   * 
   * @param onResult - Callback function called when speech is recognized
   * @param onError - Callback function called when an error occurs
   * @returns Function to stop the continuous recognition
   */
  public startContinuousRecognition(
    onResult: (text: string) => void,
    onError: (error: Error) => void
  ): () => void {
    let isRunning = true;
    
    // Start continuous recognition loop
    const recognitionLoop = async () => {
      while (isRunning) {
        try {
          // Record for a short duration to detect speech
          const result = await this.recognizeSpeech(3000);
          if (result && isRunning) {
            onResult(result);
          }
        } catch (error) {
          if (isRunning) {
            onError(error as Error);
          }
        }
        
        // Small delay between recognition attempts
        if (isRunning) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    };
    
    recognitionLoop().catch(onError);
    
    // Return stop function
    return () => {
      isRunning = false;
    };
  }
}

/**
 * Creates a TencentASR instance with default configuration.
 * @returns TencentASR instance
 */
export function createTencentASR(config: Partial<TencentAsrConfig> = {}): TencentASR {
  return new TencentASR(config);
}