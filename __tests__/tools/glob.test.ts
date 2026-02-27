import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { globFilesTool } from '../../src/tools/glob';

const REPO_ROOT = path.resolve(__dirname, '../..');

describe('globFilesTool', () => {
  test('should have correct tool schema', () => {
    expect(globFilesTool.name).toBe('glob_files');
    expect(globFilesTool.description).toContain('glob pattern');
    const schema = globFilesTool.schema;
    expect(schema.shape.pattern).toBeDefined();
    expect(schema.shape.cwd).toBeDefined();
    expect(schema.shape.ignore).toBeDefined();
  });

  test('should find TypeScript files in src/', async () => {
    const result = await globFilesTool.invoke({
      pattern: 'src/tools/*.ts',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.files.some((f: string) => f.includes('bash.ts'))).toBe(true);
    expect(parsed.pattern).toBe('src/tools/*.ts');
  });

  test('should return sorted results', async () => {
    const result = await globFilesTool.invoke({
      pattern: 'src/**/*.ts',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    const sorted = [...parsed.files].sort();
    expect(parsed.files).toEqual(sorted);
  });

  test('should return empty array for non-matching pattern', async () => {
    const result = await globFilesTool.invoke({
      pattern: '**/*.nonexistent_extension_xyz',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBe(0);
    expect(parsed.files).toEqual([]);
  });

  test('should use process.cwd() when cwd is not specified', async () => {
    const result = await globFilesTool.invoke({ pattern: 'package.json' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.cwd).toBe(process.cwd());
  });

  test('should respect custom ignore patterns', async () => {
    const result = await globFilesTool.invoke({
      pattern: '**/*.ts',
      cwd: REPO_ROOT,
      ignore: ['**/*.ts'], // ignore all ts files
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBe(0);
  });

  test('should handle invalid cwd gracefully', async () => {
    const result = await globFilesTool.invoke({
      pattern: '**/*.ts',
      cwd: '/nonexistent/path/xyz',
    });
    const parsed = JSON.parse(result);
    // glob will return 0 results or an error - either is acceptable
    expect(typeof parsed.success).toBe('boolean');
  });

  test('should find JSON config files', async () => {
    const result = await globFilesTool.invoke({
      pattern: '*.json',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.files.some((f: string) => f === 'package.json')).toBe(true);
  });
});
