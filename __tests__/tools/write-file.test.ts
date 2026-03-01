import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writeFileTool } from '../../src/tools/write-file';

describe('writeFileTool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'write-file-test-')));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('should have correct name and description', () => {
    expect(writeFileTool.name).toBe('write_file');
    expect(writeFileTool.description).toContain('full content');
    expect(writeFileTool.description).toContain('edit_file');
  });

  test('creates a new file with given content', async () => {
    const filePath = path.join(tmpDir, 'new-file.ts');
    const content = 'export const greeting = "hello world";\n';

    const result = await writeFileTool.invoke({ file_path: filePath, content });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('created');
    expect(parsed.file_path).toBe(filePath);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
  });

  test('overwrites an existing file completely', async () => {
    const filePath = path.join(tmpDir, 'existing.ts');
    fs.writeFileSync(filePath, 'old content\n', 'utf-8');

    const newContent = 'brand new content\n';
    const result = await writeFileTool.invoke({ file_path: filePath, content: newContent });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('overwritten');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(newContent);
  });

  test('creates parent directories automatically', async () => {
    const filePath = path.join(tmpDir, 'a', 'b', 'c', 'deep.ts');
    const content = 'export {};\n';

    const result = await writeFileTool.invoke({ file_path: filePath, content });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('created');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('resolves relative paths against cwd', async () => {
    // Use absolute path to avoid relying on process.cwd() in test
    const filePath = path.join(tmpDir, 'relative-test.ts');
    const result = await writeFileTool.invoke({ file_path: filePath, content: 'hello\n' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.file_path).toBe(filePath);
  });

  test('reports correct line count', async () => {
    const filePath = path.join(tmpDir, 'lines.ts');
    const content = 'line1\nline2\nline3\n';

    const result = await writeFileTool.invoke({ file_path: filePath, content });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.lines_written).toBe(3); // 3 real lines (trailing \n is just a terminator)
  });

  test('handles empty content', async () => {
    const filePath = path.join(tmpDir, 'empty.ts');
    const result = await writeFileTool.invoke({ file_path: filePath, content: '' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('');
  });

  test('getWriteFileTools returns array containing writeFileTool', async () => {
    const getWriteFileTools = (await import('../../src/tools/write-file')).default;
    const tools = await getWriteFileTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('write_file');
  });

  test('resolves relative file_path against cwd', async () => {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = await writeFileTool.invoke({ file_path: 'relative-write-test.ts', content: 'hello' });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.file_path).toBe(path.join(tmpDir, 'relative-write-test.ts'));
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('handles non-Error exception (string thrown)', async () => {
    const fsModule = require('fs');
    const origWrite = fsModule.writeFileSync;
    fsModule.writeFileSync = () => { throw 'string error'; };
    try {
      const result = await writeFileTool.invoke({ file_path: path.join(tmpDir, 'throw-test.ts'), content: 'x' });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('string error');
    } finally {
      fsModule.writeFileSync = origWrite;
    }
  });
});
