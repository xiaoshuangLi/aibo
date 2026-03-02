import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { loadAiboMd } from '@/core/utils/aibo-md';

const TEST_DIR = '/tmp/test-aibo-md';

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('loadAiboMd', () => {
  test('returns empty object when aibo.md does not exist', () => {
    const result = loadAiboMd(TEST_DIR);
    expect(result).toEqual({});
  });

  test('returns systemPrompt from plain content (no frontmatter)', () => {
    writeFileSync(join(TEST_DIR, 'aibo.md'), 'You are a helpful assistant.');
    const result = loadAiboMd(TEST_DIR);
    expect(result.systemPrompt).toBe('You are a helpful assistant.');
    expect(result.model).toBeUndefined();
  });

  test('returns model and systemPrompt from frontmatter + body', () => {
    const content = `---\nmodel: claude-3-5-sonnet-20241022\n---\nYou are a specialized assistant.`;
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);
    const result = loadAiboMd(TEST_DIR);
    expect(result.model).toBe('claude-3-5-sonnet-20241022');
    expect(result.systemPrompt).toBe('You are a specialized assistant.');
  });

  test('returns model without body', () => {
    const content = `---\nmodel: gpt-4o\n---\n`;
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);
    const result = loadAiboMd(TEST_DIR);
    expect(result.model).toBe('gpt-4o');
    expect(result.systemPrompt).toBeUndefined();
  });

  test('ignores unknown frontmatter keys', () => {
    const content = `---\nunknown: value\n---\nCustom prompt.`;
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);
    const result = loadAiboMd(TEST_DIR);
    expect(result.systemPrompt).toBe('Custom prompt.');
    expect((result as any).unknown).toBeUndefined();
  });

  test('trims whitespace from model name', () => {
    const content = `---\nmodel:  gemini-2.0-flash \n---\nPrompt body.`;
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);
    const result = loadAiboMd(TEST_DIR);
    expect(result.model).toBe('gemini-2.0-flash');
  });

  test('returns systemPrompt as undefined when body is only whitespace', () => {
    const content = `---\nmodel: gpt-4o\n---\n   \n   `;
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);
    const result = loadAiboMd(TEST_DIR);
    expect(result.systemPrompt).toBeUndefined();
  });

  test('defaults cwd to process.cwd()', () => {
    // Should not throw even if there is no aibo.md in cwd
    expect(() => loadAiboMd()).not.toThrow();
  });

  test('handles multiline body correctly', () => {
    const body = 'Line 1.\nLine 2.\nLine 3.';
    const content = `---\nmodel: gpt-4o\n---\n${body}`;
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);
    const result = loadAiboMd(TEST_DIR);
    expect(result.systemPrompt).toBe(body);
  });
});
