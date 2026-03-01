import { FilesystemCheckpointer } from '../src/infrastructure/checkpoint/checkpointer';
import * as fs from 'fs';
import * as path from 'path';

describe('FilesystemCheckpointer', () => {
  let checkpointer: FilesystemCheckpointer;
  const testSessionsDir = path.join(__dirname, '.test-sessions');

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    }
    checkpointer = new FilesystemCheckpointer(testSessionsDir);
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  test('getTuple returns undefined for non-existent thread', async () => {
    const config = { configurable: { thread_id: 'non-existent' } };
    const result = await checkpointer.getTuple(config);
    expect(result).toBeUndefined();
  });

  test('put saves checkpoint and returns correct config', async () => {
    const config = { configurable: { thread_id: 'test-thread' } };
    const checkpoint = {
      v: 4,
      id: 'test-checkpoint-id',
      ts: new Date().toISOString(),
      channel_values: {},
      channel_versions: {},
      versions_seen: {}
    };
    const metadata = {
      source: 'input' as const,
      step: 0,
      parents: {}
    };
    const newVersions = { channel1: 1, channel2: 2 };

    const resultConfig = await checkpointer.put(config, checkpoint, metadata, newVersions);
    
    expect(resultConfig.configurable?.thread_id).toBe('test-thread');
    expect(resultConfig.configurable?.checkpoint_id).toBe('test-checkpoint-id');
    
    // Verify the file was saved
    const filePath = path.join(testSessionsDir, 'test-thread', 'session.json');
    expect(fs.existsSync(filePath)).toBe(true);
    
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(fileContent.checkpoint).toEqual(checkpoint);
    expect(fileContent.metadata).toEqual(metadata);
    expect(fileContent.newVersions).toEqual(newVersions);
  });

  test('getTuple retrieves saved checkpoint', async () => {
    const config = { configurable: { thread_id: 'test-thread' } };
    const checkpoint = {
      v: 4,
      id: 'test-checkpoint-id',
      ts: new Date().toISOString(),
      channel_values: { key: 'value' },
      channel_versions: { key: 1 },
      versions_seen: {}
    };
    const metadata = {
      source: 'input' as const,
      step: 0,
      parents: {}
    };
    const newVersions = { key: 1 };

    await checkpointer.put(config, checkpoint, metadata, newVersions);
    
    const result = await checkpointer.getTuple(config);
    
    expect(result).toBeDefined();
    expect(result?.config.configurable?.thread_id).toBe('test-thread');
    expect(result?.config.configurable?.checkpoint_id).toBe('test-checkpoint-id');
    expect(result?.config.configurable?.checkpoint_ns).toBe('');
    expect(result?.checkpoint).toEqual(checkpoint);
    expect(result?.metadata).toEqual(metadata);
    expect(result?.pendingWrites).toEqual([]);
  });

  test('putWrites saves pending writes', async () => {
    // First create a checkpoint
    const config = { configurable: { thread_id: 'test-thread' } };
    const checkpoint = {
      v: 4,
      id: 'test-checkpoint-id',
      ts: new Date().toISOString(),
      channel_values: {},
      channel_versions: {},
      versions_seen: {}
    };
    const metadata = {
      source: 'input' as const,
      step: 0,
      parents: {}
    };
    const newVersions = {};

    await checkpointer.put(config, checkpoint, metadata, newVersions);
    
    // Now add writes with the checkpoint_id
    const configWithCheckpointId = { 
      configurable: { 
        thread_id: 'test-thread',
        checkpoint_id: 'test-checkpoint-id'
      } 
    };
    const writes: [string, unknown][] = [['channel1', 'value1'], ['channel2', 'value2']];
    const taskId = 'test-task-id';

    await checkpointer.putWrites(configWithCheckpointId, writes, taskId);
    
    const result = await checkpointer.getTuple(config);
    
    expect(result).toBeDefined();
    expect(result?.pendingWrites).toHaveLength(2);
    expect(result?.pendingWrites).toContainEqual([taskId, 'channel1', 'value1']);
    expect(result?.pendingWrites).toContainEqual([taskId, 'channel2', 'value2']);
  });

  test('deleteThread removes entire session directory including history', async () => {
    const config = { configurable: { thread_id: 'test-thread' } };
    const checkpoint = {
      v: 4,
      id: 'test-checkpoint-id',
      ts: new Date().toISOString(),
      channel_values: {},
      channel_versions: {},
      versions_seen: {}
    };
    const metadata = {
      source: 'input' as const,
      step: 0,
      parents: {}
    };
    const newVersions = {};

    await checkpointer.put(config, checkpoint, metadata, newVersions);

    // Verify session directory exists
    const sessionDir = path.join(testSessionsDir, 'test-thread');
    expect(fs.existsSync(sessionDir)).toBe(true);

    // Delete thread
    await checkpointer.deleteThread('test-thread');

    // Verify entire directory is deleted
    expect(fs.existsSync(sessionDir)).toBe(false);
  });

  test('list yields checkpoints as async generator', async () => {
    // Save multiple checkpoints
    const threads = ['thread1', 'thread2', 'thread3'];
    for (const threadId of threads) {
      const config = { configurable: { thread_id: threadId } };
      const checkpoint = {
        v: 4,
        id: `checkpoint-${threadId}`,
        ts: new Date().toISOString(),
        channel_values: {},
        channel_versions: {},
        versions_seen: {}
      };
      const metadata = {
        source: 'input' as const,
        step: 0,
        parents: {}
      };
      const newVersions = {};
      
      await checkpointer.put(config, checkpoint, metadata, newVersions);
    }
    
    const config = { configurable: {} };
    const checkpoints: any[] = [];
    for await (const checkpoint of checkpointer.list(config)) {
      checkpoints.push(checkpoint);
    }
    
    // Now that the list() method is fixed, it should return all 3 checkpoints
    expect(checkpoints).toHaveLength(3);
    expect(checkpoints[0].config.configurable.thread_id).toBe('thread3');
    expect(checkpoints[1].config.configurable.thread_id).toBe('thread2');
    expect(checkpoints[2].config.configurable.thread_id).toBe('thread1');
  });

  test('put saves versioned history files', async () => {
    const threadId = 'history-thread';
    const configs = [
      { configurable: { thread_id: threadId } },
      { configurable: { thread_id: threadId } },
    ];
    const checkpoints = [
      {
        v: 4,
        id: 'checkpoint-v1',
        ts: new Date().toISOString(),
        channel_values: {},
        channel_versions: {},
        versions_seen: {}
      },
      {
        v: 4,
        id: 'checkpoint-v2',
        ts: new Date().toISOString(),
        channel_values: {},
        channel_versions: {},
        versions_seen: {}
      }
    ];
    const metadata = { source: 'input' as const, step: 0, parents: {} };

    await checkpointer.put(configs[0], checkpoints[0], metadata, {});
    await checkpointer.put(configs[1], checkpoints[1], metadata, {});

    // Both history files should exist
    const historyDir = path.join(testSessionsDir, threadId, 'history');
    expect(fs.existsSync(path.join(historyDir, 'checkpoint-v1.json'))).toBe(true);
    expect(fs.existsSync(path.join(historyDir, 'checkpoint-v2.json'))).toBe(true);

    // Latest session.json should point to v2
    const filePath = path.join(testSessionsDir, threadId, 'session.json');
    const latest = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(latest.checkpoint_id).toBe('checkpoint-v2');
  });

  test('list with thread_id returns history in reverse order', async () => {
    const threadId = 'list-history-thread';
    const cfg = { configurable: { thread_id: threadId } };
    const meta = { source: 'input' as const, step: 0, parents: {} };

    for (const id of ['ckpt-a', 'ckpt-b', 'ckpt-c']) {
      await checkpointer.put(cfg, {
        v: 4, id,
        ts: new Date().toISOString(),
        channel_values: {}, channel_versions: {}, versions_seen: {}
      }, meta, {});
    }

    const results: any[] = [];
    for await (const tuple of checkpointer.list({ configurable: { thread_id: threadId } })) {
      results.push(tuple);
    }

    // Should return all 3 history entries (newest first by id)
    expect(results).toHaveLength(3);
    // Sorted by checkpoint_id descending
    expect(results[0].checkpoint.id).toBe('ckpt-c');
    expect(results[1].checkpoint.id).toBe('ckpt-b');
    expect(results[2].checkpoint.id).toBe('ckpt-a');
  });

  test('getHistory returns all versioned checkpoints for a thread', async () => {
    const threadId = 'get-history-thread';
    const cfg = { configurable: { thread_id: threadId } };
    const meta = { source: 'input' as const, step: 0, parents: {} };

    await checkpointer.put(cfg, {
      v: 4, id: 'h-1', ts: new Date().toISOString(),
      channel_values: {}, channel_versions: {}, versions_seen: {}
    }, meta, {});
    await checkpointer.put(cfg, {
      v: 4, id: 'h-2', ts: new Date().toISOString(),
      channel_values: {}, channel_versions: {}, versions_seen: {}
    }, meta, {});

    const history = await checkpointer.getHistory(threadId);
    expect(history).toHaveLength(2);
    // Newest first
    expect(history[0].checkpoint.id).toBe('h-2');
    expect(history[1].checkpoint.id).toBe('h-1');
  });
});