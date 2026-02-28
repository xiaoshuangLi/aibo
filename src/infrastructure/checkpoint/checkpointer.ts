import { BaseCheckpointSaver, ChannelVersions, Checkpoint, CheckpointMetadata, CheckpointTuple } from "@langchain/langgraph-checkpoint";
import { RunnableConfig } from "@langchain/core/runnables";
import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件系统检查点器
 * 实现 LangGraph Checkpointer 接口，将检查点数据持久化到本地文件系统
 * 
 * 存储位置：工作目录/.data/sessions/{thread_id}.json
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
   * 保存检查点
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
      
      // 写入文件（原子操作）
      const tempFilePath = `${filePath}.tmp`;
      fs.writeFileSync(tempFilePath, JSON.stringify(checkpointData, null, 2), 'utf-8');
      fs.renameSync(tempFilePath, filePath);
      
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
   * 列出所有检查点（按时间倒序）
   * @param config - 配置对象
   * @param options - 列表选项（limit, before, filter）
   * @returns 检查点元组的异步生成器
   */
  async *list(config: RunnableConfig, options?: { limit?: number; before?: RunnableConfig; filter?: Record<string, any> }): AsyncGenerator<CheckpointTuple> {
    const { limit, before, filter } = options ?? {};
    let remainingLimit = limit;
    
    try {
      // 读取 sessionsDir 下的所有子目录（每个子目录代表一个 thread_id）
      const threadDirs = fs.readdirSync(this.sessionsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      // 按线程ID排序（倒序）
      const sortedThreadDirs = threadDirs.sort((a, b) => b.localeCompare(a));
      
      for (const threadId of sortedThreadDirs) {
        if (remainingLimit !== undefined && remainingLimit <= 0) {
          break;
        }
        
        // 检查是否匹配 config 中的 thread_id 过滤条件
        if (config.configurable?.thread_id && config.configurable.thread_id !== threadId) {
          continue;
        }
        
        const fileConfig = { configurable: { thread_id: threadId } };
        const tuple = await this.getTuple(fileConfig);
        
        if (tuple) {
          // 检查 before 条件
          if (before && before.configurable?.checkpoint_id) {
            const currentCheckpointId = tuple.checkpoint.id;
            if (currentCheckpointId >= before.configurable.checkpoint_id) {
              continue;
            }
          }
          
          // 检查 filter 条件
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
    } catch (error) {
      console.error('Error listing checkpoints:', error);
      return;
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
   * 删除与特定线程ID关联的所有检查点和写入操作
   * @param threadId - 要删除的线程ID
   */
  async deleteThread(threadId: string): Promise<void> {
    const filePath = path.join(this.sessionsDir, threadId, 'session.json');
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error deleting checkpoint for thread ${threadId}:`, error);
      throw error;
    }
  }
}