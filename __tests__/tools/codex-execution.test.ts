/**
 * Tests for codex tool execution paths and error handling.
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

import getCodexTools from '@/tools/codex';

describe('codex tool execution (ACP mode)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const tools = await getCodexTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  it('should call acpx with codex agent', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'codex result', stderr: '' });

    await executeTool.invoke({ prompt: 'implement REST API' });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'acpx',
      expect.arrayContaining(['--approve-all', '--format', 'text', 'codex', 'implement REST API']),
      expect.any(Object),
    );
  });

  it('should return success JSON with agent field when command succeeds', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'codex result', stderr: '' });

    const result = await executeTool.invoke({ prompt: 'implement REST API' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.stdout).toBe('codex result');
    expect(parsed.prompt).toBe('implement REST API');
    expect(parsed.agent).toBe('codex');
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

describe('codex tool execution (direct-CLI fallback, no acpx)', () => {
  let executeTool: any;

  beforeAll(async () => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    execSync.mockImplementation((cmd: string) => {
      if (cmd.startsWith('acpx')) throw new Error('not found');
      return '';
    });
    const tools = await getCodexTools();
    executeTool = tools[0];
  });

  beforeEach(() => {
    execFileAsyncMock.mockReset();
  });

  afterAll(() => {
    const { execSync } = require('child_process') as { execSync: jest.Mock };
    execSync.mockReturnValue('');
  });

  it('should call codex directly with --yolo flag', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await executeTool.invoke({ prompt: 'implement REST API' });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'codex',
      expect.arrayContaining(['implement REST API', '--yolo']),
      expect.any(Object),
    );
  });
});
