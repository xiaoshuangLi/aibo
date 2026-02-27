/**
 * Coverage gap tests for FileDiffVisualizer
 * Targets the specific missing branches identified in coverage analysis
 */
import { FileDiffVisualizer } from '@/presentation/lark/file-diff-visualizer';
import * as fs from 'fs';
import * as child_process from 'child_process';

jest.mock('fs');
jest.mock('child_process');

describe('FileDiffVisualizer – coverage gap tests', () => {
  let visualizer: FileDiffVisualizer;

  beforeEach(() => {
    visualizer = new FileDiffVisualizer('/test/dir');
    jest.clearAllMocks();
  });

  // Lines 111-112: "其他" fallback branch in getChangedFiles
  it('getChangedFiles: "其他" fallback status for unknown status code', async () => {
    (child_process.execSync as jest.Mock).mockReturnValue('?! unknown-file.txt\n');
    const result = await visualizer.getChangedFiles();
    expect(result.success).toBe(true);
    const other = result.files.find(f => f.status === '其他');
    expect(other).toBeDefined();
    expect(other?.emoji).toBe('📄');
  });

  // Lines 157-169: file does NOT exist AND diff has content → formatDiffOutput for deleted
  it('getFileDiff: non-existent file with git diff output → deleted type', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const mockDiff = `diff --git a/old.ts b/old.ts
--- a/old.ts
+++ b/old.ts
@@ -1 +1 @@
-old line
`;
    (child_process.execSync as jest.Mock).mockReturnValue(mockDiff);
    const result = await visualizer.getFileDiff('old.ts');
    expect(result.success).toBe(true);
    expect(result.type).toBe('deleted');
  });

  // Lines 187-198: non-existent file with empty diff → error response
  it('getFileDiff: non-existent file with no diff → error', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (child_process.execSync as jest.Mock).mockReturnValue('');
    const result = await visualizer.getFileDiff('gone.ts');
    expect(result.success).toBe(false);
    expect(result.error).toContain('文件不存在且无Git记录');
  });

  // Lines 212+: file exists, no working-tree diff, no staged diff, and it's a new file
  it('getFileDiff: existing untracked file → formatNewFileOutput', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const statusOutput = '?? new-file.ts\n';
    (fs.readFileSync as jest.Mock).mockReturnValue('const x = 1;\n');
    (child_process.execSync as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd.includes('git diff -- ')) return '';
      if (cmd.includes('git diff --cached')) return '';
      if (cmd.includes('git status')) return statusOutput;
      return '';
    });
    const result = await visualizer.getFileDiff('new-file.ts');
    expect(result.success).toBe(true);
    expect(result.type).toBe('new');
    expect(result.additions).toBeGreaterThan(0);
  });

  // File exists, no diffs, NOT a new file → error "没有改动"
  it('getFileDiff: existing tracked file with no diff → error', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (child_process.execSync as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd.includes('git status')) return 'M  other-file.ts\n';
      return ''; // empty diff
    });
    const result = await visualizer.getFileDiff('tracked.ts');
    expect(result.success).toBe(false);
    expect(result.error).toContain('没有改动');
  });

  // Lines 277-278: formatDiffOutput with deletions line (- prefix)
  it('getFileDiff: diff with deletion lines', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const mockDiff = `diff --git a/f.ts b/f.ts
index 000..111 100644
--- a/f.ts
+++ b/f.ts
@@ -1,3 +1,3 @@
 context line
-deleted line
+added line
`;
    (child_process.execSync as jest.Mock).mockReturnValue(mockDiff);
    const result = await visualizer.getFileDiff('f.ts');
    expect(result.success).toBe(true);
    expect(result.deletions).toBeGreaterThan(0);
    expect(result.additions).toBeGreaterThan(0);
    expect(result.diff).toContain('<font color="red">');
    expect(result.diff).toContain('<font color="green">');
    expect(result.diff).toContain('<font color="blue">');
  });

  // Lines 305-313: revertFile, stageFile, commit success paths
  it('revertFile: success', async () => {
    (child_process.execSync as jest.Mock).mockReturnValue('');
    const result = await visualizer.revertFile('src/index.ts');
    expect(result.success).toBe(true);
    expect(result.message).toContain('src/index.ts');
  });

  it('stageFile: success', async () => {
    (child_process.execSync as jest.Mock).mockReturnValue('');
    const result = await visualizer.stageFile('src/index.ts');
    expect(result.success).toBe(true);
    expect(result.message).toContain('src/index.ts');
  });

  it('commit: success', async () => {
    (child_process.execSync as jest.Mock).mockReturnValue('');
    const result = await visualizer.commit('feat: add new feature');
    expect(result.success).toBe(true);
    expect(result.message).toContain('feat: add new feature');
  });
});
