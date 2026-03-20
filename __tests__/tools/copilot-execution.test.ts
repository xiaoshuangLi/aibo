/**
 * Tests for copilot tool execution paths and error handling.
 *
 * Since execSync is mocked to return '' for all commands (meaning acpx is
 * available), the tests below exercise the ACP code path by default.
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

import getCopilotTools from '@/tools/copilot';

describe('copilot tool execution (ACP mode)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const tools = await getCopilotTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  it('should call acpx with copilot agent', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'docker ps', stderr: '' });

    await executeTool.invoke({ prompt: 'list all running docker containers' });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'acpx',
      expect.arrayContaining(['--approve-all', '--format', 'text', 'copilot', 'list all running docker containers']),
      expect.any(Object),
    );
  });

  it('should return success JSON with agent field when command succeeds', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'docker ps', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'list all running docker containers' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('docker ps');
    expect(parsed.prompt).toBe('list all running docker containers');
    expect(parsed.agent).toBe('copilot');
    expect(parsed.passthrough_activated).toBe(true);
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

    const result = await executeTool.invoke({ prompt: 'task', timeout: 8000 });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Command timeout');
    expect(parsed.message).toContain('8000ms');
  });

  it('should return interrupted JSON on ABORT_ERR', async () => {
    const err: any = new Error('aborted');
    err.code = 'ABORT_ERR';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    const result = await executeTool.invoke({ prompt: 'task' });
    const parsed = JSON.parse(result);

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
    const err: any = new Error('failed');
    err.code = 'EACCES';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    const result = await executeTool.invoke({ prompt: 'task' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe('EACCES');
  });

  it('should auto-create session and retry when "No acpx session found" error occurs', async () => {
    const noSessionErr: any = new Error('Command failed: No acpx session found');
    noSessionErr.stderr = '⚠ No acpx session found (searched up to /project).';
    noSessionErr.stdout = '';

    // First call (prompt) fails with session-not-found; second call (sessions new) succeeds; third call (retry) returns result
    execFileAsyncMock
      .mockRejectedValueOnce(noSessionErr)
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // sessions new
      .mockResolvedValueOnce({ stdout: 'copilot result', stderr: '' }); // retry

    const result = await executeTool.invoke({ prompt: 'hello' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('copilot result');
    // Three execFileAsync calls: initial prompt, sessions new, retry
    expect(execFileAsyncMock).toHaveBeenCalledTimes(3);
    // Second call must be sessions new for the copilot agent
    const sessionNewArgs = execFileAsyncMock.mock.calls[1][1] as string[];
    expect(sessionNewArgs).toContain('copilot');
    expect(sessionNewArgs).toContain('sessions');
    expect(sessionNewArgs).toContain('new');
  });

  it('should NOT retry on non-session errors', async () => {
    const err: any = new Error('Permission denied');
    err.code = 'EACCES';
    err.stdout = '';
    err.stderr = 'Permission denied';
    execFileAsyncMock.mockRejectedValue(err);

    const result = await executeTool.invoke({ prompt: 'task' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(execFileAsyncMock).toHaveBeenCalledTimes(1);
  });


// ── Direct-CLI fallback (acpx not available) ──────────────────────────────────

describe('copilot tool execution (direct-CLI fallback, no acpx)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    execSync.mockImplementation((cmd: string) => {
      if (cmd.startsWith('acpx')) throw new Error('not found');
      return '';
    });
    const tools = await getCopilotTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  afterAll(() => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    execSync.mockReturnValue('');
  });

  it('should augment prompt with exit reminder and call copilot directly', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'fix the bug' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    const promptArg = callArgs[1];
    expect(execFileAsyncMock.mock.calls[0][0]).toBe('copilot');
    expect(promptArg).toContain('fix the bug');
    expect(promptArg).toContain('IMPORTANT');
    expect(promptArg).toContain('exit immediately');
  });

  it('should include --continue flag when continueSession is true', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'continue the task', continueSession: true });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--continue');
  });

  it('should not include --continue flag when continueSession is false', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'task', continueSession: false });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--continue');
  });
});
});
