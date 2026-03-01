import { BaseCheckpointSaver, ChannelVersions, Checkpoint, CheckpointMetadata, CheckpointTuple } from "@langchain/langgraph-checkpoint";
import { RunnableConfig } from "@langchain/core/runnables";
import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件系统检查点器
 * 实现 LangGraph Checkpointer 接口，将检查点数据持久化到本地文件系统
 *
 * 存储位置：
 *   - 最新检查点：工作目录/.data/sessions/{thread_id}/session.json
 *   - 历史版本：工作目录/.data/sessions/{thread_id}/history/{checkpoint_id}.json
 */
export class FilesystemCheckpointer extends BaseCheckpointSaver {
  private readonly sessionsDir: string;

  constructor(sessionsDir: string = path.join(process.cwd(), '.data', 'sessions')) {
    super();
    this.sessionsDir = sessionsDir;

    // 确保会话目录存在
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * 获取指定线程的历史检查点目录路径
   */
  private getHistoryDir(threadId: string): string {
    return path.join(this.sessionsDir, threadId, 'history');
  }

  /**
   * 获取指定线程的最新检查点
   * @param config - 包含 thread_id 的配置对象
   * @returns 检查点元组或 undefined
   */
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return undefined;
    }

    const filePath = path.join(this.sessionsDir, threadId, 'session.json');

    try {
      if (!fs.existsSync(filePath)) {
        return undefined;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const checkpointData = JSON.parse(fileContent);

      // 验证检查点数据结构
      if (!checkpointData.checkpoint || !checkpointData.metadata) {
        return undefined;
      }

      return {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointData.checkpoint_ns || '',
            checkpoint_id: checkpointData.checkpoint_id || ''
          }
        },
        checkpoint: checkpointData.checkpoint,
        metadata: checkpointData.metadata,
        parentConfig: checkpointData.parentConfig,
        pendingWrites: checkpointData.pendingWrites || []
      };
    } catch (error) {
      console.error(`Error reading checkpoint for thread ${threadId}:`, error);
      return undefined;
    }
  }

  /**
   * 保存检查点（同时保留历史版本）
   * @param config - 包含 thread_id 的配置对象
   * @param checkpoint - 检查点数据
   * @param metadata - 检查点元数据
   * @param newVersions - 新版本信息
   * @returns 更新后的配置对象
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error('Failed to put checkpoint. The passed RunnableConfig is missing a required "thread_id" field in its "configurable" property.');
    }

    const filePath = path.join(this.sessionsDir, threadId, 'session.json');

    try {
      const checkpointId = checkpoint.id;
      const checkpointNs = config.configurable?.checkpoint_ns ?? "";

      const checkpointData = {
        checkpoint,
        metadata,
        newVersions,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId,
        lastUpdated: new Date().toISOString()
      };

      // 确保会话目录存在
      const sessionDir = path.dirname(filePath);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // 写入最新检查点文件（原子操作）
      const tempFilePath = `${filePath}.tmp`;
      fs.writeFileSync(tempFilePath, JSON.stringify(checkpointData, null, 2), 'utf-8');
      fs.renameSync(tempFilePath, filePath);

      // 保存历史版本
      const historyDir = this.getHistoryDir(threadId);
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
      }
      const historyFilePath = path.join(historyDir, `${checkpointId}.json`);
      if (!fs.existsSync(historyFilePath)) {
        const tempHistoryPath = `${historyFilePath}.tmp`;
        fs.writeFileSync(tempHistoryPath, JSON.stringify(checkpointData, null, 2), 'utf-8');
        fs.renameSync(tempHistoryPath, historyFilePath);
      }

      // 返回更新后的配置
      return {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: checkpointId
        }
      };
    } catch (error) {
      console.error(`Error saving checkpoint for thread ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * 列出检查点（按时间倒序）
   *
   * 当 config 中指定了 thread_id 时，返回该线程的完整历史版本列表（从 history/ 目录）。
   * 否则，返回所有线程的最新检查点。
   *
   * @param config - 配置对象
   * @param options - 列表选项（limit, before, filter）
   * @returns 检查点元组的异步生成器
   */
  async *list(config: RunnableConfig, options?: { limit?: number; before?: RunnableConfig; filter?: Record<string, any> }): AsyncGenerator<CheckpointTuple> {
    const { limit, before, filter } = options ?? {};
    let remainingLimit = limit;
    const filterThreadId = config.configurable?.thread_id;

    try {
      if (filterThreadId) {
        // 列出单个线程的历史版本
        yield* this.listThreadHistory(filterThreadId, { remainingLimit, before, filter });
      } else {
        // 列出所有线程的最新检查点
        const threadDirs = fs.readdirSync(this.sessionsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        // 按线程ID排序（倒序）
        const sortedThreadDirs = threadDirs.sort((a, b) => b.localeCompare(a));

        for (const threadId of sortedThreadDirs) {
          if (remainingLimit !== undefined && remainingLimit <= 0) {
            break;
          }

          const fileConfig = { configurable: { thread_id: threadId } };
          const tuple = await this.getTuple(fileConfig);

          if (tuple) {
            if (before && before.configurable?.checkpoint_id) {
              const currentCheckpointId = tuple.checkpoint.id;
              if (currentCheckpointId >= before.configurable.checkpoint_id) {
                continue;
              }
            }

            if (filter) {
              const matchesFilter = Object.entries(filter).every(([key, value]) => {
                return (tuple.metadata as any)?.[key] === value;
              });
              if (!matchesFilter) {
                continue;
              }
            }

            yield tuple;

            if (remainingLimit !== undefined) {
              remainingLimit--;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error listing checkpoints:', error);
      return;
    }
  }

  /**
   * 列出指定线程的所有历史检查点（按 checkpoint_id 倒序）
   */
  private async *listThreadHistory(
    threadId: string,
    options: { remainingLimit?: number; before?: RunnableConfig; filter?: Record<string, any> }
  ): AsyncGenerator<CheckpointTuple> {
    let { remainingLimit, before, filter } = options;
    const historyDir = this.getHistoryDir(threadId);

    // 如果没有 history 目录，回退到最新检查点
    if (!fs.existsSync(historyDir)) {
      const tuple = await this.getTuple({ configurable: { thread_id: threadId } });
      if (tuple) yield tuple;
      return;
    }

    const historyFiles = fs.readdirSync(historyDir)
      .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
      .sort((a, b) => b.localeCompare(a)); // 倒序（最新的在前）

    for (const fileName of historyFiles) {
      if (remainingLimit !== undefined && remainingLimit <= 0) {
        break;
      }

      try {
        const filePath = path.join(historyDir, fileName);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const checkpointData = JSON.parse(fileContent);

        if (!checkpointData.checkpoint || !checkpointData.metadata) {
          continue;
        }

        const tuple: CheckpointTuple = {
          config: {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: checkpointData.checkpoint_ns || '',
              checkpoint_id: checkpointData.checkpoint_id || ''
            }
          },
          checkpoint: checkpointData.checkpoint,
          metadata: checkpointData.metadata,
          parentConfig: checkpointData.parentConfig,
          pendingWrites: checkpointData.pendingWrites || []
        };

        if (before && before.configurable?.checkpoint_id) {
          if (tuple.checkpoint.id >= before.configurable.checkpoint_id) {
            continue;
          }
        }

        if (filter) {
          const matchesFilter = Object.entries(filter).every(([key, value]) => {
            return (tuple.metadata as any)?.[key] === value;
          });
          if (!matchesFilter) {
            continue;
          }
        }

        yield tuple;

        if (remainingLimit !== undefined) {
          remainingLimit--;
        }
      } catch {
        // 跳过无法读取的历史文件
        continue;
      }
    }
  }

  /**
   * 存储与检查点关联的中间写入操作
   * @param config - 包含 thread_id, checkpoint_ns, checkpoint_id 的配置对象
   * @param writes - 待写入的数据
   * @param taskId - 任务ID
   */
  async putWrites(
    config: RunnableConfig,
    writes: [string, unknown][],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id;
    const checkpointId = config.configurable?.checkpoint_id;

    if (!threadId) {
      throw new Error('Failed to put writes. The passed RunnableConfig is missing a required "thread_id" field in its "configurable" property.');
    }

    if (!checkpointId) {
      throw new Error('Failed to put writes. The passed RunnableConfig is missing a required "checkpoint_id" field in its "configurable" property.');
    }

    const filePath = path.join(this.sessionsDir, threadId, 'session.json');

    try {
      let checkpointData: any = {};

      // 读取现有数据
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        checkpointData = JSON.parse(fileContent);
      }

      // 初始化 pendingWrites 数组
      if (!checkpointData.pendingWrites) {
        checkpointData.pendingWrites = [];
      }

      // 添加新的写入操作
      for (let i = 0; i < writes.length; i++) {
        const [channel, value] = writes[i];
        checkpointData.pendingWrites.push([taskId, channel, value]);
      }

      // 确保会话目录存在
      const sessionDir = path.dirname(filePath);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // 写入更新后的数据
      const tempFilePath = `${filePath}.tmp`;
      fs.writeFileSync(tempFilePath, JSON.stringify(checkpointData, null, 2), 'utf-8');
      fs.renameSync(tempFilePath, filePath);
    } catch (error) {
      console.error(`Error saving writes for thread ${threadId}, checkpoint ${checkpointId}:`, error);
      throw error;
    }
  }

  /**
   * 删除与特定线程ID关联的所有检查点和历史版本
   * @param threadId - 要删除的线程ID
   */
  async deleteThread(threadId: string): Promise<void> {
    const sessionDir = path.join(this.sessionsDir, threadId);

    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Error deleting checkpoint for thread ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * 获取指定线程的历史检查点列表（最新在前）
   * @param threadId - 线程ID
   * @returns 历史检查点元组数组
   */
  async getHistory(threadId: string): Promise<CheckpointTuple[]> {
    const results: CheckpointTuple[] = [];
    for await (const tuple of this.listThreadHistory(threadId, {})) {
      results.push(tuple);
    }
    return results;
  }
}
