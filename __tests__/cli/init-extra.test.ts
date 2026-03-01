import fs from 'fs';
import path from 'path';
import os from 'os';
import { createAiboSymlink, printInitRequired, runInit, AIBO_LINKED_SUBDIRS } from '@/cli/init';

describe('createAiboSymlink - directory removal', () => {
  let tmpDir: string;
  let packageDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-init-extra-'));
    packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-pkg-extra-'));
    for (const subdir of AIBO_LINKED_SUBDIRS) {
      fs.mkdirSync(path.join(packageDir, subdir));
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(packageDir, { recursive: true, force: true });
  });

  it('removes existing real directory (not symlink) before recreating .aibo', () => {
    const aiboPath = path.join(tmpDir, '.aibo');
    // Create a real directory (not a symlink) at the .aibo path
    fs.mkdirSync(aiboPath);

    createAiboSymlink(tmpDir, packageDir);

    // .aibo should now be a real directory with sub-symlinks
    const stat = fs.lstatSync(aiboPath);
    expect(stat.isDirectory()).toBe(true);
    expect(stat.isSymbolicLink()).toBe(false);
    for (const subdir of AIBO_LINKED_SUBDIRS) {
      expect(fs.lstatSync(path.join(aiboPath, subdir)).isSymbolicLink()).toBe(true);
    }
  });
});

describe('printInitRequired', () => {
  it('prints error messages to stderr', () => {
    const stderrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      printInitRequired();
      expect(stderrSpy).toHaveBeenCalledTimes(2);
      expect(stderrSpy.mock.calls[0][0]).toContain('No .aibo folder');
      expect(stderrSpy.mock.calls[1][0]).toContain('aibo init');
    } finally {
      stderrSpy.mockRestore();
    }
  });
});

describe('runInit', () => {
  let tmpDir: string;
  const originalCwd = process.cwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-run-init-'));
    process.cwd = () => tmpDir;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .aibo directory and prints instructions', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit();

      const aiboPath = path.join(tmpDir, '.aibo');
      expect(fs.existsSync(aiboPath)).toBe(true);
      const stat = fs.lstatSync(aiboPath);
      expect(stat.isDirectory()).toBe(true);
      expect(stat.isSymbolicLink()).toBe(false);

      const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allLogs).toContain('Created .aibo');
      expect(allLogs).toContain('README');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('prints error but continues when .aibo creation fails', async () => {
    // Mock fs.mkdirSync to simulate a permission-denied failure for .aibo
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => {
      throw new Error('permission denied');
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await runInit();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create .aibo')
      );
      // Should still print the README instructions
      const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allLogs).toContain('README');
    } finally {
      mkdirSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
