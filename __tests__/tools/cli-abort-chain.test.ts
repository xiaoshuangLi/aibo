/**
 * Reproduces and verifies the full abort signal chain:
 *
 * Problem:
 *   copilot_execute is running with signal: session?.abortController?.signal
 *   User sends /abort in Lark mode → handleAbortCommand calls session.abortController.abort()
 *   Node.js default killSignal is SIGTERM — the copilot process (Node.js CLI) may delay or
 *   ignore SIGTERM by doing async cleanup, so execFileAsync never rejects and the process
 *   appears not interrupted.
 *
 * Fix:
 *   Add killSignal: 'SIGKILL' to execFileAsync options so the process is force-killed
 *   immediately and cannot delay/ignore the abort.
 *   Also recognise SIGKILL (alongside SIGTERM) as a timeout kill signal in the error handler.
 */

const execFileAsyncMock = jest.fn();

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
import getCursorTools from '@/tools/cursor';
import getClaudeTools from '@/tools/claude';
import getGeminiTools from '@/tools/gemini';
import getCodexTools from '@/tools/codex';
import { handleCliExecutionError } from '@/shared/utils/cli-tool-factory';

/** Minimal session shape used by the CLI tools */
function createMockSession() {
  const abortController = new AbortController();
  return {
    abortController,
    isRunning: true,
    logToolProgress: jest.fn(),
  };
}

/** Narrow a tool to the invocable shape used throughout these tests */
function asInvocable(tool: any): { invoke(input: any): Promise<string> } {
  return tool as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Signal from session is wired into execFileAsync
// ─────────────────────────────────────────────────────────────────────────────
describe('session.abortController.signal is passed to execFileAsync', () => {
  beforeEach(() => execFileAsyncMock.mockReset());

  it('copilot: passes session.abortController.signal', async () => {
    const session = createMockSession();
    const [tool] = await getCopilotTools(session as any);
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.signal).toBe(session.abortController.signal);
  });

  it('cursor: passes session.abortController.signal', async () => {
    const session = createMockSession();
    const tools = await getCursorTools(session as any);
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await asInvocable(tools[0]).invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.signal).toBe(session.abortController.signal);
  });

  it('claude: passes session.abortController.signal', async () => {
    const session = createMockSession();
    const [tool] = await getClaudeTools(session as any);
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.signal).toBe(session.abortController.signal);
  });

  it('gemini: passes session.abortController.signal', async () => {
    const session = createMockSession();
    const [tool] = await getGeminiTools(session as any);
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.signal).toBe(session.abortController.signal);
  });

  it('codex: passes session.abortController.signal', async () => {
    const session = createMockSession();
    const [tool] = await getCodexTools(session as any);
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.signal).toBe(session.abortController.signal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. killSignal is SIGKILL — the process cannot ignore/delay the abort
// ─────────────────────────────────────────────────────────────────────────────
describe('killSignal is SIGKILL so the CLI process cannot ignore the abort', () => {
  beforeEach(() => execFileAsyncMock.mockReset());

  it('copilot: uses SIGKILL as killSignal', async () => {
    const [tool] = await getCopilotTools();
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.killSignal).toBe('SIGKILL');
  });

  it('cursor: uses SIGKILL as killSignal', async () => {
    const tools = await getCursorTools();
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await asInvocable(tools[0]).invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.killSignal).toBe('SIGKILL');
  });

  it('claude: uses SIGKILL as killSignal', async () => {
    const [tool] = await getClaudeTools();
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.killSignal).toBe('SIGKILL');
  });

  it('gemini: uses SIGKILL as killSignal', async () => {
    const [tool] = await getGeminiTools();
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.killSignal).toBe('SIGKILL');
  });

  it('codex: uses SIGKILL as killSignal', async () => {
    const [tool] = await getCodexTools();
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await tool.invoke({ prompt: 'test' });

    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.killSignal).toBe('SIGKILL');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Full Lark /abort chain:
//    session.abortController.abort() → signal fires → tool returns interrupted
// ─────────────────────────────────────────────────────────────────────────────
describe('full Lark /abort chain: session.abortController.abort() interrupts the tool', () => {
  beforeEach(() => execFileAsyncMock.mockReset());

  /**
   * Returns a mock implementation that:
   * - resolves `started` promise once execFileAsync is called (so the test can
   *   call abort() only after the signal listener is in place)
   * - rejects with ABORT_ERR when the signal fires OR if already aborted
   */
  function makeLongRunningMock() {
    let notifyStarted!: () => void;
    const started = new Promise<void>(r => { notifyStarted = r; });

    const impl = (_cmd: any, _args: any, opts: any) => {
      notifyStarted();
      return new Promise<{ stdout: string; stderr: string }>((_res, reject) => {
        const doReject = () => {
          const err: any = new Error('aborted');
          err.code = 'ABORT_ERR';
          err.stdout = '';
          err.stderr = '';
          reject(err);
        };
        if (opts.signal?.aborted) {
          // Signal was already fired before the listener could be registered
          process.nextTick(doReject);
        } else {
          opts.signal?.addEventListener('abort', doReject);
        }
      });
    };

    return { impl, started };
  }

  /**
   * Core reproduction test.
   *
   * Simulates a CLI process that never exits on its own (like copilot doing async
   * cleanup after SIGTERM). The test verifies that aborting the session's
   * AbortController propagates through the signal and causes the tool to return
   * an interrupted result.
   */
  it('copilot: returns interrupted when session.abortController.abort() is called mid-execution', async () => {
    const session = createMockSession();
    const [tool] = await getCopilotTools(session as any);

    const { impl, started } = makeLongRunningMock();
    execFileAsyncMock.mockImplementation(impl);

    const resultPromise = tool.invoke({ prompt: 'build the entire project' });

    // Wait until execFileAsync has been called and the abort listener is registered,
    // then simulate handleAbortCommand calling session.abortController.abort()
    await started;
    session.abortController.abort();

    const result = await resultPromise;
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.interrupted).toBe(true);
    expect(parsed.error).toBe('Command interrupted');
    expect(parsed.prompt).toBe('build the entire project');
  }, 10000);

  it('cursor: returns interrupted when session.abortController.abort() is called', async () => {
    const session = createMockSession();
    const tools = await getCursorTools(session as any);

    const { impl, started } = makeLongRunningMock();
    execFileAsyncMock.mockImplementation(impl);

    const resultPromise = asInvocable(tools[0]).invoke({ prompt: 'refactor module' });
    await started;
    session.abortController.abort();

    const parsed = JSON.parse(await resultPromise);
    expect(parsed.interrupted).toBe(true);
  }, 10000);

  it('abort fires on the exact signal reference passed to execFileAsync', async () => {
    const session = createMockSession();
    const [tool] = await getCopilotTools(session as any);

    let capturedSignal: AbortSignal | undefined;
    const { impl, started } = makeLongRunningMock();
    execFileAsyncMock.mockImplementation((_cmd: any, _args: any, opts: any) => {
      capturedSignal = opts.signal;
      return impl(_cmd, _args, opts);
    });

    const resultPromise = tool.invoke({ prompt: 'task' });

    // Wait until execFileAsync has been called (and capturedSignal is set)
    await started;

    // The captured signal must be the same object as session.abortController.signal
    expect(capturedSignal).toBe(session.abortController.signal);

    session.abortController.abort();
    await resultPromise;

    // The signal that was passed to execFileAsync is now aborted
    expect(capturedSignal?.aborted).toBe(true);
  }, 10000);

  it('tool correctly uses the current abortController set at invocation time', async () => {
    const session = createMockSession();
    const [tool] = await getCopilotTools(session as any);

    // Replace the abort controller before invocation (as handleUserMessage does)
    const newController = new AbortController();
    session.abortController = newController;

    let capturedSignal: AbortSignal | undefined;
    const { impl, started } = makeLongRunningMock();
    execFileAsyncMock.mockImplementation((_cmd: any, _args: any, opts: any) => {
      capturedSignal = opts.signal;
      return impl(_cmd, _args, opts);
    });

    const resultPromise = tool.invoke({ prompt: 'task' });

    await started;

    // Abort via the new controller — the old one must NOT affect this
    newController.abort();
    await resultPromise;

    // The tool must have used the new controller's signal
    expect(capturedSignal).toBe(newController.signal);
    expect(capturedSignal?.aborted).toBe(true);
  }, 10000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. handleCliExecutionError correctly classifies SIGKILL as a timeout
// ─────────────────────────────────────────────────────────────────────────────
describe('handleCliExecutionError recognises SIGKILL as a timeout kill signal', () => {
  it('returns Command timeout for SIGKILL (new killSignal value)', () => {
    const err: any = new Error('killed');
    err.signal = 'SIGKILL';
    err.stdout = 'partial output';
    err.stderr = '';

    const result = handleCliExecutionError(err, 'copilot', 'do work', 9000);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Command timeout');
    expect(parsed.message).toContain('9000ms');
    expect(parsed.stdout).toBe('partial output');
  });

  it('still returns Command timeout for SIGTERM (backward compat)', () => {
    const err: any = new Error('killed');
    err.signal = 'SIGTERM';
    err.stdout = '';
    err.stderr = '';

    const result = handleCliExecutionError(err, 'copilot', 'task', 5000);
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Command timeout');
    expect(parsed.message).toContain('5000ms');
  });

  it('ABORT_ERR takes priority over SIGKILL when both are set', () => {
    // Node.js may set both err.code='ABORT_ERR' and err.signal when using
    // killSignal: 'SIGKILL' with an AbortController.
    const err: any = new Error('aborted');
    err.code = 'ABORT_ERR';
    err.signal = 'SIGKILL';
    err.stdout = '';
    err.stderr = '';

    const result = handleCliExecutionError(err, 'copilot', 'task', 9000);
    const parsed = JSON.parse(result);

    // Abort must win — user-initiated, not a timeout
    expect(parsed.interrupted).toBe(true);
    expect(parsed.error).toBe('Command interrupted');
  });

  it('AbortError name takes priority over SIGKILL', () => {
    const err: any = new Error('aborted');
    err.name = 'AbortError';
    err.signal = 'SIGKILL';
    err.stdout = '';
    err.stderr = '';

    const result = handleCliExecutionError(err, 'claude', 'task', 3000);
    const parsed = JSON.parse(result);

    expect(parsed.interrupted).toBe(true);
    expect(parsed.error).toBe('Command interrupted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Signal is undefined when no session — no regression on session-less usage
// ─────────────────────────────────────────────────────────────────────────────
describe('no session: signal is undefined, tool still works normally', () => {
  beforeEach(() => execFileAsyncMock.mockReset());

  it('copilot: runs without signal when no session provided', async () => {
    const [tool] = await getCopilotTools();
    execFileAsyncMock.mockResolvedValue({ stdout: 'result', stderr: '' });

    const result = await tool.invoke({ prompt: 'test' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    const [, , opts] = execFileAsyncMock.mock.calls[0];
    expect(opts.signal).toBeUndefined();
    // killSignal is still set regardless
    expect(opts.killSignal).toBe('SIGKILL');
  });
});
