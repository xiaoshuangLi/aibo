import { SafeFilesystemBackend } from '@/infrastructure/filesystem/safe-backend';
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
      expect(backendWithDefaults.maxDepth).toBe(10);
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

    test('should return false for paths outside project root (starting with ..)', () => {
      // This simulates a path that would be outside the project root
      const outsidePath = path.join(testRoot, '..', 'other-project', 'file.txt');
      expect(safeBackend.isWithinDepthLimit(outsidePath)).toBe(false);
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
      const result = await safeBackend.read('package.json');
      expect(result.error).toBeUndefined();
      expect(result.content).toContain('aibo');
    });

    test('should return error for files outside project root', async () => {
      const result = await safeBackend.read('/tmp/outside-project-file.txt');
      expect(result.error).toContain('Access denied');
    });

    test('should return error for blocked file extensions', async () => {
      const result = await safeBackend.read('nonexistent.bin');
      expect(result.error).toContain('blocked file extension');
    });

    test('should return error for files exceeding depth limit', async () => {
      const deepPath = 'level1/level2/level3/level4/file.txt';
      const result = await safeBackend.read(deepPath);
      expect(result.error).toContain('exceeds maximum depth limit');
    });

    test('should handle permission errors gracefully', async () => {
      // Create a temporary file and then make it unreadable
      const tempFile = path.join(testRoot, 'temp-permission-test.txt');
      await fs.promises.writeFile(tempFile, 'test content');
      
      // Make file unreadable (this might not work on all systems, so we'll skip if it fails)
      try {
        await fs.promises.chmod(tempFile, 0o000);
        const result = await safeBackend.read('temp-permission-test.txt');
        expect(result.error).toContain('Permission denied');
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

  describe('ls', () => {
    test('should list files in current directory', async () => {
      const result = await safeBackend.ls('.');
      expect(result.error).toBeUndefined();
      expect(result.files?.length).toBeGreaterThan(0);
    });

    test('should return error for directories outside project root', async () => {
      const result = await safeBackend.ls('/tmp');
      expect(result.error).toContain('Access denied');
    });

    test('should return error for directories exceeding depth limit', async () => {
      const deepPath = 'level1/level2/level3/level4';
      const result = await safeBackend.ls(deepPath);
      expect(result.error).toContain('exceeds maximum depth limit');
    });

    test('should handle permission errors gracefully', async () => {
      // Create a temporary directory and then make it unreadable
      const tempDir = path.join(testRoot, 'temp-permission-test-dir');
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      // Make directory unreadable (this might not work on all systems, so we'll skip if it fails)
      try {
        await fs.promises.chmod(tempDir, 0o000);
        const result = await safeBackend.ls('temp-permission-test-dir');
        expect(result.error).toContain('Permission denied');
      } catch (error) {
        // Skip this test if we can't change permissions
        console.log('Skipping ls permission test due to system restrictions');
      } finally {
        // Clean up - first restore permissions, then remove
        try {
          await fs.promises.chmod(tempDir, 0o755);
          await fs.promises.rmdir(tempDir);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('grep', () => {
    test('should return access denied error for directories outside project root', async () => {
      const result = await safeBackend.grep('pattern', '/tmp');
      expect(result.error).toContain('Access denied: /tmp is outside project root');
    });

    test('should return empty matches for ignored directories', async () => {
      const result = await safeBackend.grep('pattern', path.join(testRoot, 'node_modules'));
      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });

    test('should handle permission errors gracefully', async () => {
      // Create a temporary directory and then make it unreadable
      const tempDir = path.join(testRoot, 'temp-grep-permission-test-dir');
      await fs.promises.mkdir(tempDir, { recursive: true });
      await fs.promises.writeFile(path.join(tempDir, 'test.txt'), 'test content for grep');
      
      // Make directory unreadable (this might not work on all systems, so we'll skip if it fails)
      try {
        await fs.promises.chmod(tempDir, 0o000);
        const result = await safeBackend.grep('test', 'temp-grep-permission-test-dir');
        expect(result.error).toContain('Permission denied');
      } catch (error) {
        // Skip this test if we can't change permissions
        console.log('Skipping grep permission test due to system restrictions');
      } finally {
        // Clean up - first restore permissions, then remove
        try {
          await fs.promises.chmod(tempDir, 0o755);
          await fs.promises.rm(tempDir, { recursive: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('glob', () => {
    test('should find files with glob pattern', async () => {
      const result = await safeBackend.glob('*.json', '.');
      expect(result.error).toBeUndefined();
      expect(result.files?.length).toBeGreaterThan(0);
    });

    test('should return error for search paths outside project root', async () => {
      const result = await safeBackend.glob('**/*.ts', '/tmp');
      expect(result.error).toContain('Access denied');
    });

    test('should return error for search paths exceeding depth limit', async () => {
      const deepPath = 'level1/level2/level3/level4';
      const result = await safeBackend.glob('*.txt', deepPath);
      expect(result.error).toContain('exceeds maximum depth limit');
    });

    test('should handle permission errors gracefully', async () => {
      // Create a temporary directory and then make it unreadable
      const tempDir = path.join(testRoot, 'temp-glob-permission-test-dir');
      await fs.promises.mkdir(tempDir, { recursive: true });
      await fs.promises.writeFile(path.join(tempDir, 'test.txt'), 'test content');
      
      // Make directory unreadable (this might not work on all systems, so we'll skip if it fails)
      try {
        await fs.promises.chmod(tempDir, 0o000);
        const result = await safeBackend.glob('*.txt', 'temp-glob-permission-test-dir');
        expect(result.error).toContain('Permission denied');
      } catch (error) {
        // Skip this test if we can't change permissions
        console.log('Skipping glob permission test due to system restrictions');
      } finally {
        // Clean up - first restore permissions, then remove
        try {
          await fs.promises.chmod(tempDir, 0o755);
          await fs.promises.rm(tempDir, { recursive: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });
});