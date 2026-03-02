/**
 * Tests for claude tool execution paths and error handling.
 */

const execFileAsyncMock = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });

jest.mock('child_process', () => {
  const execFileMock: any = jest.fn();
  execFileMock[Symbol.for('nodejs.util.promisify.custom')] = execFileAsyncMock;

  return {
    ...jest.requireActual('child_process'),
    execSync: jest.fn().mockReturnValue(''),
    execFile: execFileMock,
  };
});

import getClaudeTools from '@/tools/claude';

describe('claude tool execution', () => {
  let executeTool: any;

  beforeAll(async () => {
    const tools = await getClaudeTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  it('should pass --dangerously-skip-permissions flag to claude', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'write tests' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--dangerously-skip-permissions');
    expect(callArgs).not.toContain('--yolo');
  });

  it('should not pass --continue flag when continueSession is false', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'write tests', continueSession: false });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--continue');
  });

  it('should pass --continue flag when continueSession is true', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'continue task', continueSession: true });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--continue');
  });

  it('should return success JSON when command succeeds', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'claude result', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'write tests' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('claude result');
    expect(parsed.prompt).toBe('write tests');
  });

  it('should return (empty) for empty stdout/stderr', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'task' });
    const parsed = JSON.parse(result);

    expect(parsed.stdout).toBe('(empty)');
    expect(parsed.stderr).toBe('(empty)');
  });

  it('should return timeout error JSON on SIGTERM', async () => {
    const err: any = new Error('killed');
    err.signal = 'SIGTERM';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    const result = await executeTool.invoke({ prompt: 'task', timeout: 10000 });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Command timeout');
    expect(parsed.message).toContain('10000ms');
  });

  it('should return interrupted JSON on ABORT_ERR', async () => {
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

    expect(parsed.interrupted).toBe(true);
  });

  it('should return generic error JSON on other errors', async () => {
    const err: any = new Error('command failed');
    err.code = 'ENOENT';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    const result = await executeTool.invoke({ prompt: 'task' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('ENOENT');
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
