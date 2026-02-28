/**
 * 语音识别协调器
 * 
 * 中文名称：语音识别协调器
 * 
 * 该模块协调音频录制和语音识别服务，提供完整的语音输入功能。
 * 它组合了AudioRecorder和TencentAsrService，提供高层级的语音识别API。
 * 
 * @module VoiceRecognition
 */

import { AudioRecorder } from '@/infrastructure/audio';
import { TencentAsrService, TencentAsrConfig } from '@/infrastructure/tencent-cloud';

/**
 * 语音识别配置
 * 
 * 中文名称：语音识别配置
 * 
 * 组合了腾讯云ASR配置和通用配置选项。
 */
export interface VoiceRecognitionConfig extends TencentAsrConfig {
  // 可以添加其他配置选项
}

/**
 * 语音识别协调器类
 * 
 * 中文名称：语音识别协调器类
 * 
 * 该类提供与语音识别相关的完整功能，包括自动识别、手动录制和连续识别。
 * 它封装了AudioRecorder和TencentAsrService的复杂交互。
 */
export class VoiceRecognition {
  private audioRecorder: AudioRecorder;
  private asrService: TencentAsrService;

  /**
   * 构造函数
   * 
   * 中文名称：构造函数
   * 
   * 预期行为：
   * - 创建AudioRecorder实例
   * - 创建TencentAsrService实例
   * - 初始化语音识别协调器
   * 
   * 行为分支：
   * 1. 正常情况：成功创建两个依赖实例
   * 2. 配置验证失败：TencentAsrService构造函数会抛出错误
   * 
   * @param config - VoiceRecognitionConfig配置对象
   * @throws {Error} 如果腾讯云ASR配置无效
   */
  constructor(config: VoiceRecognitionConfig) {
    this.audioRecorder = new AudioRecorder();
    this.asrService = new TencentAsrService(config);
  }

  /**
   * 检查系统是否可以录制音频
   * 
   * 中文名称：检查系统是否可以录制音频
   * 
   * 预期行为：
   * - 委托给AudioRecorder的canRecord方法
   * - 返回录制能力检查结果
   * 
   * 行为分支：
   * 1. 正常情况：返回AudioRecorder.canRecord()的结果
   * 
   * @returns boolean - 如果系统可以录制音频则返回true，否则返回false
   */
  public canRecord(): boolean {
    return this.audioRecorder.canRecord();
  }

  /**
   * 开始手动音频录制
   * 
   * 中文名称：开始手动音频录制
   * 
   * 预期行为：
   * - 委托给AudioRecorder的startManualRecording方法
   * - 启动手动录制
   * 
   * 行为分支：
   * 1. 正常情况：成功启动录制
   * 2. 已在录制：抛出错误
   * 3. 初始化失败：抛出错误
   * 
   * @throws {Error} 如果已在录制或初始化失败
   */
  public startManualRecording(): Promise<void> {
    return this.audioRecorder.startManualRecording();
  }

  /**
   * 停止手动音频录制
   * 
   * 中文名称：停止手动音频录制
   * 
   * 预期行为：
   * - 委托给AudioRecorder的stopManualRecording方法
   * - 停止录制并返回音频数据
   * 
   * 行为分支：
   * 1. 未在录制：返回null
   * 2. 有音频数据：返回音频Buffer
   * 3. 无音频数据：返回null
   * 
   * @returns Promise<Buffer | null> - 录制的音频数据或null
   */
  public stopManualRecording(): Promise<Buffer | null> {
    return this.audioRecorder.stopManualRecording();
  }

  /**
   * 检查是否正在手动录制
   * 
   * 中文名称：检查是否正在手动录制
   * 
   * 预期行为：
   * - 委托给AudioRecorder的isManualRecording方法
   * - 返回当前录制状态
   * 
   * 行为分支：
   * 1. 正常情况：返回AudioRecorder.isManualRecording()的结果
   * 
   * @returns boolean - 如果正在录制返回true，否则返回false
   */
  public isManualRecording(): boolean {
    return this.audioRecorder.isManualRecording();
  }

  /**
   * 录制音频
   * 
   * 中文名称：录制音频
   * 
   * 预期行为：
   * - 委托给AudioRecorder的recordAudio方法
   * - 录制指定时长的音频
   * 
   * 行为分支：
   * 1. 正常情况：返回录制的音频Buffer
   * 2. 录制失败：抛出错误
   * 
   * @param duration - 录制持续时间（毫秒）
   * @returns Promise<Buffer> - 录制的音频数据Buffer的Promise
   * @throws {Error} 如果录音初始化或录制过程中发生错误
   */
  public recordAudio(duration: number): Promise<Buffer> {
    return this.audioRecorder.recordAudio(duration);
  }

  /**
   * 构建签名字符串
   * 
   * 中文名称：构建签名字符串
   * 
   * 预期行为：
   * - 委托给AsrService的buildSignString方法
   * - 构建腾讯云API签名字符串
   * 
   * 行为分支：
   * 1. 正常情况：返回格式化的签名字符串
   * 
   * @param params - 参数对象
   * @returns string - 签名字符串
   */
  public buildSignString(params: Record<string, string | number>): string {
    return this.asrService.buildSignString(params);
  }

  /**
   * 生成HMAC-SHA1签名
   * 
   * 中文名称：生成HMAC-SHA1签名
   * 
   * 预期行为：
   * - 委托给AsrService的sign方法
   * - 生成HMAC-SHA1签名
   * 
   * 行为分支：
   * 1. 正常情况：返回base64编码的签名结果
   * 
   * @param signStr - 待签名的字符串
   * @param secretKey - 密钥
   * @returns string - base64编码的签名结果
   */
  public sign(signStr: string, secretKey: string): string {
    return this.asrService.sign(signStr, secretKey);
  }

  /**
   * 识别语音
   * 
   * 中文名称：识别语音
   * 
   * 预期行为：
   * - 录制指定时长的音频
   * - 如果录制成功，发送到ASR服务进行识别
   * - 返回识别结果
   * 
   * 行为分支：
   * 1. 录制成功且识别成功：返回识别的文本
   * 2. 录制成功但未识别到语音：返回null
   * 3. 录制成功但识别失败：抛出错误
   * 4. 录制失败：抛出错误
   * 
   * @param duration - 录制持续时间（毫秒），默认5000ms
   * @returns Promise<string | null> - 识别结果文本或null
   * @throws {Error} 如果录制或识别过程中发生错误
   */
  public async recognizeSpeech(duration: number = 5000): Promise<string | null> {
    try {
      console.log(`🎙️  Recording audio for ${duration}ms...`);
      const audioBuffer = await this.audioRecorder.recordAudio(duration);
      console.log(`✅ Audio recorded (${audioBuffer.length} bytes)`);
      
      if (audioBuffer.length === 0) {
        console.log('⚠️  No audio data recorded');
        return null;
      }
      
      console.log('📡 Sending audio to Tencent Cloud ASR...');
      const result = await this.asrService.recognizeManualRecording(audioBuffer);
      
      if (result) {
        console.log('🎯 Speech recognized:', `"${result}"`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Speech recognition failed in recognizeSpeech:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * 识别手动录制的音频
   * 
   * 中文名称：识别手动录制的音频
   * 
   * 预期行为：
   * - 委托给TencentAsrService的recognizeManualRecording方法
   * - 识别提供的音频数据
   * 
   * 行为分支：
   * 1. 音频数据为空：返回null
   * 2. 识别成功：返回识别的文本
   * 3. 未识别到语音：返回null
   * 4. 识别失败：抛出错误
   * 
   * @param audioBuffer - 音频数据Buffer
   * @returns Promise<string | null> - 识别结果文本或null
   * @throws {Error} 如果识别过程中发生错误
   */
  public async recognizeManualRecording(audioBuffer: Buffer): Promise<string | null> {
    return this.asrService.recognizeManualRecording(audioBuffer);
  }

  /**
   * 开始连续语音识别
   * 
   * 中文名称：开始连续语音识别
   * 
   * 预期行为：
   * - 启动一个循环，持续录制和识别语音
   * - 在每次识别后调用回调函数
   * - 返回停止函数用于中断识别
   * 
   * 行为分支：
   * 1. 正常识别：调用onResult回调
   * 2. 识别失败：调用onError回调
   * 3. 被停止：正常退出循环
   * 
   * @param onResult - 识别成功时的回调函数
   * @param onError - 识别失败时的回调函数
   * @returns () => void - 停止函数，调用后停止连续识别
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

// Import configuration at the top level
import { config as appConfig } from '@/core/config';

/**
 * 创建语音识别实例的工厂函数
 * 
 * 中文名称：创建语音识别实例的工厂函数
 * 
 * 预期行为：
 * - 从应用程序配置中获取默认ASR配置
 * - 合并用户提供的配置
 * - 创建并返回VoiceRecognition实例
 * 
 * 行为分支：
 * 1. 无配置参数：使用默认配置
 * 2. 有配置参数：合并默认配置和用户配置
 * 
 * @param config - 可选的VoiceRecognitionConfig配置对象
 * @returns VoiceRecognition - 语音识别实例
 */
export function createVoiceRecognition(config: Partial<VoiceRecognitionConfig> = {}): VoiceRecognition {
  const defaultConfig: VoiceRecognitionConfig = {
    appId: appConfig.tencentCloud.appId || '',
    secretId: appConfig.tencentCloud.secretId || '',
    secretKey: appConfig.tencentCloud.secretKey || '',
    region: appConfig.tencentCloud.region || 'ap-shanghai',
    engineModelType: '16k_zh', // Chinese model with 16kHz sampling
    voiceFormat: 'pcm',        // PCM format as string
    hotwordId: '',
    filterDirty: 1,            // Filter dirty words
    filterModal: 2,            // Filter modal particles
    filterPunc: 0,             // Keep punctuation
    convertNumMode: 1,         // Convert numbers to digits
    wordInfo: 2,               // Include word-level information
  };
  
  return new VoiceRecognition({ ...defaultConfig, ...config });
}