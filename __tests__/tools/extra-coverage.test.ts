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

// ── prompts: English locale path (line 37) ───────────────────────────────────

describe('getSystemPrompt - English locale', () => {
  it('returns non-empty English prompt when language is not zh', () => {
    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const prompt = getSystemPrompt('en');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

// ── prompts: persona style branch and Chinese locale ─────────────────────────

describe('getSystemPrompt - persona style branch', () => {
  it('includes persona section when config.persona.style is set', () => {
    jest.resetModules();
    jest.mock('@/core/config', () => ({
      config: {
        language: { code: 'en' },
        persona: { style: 'You are a helpful assistant.' },
      },
    }));
    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const prompt = getSystemPrompt();
    expect(prompt).toContain('PERSONA');
    expect(prompt).toContain('You are a helpful assistant.');
    jest.resetModules();
  });

  it('returns Chinese prompt when language code is zh', () => {
    jest.resetModules();
    jest.mock('@/core/config', () => ({
      config: {
        language: { code: 'zh' },
        persona: { style: undefined },
      },
    }));
    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const prompt = getSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Chinese (中文)');
    jest.resetModules();
  });
});
