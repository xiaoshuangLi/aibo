/**
 * Additional coverage tests for SafeFilesystemBackend error paths.
 * Covers permission error handling in read(), lsInfo(), grepRaw(), and globInfo().
 */
import { SafeFilesystemBackend } from '@/infrastructure/filesystem/safe-backend';
import * as path from 'path';

describe('SafeFilesystemBackend - error branch coverage', () => {
  let backend: SafeFilesystemBackend;
  const testRoot = process.cwd();

  beforeEach(() => {
    backend = new SafeFilesystemBackend({ rootDir: testRoot, maxDepth: 5 });
  });

  // ── read(): EACCES error (lines 193-194) ──────────────────────────────────

  it('read() throws "Permission denied" on EACCES error from parent', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'read')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    await expect(backend.read('src/cli/init.ts', 0, 100)).rejects.toThrow('Permission denied');
  });

  it('read() rethrows other errors (line 198)', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'read')
      .mockRejectedValueOnce(new Error('some other error'));

    await expect(backend.read('src/cli/init.ts', 0, 100)).rejects.toThrow('some other error');
  });

  it('read() throws "Permission denied" on EPERM error', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'read')
      .mockRejectedValueOnce(new Error('EPERM operation not permitted'));

    await expect(backend.read('src/cli/init.ts', 0, 100)).rejects.toThrow('Permission denied');
  });

  // ── lsInfo(): EACCES error (lines 230-231) ─────────────────────────────────

  it('lsInfo() throws "Permission denied" on EACCES error from parent', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'lsInfo')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    await expect(backend.lsInfo(testRoot)).rejects.toThrow('Permission denied');
  });

  it('lsInfo() rethrows other errors (line 235)', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'lsInfo')
      .mockRejectedValueOnce(new Error('unknown lsInfo error'));

    await expect(backend.lsInfo(testRoot)).rejects.toThrow('unknown lsInfo error');
  });

  // ── grepRaw(): EACCES (line 332) and other (line 337) ────────────────────

  it('grepRaw() returns "Permission denied" string on EACCES error', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'grepRaw')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    const result = await backend.grepRaw('pattern', testRoot, '**/*.ts');
    expect(typeof result === 'string' ? result : '').toContain('Permission denied');
  });

  it('grepRaw() rethrows other errors (line 337)', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'grepRaw')
      .mockRejectedValueOnce(new Error('critical grep error'));

    await expect(backend.grepRaw('pattern', testRoot, '**/*.ts')).rejects.toThrow('critical grep error');
  });

  // ── globInfo(): EACCES (line 394-409) ─────────────────────────────────────

  it('globInfo() throws "Permission denied" on EACCES error', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'globInfo')
      .mockRejectedValueOnce(new Error('EACCES permission denied'));

    await expect(backend.globInfo('**/*.ts', testRoot)).rejects.toThrow('Permission denied');
  });

  it('globInfo() rethrows other errors (line 409)', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'globInfo')
      .mockRejectedValueOnce(new Error('glob error'));

    await expect(backend.globInfo('**/*.ts', testRoot)).rejects.toThrow('glob error');
  });

  // ── grepRaw(): "Access denied" error string (line 283) ──────────────────

  it('grepRaw() returns Access denied string from catch when message includes Access denied', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'grepRaw')
      .mockRejectedValueOnce(new Error('Access denied: path is blocked'));

    const result = await backend.grepRaw('pattern', testRoot, '**/*.ts');
    expect(typeof result).toBe('string');
    expect(result).toContain('Access denied');
  });

  // ── globInfo(): "Access denied" error (line 394) ────────────────────────

  it('globInfo() rethrows "Access denied" error as-is', async () => {
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(backend)), 'globInfo')
      .mockRejectedValueOnce(new Error('Access denied: path outside root'));

    await expect(backend.globInfo('**/*.ts', testRoot)).rejects.toThrow('Access denied');
  });

  // ── write(): EACCES error (line 396) ──────────────────────────────────────

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
