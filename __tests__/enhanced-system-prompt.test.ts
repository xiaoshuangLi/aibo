import { ENHANCED_SYSTEM_PROMPT_EN, ENHANCED_SYSTEM_PROMPT_ZH, ENHANCED_SYSTEM_PROMPT } from '../src/enhanced-system-prompt';

describe('Enhanced System Prompt Tests', () => {
  test('should export ENHANCED_SYSTEM_PROMPT_EN', () => {
    expect(ENHANCED_SYSTEM_PROMPT_EN).toBeDefined();
    expect(typeof ENHANCED_SYSTEM_PROMPT_EN).toBe('string');
    expect(ENHANCED_SYSTEM_PROMPT_EN).toBeTruthy();
  });

  test('should export ENHANCED_SYSTEM_PROMPT_ZH', () => {
    expect(ENHANCED_SYSTEM_PROMPT_ZH).toBeDefined();
    expect(typeof ENHANCED_SYSTEM_PROMPT_ZH).toBe('string');
    expect(ENHANCED_SYSTEM_PROMPT_ZH).toBeTruthy();
  });

  test('should export ENHANCED_SYSTEM_PROMPT as ENHANCED_SYSTEM_PROMPT_EN', () => {
    expect(ENHANCED_SYSTEM_PROMPT).toBeDefined();
    expect(ENHANCED_SYSTEM_PROMPT).toBe(ENHANCED_SYSTEM_PROMPT_EN);
  });
});