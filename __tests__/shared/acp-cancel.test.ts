const execFileAsyncMock = jest.fn();

jest.mock('child_process', () => {
  const execFileMock: any = jest.fn();
  execFileMock[Symbol.for('nodejs.util.promisify.custom')] = execFileAsyncMock;
  return { ...jest.requireActual('child_process'), execFile: execFileMock };
});

import {
  buildAcpCancelArgs,
  cancelAcpPromptAfterTimeout,
  isAcpPromptTimeoutError,
} from '@/shared/acp-cancel';

describe('buildAcpCancelArgs', () => {
  beforeEach(() => execFileAsyncMock.mockReset());

  it('targets the default session without inventing a name', () => {
    expect(buildAcpCancelArgs({ agent: 'codex', cwd: '/repo' })).toEqual([
      '--cwd', '/repo', 'codex', 'cancel',
    ]);
  });

  it('targets the same named session', () => {
    expect(buildAcpCancelArgs({
      agent: 'claude',
      cwd: '/repo',
      sessionName: 'backend',
    })).toEqual([
      '--cwd', '/repo', 'claude', '-s', 'backend', 'cancel',
    ]);
  });

  it('recognises structured and child-process timeout failures', () => {
    expect(isAcpPromptTimeoutError({ name: 'TimeoutError' })).toBe(true);
    expect(isAcpPromptTimeoutError({ stderr: '[acpx] error: {"code":"TIMEOUT"}' })).toBe(true);
    expect(isAcpPromptTimeoutError(new Error('ordinary failure'))).toBe(false);
  });

  it('cancels the same persistent session after a timeout', async () => {
    execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

    await expect(cancelAcpPromptAfterTimeout(
      { stderr: '[acpx] error: {"code":"TIMEOUT"}' },
      { agent: 'codex', cwd: '/repo', sessionName: 'main' },
    )).resolves.toBe(true);

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'acpx',
      ['--cwd', '/repo', 'codex', '-s', 'main', 'cancel'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('does not cancel unrelated failures', async () => {
    await expect(cancelAcpPromptAfterTimeout(
      new Error('permission denied'),
      { agent: 'codex', cwd: '/repo' },
    )).resolves.toBe(false);

    expect(execFileAsyncMock).not.toHaveBeenCalled();
  });
});
