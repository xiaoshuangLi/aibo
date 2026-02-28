import { findSkillsDirectories } from '@/core/utils';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('findSkillsDirectories', () => {
  test('should find root skills directory', () => {
    const result = findSkillsDirectories(process.cwd());
    expect(result).toContain('./skills/');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('should return default path when no skills directories found', () => {
    // Create a temporary directory without skills
    const tempDir = mkdtempSync(join(tmpdir(), 'test-no-skills-'));
    try {
      const result = findSkillsDirectories(tempDir);
      expect(result).toEqual(['./skills/']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});