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
    expect(result.error).toContain('文件不存在或已彻底删除');
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
    expect(result.message).toContain('`src/index.ts`');
  });

  it('stageFile: success', async () => {
    (child_process.execSync as jest.Mock).mockReturnValue('');
    const result = await visualizer.stageFile('src/index.ts');
    expect(result.success).toBe(true);
    expect(result.message).toContain('`src/index.ts`');
  });

  it('commit: success', async () => {
    (child_process.execSync as jest.Mock).mockReturnValue('');
    const result = await visualizer.commit('feat: add new feature');
    expect(result.success).toBe(true);
    expect(result.message).toContain('feat: add new feature');
  });
});

// ─── Optimized copy tests ────────────────────────────────────────────────────

describe('FileDiffVisualizer – optimized copy tests', () => {
  let visualizer: FileDiffVisualizer;

  beforeEach(() => {
    visualizer = new FileDiffVisualizer('/test/dir');
    jest.clearAllMocks();
  });

  describe('getChangedFiles – new copy', () => {
    it('message omits git status letter codes from status labels', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('M  src/modified.ts\n');
      const result = await visualizer.getChangedFiles();
      expect(result.files[0].status).toBe('修改');
      expect(result.files[0].status).not.toContain('(M)');
    });

    it('file list uses backtick code formatting for file paths', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('M  src/foo.ts\n');
      const result = await visualizer.getChangedFiles();
      expect(result.message).toContain('`src/foo.ts`');
    });

    it('message includes category summary with counts', async () => {
      const mockStatus = [
        'M  src/modified.ts',
        'A  src/added.ts',
        'D  src/deleted.ts',
        '?? src/untracked.ts',
      ].join('\n');
      (child_process.execSync as jest.Mock).mockReturnValue(mockStatus);
      const result = await visualizer.getChangedFiles();
      // 2 new (A + ??), 1 modified, 1 deleted
      expect(result.message).toContain('新增 2');
      expect(result.message).toContain('修改 1');
      expect(result.message).toContain('删除 1');
    });

    it('message headline uses "个文件有改动" phrasing', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('M  src/a.ts\n');
      const result = await visualizer.getChangedFiles();
      expect(result.message).toMatch(/\d+ 个文件有改动/);
    });

    it('error message includes spaces around Git', async () => {
      (child_process.execSync as jest.Mock).mockImplementation(() => { throw new Error('not a repo'); });
      const result = await visualizer.getChangedFiles();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Git 状态');
    });
  });

  describe('getFileDiff – improved error copy', () => {
    it('non-existent file error says "已彻底删除"', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (child_process.execSync as jest.Mock).mockReturnValue('');
      const result = await visualizer.getFileDiff('missing.ts');
      expect(result.error).toContain('已彻底删除');
    });

    it('no-diff-for-existing file error says "已是最新状态"', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (child_process.execSync as jest.Mock).mockImplementation((cmd: string) => {
        if (cmd.includes('git status')) return 'M  other.ts\n';
        return '';
      });
      const result = await visualizer.getFileDiff('nochange.ts');
      expect(result.error).toContain('已是最新状态');
    });

    it('exception error message uses "diff 失败" with space', async () => {
      (fs.existsSync as jest.Mock).mockImplementation(() => { throw new Error('permission denied'); });
      const result = await visualizer.getFileDiff('secret.ts');
      expect(result.error).toContain('diff 失败');
    });
  });

  describe('formatDiffOutput – enriched summary', () => {
    it('summary includes "行新增" label', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const mockDiff = `diff --git a/f.ts b/f.ts
--- a/f.ts
+++ b/f.ts
@@ -1 +1 @@
-old line
+new line
`;
      (child_process.execSync as jest.Mock).mockReturnValue(mockDiff);
      const result = await visualizer.getFileDiff('f.ts');
      expect(result.summary).toContain('行新增');
      expect(result.summary).toContain('行删除');
    });
  });

  describe('formatNewFileOutput – enriched summary', () => {
    it('summary includes "新文件" label', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('const x = 1;\n');
      (child_process.execSync as jest.Mock).mockImplementation((cmd: string) => {
        if (cmd.includes('git status')) return '?? new.ts\n';
        return '';
      });
      const result = await visualizer.getFileDiff('new.ts');
      expect(result.summary).toContain('新文件');
    });
  });

  describe('revertFile / stageFile / commit – improved copy', () => {
    it('revertFile success message shows file path in backticks', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('');
      const result = await visualizer.revertFile('src/app.ts');
      expect(result.message).toContain('`src/app.ts`');
      expect(result.message).toContain('已撤销');
    });

    it('stageFile success message shows file path in backticks', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('');
      const result = await visualizer.stageFile('src/app.ts');
      expect(result.message).toContain('`src/app.ts`');
      expect(result.message).toContain('已暂存');
    });

    it('commit success message uses bold commit message', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('');
      const result = await visualizer.commit('fix: correct typo');
      expect(result.message).toContain('**fix: correct typo**');
      expect(result.message).toContain('提交成功');
    });

    it('revertFile failure error says "撤销文件改动失败"', async () => {
      (child_process.execSync as jest.Mock).mockImplementation(() => { throw new Error('locked'); });
      const result = await visualizer.revertFile('src/app.ts');
      expect(result.success).toBe(false);
      expect(result.error).toContain('撤销文件改动失败');
    });
  });

  describe('getAllFilesDiff – consistent empty message', () => {
    it('empty workspace error message has no trailing exclamation', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('');
      const result = await visualizer.getAllFilesDiff();
      expect(result.error).not.toMatch(/！$/);
      expect(result.error).toContain('没有文件改动');
    });
  });
});
