import { promises as fs } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

import type { AcpSessionState } from './acp-session';

interface AcpxSessionIndexEntry {
  acpxRecordId?: string;
  agentCommand?: string;
  cwd?: string;
  name?: string;
  closed?: boolean;
  lastUsedAt?: string;
}

/** Locate the event log for the same cwd/name/agent without changing session state. */
export async function findAcpEventStreamPath(
  state: AcpSessionState,
  sessionsDir = resolve(homedir(), '.acpx', 'sessions'),
): Promise<string | null> {
  try {
    const index = JSON.parse(await fs.readFile(resolve(sessionsDir, 'index.json'), 'utf8'));
    const targetCwd = resolve(state.cwd || process.cwd());
    const targetAgent = state.agent.toLowerCase();
    const entries = (Array.isArray(index?.entries) ? index.entries : []) as AcpxSessionIndexEntry[];
    const candidates = entries
      .filter((entry) => !entry.closed && entry.acpxRecordId && entry.cwd && resolve(entry.cwd) === targetCwd)
      .filter((entry) => state.sessionName ? entry.name === state.sessionName : !entry.name)
      .sort((a, b) => String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')));
    const matched = candidates.find((entry) => String(entry.agentCommand || '').toLowerCase().includes(targetAgent));
    return matched?.acpxRecordId
      ? resolve(sessionsDir, `${matched.acpxRecordId}.stream.ndjson`)
      : null;
  } catch {
    return null;
  }
}

/** Follow only bytes appended after start(), including across stream truncation/rotation. */
export class AcpEventStreamFollower {
  private offset = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling: Promise<void> | null = null;

  constructor(
    private readonly path: string,
    private readonly onData: (chunk: Buffer) => void,
    private readonly intervalMs = 250,
  ) {}

  async start(): Promise<void> {
    try {
      this.offset = (await fs.stat(this.path)).size;
    } catch {
      this.offset = 0;
    }
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.poll();
    await this.polling;
  }

  private poll(): Promise<void> {
    if (this.polling) return this.polling;
    this.polling = this.readAppendedBytes().finally(() => {
      this.polling = null;
    });
    return this.polling;
  }

  private async readAppendedBytes(): Promise<void> {
    try {
      const stat = await fs.stat(this.path);
      if (stat.size < this.offset) this.offset = 0;
      if (stat.size === this.offset) return;

      const length = stat.size - this.offset;
      const handle = await fs.open(this.path, 'r');
      try {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, this.offset);
        this.offset += bytesRead;
        if (bytesRead > 0) this.onData(buffer.subarray(0, bytesRead));
      } finally {
        await handle.close();
      }
    } catch {
      // The active segment may briefly disappear while acpx rotates it.
    }
  }
}
