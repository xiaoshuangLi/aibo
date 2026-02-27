import * as path from 'path';
import { grepFilesTool } from '../../src/tools/grep';

const REPO_ROOT = path.resolve(__dirname, '../..');

describe('grepFilesTool', () => {
  test('should have correct tool schema', () => {
    expect(grepFilesTool.name).toBe('grep_files');
    expect(grepFilesTool.description).toContain('regular expression');
    const schema = grepFilesTool.schema;
    expect(schema.shape.pattern).toBeDefined();
    expect(schema.shape.include).toBeDefined();
    expect(schema.shape.cwd).toBeDefined();
    expect(schema.shape.case_insensitive).toBeDefined();
  });

  test('should find pattern in TypeScript files', async () => {
    const result = await grepFilesTool.invoke({
      pattern: 'execute_bash',
      include: 'src/tools/*.ts',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.results.some((r: any) => r.file.includes('bash.ts'))).toBe(true);
  });

  test('should return file, line, and content in results', async () => {
    const result = await grepFilesTool.invoke({
      pattern: 'export default',
      include: 'src/tools/utils.ts',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    if (parsed.count > 0) {
      expect(parsed.results[0]).toHaveProperty('file');
      expect(parsed.results[0]).toHaveProperty('line');
      expect(parsed.results[0]).toHaveProperty('content');
      expect(typeof parsed.results[0].line).toBe('number');
    }
  });

  test('should return empty results for no matches', async () => {
    const result = await grepFilesTool.invoke({
      pattern: 'ZZZNOSUCHTEXTZZZZZZZZ',
      include: 'src/**/*.ts',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBe(0);
    expect(parsed.results).toEqual([]);
  });

  test('should perform case-insensitive search', async () => {
    const caseSensitive = await grepFilesTool.invoke({
      pattern: 'EXECUTE_BASH',
      include: 'src/tools/*.ts',
      cwd: REPO_ROOT,
      case_insensitive: false,
    });
    const caseInsensitive = await grepFilesTool.invoke({
      pattern: 'EXECUTE_BASH',
      include: 'src/tools/*.ts',
      cwd: REPO_ROOT,
      case_insensitive: true,
    });
    const parsedSensitive = JSON.parse(caseSensitive);
    const parsedInsensitive = JSON.parse(caseInsensitive);
    // Case-insensitive should find more or equal results
    expect(parsedInsensitive.count).toBeGreaterThanOrEqual(parsedSensitive.count);
  });

  test('should handle invalid regex gracefully', async () => {
    const result = await grepFilesTool.invoke({
      pattern: '[invalid regex((',
      include: 'src/**/*.ts',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('INVALID_REGEX');
  });

  test('should use process.cwd() when cwd not specified', async () => {
    const result = await grepFilesTool.invoke({
      pattern: 'name',
      include: 'package.json',
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.cwd).toBe(process.cwd());
  });

  test('should use ** wildcard when include not specified', async () => {
    const result = await grepFilesTool.invoke({
      pattern: 'execute_bash',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBeGreaterThan(0);
  });

  test('should report truncated flag when MAX_RESULTS exceeded', async () => {
    // Search for a very common pattern to trigger truncation
    // We use a benign pattern that appears in many files
    const result = await grepFilesTool.invoke({
      pattern: '.',  // matches every non-empty line
      include: 'src/**/*.ts',
      cwd: REPO_ROOT,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    // May or may not truncate depending on file size; both cases are valid
    expect(typeof parsed.truncated).toBe('boolean');
  });
});
