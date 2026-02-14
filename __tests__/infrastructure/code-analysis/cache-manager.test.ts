import { CacheManager } from '@/infrastructure/code-analysis/cache-manager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module functions we need
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn()
  }
}));

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  const cacheDir = '/test/.cache/code-analysis';

  beforeEach(() => {
    jest.clearAllMocks();
    
    const config = {
      maxMemorySize: 1024, // 1KB for testing
      cacheDirectory: cacheDir,
      defaultTtl: 1000, // 1 second for testing
      enableFileCache: true
    };

    cacheManager = new CacheManager(config);
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(cacheManager).toBeDefined();
      expect((cacheManager as any).config.cacheDirectory).toBe(cacheDir);
      expect((cacheManager as any).config.maxMemorySize).toBe(1024);
      expect((cacheManager as any).config.defaultTtl).toBe(1000);
      expect((cacheManager as any).config.enableFileCache).toBe(true);
    });

    test('should create cache directory when file cache is enabled', () => {
      expect(fs.mkdirSync).toHaveBeenCalledWith(cacheDir, { recursive: true });
    });
  });

  describe('get', () => {
    test('should return null for non-existent cache key', async () => {
      const result = await cacheManager.get<string>('non-existent-key');
      expect(result).toBeNull();
      expect((cacheManager as any).stats.memoryMisses).toBe(1);
      expect((cacheManager as any).stats.fileMisses).toBe(1);
    });

    test('should return data from memory cache when available and not expired', async () => {
      const testData = 'test-data';
      cacheManager.set('test-key', testData);
      
      const result = await cacheManager.get<string>('test-key');
      expect(result).toBe(testData);
      expect((cacheManager as any).stats.memoryHits).toBe(1);
    });

    test('should return null for expired memory cache item', async () => {
      const testData = 'test-data';
      cacheManager.set('test-key', testData, -1); // Expired immediately
      
      const result = await cacheManager.get<string>('test-key');
      expect(result).toBeNull();
      expect((cacheManager as any).stats.memoryMisses).toBe(1);
      expect((cacheManager as any).stats.fileMisses).toBe(1);
    });
  });

  describe('set', () => {
    test('should store data in memory cache', () => {
      const testData = 'test-data';
      cacheManager.set('test-key', testData);
      
      const memoryCache = (cacheManager as any).memoryCache;
      expect(memoryCache.has('test-key')).toBe(true);
      expect(memoryCache.get('test-key').data).toBe(testData);
    });

    test('should use default TTL when not specified', () => {
      const testData = 'test-data';
      const before = Date.now();
      cacheManager.set('test-key', testData);
      const after = Date.now();
      
      const item = (cacheManager as any).memoryCache.get('test-key');
      expect(item.expiresAt).toBeGreaterThanOrEqual(before + 1000);
      expect(item.expiresAt).toBeLessThanOrEqual(after + 1000);
    });

    test('should write to file cache when enabled', async () => {
      const testData = 'file-test-data';
      cacheManager.set('file-test-key', testData);
      
      await new Promise(setImmediate); // Wait for async file write
      
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });
  });

  describe('isExpired', () => {
    test('should return false for non-expired items', () => {
      const item = {
        data: 'test',
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000,
        size: 100
      };
      
      expect((cacheManager as any).isExpired(item)).toBe(false);
    });

    test('should return true for expired items', () => {
      const item = {
        data: 'test',
        createdAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000,
        size: 100
      };
      
      expect((cacheManager as any).isExpired(item)).toBe(true);
    });
  });

  describe('getCacheFilePath', () => {
    test('should generate safe file paths', () => {
      expect((cacheManager as any).getCacheFilePath('simple-key')).toBe(path.join(cacheDir, 'simple-key.json'));
      expect((cacheManager as any).getCacheFilePath('key-with/slashes')).toBe(path.join(cacheDir, 'key-with_slashes.json'));
    });
  });

  describe('delete', () => {
    test('should delete from memory cache', async () => {
      cacheManager.set('delete-key', 'delete-value');
      expect((cacheManager as any).memoryCache.has('delete-key')).toBe(true);
      
      await cacheManager.delete('delete-key');
      expect((cacheManager as any).memoryCache.has('delete-key')).toBe(false);
    });
  });

  describe('clear', () => {
    test('should clear memory cache', async () => {
      // Create a manager with file cache disabled to avoid fs calls
      const configNoFileCache = {
        maxMemorySize: 1024,
        cacheDirectory: cacheDir,
        defaultTtl: 1000,
        enableFileCache: false
      };
      const manager = new CacheManager(configNoFileCache);
      
      manager.set('clear-key', 'clear-value');
      expect((manager as any).memoryCache.size).toBe(1);
      
      await manager.clear();
      expect((manager as any).memoryCache.size).toBe(0);
      expect((manager as any).memorySize).toBe(0);
    });
  });

  describe('getStats', () => {
    test('should return current cache statistics', () => {
      // Create a manager with file cache disabled to avoid fs calls
      const configNoFileCache = {
        maxMemorySize: 1024,
        cacheDirectory: cacheDir,
        defaultTtl: 1000,
        enableFileCache: false
      };
      const manager = new CacheManager(configNoFileCache);
      
      const stats = manager.getStats();
      expect(stats).toEqual({
        memoryHits: 0,
        memoryMisses: 0,
        fileHits: 0,
        fileMisses: 0,
        memorySize: 0,
        fileSize: 0,
        memoryItems: 0,
        fileItems: 0
      });
    });
  });

  describe('getHitRate', () => {
    test('should return 0 when no requests have been made', () => {
      expect(cacheManager.getHitRate()).toBe(0);
    });

    test('should calculate correct hit rate', async () => {
      // One hit
      cacheManager.set('hit', 'data');
      await cacheManager.get('hit');
      
      // One miss
      await cacheManager.get('miss1');
      
      // Hit rate should be 1 / (1 + 1 + 1) = 0.333... (memory hit + memory miss + file miss)
      expect(cacheManager.getHitRate()).toBeCloseTo(1/3, 2);
    });
  });
});