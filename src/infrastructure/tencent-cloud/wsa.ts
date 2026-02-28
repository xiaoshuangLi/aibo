/**
 * 腾讯云WSA（联网搜索API）工具模块
 * 
 * 中文名称：腾讯云WSA工具模块
 * 
 * 该模块提供网络搜索功能，能够使用腾讯云WSA服务执行网络搜索并返回结构化结果。
 * 基于搜狗搜索的全网公开资源，提供智能搜索增强服务。
 * 
 * @module tencent-wsa
 */

import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/wsa/v20250508/wsa_client';
import { ClientConfig } from 'tencentcloud-sdk-nodejs/tencentcloud/common/interface';
import { BasicCredential } from 'tencentcloud-sdk-nodejs/tencentcloud/common/credential';

// Import configuration
import { config } from '@/core/config';

/**
 * 腾讯云WSA配置接口
 * 
 * 中文名称：腾讯云WSA配置接口
 * 
 * 定义腾讯云WSA服务的配置参数，用于初始化TencentWSA实例。
 */
export interface TencentWsaConfig {
  appId: string;           // 腾讯云应用ID
  secretId: string;        // 腾讯云密钥ID
  secretKey: string;       // 腾讯云密钥
  region?: string;         // 区域，默认为'ap-shanghai'
}

/**
 * 获取默认WSA配置
 * 
 * 中文名称：获取默认WSA配置
 * 
 * 预期行为：
 * - 从应用程序配置中获取腾讯云WSA的默认配置值
 * - 提供合理的默认值以确保基本功能正常工作
 * - 延迟调用以避免模块加载顺序问题
 * 
 * 行为分支：
 * 1. 正常情况：返回包含所有必要配置的TencentWsaConfig对象
 * 2. 环境变量缺失：使用空字符串作为appId、secretId、secretKey的默认值
 * 
 * @returns TencentWsaConfig - 包含默认WSA配置的对象
 * 
 * @note
 * - 区域默认为'ap-shanghai'
 */
function getDefaultWsaConfig(): TencentWsaConfig {
  return {
    appId: config.tencentCloud.appId || '',
    secretId: config.tencentCloud.secretId || '',
    secretKey: config.tencentCloud.secretKey || '',
    region: config.tencentCloud.region || 'ap-shanghai',
  };
}

/**
 * 腾讯云WSA网络搜索类
 * 
 * 中文名称：腾讯云WSA网络搜索类
 * 
 * 该类提供与腾讯云WSA服务的完整集成，支持网络搜索功能。
 * 封装了WSA客户端管理、认证和错误处理等复杂逻辑。
 */
export class TencentWSA {
  private config: TencentWsaConfig;
  private client: Client | null = null;

  /**
   * 构造函数
   * 
   * 中文名称：构造函数
   * 
   * 预期行为：
   * - 接收可选的配置参数
   * - 如果提供了配置参数，使用提供的配置
   * - 如果没有提供配置参数，使用默认配置
   * - 验证配置的有效性
   * 
   * 行为分支：
   * 1. 无配置参数：使用默认配置
   * 2. 有配置参数：直接使用提供的配置（不合并默认配置）
   * 3. 配置验证：调用validateConfig()验证必需的配置项
   * 
   * @param config - 可选的TencentWsaConfig配置对象
   * @throws {Error} 如果缺少必需的配置项（appId、secretId、secretKey）
   */
  constructor(config: Partial<TencentWsaConfig> = {}) {
    if (Object.keys(config).length > 0) {
      // Use provided config directly, don't merge with defaults
      this.config = {
        appId: config.appId || '',
        secretId: config.secretId || '',
        secretKey: config.secretKey || '',
        region: config.region || 'ap-shanghai'
      };
    } else {
      // Use default config from environment
      this.config = getDefaultWsaConfig();
    }
    this.validateConfig();
  }

  /**
   * 验证腾讯云WSA配置
   * 
   * 中文名称：验证腾讯云WSA配置
   * 
   * 预期行为：
   * - 检查必需的配置项是否已提供且非空
   * - 抛出描述性错误信息
   * 
   * 行为分支：
   * 1. 配置完整：不抛出异常，正常返回
   * 2. appId为空或缺失：抛出错误"请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量"
   * 3. secretId为空或缺失：抛出相同错误
   * 4. secretKey为空或缺失：抛出相同错误
   * 
   * @throws {Error} 如果缺少必需的配置项
   */
  private validateConfig(): void {
    if (!this.config.appId || !this.config.secretId || !this.config.secretKey || 
        this.config.appId.trim() === '' || this.config.secretId.trim() === '' || this.config.secretKey.trim() === '') {
      throw new Error('请设置 TENCENTCLOUD_APP_ID、TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量');
    }
  }

  /**
   * 创建腾讯云WSA客户端实例
   * 
   * 中文名称：创建腾讯云WSA客户端实例
   * 
   * 预期行为：
   * - 使用提供的配置创建BasicCredential
   * - 构建ClientConfig对象
   * - 初始化并返回WSA客户端实例
   * 
   * 行为分支：
   * 1. 正常情况：成功创建并返回配置好的WSA客户端
   * 
   * @returns Client - 配置好的腾讯云WSA客户端实例
   */
  private createClient(): Client {
    const credential = new BasicCredential(this.config.secretId, this.config.secretKey);
    const clientConfig: ClientConfig = {
      credential: credential,
      profile: {
        httpProfile: {
          reqMethod: "POST",
          reqTimeout: 30,
          endpoint: "wsa.tencentcloudapi.com"
        }
      }
    };
    
    return new Client(clientConfig);
  }

  /**
   * 获取WSA客户端实例
   * 
   * 中文名称：获取WSA客户端实例
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
   * @returns Client - WSA客户端实例
   */
  private getClient(): Client {
    if (!this.client) {
      this.client = this.createClient();
    }
    return this.client;
  }

  /**
   * 执行网络搜索
   * 
   * 中文名称：执行网络搜索
   * 
   * 预期行为：
   * - 使用腾讯云WSA服务执行网络搜索
   * - 返回结构化的搜索结果
   * - 处理搜索过程中的错误
   * 
   * 行为分支：
   * 1. 搜索成功：返回SearchProResponse对象
   * 2. 搜索失败：抛出错误信息
   * 
   * @param query - 搜索关键词
   * @param mode - 搜索模式（0-自然检索结果(默认)，1-多模态VR结果，2-混合结果）
   * @returns Promise<any> - 搜索结果的Promise
   * @throws {Error} 如果搜索过程中发生错误
   */
  public async search(query: string, mode: number = 0): Promise<any> {
    try {
      const client = this.getClient();
      const request = {
        Query: query,
        Mode: mode
      };
      
      const response = await client.SearchPro(request);
      return response;
    } catch (error) {
      throw new Error(`网络搜索失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 检查WSA配置是否有效
   * 
   * 中文名称：检查WSA配置是否有效
   * 
   * 预期行为：
   * - 检查必需的配置项是否已提供
   * - 返回布尔值表示配置是否有效
   * 
   * 行为分支：
   * 1. 配置完整：返回true
   * 2. 配置不完整：返回false
   * 
   * @returns boolean - 如果配置有效则返回true，否则返回false
   */
  public canSearch(): boolean {
    return !!(this.config.appId && this.config.secretId && this.config.secretKey);
  }
}

/**
 * 创建腾讯云WSA实例的工厂函数
 * 
 * 中文名称：创建腾讯云WSA实例的工厂函数
 * 
 * 预期行为：
 * - 接收可选的配置参数
 * - 创建并返回配置好的TencentWSA实例
 * 
 * 行为分支：
 * 1. 无配置参数：使用默认配置创建实例
 * 2. 有配置参数：使用合并后的配置创建实例
 * 
 * @param config - 可选的TencentWsaConfig配置对象
 * @returns TencentWSA - 配置好的腾讯云WSA实例
 * 
 * @example
 * ```typescript
 * // 使用默认配置
 * const wsa = createTencentWSA();
 * 
 * // 使用自定义配置
 * const wsa = createTencentWSA({
 *   appId: 'your-app-id',
 *   secretId: 'your-secret-id',
 *   secretKey: 'your-secret-key'
 * });
 * ```
 */
export function createTencentWSA(config: Partial<TencentWsaConfig> = {}): TencentWSA {
  return new TencentWSA(config);
}