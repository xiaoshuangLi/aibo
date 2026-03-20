/**
 * Tests for cursor tool execution paths and error handling.
 *
 * Since execSync is mocked to return '' for all commands (meaning acpx is
 * available), the cursorExecuteTool tests below exercise the ACP code path.
 * A separate set of tests verifies the direct-CLI fallback when acpx is absent.
 * The cursorOpenTool always uses the direct CLI and is not affected by ACP mode.
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

describe('cursor tool execution (ACP mode)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const tools = await getCursorTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  it('should call acpx with cursor agent', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ prompt: 'fix bug' });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'acpx',
      expect.arrayContaining(['--approve-all', '--format', 'text', 'cursor', 'fix bug']),
      expect.any(Object),
    );
  });

  it('should return success JSON with agent field when command succeeds', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'command output', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'fix bug' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('command output');
    expect(parsed.stderr).toBe('(empty)');
    expect(parsed.prompt).toBe('fix bug');
    expect(parsed.agent).toBe('cursor');
    expect(parsed.passthrough_activated).toBe(true);
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

// ── Direct-CLI fallback (acpx not available) ──────────────────────────────────

describe('cursor tool execution (direct-CLI fallback, no acpx)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    execSync.mockImplementation((cmd: string) => {
      if (cmd.startsWith('acpx')) throw new Error('not found');
      return '';
    });
    const tools = await getCursorTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  afterAll(() => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    execSync.mockReturnValue('');
  });

  it('should invoke agent with "-p <prompt>" args', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ prompt: 'fix bug' });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'agent',
      ['-p', 'fix bug', '--yolo'],
      expect.any(Object),
    );
  });

  it('should pass --continue flag when continueSession is true', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ prompt: 'fix bug', continueSession: true });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'agent',
      ['-p', 'fix bug', '--continue', '--yolo'],
      expect.any(Object),
    );
  });

  it('should not pass --continue flag when continueSession is false', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ prompt: 'fix bug', continueSession: false });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'agent',
      ['-p', 'fix bug', '--yolo'],
      expect.any(Object),
    );
  });
});

// ── cursorOpenTool (always direct CLI, no ACP) ────────────────────────────────

describe('cursorOpenTool execution', () => {
  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

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
