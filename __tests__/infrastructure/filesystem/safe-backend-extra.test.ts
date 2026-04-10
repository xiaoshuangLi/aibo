/**
 * Additional coverage tests for SafeFilesystemBackend error paths.
 * Covers permission error handling in read(), ls(), grep(), and glob().
 */
import { SafeFilesystemBackend } from '@/infrastructure/filesystem/safe-backend';
import * as path from 'path';

describe('SafeFilesystemBackend - error branch coverage', () => {
  let backend: SafeFilesystemBackend;
  const testRoot = process.cwd();

  beforeEach(() => {
    backend = new SafeFilesystemBackend({ rootDir: testRoot, maxDepth: 5 });
  });

  // ── read(): EACCES error ──────────────────────────────────────────────────

  it('read() returns "Permission denied" on EACCES error from parent', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'read')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    const result = await backend.read('src/cli/init.ts', 0, 100);
    expect(result.error).toContain('Permission denied');
  });

  it('read() rethrows other errors', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'read')
      .mockRejectedValueOnce(new Error('some other error'));

    await expect(backend.read('src/cli/init.ts', 0, 100)).rejects.toThrow('some other error');
  });

  it('read() returns "Permission denied" on EPERM error', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'read')
      .mockRejectedValueOnce(new Error('EPERM operation not permitted'));

    const result = await backend.read('src/cli/init.ts', 0, 100);
    expect(result.error).toContain('Permission denied');
  });

  // ── ls(): EACCES error ─────────────────────────────────────────────────────

  it('ls() returns "Permission denied" on EACCES error from parent', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'ls')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    const result = await backend.ls(testRoot);
    expect(result.error).toContain('Permission denied');
  });

  it('ls() rethrows other errors', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'ls')
      .mockRejectedValueOnce(new Error('unknown ls error'));

    await expect(backend.ls(testRoot)).rejects.toThrow('unknown ls error');
  });

  // ── grep(): EACCES and other errors ───────────────────────────────────────

  it('grep() returns "Permission denied" error on EACCES error', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'grep')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    const result = await backend.grep('pattern', testRoot, '**/*.ts');
    expect(result.error).toContain('Permission denied');
  });

  it('grep() rethrows other errors', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'grep')
      .mockRejectedValueOnce(new Error('critical grep error'));

    await expect(backend.grep('pattern', testRoot, '**/*.ts')).rejects.toThrow('critical grep error');
  });

  // ── glob(): EACCES and other errors ────────────────────────────────────────

  it('glob() returns "Permission denied" error on EACCES error', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'glob')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    const result = await backend.glob('**/*.ts', testRoot);
    expect(result.error).toContain('Permission denied');
  });

  it('glob() rethrows other errors', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'glob')
      .mockRejectedValueOnce(new Error('glob error'));

    await expect(backend.glob('**/*.ts', testRoot)).rejects.toThrow('glob error');
  });

  // ── grep(): "Access denied" error string ──────────────────────────────────

  it('grep() returns Access denied error when caught error message includes Access denied', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'grep')
      .mockRejectedValueOnce(new Error('Access denied: path is blocked'));

    const result = await backend.grep('pattern', testRoot, '**/*.ts');
    expect(result.error).toContain('Access denied');
  });

  // ── glob(): "Access denied" error ────────────────────────────────────────

  it('glob() returns Access denied error when caught error message includes Access denied', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'glob')
      .mockRejectedValueOnce(new Error('Access denied: path outside root'));

    const result = await backend.glob('**/*.ts', testRoot);
    expect(result.error).toContain('Access denied');
  });

  // ── write(): EACCES error ──────────────────────────────────────────────────

  it('write() returns permission error on EACCES', async () => {
    jest.spyOn(require('fs').promises, 'writeFile')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    const result = await backend.write('src/cli/init.ts', 'content');
    expect(result.error).toContain('Permission denied');
  });

  it('write() returns error message on other Error', async () => {
    jest.spyOn(require('fs').promises, 'mkdir')
      .mockRejectedValueOnce(new Error('unexpected error'));

    const result = await backend.write('src/cli/init.ts', 'content');
    expect(result.error).toContain('unexpected error');
  });
});
