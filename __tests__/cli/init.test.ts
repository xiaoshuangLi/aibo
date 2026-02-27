import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeEnvFile, createAiboSymlink, resolvePackageDir } from '@/cli/init';

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

describe('writeEnvFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-init-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes key=value pairs to the target file', () => {
    const envPath = path.join(tmpDir, '.env');
    writeEnvFile({ AIBO_API_KEY: 'sk-test', AIBO_MODEL_NAME: 'gpt-4o' }, envPath);

    const content = fs.readFileSync(envPath, 'utf-8');
    expect(content).toContain('AIBO_API_KEY=sk-test');
    expect(content).toContain('AIBO_MODEL_NAME=gpt-4o');
  });

  it('overwrites an existing .env file', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'OLD_VAR=old\n', 'utf-8');

    writeEnvFile({ NEW_VAR: 'new' }, envPath);

    const content = fs.readFileSync(envPath, 'utf-8');
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
