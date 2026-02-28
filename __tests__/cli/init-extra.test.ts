import fs from 'fs';
import path from 'path';
import os from 'os';
import { createAiboSymlink, printInitRequired, runInit } from '@/cli/init';

describe('createAiboSymlink - directory removal', () => {
  let tmpDir: string;
  let packageDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-init-extra-'));
    packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-pkg-extra-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(packageDir, { recursive: true, force: true });
  });

  it('removes existing real directory (not symlink) before creating symlink', () => {
    const symlinkPath = path.join(tmpDir, '.aibo');
    // Create a real directory (not a symlink) at the .aibo path
    fs.mkdirSync(symlinkPath);

    createAiboSymlink(tmpDir, packageDir);

    // Now .aibo should be a symlink pointing to packageDir
    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(symlinkPath)).toBe(fs.realpathSync(packageDir));
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

  it('creates .aibo symlink and prints instructions', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runInit();

      const symlinkPath = path.join(tmpDir, '.aibo');
      expect(fs.existsSync(symlinkPath)).toBe(true);
      expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);

      const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allLogs).toContain('Created .aibo');
      expect(allLogs).toContain('README');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('prints error but continues when symlink creation fails', async () => {
    // Make cwd point to a non-writable path by mocking fs.symlinkSync to throw
    const symlinkSpy = jest.spyOn(fs, 'symlinkSync').mockImplementationOnce(() => {
      throw new Error('permission denied');
    });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await runInit();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create .aibo symlink')
      );
      // Should still print the README instructions
      const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allLogs).toContain('README');
    } finally {
      symlinkSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
