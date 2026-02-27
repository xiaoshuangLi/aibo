import fs from 'fs';
import path from 'path';
import os from 'os';
import { copyEnvExample, createAiboSymlink, resolvePackageDir } from '@/cli/init';

describe('resolvePackageDir', () => {
  it('should return a path that ends with two segments up from __dirname equivalent', () => {
    const packageDir = resolvePackageDir();
    // The function uses path.resolve(__dirname, '..', '..') at runtime.
    // In the test environment __dirname corresponds to the ts-jest compilation of
    // src/cli/init.ts.  We just assert it returns a non-empty absolute path.
    expect(typeof packageDir).toBe('string');
    expect(path.isAbsolute(packageDir)).toBe(true);
  });
});

describe('copyEnvExample', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-copy-env-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copies the source file content to the destination', () => {
    const srcPath = path.join(tmpDir, '.env.example');
    const destPath = path.join(tmpDir, '.env');
    fs.writeFileSync(srcPath, 'AIBO_API_KEY=your-api-key\nAIBO_MODEL_NAME=gpt-4o\n', 'utf-8');

    copyEnvExample(srcPath, destPath);

    const content = fs.readFileSync(destPath, 'utf-8');
    expect(content).toContain('AIBO_API_KEY=your-api-key');
    expect(content).toContain('AIBO_MODEL_NAME=gpt-4o');
  });

  it('overwrites an existing destination file', () => {
    const srcPath = path.join(tmpDir, '.env.example');
    const destPath = path.join(tmpDir, '.env');
    fs.writeFileSync(srcPath, 'NEW_VAR=new\n', 'utf-8');
    fs.writeFileSync(destPath, 'OLD_VAR=old\n', 'utf-8');

    copyEnvExample(srcPath, destPath);

    const content = fs.readFileSync(destPath, 'utf-8');
    expect(content).not.toContain('OLD_VAR');
    expect(content).toContain('NEW_VAR=new');
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
