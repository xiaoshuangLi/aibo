/**
 * Tests for Lark ACP hyphenated command suite:
 * - handleAcpExitCommand
 * - handleAcpKillCommand
 * - handleAcpStatusCommand
 * - handleAcpCancelCommand
 * - createHandleInternalCommand routing for /acp-* commands
 * - Dynamic /acp-<agent> shortcuts
 */

import {
  handleAcpExitCommand,
  handleAcpKillCommand,
  handleAcpStatusCommand,
  handleAcpCancelCommand,
  handleAcpPauseCommand,
  handleAcpResumeCommand,
  createHandleInternalCommand,
  KNOWN_ACP_AGENTS,
} from '@/presentation/lark/commander';
import {
  getAcpPassthroughState,
  setAcpPassthroughState,
  clearAcpPassthroughState,
  getAcpPausedPassthroughState,
  pauseAcpPassthroughState,
  clearAcpPausedPassthroughState,
} from '@/presentation/lark/acp-passthrough';

// ── Mocks ──────────────────────────────────────────────────────────────

jest.mock('@/core/config', () => ({
  config: { output: { verbose: false } },
}));

jest.mock('@/presentation/styling/styler', () => ({
  styled: { system: (m: string) => m, error: (m: string) => m },
}));

jest.mock('@/infrastructure/session/manager', () => ({
  SessionManager: {
    getInstance: jest.fn().mockReturnValue({
      clearCurrentSession: jest.fn().mockReturnValue('new-session'),
      generateSessionMetadata: jest.fn(),
      getCurrentSessionMetadata: jest.fn().mockReturnValue(null),
    }),
  },
}));

jest.mock('@/shared/utils/library', () => ({
  getAllKnowledge: jest.fn().mockReturnValue([]),
  addKnowledge: jest.fn(),
}));

jest.mock('@/infrastructure/code-analysis/client', () => ({
  LspClientManager: { shutdownAll: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/shared/utils', () => ({
  getRestartCommand: jest.fn().mockReturnValue({ restartCommand: 'node', restartArgs: [] }),
  getAllKnowledge: jest.fn().mockReturnValue([]),
  addKnowledge: jest.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────

const makeSession = (overrides: Record<string, any> = {}) => ({
  adapter: { emit: jest.fn().mockResolvedValue(undefined) },
  isRunning: false,
  abortController: null as any,
  ...overrides,
});

const mockAbortController = () => {
  const abortFn = jest.fn();
  return {
    abort: abortFn,
    signal: { aborted: false },
    _abortFn: abortFn,
  };
};

const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

beforeEach(() => {
  clearAcpPassthroughState();
  clearAcpPausedPassthroughState();
  consoleSpy.mockClear();
  jest.clearAllMocks();
});

afterAll(() => {
  consoleSpy.mockRestore();
  clearAcpPassthroughState();
  clearAcpPausedPassthroughState();
});

// ── KNOWN_ACP_AGENTS export ────────────────────────────────────────────

describe('KNOWN_ACP_AGENTS', () => {
  it('exports the known agent list', () => {
    expect(Array.isArray(KNOWN_ACP_AGENTS)).toBe(true);
    expect(KNOWN_ACP_AGENTS).toContain('codex');
    expect(KNOWN_ACP_AGENTS).toContain('claude');
    expect(KNOWN_ACP_AGENTS).toContain('gemini');
  });
});

// ── handleAcpExitCommand ───────────────────────────────────────────────

describe('handleAcpExitCommand', () => {
  it('shows "not active" when passthrough is inactive', async () => {
    const session = makeSession();
    const result = await handleAcpExitCommand(session);
    expect(result).toBe(true);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'commandExecuted' }),
    );
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('clears passthrough state when active', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const session = makeSession();
    const result = await handleAcpExitCommand(session);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('emits /acp-exit command event', async () => {
    setAcpPassthroughState({ agent: 'claude' });
    const session = makeSession();
    await handleAcpExitCommand(session);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: '/acp-exit' }),
      }),
    );
  });

  it('includes agent display name in exit message', async () => {
    setAcpPassthroughState({ agent: 'claude' });
    const session = makeSession();
    await handleAcpExitCommand(session);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('Claude Code');
  });
});

// ── handleAcpKillCommand ───────────────────────────────────────────────

describe('handleAcpKillCommand', () => {
  it('shows message and clears state when passthrough is inactive', async () => {
    const session = makeSession();
    const result = await handleAcpKillCommand(session);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('aborts in-flight operation and clears passthrough state', async () => {
    setAcpPassthroughState({ agent: 'gemini' });
    const ac = mockAbortController();
    const session = makeSession({
      isRunning: true,
      abortController: ac,
    });
    const result = await handleAcpKillCommand(session);
    expect(result).toBe(true);
    expect(ac.abort).toHaveBeenCalled();
    expect(session.isRunning).toBe(false);
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('emits /acp-kill command event', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const session = makeSession();
    await handleAcpKillCommand(session);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: '/acp-kill' }),
      }),
    );
  });

  it('does not abort if abortController already aborted', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const abortFn = jest.fn();
    const session = makeSession({
      isRunning: true,
      abortController: { abort: abortFn, signal: { aborted: true } },
    });
    await handleAcpKillCommand(session);
    expect(abortFn).not.toHaveBeenCalled();
  });
});

// ── handleAcpStatusCommand ─────────────────────────────────────────────

describe('handleAcpStatusCommand', () => {
  it('shows "not active" when passthrough is inactive', async () => {
    const session = makeSession();
    const result = await handleAcpStatusCommand(session);
    expect(result).toBe(true);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('未激活');
  });

  it('shows agent info when passthrough is active', async () => {
    setAcpPassthroughState({ agent: 'codex', sessionName: 'review' });
    const session = makeSession({ isRunning: false });
    const result = await handleAcpStatusCommand(session);
    expect(result).toBe(true);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('Codex');
    expect(emitCall.data.result.message).toContain('review');
  });

  it('shows running status when agent is processing', async () => {
    setAcpPassthroughState({ agent: 'claude' });
    const session = makeSession({ isRunning: true });
    await handleAcpStatusCommand(session);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('正在处理');
  });

  it('shows idle status when agent is waiting', async () => {
    setAcpPassthroughState({ agent: 'claude' });
    const session = makeSession({ isRunning: false });
    await handleAcpStatusCommand(session);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('空闲');
  });

  it('emits /acp-status command event', async () => {
    const session = makeSession();
    await handleAcpStatusCommand(session);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: '/acp-status' }),
      }),
    );
  });

  it('shows cwd when set', async () => {
    setAcpPassthroughState({ agent: 'codex', cwd: '/my/project' });
    const session = makeSession();
    await handleAcpStatusCommand(session);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('/my/project');
  });
});

// ── handleAcpCancelCommand ─────────────────────────────────────────────

describe('handleAcpCancelCommand', () => {
  it('shows "no operation to cancel" when idle', async () => {
    const session = makeSession({ isRunning: false, abortController: null });
    const result = await handleAcpCancelCommand(session);
    expect(result).toBe(true);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('无操作可取消');
  });

  it('aborts in-flight operation but keeps passthrough state', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const ac = mockAbortController();
    const session = makeSession({ isRunning: true, abortController: ac });
    const result = await handleAcpCancelCommand(session);
    expect(result).toBe(true);
    expect(ac.abort).toHaveBeenCalled();
    expect(session.isRunning).toBe(false);
    // Passthrough state should remain
    expect(getAcpPassthroughState()?.agent).toBe('codex');
  });

  it('emits /acp-cancel command event', async () => {
    setAcpPassthroughState({ agent: 'gemini' });
    const ac = mockAbortController();
    const session = makeSession({ isRunning: true, abortController: ac });
    await handleAcpCancelCommand(session);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: '/acp-cancel' }),
      }),
    );
  });

  it('shows generic cancel message when no passthrough state is set', async () => {
    const ac = mockAbortController();
    const session = makeSession({ isRunning: true, abortController: ac });
    await handleAcpCancelCommand(session);
    expect(ac.abort).toHaveBeenCalled();
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('已取消');
  });
});

// ── createHandleInternalCommand routing ───────────────────────────────

describe('createHandleInternalCommand — ACP hyphenated routing', () => {
  it('routes /acp-exit to handleAcpExitCommand', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const handler = createHandleInternalCommand(makeSession());
    const result = await handler('/acp-exit');
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('routes /acp-stop to handleAcpExitCommand', async () => {
    setAcpPassthroughState({ agent: 'claude' });
    const handler = createHandleInternalCommand(makeSession());
    await handler('/acp-stop');
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('routes /acp-off to handleAcpExitCommand', async () => {
    setAcpPassthroughState({ agent: 'gemini' });
    const handler = createHandleInternalCommand(makeSession());
    await handler('/acp-off');
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('routes /acp-kill to handleAcpKillCommand', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const ac = mockAbortController();
    const session = makeSession({ isRunning: true, abortController: ac });
    const handler = createHandleInternalCommand(session);
    await handler('/acp-kill');
    expect(ac.abort).toHaveBeenCalled();
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('routes /acp-status to handleAcpStatusCommand', async () => {
    setAcpPassthroughState({ agent: 'cursor' });
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    const result = await handler('/acp-status');
    expect(result).toBe(true);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: '/acp-status' }),
      }),
    );
  });

  it('routes /acp-cancel to handleAcpCancelCommand', async () => {
    const ac = mockAbortController();
    const session = makeSession({ isRunning: true, abortController: ac });
    const handler = createHandleInternalCommand(session);
    const result = await handler('/acp-cancel');
    expect(result).toBe(true);
    expect(ac.abort).toHaveBeenCalled();
  });

  it('routes /acp-codex to activate codex passthrough', async () => {
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    const result = await handler('/acp-codex');
    expect(result).toBe(true);
    expect(getAcpPassthroughState()?.agent).toBe('codex');
  });

  it('routes /acp-claude to activate claude passthrough', async () => {
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    await handler('/acp-claude');
    expect(getAcpPassthroughState()?.agent).toBe('claude');
  });

  it('routes /acp-codex mySession with session name', async () => {
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    await handler('/acp-codex mySession');
    const state = getAcpPassthroughState();
    expect(state?.agent).toBe('codex');
    expect(state?.sessionName).toBe('mySession');
  });

  it('routes all known agents via /acp-<agent> shortcuts', async () => {
    for (const agent of KNOWN_ACP_AGENTS) {
      clearAcpPassthroughState();
      const session = makeSession();
      const handler = createHandleInternalCommand(session);
      const result = await handler(`/acp-${agent}`);
      expect(result).toBe(true);
      expect(getAcpPassthroughState()?.agent).toBe(agent);
    }
  });

  it('unknown /acp-<non-agent> falls through to handleAcpCommand which rejects it', async () => {
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    const result = await handler('/acp-unknownxyz');
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
    // The emit should contain a warning about unknown agent
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: expect.objectContaining({ success: true }),
        }),
      }),
    );
  });

  it('routes /acp-pause to handleAcpPauseCommand', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    const result = await handler('/acp-pause');
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
    expect(getAcpPausedPassthroughState()?.agent).toBe('codex');
  });

  it('routes /acp-resume to handleAcpResumeCommand', async () => {
    setAcpPassthroughState({ agent: 'claude', sessionName: 'main' });
    pauseAcpPassthroughState();
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    const result = await handler('/acp-resume');
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toEqual({ agent: 'claude', sessionName: 'main' });
    expect(getAcpPausedPassthroughState()).toBeNull();
  });
});

// ── handleAcpPauseCommand ──────────────────────────────────────────────

describe('handleAcpPauseCommand', () => {
  it('pauses active passthrough and saves state', async () => {
    setAcpPassthroughState({ agent: 'codex', sessionName: 'backend' });
    const session = makeSession();
    const result = await handleAcpPauseCommand(session);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
    expect(getAcpPausedPassthroughState()).toEqual({ agent: 'codex', sessionName: 'backend' });
  });

  it('shows "not active" when no passthrough is running', async () => {
    const session = makeSession();
    const result = await handleAcpPauseCommand(session);
    expect(result).toBe(true);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('未激活');
    expect(getAcpPausedPassthroughState()).toBeNull();
  });

  it('emits /acp-pause command event', async () => {
    setAcpPassthroughState({ agent: 'gemini' });
    const session = makeSession();
    await handleAcpPauseCommand(session);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: '/acp-pause' }),
      }),
    );
  });

  it('includes agent display name in pause message', async () => {
    setAcpPassthroughState({ agent: 'claude' });
    const session = makeSession();
    await handleAcpPauseCommand(session);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('Claude Code');
  });
});

// ── handleAcpResumeCommand ─────────────────────────────────────────────

describe('handleAcpResumeCommand', () => {
  it('resumes paused passthrough state', async () => {
    setAcpPassthroughState({ agent: 'codex', sessionName: 'review' });
    pauseAcpPassthroughState();
    const session = makeSession();
    const result = await handleAcpResumeCommand(session);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toEqual({ agent: 'codex', sessionName: 'review' });
    expect(getAcpPausedPassthroughState()).toBeNull();
  });

  it('shows "no paused session" when nothing was paused', async () => {
    const session = makeSession();
    const result = await handleAcpResumeCommand(session);
    expect(result).toBe(true);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('无可恢复');
  });

  it('shows "already active" when passthrough is already running', async () => {
    setAcpPassthroughState({ agent: 'gemini' });
    const session = makeSession();
    const result = await handleAcpResumeCommand(session);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()?.agent).toBe('gemini');
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('已激活');
  });

  it('emits /acp-resume command event', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    pauseAcpPassthroughState();
    const session = makeSession();
    await handleAcpResumeCommand(session);
    expect(session.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ command: '/acp-resume' }),
      }),
    );
  });

  it('includes agent display name in resume message', async () => {
    setAcpPassthroughState({ agent: 'claude' });
    pauseAcpPassthroughState();
    const session = makeSession();
    await handleAcpResumeCommand(session);
    const emitCall = session.adapter.emit.mock.calls[0][0];
    expect(emitCall.data.result.message).toContain('Claude Code');
  });
});
