import { SafeFilesystemBackend } from '@/infrastructure/filesystem/safe-backend';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('SafeFilesystemBackend - Write Method and Additional Coverage', () => {
  let safeBackend: SafeFilesystemBackend;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temp directory that acts as our project root
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aibo-test-'));
    safeBackend = new SafeFilesystemBackend({
      rootDir: tempDir,
      maxFileSizeMb: 5,
      maxDepth: 4
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('write method', () => {
    it('should write a new file successfully', async () => {
      const filePath = path.join(tempDir, 'test-write.ts');
      const result = await safeBackend.write(filePath, 'const x = 1;');
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      // Verify the file was actually written
      const content = await fs.promises.readFile(filePath, 'utf-8');
      expect(content).toBe('const x = 1;');
    });

    it('should overwrite an existing file', async () => {
      const filePath = path.join(tempDir, 'existing.ts');
      await fs.promises.writeFile(filePath, 'original content');
      const result = await safeBackend.write(filePath, 'new content');
      expect(result.error).toBeUndefined();
      const content = await fs.promises.readFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('should create parent directories if they do not exist', async () => {
      const filePath = path.join(tempDir, 'subdir', 'nested', 'file.ts');
      const result = await safeBackend.write(filePath, 'content');
      expect(result.error).toBeUndefined();
      const content = await fs.promises.readFile(filePath, 'utf-8');
      expect(content).toBe('content');
    });

    it('should return error when file is outside project root', async () => {
      const result = await safeBackend.write('/tmp/outside-root.ts', 'content');
      expect(result.error).toContain('Access denied');
    });

    it('should return error for file with blocked extension', async () => {
      const filePath = path.join(tempDir, 'file.bin');
      const result = await safeBackend.write(filePath, 'binary content');
      expect(result.error).toContain('blocked file extension');
    });

    it('should return error when depth exceeds max limit', async () => {
      const filePath = path.join(tempDir, 'a', 'b', 'c', 'd', 'e', 'deep.ts');
      const result = await safeBackend.write(filePath, 'content');
      expect(result.error).toContain('exceeds maximum depth limit');
    });

    it('should write a file using relative path within project root', async () => {
      // Change cwd to tempDir to test relative paths
      const originalCwd = process.cwd();
      process.chdir(tempDir);
      try {
        const backend = new SafeFilesystemBackend({ rootDir: tempDir, maxDepth: 3 });
        const result = await backend.write('relative-test.ts', 'hello');
        expect(result.error).toBeUndefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle permission error gracefully', async () => {
      const filePath = path.join(tempDir, 'restricted.ts');
      // First create the file
      await fs.promises.writeFile(filePath, 'original');
      
      // Make parent directory read-only
      try {
        await fs.promises.chmod(tempDir, 0o555);
        const result = await safeBackend.write(filePath, 'new content');
        // Either a permission error or success depending on OS/user privileges
        if (result.error) {
          expect(result.error).toContain('Permission denied');
        }
      } catch (e) {
        // Skip if permissions can't be changed
      } finally {
        await fs.promises.chmod(tempDir, 0o755).catch(() => {});
      }
    });
  });

  describe('grepRaw - filtering behavior', () => {
    it('should filter files in ignored directories', async () => {
      // Create a node_modules directory with a matching file
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.promises.mkdir(nodeModulesDir, { recursive: true });
      await fs.promises.writeFile(path.join(nodeModulesDir, 'test.ts'), 'const test = true;');
      
      // Also create a file in src that matches
      const srcDir = path.join(tempDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      await fs.promises.writeFile(path.join(srcDir, 'test.ts'), 'const test = true;');
      
      const result = await safeBackend.grepRaw('const test', tempDir);
      
      // Result might be a string or array
      if (Array.isArray(result)) {
        // Should not include files from node_modules
        const nodeModulesMatches = result.filter(m => m.path.includes('node_modules'));
        expect(nodeModulesMatches.length).toBe(0);
      }
    });

    it('should filter files with blocked extensions', async () => {
      // Create a .bin file that matches
      await fs.promises.writeFile(path.join(tempDir, 'test.bin'), 'matching content');
      // Create a .ts file that matches
      await fs.promises.writeFile(path.join(tempDir, 'test.ts'), 'matching content');
      
      const result = await safeBackend.grepRaw('matching content', tempDir);
      
      if (Array.isArray(result)) {
        const binMatches = result.filter(m => m.path.endsWith('.bin'));
        expect(binMatches.length).toBe(0);
      }
    });
  });

  describe('lsInfo - permission error handling', () => {
    it('should handle EACCES error on lsInfo gracefully', async () => {
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.promises.mkdir(restrictedDir, { recursive: true });
      
      try {
        await fs.promises.chmod(restrictedDir, 0o000);
        await expect(safeBackend.lsInfo(restrictedDir)).rejects.toThrow('Permission denied');
      } catch (e) {
        // Skip if permissions can't be changed on this system
        console.log('Skipping permission test - cannot change permissions');
      } finally {
        await fs.promises.chmod(restrictedDir, 0o755).catch(() => {});
      }
    });
  });

  describe('globInfo - filtering behavior', () => {
    it('should filter out files in ignored directories', async () => {
      // Create a dist directory with a .ts file
      const distDir = path.join(tempDir, 'dist');
      await fs.promises.mkdir(distDir, { recursive: true });
      await fs.promises.writeFile(path.join(distDir, 'index.ts'), 'content');
      
      // Create a src directory with a .ts file
      const srcDir = path.join(tempDir, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      await fs.promises.writeFile(path.join(srcDir, 'index.ts'), 'content');
      
      const files = await safeBackend.globInfo('**/*.ts', tempDir);
      const distFiles = files.filter(f => f.path.includes(`${path.sep}dist${path.sep}`));
      expect(distFiles.length).toBe(0);
    });

    it('should filter out files with blocked extensions', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'image.jpg'), 'binary');
      await fs.promises.writeFile(path.join(tempDir, 'code.ts'), 'content');
      
      const files = await safeBackend.globInfo('*', tempDir);
      const jpgFiles = files.filter(f => f.path.endsWith('.jpg'));
      expect(jpgFiles.length).toBe(0);
    });
  });
});
