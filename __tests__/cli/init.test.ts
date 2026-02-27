import fs from 'fs';
import path from 'path';
import os from 'os';
import { README_URL, createAiboSymlink, resolvePackageDir } from '@/cli/init';

describe('resolvePackageDir', () => {
  it('should return a path that ends with two segments up from __dirname equivalent', () => {
    const packageDir = resolvePackageDir();
    expect(typeof packageDir).toBe('string');
    expect(path.isAbsolute(packageDir)).toBe(true);
  });
});

describe('README_URL', () => {
  it('should point to the aibo GitHub repository readme', () => {
    expect(README_URL).toContain('github.com/xiaoshuangLi/aibo');
    expect(README_URL).toContain('#readme');
  });
});

describe('createAiboSymlink', () => {
  let tmpDir: string;
  let packageDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-symlink-test-'));
    packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-pkg-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(packageDir, { recursive: true, force: true });
  });

  it('creates a .aibo symlink pointing to packageDir', () => {
    createAiboSymlink(tmpDir, packageDir);

    const symlinkPath = path.join(tmpDir, '.aibo');
    expect(fs.existsSync(symlinkPath)).toBe(true);
    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(symlinkPath)).toBe(fs.realpathSync(packageDir));
  });

  it('recreates .aibo symlink when it already exists', () => {
    const symlinkPath = path.join(tmpDir, '.aibo');
    const firstPackageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-pkg1-'));
    fs.symlinkSync(firstPackageDir, symlinkPath, 'dir');

    createAiboSymlink(tmpDir, packageDir);

    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(symlinkPath)).toBe(fs.realpathSync(packageDir));

    fs.rmSync(firstPackageDir, { recursive: true, force: true });
  });
});
