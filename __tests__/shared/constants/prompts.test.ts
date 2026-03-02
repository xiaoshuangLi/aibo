// Mock dotenv to prevent loading .env during tests
jest.mock('dotenv', () => ({ config: jest.fn() }));

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

const TEST_DIR = join(os.tmpdir(), 'test-get-system-prompt');

describe('getContextInfo', () => {
  let getContextInfo: () => string;

  beforeAll(() => {
    ({ getContextInfo } = require('@/shared/constants/prompts'));
  });

  test('contains current date in YYYY-MM-DD format', () => {
    const result = getContextInfo();
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toContain(`Current Date: ${today}`);
  });

  test('contains OS, Node.js version, and working directory', () => {
    const result = getContextInfo();
    expect(result).toContain('Operating System:');
    expect(result).toContain('Node.js Version:');
    expect(result).toContain('Working Directory:');
  });

  test('contains hostname, shell, username, and home directory', () => {
    const result = getContextInfo();
    expect(result).toContain('Hostname:');
    expect(result).toContain('Shell:');
    expect(result).toContain('Username:');
    expect(result).toContain('Home Directory:');
  });
});

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

  test('includes aibo.md content and context info when file exists', () => {
    const content = 'You are a custom assistant defined in aibo.md.';
    writeFileSync(join(TEST_DIR, 'aibo.md'), content);

    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const result: string = getSystemPrompt();
    expect(result).toContain(content);
    expect(result).toContain('ENVIRONMENT CONTEXT');
    expect(result).toContain('Current Date:');
  });

  test('returns default system prompt when aibo.md does not exist', () => {
    // TEST_DIR has no aibo.md
    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const result: string = getSystemPrompt();
    expect(result).toContain('CONFIGURED LANGUAGE');
    expect(result).toContain('ENVIRONMENT CONTEXT');
    expect(result).toContain('Current Date:');
  });

  test('falls back to default prompt when aibo.md cannot be read', () => {
    // Point cwd to a non-existent sub-directory so existsSync returns false
    cwdSpy.mockReturnValue(join(TEST_DIR, 'nonexistent'));

    const { getSystemPrompt } = require('@/shared/constants/prompts');
    const result: string = getSystemPrompt();
    expect(result).toContain('CONFIGURED LANGUAGE');
    expect(result).toContain('ENVIRONMENT CONTEXT');
    expect(result).toContain('Current Date:');
  });
});
