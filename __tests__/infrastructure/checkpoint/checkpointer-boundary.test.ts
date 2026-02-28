import { FilesystemCheckpointer } from '../../../src/infrastructure/checkpoint/checkpointer';
import * as fs from 'fs';
import * as path from 'path';

// Mock console.error to avoid polluting test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('FilesystemCheckpointer - Boundary Conditions and Error Handling', () => {
  let checkpointer: FilesystemCheckpointer;
  const testSessionsDir = path.join(__dirname, '.test-sessions-boundary');

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
    // Clear mock calls
    (console.error as jest.Mock).mockClear();
  });

  // ==================== 边界条件测试 ====================

  test('getTuple handles empty thread_id gracefully', async () => {
    const config = { configurable: { thread_id: '' } };
    const result = await checkpointer.getTuple(config);
    expect(result).toBeUndefined();
  });

  test('getTuple handles undefined thread_id gracefully', async () => {
    const config = { configurable: {} as any };
    const result = await checkpointer.getTuple(config);
    expect(result).toBeUndefined();
  });

  test('getTuple handles null thread_id gracefully', async () => {
    const config = { configurable: { thread_id: null as any } };
    const result = await checkpointer.getTuple(config);
    expect(result).toBeUndefined();
  });

  test('put handles empty thread_id with proper error', async () => {
    const config = { configurable: { thread_id: '' } };
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
    const newVersions = { channel1: 1 };

    await expect(checkpointer.put(config, checkpoint, metadata, newVersions))
      .rejects.toThrow('Failed to put checkpoint. The passed RunnableConfig is missing a required "thread_id" field');
  });

  test('put handles undefined thread_id with proper error', async () => {
    const config = { configurable: {} as any };
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
    const newVersions = { channel1: 1 };

    await expect(checkpointer.put(config, checkpoint, metadata, newVersions))
      .rejects.toThrow('Failed to put checkpoint. The passed RunnableConfig is missing a required "thread_id" field');
  });

  test('put handles null thread_id with proper error', async () => {
    const config = { configurable: { thread_id: null as any } };
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
    const newVersions = { channel1: 1 };

    await expect(checkpointer.put(config, checkpoint, metadata, newVersions))
      .rejects.toThrow('Failed to put checkpoint. The passed RunnableConfig is missing a required "thread_id" field');
  });

  test('getTuple handles corrupted JSON file gracefully', async () => {
    const threadId = 'corrupted-thread';
    const sessionDir = path.join(testSessionsDir, threadId);
    fs.mkdirSync(sessionDir, { recursive: true });
    const filePath = path.join(sessionDir, 'session.json');
    
    // Write invalid JSON
    fs.writeFileSync(filePath, 'invalid json content');
    
    const config = { configurable: { thread_id: threadId } };
    const result = await checkpointer.getTuple(config);
    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  test('getTuple handles empty file gracefully', async () => {
    const threadId = 'empty-thread';
    const sessionDir = path.join(testSessionsDir, threadId);
    fs.mkdirSync(sessionDir, { recursive: true });
    const filePath = path.join(sessionDir, 'session.json');
    
    // Write empty file
    fs.writeFileSync(filePath, '');
    
    const config = { configurable: { thread_id: threadId } };
    const result = await checkpointer.getTuple(config);
    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  test('getTuple handles malformed checkpoint data gracefully', async () => {
    const threadId = 'malformed-thread';
    const sessionDir = path.join(testSessionsDir, threadId);
    fs.mkdirSync(sessionDir, { recursive: true });
    const filePath = path.join(sessionDir, 'session.json');
    
    // Write JSON without required fields
    fs.writeFileSync(filePath, JSON.stringify({ someField: 'value' }));
    
    const config = { configurable: { thread_id: threadId } };
    const result = await checkpointer.getTuple(config);
    expect(result).toBeUndefined();
  });

  test('put handles very large checkpoint data', async () => {
    const threadId = 'large-checkpoint';
    const config = { configurable: { thread_id: threadId } };
    
    // Create a large checkpoint with lots of data
    const largeData: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      largeData[`key${i}`] = 'x'.repeat(100); // 100 characters each
    }
    
    const checkpoint = {
      v: 4,
      id: 'large-checkpoint-id',
      ts: new Date().toISOString(),
      channel_values: largeData,
      channel_versions: {},
      versions_seen: {}
    };
    const metadata = {
      source: 'input' as const,
      step: 0,
      parents: {}
    };
    const newVersions = { channel1: 1 };

    const resultConfig = await checkpointer.put(config, checkpoint, metadata, newVersions);
    expect(resultConfig.configurable?.thread_id).toBe(threadId);
    
    // Verify it can be read back
    const retrieved = await checkpointer.getTuple(config);
    expect(retrieved).toBeDefined();
    expect(retrieved?.checkpoint.channel_values).toEqual(largeData);
  });

  test('put handles special characters in thread_id', async () => {
    const threadId = 'thread-with-special-chars-!@#$%^&*()';
    const config = { configurable: { thread_id: threadId } };
    const checkpoint = {
      v: 4,
      id: 'special-checkpoint-id',
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
    const newVersions = { channel1: 1 };

    const resultConfig = await checkpointer.put(config, checkpoint, metadata, newVersions);
    expect(resultConfig.configurable?.thread_id).toBe(threadId);
    
    const retrieved = await checkpointer.getTuple(config);
    expect(retrieved).toBeDefined();
  });

  // ==================== 目录和权限测试 ====================

  test('constructor creates sessions directory recursively', () => {
    const nestedDir = path.join(testSessionsDir, 'nested', 'deep', 'structure');
    const tempCheckpointer = new FilesystemCheckpointer(nestedDir);
    
    expect(fs.existsSync(nestedDir)).toBe(true);
    // Verify it's a directory
    expect(fs.statSync(nestedDir).isDirectory()).toBe(true);
  });

  test('put creates session subdirectory if it doesnt exist', async () => {
    const threadId = 'new-session';
    const config = { configurable: { thread_id: threadId } };
    const checkpoint = {
      v: 4,
      id: 'new-session-checkpoint',
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
    const newVersions = { channel1: 1 };

    await checkpointer.put(config, checkpoint, metadata, newVersions);
    
    const sessionDir = path.join(testSessionsDir, threadId);
    expect(fs.existsSync(sessionDir)).toBe(true);
    expect(fs.statSync(sessionDir).isDirectory()).toBe(true);
  });

  test('put operations are atomic (temp file handling)', async () => {
    const threadId = 'atomic-test';
    const config = { configurable: { thread_id: threadId } };
    const checkpoint = {
      v: 4,
      id: 'atomic-checkpoint-id',
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
    
    const filePath = path.join(testSessionsDir, threadId, 'session.json');
    const tempFilePath = `${filePath}.tmp`;
    
    // Verify temp file doesn't exist after successful write
    expect(fs.existsSync(tempFilePath)).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
    
    // Verify content is correct
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.checkpoint).toEqual(checkpoint);
  });
});