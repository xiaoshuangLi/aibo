/**
 * 腾讯云ASR（自动语音识别）工具模块
 * 
 * 中文名称：腾讯云ASR工具模块
 * 
 * 该模块提供实时语音输入功能，能够从麦克风捕获音频并使用腾讯云ASR服务
 * 将其转换为文本。支持手动录制、自动识别和连续语音识别模式。
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
 * 腾讯云ASR配置接口
 * 
 * 中文名称：腾讯云ASR配置接口
 * 
 * 定义腾讯云ASR服务的配置参数，用于初始化TencentASR实例。
 */
export interface TencentAsrConfig {
  appId: string;           // 腾讯云应用ID
  secretId: string;        // 腾讯云密钥ID
  secretKey: string;       // 腾讯云密钥
  region?: string;         // 区域，默认为'ap-shanghai'
  engineModelType?: string; // 引擎模型类型，默认为'16k_zh'
  voiceFormat?: string;    // 音频格式，默认为'pcm'
  hotwordId?: string;      // 热词ID，用于自定义词汇
  filterDirty?: number;    // 脏词过滤，1为过滤，0为不过滤
  filterModal?: number;    // 语气词过滤，2为过滤，0为不过滤
  filterPunc?: number;     // 标点符号过滤，0为保留，1为过滤
  convertNumMode?: number; // 数字转换模式，1为转换，0为不转换
  wordInfo?: number;       // 词级别信息，2为包含，0为不包含
}

/**
 * 获取默认ASR配置
 * 
 * 中文名称：获取默认ASR配置
 * 
 * 预期行为：
 * - 从应用程序配置中获取腾讯云ASR的默认配置值
 * - 提供合理的默认值以确保基本功能正常工作
 * - 延迟调用以避免模块加载顺序问题
 * 
 * 行为分支：
 * 1. 正常情况：返回包含所有必要配置的TencentAsrConfig对象
 * 2. 环境变量缺失：使用空字符串作为appId、secretId、secretKey的默认值
 * 
 * @returns TencentAsrConfig - 包含默认ASR配置的对象
 * 
 * @note
 * - 引擎模型类型默认为'16k_zh'（16kHz采样率的中文模型）
 * - 音频格式默认为'pcm'
 * - 启用脏词过滤和语气词过滤
 * - 保留标点符号并转换数字
 * - 包含词级别信息
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
 * 腾讯云ASR语音识别类
 * 
 * 中文名称：腾讯云ASR语音识别类
 * 
 * 该类提供与腾讯云ASR服务的完整集成，支持实时语音识别、手动录制和连续语音识别。
 * 封装了音频录制、ASR客户端管理、认证和错误处理等复杂逻辑。
 */
export class TencentASR {
  private config: TencentAsrConfig;
  private client: Client | null = null;
  private currentRecorder: any = null;
  private recordingChunks: Buffer[] = [];
  private isRecording: boolean = false;

  /**
   * 构造函数
   * 
   * 中文名称：构造函数
   * 
   * 预期行为：
   * - 接收可选的配置参数
   * - 合并默认配置和用户提供的配置
   * - 验证配置的有效性
   * 
   * 行为分支：
   * 1. 无配置参数：使用默认配置
   * 2. 有配置参数：合并默认配置和用户配置
   * 3. 配置验证：调用validateConfig()验证必需的配置项
   * 
   * @param config - 可选的TencentAsrConfig配置对象
   * @throws {Error} 如果缺少必需的配置项（appId、secretId、secretKey）
   */
  constructor(config: Partial<TencentAsrConfig> = {}) {
    this.config = { ...getDefaultAsrConfig(), ...config };
    this.validateConfig();
  }

  /**
   * 验证腾讯云ASR配置
   * 
   * 中文名称：验证腾讯云ASR配置
   * 
   * 预期行为：
   * - 检查必需的配置项是否已提供
   * - 抛出描述性错误信息
   * 
   * 行为分支：
   * 1. 配置完整：不抛出异常，正常返回
   * 2. 缺少appId：抛出错误"请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量"
   * 3. 缺少secretId：抛出相同错误
   * 4. 缺少secretKey：抛出相同错误
   * 
   * @throws {Error} 如果缺少必需的配置项
   */
  private validateConfig(): void {
    if (!this.config.appId || !this.config.secretId || !this.config.secretKey) {
      throw new Error('请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量');
    }
  }

  /**
   * 创建腾讯云ASR客户端实例
   * 
   * 中文名称：创建腾讯云ASR客户端实例
   * 
   * 预期行为：
   * - 使用提供的配置创建BasicCredential
   * - 构建ClientConfig对象
   * - 初始化并返回ASR客户端实例
   * 
   * 行为分支：
   * 1. 正常情况：成功创建并返回配置好的ASR客户端
   * 
   * @returns Client - 配置好的腾讯云ASR客户端实例
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
   * 获取ASR客户端实例
   * 
   * 中文名称：获取ASR客户端实例
   * 
   * 预期行为：
   * - 检查是否已存在客户端实例
   * - 如果不存在，创建新的客户端实例
   * - 返回客户端实例
   * 
   * 行为分支：
   * 1. 客户端已存在：直接返回现有实例
   * 2. 客户端不存在：调用createClient()创建新实例并返回
   * 
   * @returns Client - ASR客户端实例
   */
  private getClient(): Client {
    if (!this.client) {
      this.client = this.createClient();
    }
    return this.client;
  }

  /**
   * 录制音频
   * 
   * 中文名称：录制音频
   * 
   * 预期行为：
   * - 使用node-record-lpcm16库从麦克风录制音频
   * - 设置16kHz采样率、单声道、0.5阈值
   * - 使用sox作为录音后端
   * - 在指定持续时间后停止录制
   * - 返回录制的音频缓冲区
   * 
   * 行为分支：
   * 1. 正常录制：成功录制指定时长的音频并返回Buffer
   * 2. 录制初始化失败：抛出"Failed to initialize audio recorder"错误
   * 3. 录制过程中出错：抛出"Audio recording failed"错误
   * 
   * @param duration - 录制持续时间（毫秒）
   * @returns Promise<Buffer> - 录制的音频数据Buffer的Promise
   * @throws {Error} 如果录音初始化或录制过程中发生错误
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
   * 检查系统是否可以录制音频
   * 
   * 中文名称：检查系统是否可以录制音频
   * 
   * 预期行为：
   * - 检查系统是否具备音频录制能力
   * - 返回布尔值表示录制是否可能
   * 
   * 行为分支：
   * 1. 当前实现：总是返回true（简化实现）
   * 2. 注释中的实现：尝试创建测试录音器并验证功能
   * 
   * @returns boolean - 如果系统可以录制音频则返回true，否则返回false
   * 
   * @note
   * - 当前实现简化为总是返回true
   * - 完整实现需要测试sox工具和麦克风权限
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
   * 开始手动音频录制
   * 
   * 中文名称：开始手动音频录制
   * 
   * 预期行为：
   * - 检查是否已在录制中
   * - 初始化录音器并开始录制
   * - 存储录制的音频块
   * - 处理录制过程中的错误
   * 
   * 行为分支：
   * 1. 已在录制中：抛出"Recording is already in progress"错误
   * 2. 正常开始：成功初始化录音器，开始录制，返回resolved Promise
   * 3. 录制初始化失败：抛出"Failed to initialize audio recorder"错误
   * 4. 录制过程中出错：抛出"Audio recording failed"错误
   * 
   * @returns Promise<void> - 录制开始成功的Promise
   * @throws {Error} 如果录制已在进行中或录制初始化失败
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
   * 停止手动音频录制
   * 
   * 中文名称：停止手动音频录制
   * 
   * 预期行为：
   * - 检查是否正在进行录制
   * - 停止录音器
   * - 合并录制的音频块
   * - 重置录制状态
   * - 返回录制的音频缓冲区
   * 
   * 行为分支：
   * 1. 无录制进行中：抛出"No recording in progress"错误
   * 2. 有录制且有音频数据：停止录制，返回音频Buffer
   * 3. 有录制但无音频数据：停止录制，返回null
   * 
   * @returns Promise<Buffer | null> - 录制的音频数据Buffer或null（如果无数据）的Promise
   * @throws {Error} 如果没有正在进行的录制
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
   * 检查手动录制是否正在进行
   * 
   * 中文名称：检查手动录制是否正在进行
   * 
   * 预期行为：
   * - 返回当前录制状态的布尔值
   * 
   * 行为分支：
   * 1. 正在录制：返回true
   * 2. 未在录制：返回false
   * 
   * @returns boolean - 如果录制正在进行则返回true，否则返回false
   */
  public isManualRecording(): boolean {
    return this.isRecording;
  }

  /**
   * 构建签名字符串
   * 
   * 中文名称：构建签名字符串
   * 
   * 预期行为：
   * - 接收参数对象
   * - 按键名排序参数
   * - 构建"key=value"格式的字符串并用&连接
   * 
   * 行为分支：
   * 1. 正常情况：返回格式化的签名字符串
   * 
   * @param params - 要包含在签名字符串中的参数对象
   * @returns string - 格式化的签名字符串
   */
  public buildSignString(params: Record<string, string | number>): string {
    const sortedKeys = Object.keys(params).sort();
    return sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  }

  /**
   * 生成HMAC-SHA1签名
   * 
   * 中文名称：生成HMAC-SHA1签名
   * 
   * 预期行为：
   * - 使用Node.js内置crypto模块
   * - 创建HMAC-SHA1哈希
   * - 使用密钥对字符串进行签名
   * - 返回Base64编码的签名
   * 
   * 行为分支：
   * 1. 正常情况：成功生成并返回Base64编码的签名
   * 
   * @param signStr - 要签名的字符串
   * @param secretKey - 用于签名的密钥
   * @returns string - Base64编码的HMAC-SHA1签名
   */
  public sign(signStr: string, secretKey: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha1', secretKey);
    return hash.update(Buffer.from(signStr, 'utf8')).digest('base64');
  }

  /**
   * 处理语音识别错误
   * 
   * 中文名称：处理语音识别错误
   * 
   * 预期行为：
   * - 统一处理语音识别过程中的各种错误
   * - 记录详细的错误日志
   * - 重新抛出原始错误以保持调用栈完整性
   * 
   * @param error - 原始错误对象
   * @param context - 错误发生的上下文
   * @throws {Error} 重新抛出原始错误
   */
  private handleRecognitionError(error: unknown, context: string): never {
    console.error(`❌ Speech recognition failed in ${context}:`, error);
    throw error instanceof Error ? error : new Error(String(error));
  }

  /**
   * 执行实时语音识别
   * 
   * 中文名称：执行实时语音识别
   * 
   * 预期行为：
   * - 从麦克风录制指定时长的音频
   * - 将音频数据发送到腾讯云ASR服务
   * - 返回识别的文本结果
   * 
   * 行为分支：
   * 1. 正常识别：成功录制、发送并返回识别文本
   * 2. 无语音识别：返回null
   * 3. 录制失败：抛出音频录制相关错误
   * 4. ASR请求失败：抛出ASR服务相关错误
   * 
   * @param duration - 录制持续时间（毫秒），默认5000ms（5秒）
   * @returns Promise<string | null> - 识别的文本或null（如果识别失败）的Promise
   * @throws {Error} 如果ASR请求失败或配置无效
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
      this.handleRecognitionError(error, 'recognizeSpeech');
    }
  }

  /**
   * 执行手动录制音频的语音识别
   * 
   * 中文名称：执行手动录制音频的语音识别
   * 
   * 预期行为：
   * - 接收已录制的音频缓冲区
   * - 验证音频数据的有效性
   * - 将音频数据发送到腾讯云ASR服务
   * - 返回识别的文本结果
   * 
   * 行为分支：
   * 1. 无音频数据：返回null
   * 2. 正常识别：成功发送并返回识别文本
   * 3. 无语音识别：返回null
   * 4. ASR请求失败：抛出ASR服务相关错误
   * 
   * @param audioBuffer - 要处理的已录制音频缓冲区
   * @returns Promise<string | null> - 识别的文本或null（如果识别失败）的Promise
   * @throws {Error} 如果ASR请求失败或配置无效
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
   * 启动连续语音识别模式
   * 
   * 中文名称：启动连续语音识别模式
   * 
   * 预期行为：
   * - 持续监听语音输入
   * - 每3秒进行一次语音识别尝试
   * - 在识别到语音时调用onResult回调
   * - 在发生错误时调用onError回调
   * - 提供停止函数以终止连续识别
   * 
   * 行为分支：
   * 1. 正常识别：调用onResult回调传递识别文本
   * 2. 识别失败：调用onError回调传递错误对象
   * 3. 停止识别：设置isRunning为false，退出循环
   * 4. 识别间隔：每次识别后等待500ms再进行下一次尝试
   * 
   * @param onResult - 语音识别成功时调用的回调函数
   * @param onError - 发生错误时调用的回调函数
   * @returns () => void - 用于停止连续识别的函数
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
 * 创建腾讯云ASR实例
 * 
 * 中文名称：创建腾讯云ASR实例
 * 
 * 预期行为：
 * - 接收可选的配置参数
 * - 创建并返回配置好的TencentASR实例
 * 
 * 行为分支：
 * 1. 无配置参数：使用默认配置创建实例
 * 2. 有配置参数：合并默认配置和用户配置创建实例
 * 3. 配置验证：实例构造函数会验证必需的配置项
 * 
 * @param config - 可选的TencentAsrConfig配置对象
 * @returns TencentASR - 配置好的腾讯云ASR实例
 * 
 * @example
 * ```typescript
 * // 使用默认配置
 * const asr = createTencentASR();
 * 
 * // 使用自定义配置
 * const asr = createTencentASR({
 *   region: 'ap-beijing',
 *   engineModelType: '8k_zh'
 * });
 * ```
 */
export function createTencentASR(config: Partial<TencentAsrConfig> = {}): TencentASR {
  return new TencentASR(config);
}