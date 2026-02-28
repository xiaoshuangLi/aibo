/**
 * 腾讯云ASR服务适配器
 * 
 * 中文名称：腾讯云ASR服务适配器
 * 
 * 该模块提供腾讯云ASR服务的抽象接口，封装了与腾讯云API的交互细节。
 * 实现了IAsrService接口，提供语音识别的核心功能。
 * 
 * @module AsrService
 */

import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/asr/v20190614/asr_client';
import { ClientConfig } from 'tencentcloud-sdk-nodejs/tencentcloud/common/interface';
import { BasicCredential } from 'tencentcloud-sdk-nodejs/tencentcloud/common/credential';

/**
 * 腾讯云ASR配置接口
 * 
 * 中文名称：腾讯云ASR配置接口
 * 
 * 定义腾讯云ASR服务的配置参数，用于初始化TencentAsrService实例。
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
 * 腾讯云ASR服务类
 * 
 * 中文名称：腾讯云ASR服务类
 * 
 * 该类提供与腾讯云ASR服务的完整集成，封装了认证、客户端管理、
 * 签名生成和语音识别等核心功能。
 */
export class TencentAsrService {
  private config: TencentAsrConfig;
  private client: Client | null = null;

  /**
   * 构造函数
   * 
   * 中文名称：构造函数
   * 
   * 预期行为：
   * - 接收必需的配置参数
   * - 验证配置的有效性
   * 
   * 行为分支：
   * 1. 配置完整：正常初始化实例
   * 2. 配置验证失败：抛出错误"请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量"
   * 
   * @param config - TencentAsrConfig配置对象
   * @throws {Error} 如果缺少必需的配置项
   */
  constructor(config: TencentAsrConfig) {
    this.config = config;
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
   * 构建签名字符串
   * 
   * 中文名称：构建签名字符串
   * 
   * 预期行为：
   * - 将参数对象按字母顺序排序
   * - 连接成key=value&key=value格式的字符串
   * - 返回签名字符串
   * 
   * 行为分支：
   * 1. 正常情况：返回格式化的签名字符串
   * 
   * @param params - 参数对象
   * @returns string - 签名字符串
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
   * - 使用Node.js crypto模块生成HMAC-SHA1签名
   * - 返回base64编码的签名结果
   * 
   * 行为分支：
   * 1. 正常情况：返回base64编码的签名字符串
   * 
   * @param signStr - 待签名的字符串
   * @param secretKey - 密钥
   * @returns string - base64编码的签名结果
   */
  public sign(signStr: string, secretKey: string): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha1', secretKey);
    hmac.update(signStr, 'utf8');
    return hmac.digest('base64');
  }

  /**
   * 处理语音识别错误
   * 
   * 中文名称：处理语音识别错误
   * 
   * 预期行为：
   * - 记录详细的错误信息到控制台
   * - 重新抛出原始错误
   * 
   * 行为分支：
   * 1. Error实例：记录错误消息
   * 2. 非Error实例：转换为字符串后记录
   * 
   * @param error - 错误对象
   * @param context - 错误上下文
   * @throws 原始错误
   */
  private handleRecognitionError(error: unknown, context: string): never {
    console.error(`❌ Speech recognition failed in ${context}:`, error);
    throw error instanceof Error ? error : new Error(String(error));
  }

  /**
   * 识别手动录制的音频
   * 
   * 中文名称：识别手动录制的音频
   * 
   * 预期行为：
   * - 验证音频数据是否有效
   * - 如果无效，返回null
   * - 如果有效，发送到腾讯云ASR服务进行识别
   * - 返回识别结果文本
   * 
   * 行为分支：
   * 1. 音频数据为空：返回null
   * 2. 音频数据有效：调用腾讯云ASR API并返回识别结果
   * 3. 识别成功：返回识别的文本
   * 4. 未识别到语音：返回null
   * 5. 识别失败：调用handleRecognitionError处理错误
   * 
   * @param audioBuffer - 音频数据Buffer
   * @returns Promise<string | null> - 识别结果文本或null
   * @throws {Error} 如果识别过程中发生错误
   */
  public async recognizeManualRecording(audioBuffer: Buffer): Promise<string | null> {
    if (!audioBuffer || audioBuffer.length === 0) {
      console.log('⚠️  No audio data to process');
      return null;
    }

    try {
      console.log(`📡 Sending manual recording to Tencent Cloud ASR (${audioBuffer.length} bytes)...`);
      
      const client = this.getClient();
      const audioBase64 = audioBuffer.toString('base64');
      
      const params = {
        EngSerViceType: this.config.engineModelType || '16k_zh',
        SourceType: 1, // 1 means audio data in post body
        VoiceFormat: this.config.voiceFormat || 'pcm',
        Data: audioBase64,
        DataLen: audioBuffer.length,
        HotwordId: this.config.hotwordId || '',
        FilterDirty: this.config.filterDirty || 1,
        FilterModal: this.config.filterModal || 2,
        FilterPunc: this.config.filterPunc || 0,
        ConvertNumMode: this.config.convertNumMode || 1,
        WordInfo: this.config.wordInfo || 2,
      };

      const response = await client.SentenceRecognition(params);
      
      if (response && response.Result) {
        console.log('🎯 Speech recognized:', `"${response.Result}"`);
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
}