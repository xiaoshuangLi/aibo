/**
 * Tests for SafeFilesystemBackend.redirectDeepagentsPath()
 *
 * Verifies that deepagents internal absolute paths (/conversation_history,
 * /large_tool_results) are transparently redirected to <projectRoot>/.data/
 * so that the built-in SummarizationMiddleware can write conversation history
 * without being blocked by the safety checks.
 */

import { SafeFilesystemBackend } from '@/infrastructure/filesystem/safe-backend';
import * as path from 'path';
import * as fs from 'fs';

describe('SafeFilesystemBackend – redirectDeepagentsPath', () => {
  const testRoot = '/tmp/test-safe-backend-redirect';
  let backend: SafeFilesystemBackend;

  beforeAll(() => {
    fs.mkdirSync(testRoot, { recursive: true });
  });

  beforeEach(() => {
    backend = new SafeFilesystemBackend({ rootDir: testRoot });
  });

  // ── /conversation_history ────────────────────────────────────────────────

  it('redirects /conversation_history exactly to .data/conversation_history', () => {
    const result = backend.redirectDeepagentsPath('/conversation_history');
    expect(result).toBe(path.join(testRoot, '.data', 'conversation_history'));
  });

  it('redirects /conversation_history/<file>.json', () => {
    const result = backend.redirectDeepagentsPath('/conversation_history/session-abc.json');
    expect(result).toBe(path.join(testRoot, '.data', 'conversation_history', 'session-abc.json'));
  });

  it('redirects /conversation_history/<subdir>/<file>', () => {
    const result = backend.redirectDeepagentsPath('/conversation_history/user1/2024/history.md');
    expect(result).toBe(path.join(testRoot, '.data', 'conversation_history', 'user1/2024/history.md'));
  });

  // ── /large_tool_results ──────────────────────────────────────────────────

  it('redirects /large_tool_results exactly to .data/large_tool_results', () => {
    const result = backend.redirectDeepagentsPath('/large_tool_results');
    expect(result).toBe(path.join(testRoot, '.data', 'large_tool_results'));
  });

  it('redirects /large_tool_results/<id>.json', () => {
    const result = backend.redirectDeepagentsPath('/large_tool_results/tool-result-xyz.json');
    expect(result).toBe(path.join(testRoot, '.data', 'large_tool_results', 'tool-result-xyz.json'));
  });

  // ── Non-internal paths (unchanged) ───────────────────────────────────────

  it('does not redirect paths within the project root', () => {
    const projectPath = path.join(testRoot, 'src', 'index.ts');
    expect(backend.redirectDeepagentsPath(projectPath)).toBe(projectPath);
  });

  it('does not redirect relative paths', () => {
    expect(backend.redirectDeepagentsPath('src/index.ts')).toBe('src/index.ts');
    expect(backend.redirectDeepagentsPath('./foo/bar.json')).toBe('./foo/bar.json');
  });

  it('does not redirect /skills paths', () => {
    const p = '/skills/coding/SKILL.md';
    expect(backend.redirectDeepagentsPath(p)).toBe(p);
  });

  it('does not redirect paths that merely contain the prefix as a substring', () => {
    const p = '/other_conversation_history/file.json';
    expect(backend.redirectDeepagentsPath(p)).toBe(p);
  });

  it('does not redirect empty string', () => {
    expect(backend.redirectDeepagentsPath('')).toBe('');
  });

  // ── End-to-end: write + read through redirect ─────────────────────────────

  it('write to /conversation_history path succeeds and file lands in .data/', async () => {
    const content = JSON.stringify({ sessionId: 'test-session', messages: [] });
    const virtualPath = '/conversation_history/test-session.json';

    const result = await backend.write(virtualPath, content);

    expect(result.error).toBeUndefined();

    const expectedFile = path.join(testRoot, '.data', 'conversation_history', 'test-session.json');
    expect(fs.existsSync(expectedFile)).toBe(true);
    expect(fs.readFileSync(expectedFile, 'utf-8')).toBe(content);

    // Cleanup
    fs.rmSync(expectedFile, { force: true });
  });

  it('read from /conversation_history path succeeds after writing', async () => {
    const content = '# Conversation History\n\nSession data here.';
    const virtualPath = '/conversation_history/read-test.md';
    const expectedFile = path.join(testRoot, '.data', 'conversation_history', 'read-test.md');

    // Write directly to the expected location
    fs.mkdirSync(path.dirname(expectedFile), { recursive: true });
    fs.writeFileSync(expectedFile, content, 'utf-8');

    const readResult = await backend.read(virtualPath);
    expect(readResult.content).toContain('Session data here.');

    // Cleanup
    fs.rmSync(expectedFile, { force: true });
  });

  it('write to /large_tool_results path succeeds and file lands in .data/', async () => {
    const content = 'large grep output here';
    const virtualPath = '/large_tool_results/grep-result-001.txt';

    const result = await backend.write(virtualPath, content);

    expect(result.error).toBeUndefined();

    const expectedFile = path.join(testRoot, '.data', 'large_tool_results', 'grep-result-001.txt');
    expect(fs.existsSync(expectedFile)).toBe(true);

    // Cleanup
    fs.rmSync(expectedFile, { force: true });
  });
});
