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

/**
 * Maps an ACP agent identifier to a human-readable programming tool display name.
 *
 * @param agent - The ACP agent identifier (e.g. "claude", "codex")
 * @returns A display name suitable for Lark message titles (e.g. "Claude Code", "Codex")
 */
export function getAcpAgentDisplayName(agent: string): string {
  const names: Record<string, string> = {
    claude: 'Claude Code',
    codex: 'Codex',
    gemini: 'Gemini',
    cursor: 'Cursor',
    copilot: 'GitHub Copilot',
    pi: 'Pi',
    openclaw: 'OpenClaw',
    kimi: 'Kimi',
    opencode: 'OpenCode',
    kiro: 'Kiro',
    kilocode: 'Kilocode',
    qwen: 'Qwen',
    droid: 'Droid',
  };
  return names[agent.toLowerCase()] ?? (agent.charAt(0).toUpperCase() + agent.slice(1));
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
