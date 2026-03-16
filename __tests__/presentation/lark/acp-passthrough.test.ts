/**
 * Tests for ACP passthrough state management and Lark interactive ACP passthrough handling.
 */

import {
  getAcpPassthroughState,
  setAcpPassthroughState,
  clearAcpPassthroughState,
} from '@/presentation/lark/acp-passthrough';
import { handleAcpCommand } from '@/presentation/lark/commander';

// ====================================================================
// acp-passthrough state tests
// ====================================================================

describe('ACP Passthrough State', () => {
  beforeEach(() => {
    clearAcpPassthroughState();
  });

  afterEach(() => {
    clearAcpPassthroughState();
  });

  it('should return null when no state is set', () => {
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('should set and retrieve passthrough state', () => {
    setAcpPassthroughState({ agent: 'codex' });
    expect(getAcpPassthroughState()).toEqual({ agent: 'codex' });
  });

  it('should set state with session name', () => {
    setAcpPassthroughState({ agent: 'claude', sessionName: 'backend' });
    const state = getAcpPassthroughState();
    expect(state?.agent).toBe('claude');
    expect(state?.sessionName).toBe('backend');
  });

  it('should set state with cwd', () => {
    setAcpPassthroughState({ agent: 'gemini', cwd: '/path/to/project' });
    expect(getAcpPassthroughState()?.cwd).toBe('/path/to/project');
  });

  it('should clear the state', () => {
    setAcpPassthroughState({ agent: 'codex' });
    clearAcpPassthroughState();
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('should overwrite existing state', () => {
    setAcpPassthroughState({ agent: 'codex' });
    setAcpPassthroughState({ agent: 'claude', sessionName: 'review' });
    const state = getAcpPassthroughState();
    expect(state?.agent).toBe('claude');
    expect(state?.sessionName).toBe('review');
  });

  it('should allow setting state to null explicitly', () => {
    setAcpPassthroughState({ agent: 'codex' });
    setAcpPassthroughState(null);
    expect(getAcpPassthroughState()).toBeNull();
  });
});

// ====================================================================
// handleAcpCommand tests
// ====================================================================

describe('handleAcpCommand', () => {
  const mockEmit = jest.fn().mockResolvedValue(undefined);
  const mockSession = {
    adapter: { emit: mockEmit },
  };

  beforeEach(() => {
    clearAcpPassthroughState();
    mockEmit.mockClear();
    // Suppress console.log during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    clearAcpPassthroughState();
    jest.restoreAllMocks();
  });

  it('should activate passthrough mode for a known agent', async () => {
    const result = await handleAcpCommand(mockSession, ['codex']);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toEqual({ agent: 'codex', sessionName: undefined });
  });

  it('should activate passthrough mode with a named session', async () => {
    const result = await handleAcpCommand(mockSession, ['codex', 'backend']);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toEqual({ agent: 'codex', sessionName: 'backend' });
  });

  it('should deactivate passthrough mode with "stop"', async () => {
    setAcpPassthroughState({ agent: 'codex' });

    const result = await handleAcpCommand(mockSession, ['stop']);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('should deactivate passthrough mode with "off"', async () => {
    setAcpPassthroughState({ agent: 'claude' });

    const result = await handleAcpCommand(mockSession, ['off']);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('should deactivate passthrough mode with "exit"', async () => {
    setAcpPassthroughState({ agent: 'gemini' });

    const result = await handleAcpCommand(mockSession, ['exit']);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('should show "not active" message when stopping with no active passthrough', async () => {
    const result = await handleAcpCommand(mockSession, ['stop']);
    expect(result).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'commandExecuted',
        data: expect.objectContaining({ command: '/acp' }),
      }),
    );
    // State should still be null
    expect(getAcpPassthroughState()).toBeNull();
  });

  it('should show status when passthrough is active', async () => {
    setAcpPassthroughState({ agent: 'codex', sessionName: 'review' });

    const result = await handleAcpCommand(mockSession, ['status']);
    expect(result).toBe(true);
    expect(mockEmit).toHaveBeenCalled();
    // State should not change
    expect(getAcpPassthroughState()?.agent).toBe('codex');
  });

  it('should show "not active" status message when passthrough is inactive', async () => {
    const result = await handleAcpCommand(mockSession, ['status']);
    expect(result).toBe(true);
    expect(mockEmit).toHaveBeenCalled();
  });

  it('should show warning for unknown agent name', async () => {
    const result = await handleAcpCommand(mockSession, ['unknownagent123']);
    expect(result).toBe(true);
    // State should not be set
    expect(getAcpPassthroughState()).toBeNull();
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: expect.objectContaining({ success: true }),
        }),
      }),
    );
  });

  it('should support all known built-in agents', async () => {
    const agents = ['codex', 'claude', 'gemini', 'cursor', 'copilot', 'pi', 'openclaw'];
    for (const agent of agents) {
      clearAcpPassthroughState();
      const result = await handleAcpCommand(mockSession, [agent]);
      expect(result).toBe(true);
      expect(getAcpPassthroughState()?.agent).toBe(agent);
    }
  });

  it('should show "not active" message when no args given and passthrough is inactive', async () => {
    const result = await handleAcpCommand(mockSession, []);
    expect(result).toBe(true);
    expect(getAcpPassthroughState()).toBeNull();
  });
});
