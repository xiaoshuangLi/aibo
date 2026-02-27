import { FileDiffVisualizer } from '@/presentation/lark/file-diff-visualizer';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Mock fs and child_process
jest.mock('fs');
jest.mock('child_process');

describe('File Diff Visualizer Additional Tests', () => {
  let visualizer: FileDiffVisualizer;
  
  beforeEach(() => {
    visualizer = new FileDiffVisualizer('/test/working/dir');
    jest.clearAllMocks();
  });

  it('should handle various git status outputs', async () => {
    // Test with multiple file types
    const mockStatus = 'M  src/modified.ts\nA  src/added.ts\nD  src/deleted.ts\n?? src/untracked.ts';
    (child_process.execSync as jest.Mock).mockReturnValue(mockStatus);
    
    const result = await visualizer.getChangedFiles();
    
    expect(result.success).toBe(true);
    expect(result.files).toHaveLength(4);
    expect(result.files[0].status).toBe('修改');
    expect(result.files[1].status).toBe('新增');
    expect(result.files[2].status).toBe('删除');
    expect(result.files[3].status).toBe('新增');
  });

  it('should handle empty git status', async () => {
    (child_process.execSync as jest.Mock).mockReturnValue('');
    
    const result = await visualizer.getChangedFiles();
    
    expect(result.success).toBe(true);
    expect(result.isEmpty).toBe(true);
    expect(result.files).toHaveLength(0);
  });

  it('should handle git status errors', async () => {
    (child_process.execSync as jest.Mock).mockImplementation(() => {
      throw new Error('Git not found');
    });
    
    const result = await visualizer.getChangedFiles();
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Git not found');
  });
});