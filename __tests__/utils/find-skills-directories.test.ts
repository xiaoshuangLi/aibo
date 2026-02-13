import { findSkillsDirectories } from '../../src/core/utils/find-skills-directories';
import { join } from 'path';

describe('findSkillsDirectories', () => {
  test('should find root skills directory', () => {
    const result = findSkillsDirectories(process.cwd());
    expect(result).toContain('./skills/');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('should return default path when no skills directories found', () => {
    // Create a temporary directory without skills
    const tempDir = '/tmp';
    const result = findSkillsDirectories(tempDir);
    expect(result).toEqual(['./skills/']);
  });
});