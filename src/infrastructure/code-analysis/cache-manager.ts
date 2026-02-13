/**
 * 缓存管理器
 * 
 * 中文名称：缓存管理器
 * 
 * 预期行为：
 * - 提供多级缓存策略（内存、文件系统）
 * - 支持缓存过期和清理
 * - 提供缓存统计和监控
 * - 支持不同类型的缓存数据
 * - 实现智能缓存淘汰策略
 * 
 * 行为分支：
 * 1. 内存缓存：快速访问，有限容量
 * 2. 文件缓存：持久化存储，大容量
 * 3. LRU淘汰：当缓存满时淘汰最近最少使用的项
 * 4. TTL过期：自动清理过期的缓存项
 * 5. 智能预取：根据使用模式预取可能需要的数据
 * 
 * @class CacheManager
 */
import fs from 'fs';
import path from 'path';

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 内存缓存最大容量（字节） */
  maxMemorySize: number;
  /** 文件缓存目录 */
  cacheDirectory: string;
  /** 默认TTL（毫秒） */
  defaultTtl: number;
  /** 是否启用文件缓存 */
  enableFileCache: boolean;
}

/**
 * 缓存项
 */
interface CacheItem<T> {
  /** 数据 */
  data: T;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expiresAt: number;
  /** 大小（字节） */
  size: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 内存缓存命中数 */
  memoryHits: number;
  /** 内存缓存未命中数 */
  memoryMisses: number;
  /** 文件缓存命中数 */
  fileHits: number;
  /** 文件缓存未命中数 */
  fileMisses: number;
  /** 内存缓存大小 */
  memorySize: number;
  /** 文件缓存大小 */
  fileSize: number;
  /** 内存缓存项数 */
  memoryItems: number;
  /** 文件缓存项数 */
  fileItems: number;
}

/**
 * 缓存管理器类
 * 
 * 中文名称：缓存管理器类
 * 
 * 负责管理代码分析相关的缓存数据
 */
export class CacheManager {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private memorySize: number = 0;
  private stats: CacheStats = {
    memoryHits: 0,
    memoryMisses: 0,
    fileHits: 0,
    fileMisses: 0,
    memorySize: 0,
    fileSize: 0,
    memoryItems: 0,
    fileItems: 0
  };

  /**
   * 创建缓存管理器实例
   * @param config 配置
   */
  constructor(config: CacheConfig) {
    this.config = {
      ...config,
      cacheDirectory: config.cacheDirectory || path.join(process.cwd(), '.cache', 'code-analysis')
    };
    
    // 确保缓存目录存在
    if (this.config.enableFileCache) {
      this.ensureCacheDirectory();
    }
  }

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.config.cacheDirectory)) {
      fs.mkdirSync(this.config.cacheDirectory, { recursive: true });
    }
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    // 首先尝试内存缓存
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && !this.isExpired(memoryItem)) {
      this.stats.memoryHits++;
      return memoryItem.data;
    }

    if (memoryItem) {
      // 清理过期的内存缓存
      this.memoryCache.delete(key);
      this.memorySize -= memoryItem.size;
    }

    this.stats.memoryMisses++;

    // 尝试文件缓存
    if (this.config.enableFileCache) {
      try {
        const filePath = this.getCacheFilePath(key);
        if (fs.existsSync(filePath)) {
          const fileContent = await fs.promises.readFile(filePath, 'utf8');
          const fileItem: CacheItem<T> = JSON.parse(fileContent);
          
          if (!this.isExpired(fileItem)) {
            this.stats.fileHits++;
            // 将文件缓存加载到内存中
            this.set(key, fileItem.data, Date.now() - fileItem.createdAt + this.config.defaultTtl);
            return fileItem.data;
          } else {
            // 清理过期的文件缓存
            await fs.promises.unlink(filePath);
          }
        }
      } catch (error) {
        console.error(`Failed to read file cache for key ${key}:`, error);
      }
    }

    this.stats.fileMisses++;
    return null;
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttl 生存时间（毫秒），默认使用配置的defaultTtl
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.config.defaultTtl);
    const serializedData = JSON.stringify(data);
    const size = Buffer.byteLength(serializedData, 'utf8');
    
    const item: CacheItem<T> = {
      data,
      createdAt: Date.now(),
      expiresAt,
      size
    };

    // 添加到内存缓存
    this.memoryCache.set(key, item);
    this.memorySize += size;

    // 检查内存缓存大小限制
    this.evictIfNeeded();

    // 写入文件缓存
    if (this.config.enableFileCache) {
      this.writeToFileCache(key, item).catch(error => {
        console.error(`Failed to write file cache for key ${key}:`, error);
      });
    }
  }

  /**
   * 检查缓存项是否过期
   * @param item 缓存项
   * @returns 是否过期
   */
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() > item.expiresAt;
  }

  /**
   * 获取缓存文件路径
   * @param key 缓存键
   * @returns 文件路径
   */
  private getCacheFilePath(key: string): string {
    // 将键转换为安全的文件名
    const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.config.cacheDirectory, `${safeKey}.json`);
  }

  /**
   * 写入文件缓存
   * @param key 缓存键
   * @param item 缓存项
   */
  private async writeToFileCache(key: string, item: CacheItem<any>): Promise<void> {
    const filePath = this.getCacheFilePath(key);
    const content = JSON.stringify(item);
    await fs.promises.writeFile(filePath, content, 'utf8');
  }

  /**
   * 检查并执行缓存淘汰
   */
  private evictIfNeeded(): void {
    if (this.memorySize <= this.config.maxMemorySize) {
      return;
    }

    // LRU淘汰策略
    const keys = Array.from(this.memoryCache.keys());
    let evictedSize = 0;
    let evictedCount = 0;

    for (const key of keys) {
      if (this.memorySize - evictedSize <= this.config.maxMemorySize) {
        break;
      }

      const item = this.memoryCache.get(key);
      if (item) {
        evictedSize += item.size;
        evictedCount++;
        this.memoryCache.delete(key);
      }
    }

    this.memorySize -= evictedSize;
    console.log(`Evicted ${evictedCount} cache items (${evictedSize} bytes) to stay within memory limit`);
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  async delete(key: string): Promise<void> {
    // 删除内存缓存
    const item = this.memoryCache.get(key);
    if (item) {
      this.memorySize -= item.size;
      this.memoryCache.delete(key);
    }

    // 删除文件缓存
    if (this.config.enableFileCache) {
      try {
        const filePath = this.getCacheFilePath(key);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch (error) {
        console.error(`Failed to delete file cache for key ${key}:`, error);
      }
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.memorySize = 0;

    if (this.config.enableFileCache) {
      try {
        const files = await fs.promises.readdir(this.config.cacheDirectory);
        await Promise.all(files.map(file => 
          fs.promises.unlink(path.join(this.config.cacheDirectory, file))
        ));
      } catch (error) {
        console.error('Failed to clear file cache:', error);
      }
    }

    // 重置统计
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      fileHits: 0,
      fileMisses: 0,
      memorySize: 0,
      fileSize: 0,
      memoryItems: 0,
      fileItems: 0
    };
  }

  /**
   * 获取缓存统计
   * @returns 缓存统计
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      memorySize: this.memorySize,
      memoryItems: this.memoryCache.size,
      fileSize: this.getFileCacheSize(),
      fileItems: this.getFileCacheItemCount()
    };
  }

  /**
   * 获取文件缓存大小
   * @returns 文件缓存大小（字节）
   */
  private getFileCacheSize(): number {
    if (!this.config.enableFileCache) {
      return 0;
    }

    try {
      const files = fs.readdirSync(this.config.cacheDirectory);
      let totalSize = 0;
      for (const file of files) {
        const stats = fs.statSync(path.join(this.config.cacheDirectory, file));
        totalSize += stats.size;
      }
      return totalSize;
    } catch (error) {
      console.error('Failed to get file cache size:', error);
      return 0;
    }
  }

  /**
   * 获取文件缓存项数
   * @returns 文件缓存项数
   */
  private getFileCacheItemCount(): number {
    if (!this.config.enableFileCache) {
      return 0;
    }

    try {
      const files = fs.readdirSync(this.config.cacheDirectory);
      return files.length;
    } catch (error) {
      console.error('Failed to get file cache item count:', error);
      return 0;
    }
  }

  /**
   * 计算缓存命中率
   * @returns 命中率（0-1）
   */
  getHitRate(): number {
    const totalHits = this.stats.memoryHits + this.stats.fileHits;
    const totalRequests = totalHits + this.stats.memoryMisses + this.stats.fileMisses;
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }
}