/**
 * Tests for claude tool execution paths and error handling.
 *
 * Since execSync is mocked to return '' for all commands (meaning acpx is
 * available), the tests below exercise the ACP code path by default.
 * A separate set of tests verifies the direct-CLI fallback when acpx is absent.
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

// ── ACP mode (acpx available — default mock) ─────────────────────────────────

describe('claude tool execution (ACP mode)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const tools = await getClaudeTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  it('should call acpx with claude agent and --approve-all flag', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'write tests' });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'acpx',
      expect.arrayContaining(['--approve-all', '--format', 'text', 'claude', 'write tests']),
      expect.any(Object),
    );
    // Direct-CLI flags should NOT be present in ACP mode
    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--dangerously-skip-permissions');
    expect(callArgs).not.toContain('-p');
  });

  it('should return success JSON with agent field when command succeeds', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'claude result', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'write tests' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('claude result');
    expect(parsed.prompt).toBe('write tests');
    expect(parsed.agent).toBe('claude');
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

  it('should not activate passthrough when start_passthrough is false', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'task', start_passthrough: false });
    const parsed = JSON.parse(result);

    expect(parsed.passthrough_activated).toBe(false);
  });
});

// ── Direct-CLI fallback (acpx not available) ──────────────────────────────────

describe('claude tool execution (direct-CLI fallback, no acpx)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    // Make only acpx unavailable, keep claude available
    execSync.mockImplementation((cmd: string) => {
      if (cmd.startsWith('acpx')) throw new Error('not found');
      return '';
    });
    const tools = await getClaudeTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  afterAll(() => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    execSync.mockReturnValue('');
  });

  it('should pass --dangerously-skip-permissions flag to claude directly', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'write tests' });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'write tests', '--dangerously-skip-permissions']),
      expect.any(Object),
    );
  });

  it('should return success JSON without agent field in fallback mode', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'claude result', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'write tests' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.agent).toBeUndefined();
  });
});
