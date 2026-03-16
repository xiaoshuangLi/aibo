/**
 * ACP (Agent Communication Protocol) session state.
 *
 * Shared singleton that tracks whether Lark passthrough mode is active and
 * which agent/session it is targeting. Lives in `src/shared/` so it can be
 * imported by both `src/tools/` and `src/presentation/lark/` without
 * creating a circular dependency.
 *
 * @module shared/acp-session
 */

export interface AcpSessionState {
  /** ACP-compatible agent name (e.g. "codex", "claude") */
  agent: string;
  /** Named session (-s flag) — kept constant for the whole passthrough conversation */
  sessionName?: string;
  /** Working directory for the acpx session */
  cwd?: string;
}

let _state: AcpSessionState | null = null;

/** Return the current ACP passthrough state, or null if inactive. */
export function getAcpSessionState(): AcpSessionState | null {
  return _state;
}

/** Activate (or replace) the ACP passthrough session. */
export function setAcpSessionState(state: AcpSessionState | null): void {
  _state = state;
}

/** Deactivate ACP passthrough. */
export function clearAcpSessionState(): void {
  _state = null;
}
