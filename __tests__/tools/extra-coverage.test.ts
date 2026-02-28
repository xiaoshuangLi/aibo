/**
 * Extra coverage tests for tools targeting uncovered error branches.
 */
import * as path from 'path';
import * as os from 'os';
import * as realFs from 'fs';

// ── view-file: FILE_TOO_LARGE (line 29) and read-error (line 65) ────────────

describe('viewFileTool - extra coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = realFs.mkdtempSync(path.join(os.tmpdir(), 'vf-extra-'));
  });
  afterEach(() => {
    realFs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns FILE_TOO_LARGE when stat.size exceeds limit', async () => {
    const { viewFileTool } = require('../../src/tools/view-file');
    const bigFile = path.join(tmpDir, 'big.ts');
    realFs.writeFileSync(bigFile, '');

    const fsModule = require('fs');
    const orig = fsModule.statSync;
    fsModule.statSync = () => ({ size: 11 * 1024 * 1024 });
    try {
      const result = await viewFileTool.invoke({ file_path: bigFile });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('FILE_TOO_LARGE');
    } finally {
      fsModule.statSync = orig;
    }
  });

  it('returns error JSON when readFileSync throws', async () => {
    const { viewFileTool } = require('../../src/tools/view-file');
    const aFile = path.join(tmpDir, 'oops.ts');
    realFs.writeFileSync(aFile, 'content');

    const fsModule = require('fs');
    const origStat = fsModule.statSync;
    const origRead = fsModule.readFileSync;

    fsModule.statSync = () => ({ size: 100 });
    let called = false;
    fsModule.readFileSync = (...args: any[]) => {
      if (!called) { called = true; throw new Error('read error'); }
      return origRead(...args);
    };

    try {
      const result = await viewFileTool.invoke({ file_path: aFile });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    } finally {
      fsModule.statSync = origStat;
      fsModule.readFileSync = origRead;
    }
  });
});

// ── write-file: error path (line 40) ─────────────────────────────────────────

describe('writeFileTool - write error path', () => {
  it('returns error JSON when write target is invalid', async () => {
    const { writeFileTool } = require('../../src/tools/write-file');

    const result = await writeFileTool.invoke({
      file_path: '/proc/sys/this_cannot_be_written.txt',
      content: 'test',
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

// ── grep: unreadable file skip (line 57) ─────────────────────────────────────

describe('grepFilesTool - skip unreadable file', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = realFs.mkdtempSync(path.join(os.tmpdir(), 'grep-chmod-'));
  });
  afterEach(() => {
    realFs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skips files that cannot be read (chmod 000)', async () => {
    const { grepFilesTool } = require('../../src/tools/grep');
    const good = path.join(tmpDir, 'good.txt');
    const bad = path.join(tmpDir, 'bad.txt');
    realFs.writeFileSync(good, 'hello world');
    realFs.writeFileSync(bad, 'secret');
    realFs.chmodSync(bad, 0o000);

    try {
      const result = await grepFilesTool.invoke({ pattern: 'hello', directory: tmpDir });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    } finally {
      try { realFs.chmodSync(bad, 0o644); } catch { /* ignore */ }
    }
  });
});

// ── prompts: English locale path (line 37) ───────────────────────────────────

describe('getSystemPrompt - English locale', () => {
  it('returns non-empty English prompt when language is not zh', () => {
    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const prompt = getSystemPrompt('en');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});
