import { FilesystemCheckpointer } from '@/infrastructure/checkpoint/checkpointer';
import * as fs from 'fs';
import * as path from 'path';

describe('FilesystemCheckpointer Coverage Tests', () => {
  let checkpointer: FilesystemCheckpointer;
  const testSessionsDir = path.join(__dirname, '.test-sessions-coverage');

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

  it('should handle basic checkpoint operations correctly', async () => {
    const config = { configurable: { thread_id: 'test-thread-1' } };
    const checkpoint = {
      v: 4,
      id: 'test-checkpoint-id-1',
      ts: new Date().toISOString(),
      channel_values: { key: 'value' },
      channel_versions: {},
      versions_seen: {}
    };
    const metadata = {
      source: 'input' as const,
      step: 0,
      parents: {}
    };
    const newVersions = { channel1: 1 };

    // Test put operation
    const resultConfig = await checkpointer.put(config, checkpoint, metadata, newVersions);
    expect(resultConfig.configurable?.thread_id).toBe('test-thread-1');
    expect(resultConfig.configurable?.checkpoint_id).toBe('test-checkpoint-id-1');

    // Test getTuple operation
    const retrieved = await checkpointer.getTuple(config);
    expect(retrieved).toBeDefined();
    expect(retrieved?.checkpoint.id).toBe('test-checkpoint-id-1');
    expect(retrieved?.checkpoint.channel_values.key).toBe('value');
  });

  it('should handle edge cases properly', async () => {
    // Test non-existent thread
    const nonExistentConfig = { configurable: { thread_id: 'non-existent' } };
    const result = await checkpointer.getTuple(nonExistentConfig);
    expect(result).toBeUndefined();

    // Test with empty thread_id
    const emptyConfig = { configurable: { thread_id: '' } };
    const emptyResult = await checkpointer.getTuple(emptyConfig);
    expect(emptyResult).toBeUndefined();
  });

  it('should handle file system operations safely', async () => {
    // This test ensures the checkpointer can handle normal operations
    const config = { configurable: { thread_id: 'safe-test-thread' } };
    const checkpoint = {
      v: 4,
      id: 'safe-test-checkpoint',
      ts: new Date().toISOString(),
      channel_values: { test: 'data' },
      channel_versions: {},
      versions_seen: {}
    };
    const metadata = {
      source: 'input' as const,
      step: 0,
      parents: {}
    };
    const newVersions = { channel1: 1 };

    await checkpointer.put(config, checkpoint, metadata, newVersions);
    const retrieved = await checkpointer.getTuple(config);
    expect(retrieved).toBeDefined();
  });
});