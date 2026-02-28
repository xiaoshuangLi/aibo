import { FileDiffVisualizer } from '@/presentation/lark/diff';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Mock fs and child_process
jest.mock('fs');
jest.mock('child_process');

describe('FileDiffVisualizer', () => {
  let visualizer: FileDiffVisualizer;
  
  beforeEach(() => {
    visualizer = new FileDiffVisualizer('/test/working/dir');
    jest.clearAllMocks();
  });

  describe('getChangedFiles', () => {
    it('should return empty result when no changes', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('');
      
      const result = await visualizer.getChangedFiles();
      
      expect(result.success).toBe(true);
      expect(result.isEmpty).toBe(true);
      expect(result.files).toHaveLength(0);
    });

    it('should parse modified files correctly', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('M  src/test-file.ts\n');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const result = await visualizer.getChangedFiles();
      
      expect(result.success).toBe(true);
      expect(result.isEmpty).toBeFalsy();
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toEqual({
        path: 'src/test-file.ts',
        status: '修改',
        emoji: '✏️',
        rawStatus: 'M'
      });
    });
  });

  describe('getFileDiff', () => {
    it('should get diff from working directory when available', async () => {
      const mockDiff = 'diff --git a/test.ts b/test.ts\n+new line\n-old line';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (child_process.execSync as jest.Mock)
        .mockImplementation((command: string) => {
          if (command.includes('git diff --cached')) {
            throw new Error('No cached diff');
          }
          return mockDiff;
        });
      
      const result = await visualizer.getFileDiff('test.ts');
      
      expect(result.success).toBe(true);
      expect(result.diff).toContain('new line');
      expect(result.diff).toContain('old line');
    });

    it('should get diff from cached when working directory has no changes', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (child_process.execSync as jest.Mock)
        .mockImplementation((command: string) => {
          if (command.includes('git diff -- test.ts')) {
            return ''; // No working directory diff
          }
          if (command.includes('git diff --cached -- test.ts')) {
            return 'diff --git a/test.ts b/test.ts\n+cached line';
          }
          return '';
        });
      
      const result = await visualizer.getFileDiff('test.ts');
      
      expect(result.success).toBe(true);
      expect(result.diff).toContain('cached line');
    });

    it('should handle non-existent file gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (child_process.execSync as jest.Mock).mockReturnValue('');
      
      const result = await visualizer.getFileDiff('non-existent.ts');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('文件不存在或已彻底删除');
    });
  });

  describe('getAllFilesDiff', () => {
    it('should return empty result when no changed files', async () => {
      (child_process.execSync as jest.Mock).mockReturnValue('');
      
      const result = await visualizer.getAllFilesDiff();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('当前工作区很干净');
    });

    it('should get diffs for all changed files', async () => {
      (child_process.execSync as jest.Mock)
        .mockImplementation((command: string) => {
          if (command.includes('git status --porcelain')) {
            return ' M test1.ts\n M test2.ts\n';
          }
          if (command.includes('git diff --')) {
            return 'diff content';
          }
          return '';
        });
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const result = await visualizer.getAllFilesDiff();
      
      expect(result.success).toBe(true);
      expect(result.diffs).toHaveLength(2);
      expect(result.diffs[0].success).toBe(true);
      expect(result.diffs[1].success).toBe(true);
    });
  });
});