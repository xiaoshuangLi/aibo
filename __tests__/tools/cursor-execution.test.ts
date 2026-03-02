/**
 * Tests for cursor tool execution paths and error handling.
 */

// Mock child_process with proper promisify support
const execFileAsyncMock = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });

jest.mock('child_process', () => {
  const execFileMock: any = jest.fn();
  // util.promisify checks for this symbol to use a custom async implementation
  execFileMock[Symbol.for('nodejs.util.promisify.custom')] = execFileAsyncMock;

  return {
    ...jest.requireActual('child_process'),
    execSync: jest.fn().mockReturnValue(''),
    execFile: execFileMock,
  };
});

import getCursorTools, { cursorOpenTool } from '@/tools/cursor';

describe('cursor tool execution', () => {
  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  describe('cursorExecuteTool execution', () => {
    let executeTool: any;

    beforeAll(async () => {
      const tools = await getCursorTools();
      executeTool = tools[0];
    });

    it('should invoke agent with "-p <prompt>" args', async () => {
      execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

      await executeTool.invoke({ prompt: 'fix bug' });

      expect(execFileAsyncMock).toHaveBeenCalledWith(
        'agent',
        ['-p', 'fix bug'],
        expect.any(Object),
      );
    });

    it('should pass --continue flag when continueSession is true', async () => {
      execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

      await executeTool.invoke({ prompt: 'fix bug', continueSession: true });

      expect(execFileAsyncMock).toHaveBeenCalledWith(
        'agent',
        ['-p', 'fix bug', '--continue'],
        expect.any(Object),
      );
    });

    it('should not pass --continue flag when continueSession is false', async () => {
      execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

      await executeTool.invoke({ prompt: 'fix bug', continueSession: false });

      expect(execFileAsyncMock).toHaveBeenCalledWith(
        'agent',
        ['-p', 'fix bug'],
        expect.any(Object),
      );
    });

    it('should return success JSON when command succeeds', async () => {
      execFileAsyncMock.mockResolvedValue({ stdout: 'command output', stderr: '' });

      const result = await executeTool.invoke({ prompt: 'fix bug' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stdout).toBe('command output');
      expect(parsed.stderr).toBe('(empty)');
      expect(parsed.prompt).toBe('fix bug');
    });

    it('should return (empty) for empty stdout/stderr', async () => {
      execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await executeTool.invoke({ prompt: 'task' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stdout).toBe('(empty)');
      expect(parsed.stderr).toBe('(empty)');
    });

    it('should return timeout error JSON on SIGTERM', async () => {
      const err: any = new Error('killed');
      err.signal = 'SIGTERM';
      err.stdout = 'partial';
      err.stderr = 'err';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await executeTool.invoke({ prompt: 'task', timeout: 5000 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Command timeout');
      expect(parsed.message).toContain('5000ms');
    });

    it('should return interrupted JSON on ABORT_ERR code', async () => {
      const err: any = new Error('aborted');
      err.code = 'ABORT_ERR';
      err.stdout = '';
      err.stderr = '';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await executeTool.invoke({ prompt: 'task' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.interrupted).toBe(true);
      expect(parsed.error).toBe('Command interrupted');
    });

    it('should return interrupted JSON on AbortError name', async () => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      err.stdout = '';
      err.stderr = '';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await executeTool.invoke({ prompt: 'task' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.interrupted).toBe(true);
    });

    it('should return generic error JSON on other errors', async () => {
      const err: any = new Error('command failed');
      err.code = 'ENOENT';
      err.stdout = '';
      err.stderr = 'not found';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await executeTool.invoke({ prompt: 'task' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('ENOENT');
      expect(parsed.message).toBe('command failed');
    });

    it('should fallback to EXECUTION_ERROR when no code', async () => {
      const err: any = new Error('unexpected');
      err.stdout = '';
      err.stderr = '';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await executeTool.invoke({ prompt: 'task' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('EXECUTION_ERROR');
    });
  });

  describe('cursorOpenTool execution', () => {
    it('should return success JSON when open succeeds', async () => {
      execFileAsyncMock.mockResolvedValue({ stdout: 'opened', stderr: '' });

      const result = await (cursorOpenTool as any).invoke({ path: 'src/utils.ts' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.path).toBe('src/utils.ts');
      expect(parsed.stdout).toBe('opened');
    });

    it('should return timeout error on SIGTERM for open tool', async () => {
      const err: any = new Error('killed');
      err.signal = 'SIGTERM';
      err.stdout = '';
      err.stderr = '';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await (cursorOpenTool as any).invoke({ path: 'src/utils.ts', timeout: 1000 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Command timeout');
      expect(parsed.message).toContain('1000ms');
    });

    it('should return error JSON on open failure', async () => {
      const err: any = new Error('open failed');
      err.code = 'EACCES';
      err.stdout = '';
      err.stderr = 'permission denied';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await (cursorOpenTool as any).invoke({ path: '/forbidden' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('EACCES');
    });

    it('should fallback to EXECUTION_ERROR when no code on open failure', async () => {
      const err: any = new Error('unexpected error');
      err.stdout = '';
      err.stderr = '';
      execFileAsyncMock.mockRejectedValue(err);

      const result = await (cursorOpenTool as any).invoke({ path: '/some/path' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('EXECUTION_ERROR');
    });
  });
});
