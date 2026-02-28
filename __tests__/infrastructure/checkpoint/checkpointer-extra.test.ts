/**
 * Additional tests for FilesystemCheckpointer to cover error paths
 * and advanced branches in list(), putWrites(), and deleteThread().
 */
import { FilesystemCheckpointer } from '@/infrastructure/checkpoint/checkpointer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SESSIONS_DIR = path.join(os.tmpdir(), 'aibo-chkpt-extra-test');

function makeCheckpoint(id: string) {
  return {
    v: 4 as any,
    id,
    ts: new Date().toISOString(),
    channel_values: {},
    channel_versions: {},
    versions_seen: {},
  };
}

const BASE_META = { source: 'input' as const, step: 0, parents: {} };

describe('FilesystemCheckpointer - extra coverage', () => {
  let cp: FilesystemCheckpointer;

  beforeEach(() => {
    if (fs.existsSync(SESSIONS_DIR)) fs.rmSync(SESSIONS_DIR, { recursive: true, force: true });
    cp = new FilesystemCheckpointer(SESSIONS_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(SESSIONS_DIR)) fs.rmSync(SESSIONS_DIR, { recursive: true, force: true });
  });

  // ── put: catch block (lines 124-125) ──────────────────────────────────────

  it('rethrows when put encounters a write error', async () => {
    const config = { configurable: { thread_id: 'err-thread' } };
    const chk = makeCheckpoint('chk-err');

    const fsModule = require('fs');
    const origWrite = fsModule.writeFileSync;
    fsModule.writeFileSync = () => { throw new Error('disk full'); };

    try {
      await expect(cp.put(config, chk, BASE_META, {})).rejects.toThrow('disk full');
    } finally {
      fsModule.writeFileSync = origWrite;
    }
  });

  // ── list: limit break (line 150) ──────────────────────────────────────────

  it('stops listing when remainingLimit reaches 0', async () => {
    for (let i = 0; i < 3; i++) {
      const config = { configurable: { thread_id: `thread-lim-${i}` } };
      await cp.put(config, makeCheckpoint(`chk-${i}`), BASE_META, {});
    }

    const results: any[] = [];
    const listConfig = { configurable: {} };
    for await (const t of cp.list(listConfig, { limit: 2 })) {
      results.push(t);
    }
    expect(results.length).toBe(2);
  });

  // ── list: thread_id filter (continue, line 155) ──────────────────────────

  it('skips threads that do not match config.thread_id', async () => {
    for (let i = 0; i < 2; i++) {
      const config = { configurable: { thread_id: `thread-flt-${i}` } };
      await cp.put(config, makeCheckpoint(`chk-flt-${i}`), BASE_META, {});
    }

    const results: any[] = [];
    for await (const t of cp.list({ configurable: { thread_id: 'thread-flt-0' } })) {
      results.push(t);
    }
    expect(results.length).toBe(1);
    expect(results[0].config.configurable.thread_id).toBe('thread-flt-0');
  });

  // ── list: before condition (lines 164-166) ────────────────────────────────

  it('skips checkpoints whose id >= before.checkpoint_id', async () => {
    // Use different thread IDs so both checkpoints persist (same thread would overwrite)
    const config1 = { configurable: { thread_id: 'thread-before-aaa' } };
    const config2 = { configurable: { thread_id: 'thread-before-zzz' } };
    const chk1 = makeCheckpoint('aaa-checkpoint');
    const chk2 = makeCheckpoint('zzz-checkpoint');
    await cp.put(config1, chk1, BASE_META, {});
    await cp.put(config2, chk2, BASE_META, {});

    const results: any[] = [];
    for await (const t of cp.list(
      { configurable: {} },
      { before: { configurable: { checkpoint_id: 'bbb' } } }
    )) {
      results.push(t);
    }
    // Only aaa-checkpoint (< 'bbb') should be included, zzz-checkpoint skipped
    expect(results.some((r) => r.checkpoint.id === 'aaa-checkpoint')).toBe(true);
    expect(results.some((r) => r.checkpoint.id === 'zzz-checkpoint')).toBe(false);
  });

  // ── list: filter condition (lines 172-176) ────────────────────────────────

  it('applies metadata filter correctly', async () => {
    const config1 = { configurable: { thread_id: 'thread-meta-1' } };
    const config2 = { configurable: { thread_id: 'thread-meta-2' } };
    await cp.put(config1, makeCheckpoint('chk-m1'), { ...BASE_META, step: 1 }, {});
    await cp.put(config2, makeCheckpoint('chk-m2'), { ...BASE_META, step: 2 }, {});

    const results: any[] = [];
    for await (const t of cp.list({ configurable: {} }, { filter: { step: 1 } })) {
      results.push(t);
    }
    expect(results.length).toBe(1);
  });

  // ── list: catch block (lines 187-189) ─────────────────────────────────────

  it('handles list errors gracefully', async () => {
    const fsModule = require('fs');
    const orig = fsModule.readdirSync;
    fsModule.readdirSync = () => { throw new Error('read dir error'); };

    try {
      const results: any[] = [];
      for await (const t of cp.list({ configurable: {} })) {
        results.push(t);
      }
      expect(results.length).toBe(0);
    } finally {
      fsModule.readdirSync = orig;
    }
  });

  // ── putWrites: missing threadId (line 208) ───────────────────────────────

  it('throws when putWrites has no thread_id', async () => {
    await expect(
      cp.putWrites({ configurable: { checkpoint_id: 'cid' } }, [['ch', 'val']], 'task1')
    ).rejects.toThrow('thread_id');
  });

  // ── putWrites: missing checkpointId (line 212) ───────────────────────────

  it('throws when putWrites has no checkpoint_id', async () => {
    await expect(
      cp.putWrites({ configurable: { thread_id: 'tid' } }, [['ch', 'val']], 'task1')
    ).rejects.toThrow('checkpoint_id');
  });

  // ── putWrites: creates session dir if missing (line 240) ─────────────────

  it('creates session dir when putWrites is called for new thread', async () => {
    const config = {
      configurable: { thread_id: 'new-thread-write', checkpoint_id: 'chk-new' },
    };
    await cp.putWrites(config, [['ch', 'val']], 'task1');
    const sessionDir = path.join(SESSIONS_DIR, 'new-thread-write');
    expect(fs.existsSync(sessionDir)).toBe(true);
  });

  // ── putWrites: catch block (lines 248-249) ───────────────────────────────

  it('rethrows when putWrites write fails', async () => {
    const config = {
      configurable: { thread_id: 'write-err-thread', checkpoint_id: 'chk-x' },
    };
    const fsModule = require('fs');
    const orig = fsModule.writeFileSync;
    fsModule.writeFileSync = () => { throw new Error('write error'); };

    try {
      await expect(cp.putWrites(config, [['ch', 'val']], 'task1')).rejects.toThrow('write error');
    } finally {
      fsModule.writeFileSync = orig;
    }
  });

  // ── deleteThread: catch block (lines 265-266) ────────────────────────────

  it('rethrows when deleteThread unlink fails', async () => {
    // First put a checkpoint so the file exists
    const config = { configurable: { thread_id: 'del-err-thread' } };
    await cp.put(config, makeCheckpoint('chk-del'), BASE_META, {});

    const fsModule = require('fs');
    const orig = fsModule.unlinkSync;
    fsModule.unlinkSync = () => { throw new Error('unlink error'); };

    try {
      await expect(cp.deleteThread('del-err-thread')).rejects.toThrow('unlink error');
    } finally {
      fsModule.unlinkSync = orig;
    }
  });
});
