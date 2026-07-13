import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

import { AcpEventStreamFollower, findAcpEventStreamPath } from '@/shared/acp-event-stream';

describe('ACP event stream following', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(resolve(tmpdir(), 'aibo-acp-stream-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('finds the newest matching default session stream', async () => {
    await fs.writeFile(resolve(dir, 'index.json'), JSON.stringify({ entries: [
      { acpxRecordId: 'old', agentCommand: 'codex-acp', cwd: '/repo', lastUsedAt: '2026-01-01' },
      { acpxRecordId: 'new', agentCommand: '/repo/codex-http-agent.sh', cwd: '/repo', lastUsedAt: '2026-01-02' },
      { acpxRecordId: 'named', agentCommand: 'codex-acp', cwd: '/repo', name: 'other', lastUsedAt: '2026-01-03' },
    ] }));

    await expect(findAcpEventStreamPath({ agent: 'codex', cwd: '/repo' }, dir))
      .resolves.toBe(resolve(dir, 'new.stream.ndjson'));
  });

  it('follows only newly appended bytes', async () => {
    const path = resolve(dir, 'session.stream.ndjson');
    await fs.writeFile(path, 'old\n');
    const chunks: Buffer[] = [];
    const follower = new AcpEventStreamFollower(path, (chunk) => chunks.push(chunk), 10);
    await follower.start();
    await fs.appendFile(path, 'new-1\nnew-2\n');
    await new Promise((resolveWait) => setTimeout(resolveWait, 40));
    await follower.stop();

    expect(Buffer.concat(chunks).toString()).toBe('new-1\nnew-2\n');
  });
});
