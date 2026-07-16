import { execFile } from 'child_process';
import { promisify } from 'util';

import type { AcpSessionState } from './acp-session';

const execFileAsync = promisify(execFile);

/** Keep cancellation bounded so a new user message cannot hang indefinitely. */
const ACP_CANCEL_TIMEOUT_MS = 15_000;

/** Return true when an acpx failure means its prompt wait expired. */
export function isAcpPromptTimeoutError(error: unknown): boolean {
  const err = error as any;
  if (err?.name === 'TimeoutError' || err?.code === 'ETIMEDOUT') return true;

  const combined = `${err?.message || ''}\n${err?.stdout || ''}\n${err?.stderr || ''}`;
  return /timed out after|exceeded .* timeout|\b(?:ACP_)?TIMEOUT\b/i.test(combined);
}

/** Build argv for cancelling the exact persistent acpx session currently in use. */
export function buildAcpCancelArgs(state: AcpSessionState): string[] {
  const args: string[] = [];
  if (state.cwd) args.push('--cwd', state.cwd);
  args.push(state.agent);
  if (state.sessionName) args.push('-s', state.sessionName);
  args.push('cancel');
  return args;
}

/**
 * Cooperatively cancel the task inside the acpx queue owner.
 *
 * Aborting the local acpx client alone is insufficient: the queue owner and
 * underlying coding agent can continue running, causing the next prompt to sit
 * behind the old one. This command targets the same cwd/session and asks that
 * owner to stop its active prompt.
 */
export async function cancelAcpPrompt(state: AcpSessionState): Promise<void> {
  await execFileAsync('acpx', buildAcpCancelArgs(state), {
    cwd: state.cwd || process.cwd(),
    env: process.env,
    timeout: ACP_CANCEL_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });
}

/** Release the persistent queue owner's active turn after a prompt timeout. */
export async function cancelAcpPromptAfterTimeout(
  error: unknown,
  state: AcpSessionState,
): Promise<boolean> {
  if (!isAcpPromptTimeoutError(error)) return false;
  await cancelAcpPrompt(state);
  return true;
}
