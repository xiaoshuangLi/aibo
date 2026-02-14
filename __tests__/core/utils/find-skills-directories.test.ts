import { findSkillsDirectories } from '@/core/utils';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';

describe('findSkillsDirectories', () => {
  const testDir = '/tmp/test-skills-dir';
  const nestedTestDir = join(testDir, 'nested');
  const ignoredTestDir = join(testDir, 'node_modules');

  beforeEach(async () => {
    // 清理之前的测试目录
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // 目录可能不存在
    }
    
    // 创建测试目录结构
    mkdirSync(testDir, { recursive: true });
    mkdirSync(nestedTestDir, { recursive: true });
    mkdirSync(ignoredTestDir, { recursive: true });
    
    // 创建skills目录
    mkdirSync(join(testDir, 'skills'), { recursive: true });
    mkdirSync(join(nestedTestDir, 'skills'), { recursive: true });
    writeFileSync(join(testDir, 'skills', 'test.txt'), 'test');
    writeFileSync(join(nestedTestDir, 'skills', 'test.txt'), 'test');
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理错误
    }
  });

  test('should find root skills directory', () => {
    const result = findSkillsDirectories(process.cwd());
    expect(result).toContain('./skills/');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('should find nested skills directories', () => {
    const result = findSkillsDirectories(testDir);
    expect(result).toContain('./skills/');
    expect(result).toContain('./nested/skills/');
    expect(result.length).toBe(2);
  });

  test('should ignore node_modules directory', () => {
    // 在node_modules中创建skills目录，应该被忽略
    const nodeModulesSkills = join(ignoredTestDir, 'skills');
    mkdirSync(nodeModulesSkills, { recursive: true });
    writeFileSync(join(nodeModulesSkills, 'test.txt'), 'test');
    
    const result = findSkillsDirectories(testDir);
    expect(result).not.toContain('./node_modules/skills/');
    expect(result).toContain('./skills/');
    expect(result).toContain('./nested/skills/');
  });

  test('should return default path when no skills directories found', async () => {
    // 创建一个没有skills目录的临时目录
    const emptyDir = '/tmp/empty-test-dir';
    mkdirSync(emptyDir, { recursive: true });
    
    const result = findSkillsDirectories(emptyDir);
    expect(result).toEqual(['./skills/']);
    
    await rm(emptyDir, { recursive: true, force: true });
  });

  test('should handle empty skills directories', () => {
    // 创建一个空的skills目录
    const emptySkillsDir = join(testDir, 'empty-skills');
    mkdirSync(emptySkillsDir, { recursive: true });
    
    const result = findSkillsDirectories(testDir);
    // 空的skills目录不应该被包含
    expect(result).not.toContain('./empty-skills/');
    expect(result).toContain('./skills/');
    expect(result).toContain('./nested/skills/');
  });

  test('should handle permission errors gracefully', () => {
    // 这个测试主要验证函数不会抛出异常
    // 在实际环境中，权限错误会被捕获并跳过
    expect(() => {
      findSkillsDirectories('/nonexistent/path');
    }).not.toThrow();
  });

  test('should handle relative paths correctly', () => {
    const result = findSkillsDirectories(testDir);
    // 验证路径格式正确
    result.forEach(path => {
      expect(path).toMatch(/^\.\//);
      expect(path).toMatch(/\/$/);
    });
  });
});