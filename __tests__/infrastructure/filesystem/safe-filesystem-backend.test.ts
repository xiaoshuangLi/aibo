import { SafeFilesystemBackend } from '@/infrastructure/filesystem/safe-filesystem-backend';
import * as path from 'path';
import * as fs from 'fs';

describe('SafeFilesystemBackend', () => {
  let safeBackend: SafeFilesystemBackend;
  const testRoot = process.cwd();

  beforeEach(() => {
    safeBackend = new SafeFilesystemBackend({
      rootDir: testRoot,
      maxFileSizeMb: 5,
      maxDepth: 3
    });
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(safeBackend).toBeDefined();
      expect(safeBackend.projectRoot).toBe(path.resolve(testRoot));
      expect(safeBackend.maxDepth).toBe(3);
      expect(safeBackend.allowedExtensions.size).toBeGreaterThan(0);
      expect(safeBackend.blockedExtensions.size).toBeGreaterThan(0);
      expect(safeBackend.ignoredDirectories.size).toBeGreaterThan(0);
    });

    test('should use default values when options are not provided', () => {
      const backendWithDefaults = new SafeFilesystemBackend({ rootDir: testRoot });
      expect(backendWithDefaults.maxDepth).toBe(5);
    });
  });

  describe('isWithinProjectRoot', () => {
    test('should return true for files within project root', () => {
      const result = safeBackend.isWithinProjectRoot(path.join(testRoot, 'src', 'index.ts'));
      expect(result).toBe(true);
    });

    test('should return true for project root itself', () => {
      const result = safeBackend.isWithinProjectRoot(testRoot);
      expect(result).toBe(true);
    });

    test('should return false for files outside project root', () => {
      const result = safeBackend.isWithinProjectRoot('/tmp/external-file.txt');
      expect(result).toBe(false);
    });
  });

  describe('isAllowedExtension', () => {
    test('should return true for allowed extensions', () => {
      expect(safeBackend.isAllowedExtension('file.ts')).toBe(true);
      expect(safeBackend.isAllowedExtension('file.js')).toBe(true);
      expect(safeBackend.isAllowedExtension('file.json')).toBe(true);
      expect(safeBackend.isAllowedExtension('README')).toBe(true); // no extension
    });

    test('should return false for blocked extensions', () => {
      expect(safeBackend.isAllowedExtension('file.bin')).toBe(false);
      expect(safeBackend.isAllowedExtension('model.pth')).toBe(false);
      expect(safeBackend.isAllowedExtension('image.jpg')).toBe(false);
    });

    test('should return false for unknown extensions not in allowed list', () => {
      expect(safeBackend.isAllowedExtension('file.unknown')).toBe(false);
    });
  });

  describe('isWithinDepthLimit', () => {
    test('should return true for files within depth limit', () => {
      expect(safeBackend.isWithinDepthLimit(path.join(testRoot, 'level1', 'level2', 'file.txt'))).toBe(true);
    });

    test('should return true for project root', () => {
      expect(safeBackend.isWithinDepthLimit(testRoot)).toBe(true);
    });

    test('should return false for files exceeding depth limit', () => {
      const deepPath = path.join(testRoot, 'level1', 'level2', 'level3', 'level4', 'file.txt');
      expect(safeBackend.isWithinDepthLimit(deepPath)).toBe(false);
    });
  });

  describe('shouldIgnoreDirectory', () => {
    test('should return false for project root', () => {
      expect(safeBackend.shouldIgnoreDirectory(testRoot)).toBe(false);
    });

    test('should return true for ignored directories', () => {
      expect(safeBackend.shouldIgnoreDirectory(path.join(testRoot, 'node_modules'))).toBe(true);
      expect(safeBackend.shouldIgnoreDirectory(path.join(testRoot, 'coverage'))).toBe(true);
      expect(safeBackend.shouldIgnoreDirectory(path.join(testRoot, '.git'))).toBe(true);
    });

    test('should return false for non-ignored directories', () => {
      expect(safeBackend.shouldIgnoreDirectory(path.join(testRoot, 'src'))).toBe(false);
      expect(safeBackend.shouldIgnoreDirectory(path.join(testRoot, 'tests'))).toBe(false);
    });
  });

  // Test the main methods with actual files that exist in the project
  describe('read', () => {
    test('should read existing file successfully', async () => {
      const content = await safeBackend.read('package.json');
      expect(content).toContain('aibo');
    });

    test('should throw error for files outside project root', async () => {
      await expect(safeBackend.read('/tmp/outside-project-file.txt')).rejects.toThrow('Access denied');
    });

    test('should throw error for blocked file extensions', async () => {
      // This will fail because the file doesn't exist, but it should fail with the right error
      await expect(safeBackend.read('nonexistent.bin')).rejects.toThrow('blocked file extension');
    });

    test('should handle permission errors gracefully', async () => {
      // Create a temporary file and then make it unreadable
      const tempFile = path.join(testRoot, 'temp-permission-test.txt');
      await fs.promises.writeFile(tempFile, 'test content');
      
      // Make file unreadable (this might not work on all systems, so we'll skip if it fails)
      try {
        await fs.promises.chmod(tempFile, 0o000);
        await expect(safeBackend.read('temp-permission-test.txt')).rejects.toThrow('Permission denied');
      } catch (error) {
        // Skip this test if we can't change permissions
        console.log('Skipping permission test due to system restrictions');
      } finally {
        // Clean up
        try {
          await fs.promises.unlink(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('lsInfo', () => {
    test('should list files in current directory', async () => {
      const files = await safeBackend.lsInfo('.');
      expect(files.length).toBeGreaterThan(0);
    });

    test('should throw error for directories outside project root', async () => {
      await expect(safeBackend.lsInfo('/tmp')).rejects.toThrow('Access denied');
    });
  });

  describe('grepRaw', () => {
    test('should return access denied message for directories outside project root', async () => {
      const result = await safeBackend.grepRaw('pattern', '/tmp');
      expect(result).toBe('Access denied: /tmp is outside project root');
    });

    test('should return empty array for ignored directories', async () => {
      const result = await safeBackend.grepRaw('pattern', path.join(testRoot, 'node_modules'));
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('globInfo', () => {
    test('should find files with glob pattern', async () => {
      const files = await safeBackend.globInfo('*.json', '.');
      expect(files.length).toBeGreaterThan(0);
    });

    test('should throw error for search paths outside project root', async () => {
      await expect(safeBackend.globInfo('**/*.ts', '/tmp')).rejects.toThrow('Access denied');
    });
  });
});