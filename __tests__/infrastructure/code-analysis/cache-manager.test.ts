import { CacheManager } from '@/infrastructure/code-analysis/cache-manager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module functions we need
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
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

    test('should not create cache directory when file cache is disabled', () => {
      // Clear all mocks to ensure clean state
      jest.clearAllMocks();
      
      const config = {
        maxMemorySize: 1024,
        cacheDirectory: cacheDir,
        defaultTtl: 1000,
        enableFileCache: false
      };
      const manager = new CacheManager(config);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
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

    test('should clean up expired memory cache items', async () => {
      const testData = 'test-data';
      cacheManager.set('expired-key', testData, -1); // Expired immediately
      
      // Verify it's in memory cache initially
      expect((cacheManager as any).memoryCache.has('expired-key')).toBe(true);
      
      const result = await cacheManager.get<string>('expired-key');
      expect(result).toBeNull();
      
      // Should be removed from memory cache after access
      expect((cacheManager as any).memoryCache.has('expired-key')).toBe(false);
    });

    test('should handle file cache read errors gracefully', async () => {
      (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      const result = await cacheManager.get<string>('error-key');
      expect(result).toBeNull();
      expect((cacheManager as any).stats.fileMisses).toBe(1);
    });

    test('should clean up expired file cache items', async () => {
      const expiredItem = {
        data: 'expired-data',
        createdAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000,
        size: 100
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(expiredItem));
      
      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      const result = await cacheManager.get<string>('expired-file-key');
      expect(result).toBeNull();
      expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('expired-file-key.json'));
      
      unlinkSpy.mockRestore();
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

    test('should handle file cache write errors gracefully', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Write error'));
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const testData = 'error-test-data';
      cacheManager.set('error-test-key', testData);
      
      await new Promise(setImmediate); // Wait for async file write
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write file cache'),
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    test('should evict items when memory limit is exceeded', () => {
      // Create a manager with very small memory limit
      const config = {
        maxMemorySize: 10, // Very small limit
        cacheDirectory: cacheDir,
        defaultTtl: 1000,
        enableFileCache: false
      };
      const manager = new CacheManager(config);
      
      // Add items that exceed the limit
      manager.set('key1', 'large data that exceeds limit');
      manager.set('key2', 'another large data item');
      
      // Check that eviction happened
      expect((manager as any).memorySize).toBeLessThanOrEqual(10);
    });

    test('should load file cache into memory on hit', async () => {
      const testData = 'file-cache-data';
      const cacheItem = {
        data: testData,
        createdAt: Date.now() - 500,
        expiresAt: Date.now() + 500,
        size: Buffer.byteLength(JSON.stringify(testData), 'utf8')
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(cacheItem));

      const result = await cacheManager.get<string>('file-hit-key');
      
      expect(result).toBe(testData);
      expect((cacheManager as any).stats.fileHits).toBe(1);
      // Should also be in memory cache now
      expect((cacheManager as any).memoryCache.has('file-hit-key')).toBe(true);
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

    test('should handle file cache delete errors gracefully', async () => {
      (fs.promises.unlink as jest.Mock).mockRejectedValue(new Error('Delete error'));
      
      await cacheManager.delete('error-key');
      // Should not throw an error
      expect(true).toBe(true);
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

    test('should handle file cache clear errors gracefully', async () => {
      (fs.promises.readdir as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      await cacheManager.clear();
      // Should not throw an error
      expect(true).toBe(true);
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

    test('should handle file cache size calculation errors gracefully', () => {
      // Clear previous mocks
      (fs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });
      (fs.statSync as jest.Mock).mockImplementation(() => {
        return { size: 100 };
      });
      
      const stats = cacheManager.getStats();
      expect(stats.fileSize).toBe(0);
    });

    test('should handle file cache item count calculation errors gracefully', () => {
      // Clear previous mocks
      (fs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });
      
      const stats = cacheManager.getStats();
      expect(stats.fileItems).toBe(0);
    });
  });

  describe('getHitRate', () => {
    test('should return 0 when no requests have been made', () => {
      expect(cacheManager.getHitRate()).toBe(0);
    });

    test('should calculate correct hit rate', async () => {
      // Create a fresh manager to avoid interference from other tests
      const config = {
        maxMemorySize: 1024,
        cacheDirectory: cacheDir,
        defaultTtl: 1000,
        enableFileCache: true
      };
      const manager = new CacheManager(config);
      
      // Mock fs.existsSync to return false for misses
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      // One hit
      manager.set('hit', 'data');
      await manager.get('hit');
      
      // One miss
      await manager.get('miss1');
      
      const stats = manager.getStats();
      const hitRate = manager.getHitRate();
      
      // Debug output
      console.log('DEBUG - memoryHits:', stats.memoryHits);
      console.log('DEBUG - fileHits:', stats.fileHits);  
      console.log('DEBUG - memoryMisses:', stats.memoryMisses);
      console.log('DEBUG - fileMisses:', stats.fileMisses);
      console.log('DEBUG - hitRate:', hitRate);
      
      // Hit rate should be 1 / (1 + 1 + 1) = 0.333... (memory hit + memory miss + file miss)
      expect(hitRate).toBeCloseTo(1/3, 2);
    });
  });
});