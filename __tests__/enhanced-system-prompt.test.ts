import { SYSTEM_PROMPT_EN, SYSTEM_PROMPT_ZH, SYSTEM_PROMPT } from '../src/shared/constants/system-prompts';

describe('Enhanced System Prompt Tests', () => {
  test('should export SYSTEM_PROMPT_EN', () => {
    expect(SYSTEM_PROMPT_EN).toBeDefined();
    expect(typeof SYSTEM_PROMPT_EN).toBe('string');
    expect(SYSTEM_PROMPT_EN).toBeTruthy();
  });

  test('should export SYSTEM_PROMPT_ZH', () => {
    expect(SYSTEM_PROMPT_ZH).toBeDefined();
    expect(typeof SYSTEM_PROMPT_ZH).toBe('string');
    expect(SYSTEM_PROMPT_ZH).toBeTruthy();
  });

  test('should export SYSTEM_PROMPT as SYSTEM_PROMPT_EN', () => {
    expect(SYSTEM_PROMPT).toBeDefined();
    expect(SYSTEM_PROMPT).toBe(SYSTEM_PROMPT_EN);
  });
});