// Mock dotenv to prevent loading .env during tests
jest.mock('dotenv', () => ({ config: jest.fn() }));

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

const TEST_DIR = join(os.tmpdir(), 'test-get-system-prompt');

describe('getSystemPrompt', () => {
  let cwdSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mkdirSync(TEST_DIR, { recursive: true });
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('returns aibo.md content directly when file exists', () => {
    const content = 'You are a custom assistant defined in aibo.md.';
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);

    const { getSystemPrompt } = require('@/shared/constants/prompts');
    expect(getSystemPrompt()).toBe(content);
  });

  test('returns default system prompt when aibo.md does not exist', () => {
    // TEST_DIR has no aibo.md
    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const result = getSystemPrompt();
    // Default prompt contains language emphasis header
    expect(result).toContain('CONFIGURED LANGUAGE');
  });

  test('falls back to default prompt when aibo.md cannot be read', () => {
    // Point cwd to a non-existent sub-directory so existsSync returns false
    cwdSpy.mockReturnValue(join(TEST_DIR, 'nonexistent'));

    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const result = getSystemPrompt();
    expect(result).toContain('CONFIGURED LANGUAGE');
  });
});
