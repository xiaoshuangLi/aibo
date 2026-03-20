/**
 * Tests for acpx tool execution paths and error handling.
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

import getAcpTools from '@/tools/acp';

describe('acpx tool execution', () => {
  let executeTool: any;

  beforeAll(async () => {
    const tools = await getAcpTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  it('should return success JSON when command succeeds', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'acpx result', stderr: '' });

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'fix the tests' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('acpx result');
    expect(parsed.prompt).toBe('fix the tests');
    expect(parsed.agent).toBe('codex');
  });

  it('should return (empty) for empty stdout/stderr', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'task' });
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

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'task', timeout: 10000 });
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

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'task' });
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

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'task' });
    const parsed = JSON.parse(result);

    expect(parsed.interrupted).toBe(true);
  });

  it('should return generic error JSON on other errors', async () => {
    const err: any = new Error('failed');
    err.code = 'EACCES';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'task' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe('EACCES');
  });

  it('should pass --approve-all flag by default', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ agent: 'codex', prompt: 'task' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--approve-all');
  });

  it('should pass --format text flag', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ agent: 'codex', prompt: 'task' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--format');
    expect(callArgs).toContain('text');
  });

  it('should include agent name in args', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ agent: 'claude', prompt: 'review' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('claude');
  });

  it('should include -s flag when session_name is provided', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ agent: 'codex', prompt: 'task', session_name: 'backend' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('-s');
    expect(callArgs).toContain('backend');
  });

  it('should include exec subcommand in exec mode', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ agent: 'codex', prompt: 'summarize', mode: 'exec' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('exec');
  });

  it('should include sessions new subcommand in sessions_new mode', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ agent: 'codex', prompt: '', mode: 'sessions_new' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('sessions');
    expect(callArgs).toContain('new');
  });

  it('should include cancel subcommand in cancel mode', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await executeTool.invoke({ agent: 'codex', prompt: '', mode: 'cancel' });

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('cancel');
  });

  it('should auto-create session and retry when "No acpx session found" error occurs', async () => {
    const noSessionErr: any = new Error('Command failed: No acpx session found');
    noSessionErr.stderr = '⚠ No acpx session found (searched up to /project).\nCreate one: acpx codex sessions new';
    noSessionErr.stdout = '';

    execFileAsyncMock
      .mockRejectedValueOnce(noSessionErr)
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // sessions new
      .mockResolvedValueOnce({ stdout: 'acpx result after session', stderr: '' }); // retry

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'fix tests' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('acpx result after session');
    expect(execFileAsyncMock).toHaveBeenCalledTimes(3);
    const sessionNewArgs = execFileAsyncMock.mock.calls[1][1] as string[];
    expect(sessionNewArgs).toContain('codex');
    expect(sessionNewArgs).toContain('sessions');
    expect(sessionNewArgs).toContain('new');
  });

  it('should NOT retry on non-session errors', async () => {
    const err: any = new Error('Permission denied');
    err.code = 'EACCES';
    err.stdout = '';
    err.stderr = 'Permission denied';
    execFileAsyncMock.mockRejectedValue(err);

    const result = await executeTool.invoke({ agent: 'codex', prompt: 'task' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(execFileAsyncMock).toHaveBeenCalledTimes(1);
  });

});
