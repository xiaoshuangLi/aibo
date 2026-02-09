import { ENHANCED_SYSTEM_PROMPT_EN, ENHANCED_SYSTEM_PROMPT_ZH } from '../src/enhanced-system-prompt';

describe('Enhanced System Prompt - Chinese Version', () => {
  test('should export ENHANCED_SYSTEM_PROMPT_EN as a string', () => {
    expect(typeof ENHANCED_SYSTEM_PROMPT_EN).toBe('string');
    expect(ENHANCED_SYSTEM_PROMPT_EN.length).toBeGreaterThan(0);
  });

  test('should export ENHANCED_SYSTEM_PROMPT_ZH as a string', () => {
    expect(typeof ENHANCED_SYSTEM_PROMPT_ZH).toBe('string');
    expect(ENHANCED_SYSTEM_PROMPT_ZH.length).toBeGreaterThan(0);
  });

  test('should contain required environment information in Chinese version', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT_ZH;
    expect(prompt).toContain('环境信息');
    expect(prompt).toContain('操作系统');
    expect(prompt).toContain('Node.js 版本');
  });

  test('should contain core capabilities section in Chinese version', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT_ZH;
    expect(prompt).toContain('核心能力');
    expect(prompt).toContain('自主编程');
    expect(prompt).toContain('子代理委派');
  });

  test('should contain problem-solving methodology in Chinese version', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT_ZH;
    expect(prompt).toContain('问题解决方法论');
    expect(prompt).toContain('理解');
    expect(prompt).toContain('计划');
    expect(prompt).toContain('执行');
  });

  test('should contain feature development workflow in Chinese version', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT_ZH;
    expect(prompt).toContain('功能开发工作流程');
    expect(prompt).toContain('编写全面测试');
    expect(prompt).toContain('创建功能文档');
  });
});