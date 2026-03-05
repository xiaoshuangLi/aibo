import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { editFileTool } from '../../src/tools/edit-file';

describe('editFileTool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-edit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('should have correct tool schema', () => {
    expect(editFileTool.name).toBe('edit_file');
    expect(editFileTool.description).toContain('replacement');
    const schema = editFileTool.schema;
    expect(schema.shape.file_path).toBeDefined();
    expect(schema.shape.old_string).toBeDefined();
    expect(schema.shape.new_string).toBeDefined();
    expect(schema.shape.create_if_missing).toBeDefined();
  });

  test('should replace exact string in file', async () => {
    const file = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(file, 'const x = 1;\nconst y = 2;\n', 'utf-8');

    const result = await editFileTool.invoke({
      file_path: file,
      old_string: 'const x = 1;',
      new_string: 'const x = 42;',
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('edited');

    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toContain('const x = 42;');
    expect(content).not.toContain('const x = 1;');
  });

  test('should return NOT_FOUND when old_str not in file', async () => {
    const file = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(file, 'hello world\n', 'utf-8');

    const result = await editFileTool.invoke({
      file_path: file,
      old_string: 'nonexistent text',
      new_string: 'replacement',
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('NOT_FOUND');
  });

  test('should return AMBIGUOUS when old_str found multiple times', async () => {
    const file = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(file, 'foo\nfoo\n', 'utf-8');

    const result = await editFileTool.invoke({
      file_path: file,
      old_string: 'foo',
      new_string: 'bar',
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('AMBIGUOUS');
    expect(parsed.occurrences).toBe(2);
  });

  test('should create file when create_if_missing=true and old_str is empty', async () => {
    const file = path.join(tmpDir, 'new-file.ts');
    const content = 'export const hello = "world";\n';

    const result = await editFileTool.invoke({
      file_path: file,
      old_string: '',
      new_string: content,
      create_if_missing: true,
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.action).toBe('created');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf-8')).toBe(content);
  });

  test('should create nested directories when creating file', async () => {
    const file = path.join(tmpDir, 'deep', 'nested', 'file.ts');

    const result = await editFileTool.invoke({
      file_path: file,
      old_string: '',
      new_string: 'content',
      create_if_missing: true,
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
  });

  test('should return FILE_NOT_FOUND when file missing and create_if_missing is false', async () => {
    const result = await editFileTool.invoke({
      file_path: '/nonexistent/path/file.ts',
      old_string: 'anything',
      new_string: 'replacement',
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('FILE_NOT_FOUND');
  });

  test('should return EMPTY_OLD_STR when editing existing file with empty old_str', async () => {
    const file = path.join(tmpDir, 'existing.ts');
    fs.writeFileSync(file, 'existing content\n', 'utf-8');

    const result = await editFileTool.invoke({
      file_path: file,
      old_string: '',
      new_string: 'new content',
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('EMPTY_OLD_STR');
  });

  test('should delete text when new_str is empty', async () => {
    const file = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(file, 'keep this\ndelete this\nkeep this too\n', 'utf-8');

    const result = await editFileTool.invoke({
      file_path: file,
      old_string: '\ndelete this',
      new_string: '',
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).not.toContain('delete this');
  });

  test('should handle relative file path using cwd', async () => {
    const file = path.join(tmpDir, 'rel.ts');
    fs.writeFileSync(file, 'original\n', 'utf-8');
    const relPath = path.relative(process.cwd(), file);

    const result = await editFileTool.invoke({
      file_path: relPath,
      old_string: 'original',
      new_string: 'replaced',
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(fs.readFileSync(file, 'utf-8')).toContain('replaced');
  });
});
