import * as fs from 'fs';
import * as path from 'path';

/**
 * 会话自动摘要模块
 *
 * 当会话消息数量超过 windowSize 时，自动对旧消息进行摘要压缩，
 * 并将摘要存入 {sessionDir}/summary.json，以供下一轮对话注入上下文。
 *
 * 摘要压缩逻辑（参考 Claude Code 的 context compaction 设计）：
 *   1. 从 session.json 读取 checkpoint.channel_values.messages
 *   2. 若消息数 > windowSize，调用 LLM 对前 (N - windowSize/2) 条消息生成摘要
 *   3. 将摘要写入 summary.json，并将 session.json 中的旧消息替换为摘要消息
 *
 * @module summarizer
 */

/** 用于生成摘要的 LLM 调用接口（与 LangChain BaseChatModel 兼容） */
export interface SummarizerModel {
  invoke(messages: Array<{ role: string; content: string }>): Promise<{ content: string | unknown }>;
}

/** LangChain 序列化消息格式 */
interface SerializedMessage {
  type: string;
  id?: string[];
  kwargs?: {
    content?: string | Array<{ type: string; text?: string }>;
    response_metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/** 保存的摘要结构 */
export interface ConversationSummary {
  /** 摘要生成时间 */
  createdAt: string;
  /** 摘要文本 */
  summaryText: string;
  /** 被压缩的消息数量 */
  compressedMessageCount: number;
  /** 压缩后保留的最近消息数量 */
  retainedMessageCount: number;
}

/**
 * 从 LangChain 序列化消息中提取可读的文本内容
 */
function extractMessageText(message: SerializedMessage): string | null {
  if (message.type !== 'constructor') return null;
  const role = message.id?.[2];
  if (role !== 'HumanMessage' && role !== 'AIMessage') return null;
  const content = message.kwargs?.content;
  if (!content) return null;
  if (typeof content === 'string') return `${role === 'HumanMessage' ? 'User' : 'Assistant'}: ${content}`;
  // content 可能是 content-block 数组
  if (Array.isArray(content)) {
    const text = content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join(' ');
    return text ? `${role === 'HumanMessage' ? 'User' : 'Assistant'}: ${text}` : null;
  }
  return null;
}

/**
 * 会话自动摘要器
 *
 * 在每轮对话结束后调用 `maybeSummarize()`，当消息数超过阈值时自动压缩上下文。
 */
export class ConversationSummarizer {
  private readonly sessionsDir: string;
  private readonly windowSize: number;

  /**
   * @param sessionsDir - 会话数据根目录（通常为 .data/sessions）
   * @param windowSize  - 保留的最近消息轮数（超出后触发摘要压缩）
   */
  constructor(
    sessionsDir: string = path.join(process.cwd(), '.data', 'sessions'),
    windowSize: number = 50
  ) {
    this.sessionsDir = sessionsDir;
    this.windowSize = windowSize;
  }

  /**
   * 获取指定会话的摘要文件路径
   */
  private getSummaryPath(threadId: string): string {
    return path.join(this.sessionsDir, threadId, 'summary.json');
  }

  /**
   * 获取指定会话的 session.json 文件路径
   */
  private getSessionPath(threadId: string): string {
    return path.join(this.sessionsDir, threadId, 'session.json');
  }

  /**
   * 加载指定会话已保存的摘要（如不存在则返回 null）
   */
  loadSummary(threadId: string): ConversationSummary | null {
    const summaryPath = this.getSummaryPath(threadId);
    try {
      if (!fs.existsSync(summaryPath)) return null;
      const content = fs.readFileSync(summaryPath, 'utf-8');
      return JSON.parse(content) as ConversationSummary;
    } catch {
      return null;
    }
  }

  /**
   * 检查 session.json 中的消息数量是否超过阈值，并在需要时执行摘要压缩。
   *
   * @param threadId - 会话线程 ID
   * @param model    - LangChain BaseChatModel 实例（用于生成摘要）
   * @returns 生成的摘要文本，若未触发压缩则返回 null
   */
  async maybeSummarize(threadId: string, model: SummarizerModel): Promise<string | null> {
    const sessionPath = this.getSessionPath(threadId);
    if (!fs.existsSync(sessionPath)) return null;

    let sessionData: any;
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch {
      return null;
    }

    const messages: SerializedMessage[] = sessionData?.checkpoint?.channel_values?.messages ?? [];
    if (messages.length <= this.windowSize) return null;

    // 计算需要压缩的消息范围
    const retainCount = Math.floor(this.windowSize / 2);
    const toCompress = messages.slice(0, messages.length - retainCount);
    const toRetain = messages.slice(messages.length - retainCount);

    // 提取可读对话文本
    const conversationLines = toCompress
      .map(extractMessageText)
      .filter(Boolean) as string[];

    if (conversationLines.length === 0) return null;

    const summaryText = await this.generateSummary(conversationLines, model);
    if (!summaryText) return null;

    // 构造摘要消息（注入回检查点）
    const summaryMessage = {
      type: 'constructor',
      id: ['langchain_core', 'messages', 'AIMessage'],
      kwargs: {
        content: `[Conversation Summary – auto-generated]\n${summaryText}`,
        response_metadata: {}
      }
    };

    // 更新 session.json：用摘要消息 + 保留消息替换旧消息
    sessionData.checkpoint.channel_values.messages = [summaryMessage, ...toRetain];
    sessionData.lastUpdated = new Date().toISOString();

    try {
      const tempPath = `${sessionPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(sessionData, null, 2), 'utf-8');
      fs.renameSync(tempPath, sessionPath);
    } catch (err) {
      console.warn(`[Summarizer] Failed to write compacted session for ${threadId}:`, err);
      return null;
    }

    // 持久化摘要
    const summary: ConversationSummary = {
      createdAt: new Date().toISOString(),
      summaryText,
      compressedMessageCount: toCompress.length,
      retainedMessageCount: toRetain.length
    };

    try {
      const summaryPath = this.getSummaryPath(threadId);
      const tempPath = `${summaryPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(summary, null, 2), 'utf-8');
      fs.renameSync(tempPath, summaryPath);
    } catch (err) {
      console.warn(`[Summarizer] Failed to write summary for ${threadId}:`, err);
    }

    return summaryText;
  }

  /**
   * 调用 LLM 对对话历史生成简洁摘要
   */
  private async generateSummary(conversationLines: string[], model: SummarizerModel): Promise<string | null> {
    const conversationText = conversationLines.join('\n');
    try {
      const response = await model.invoke([
        {
          role: 'user',
          content:
            'Please summarize the following conversation concisely. ' +
            'Preserve key decisions, facts, user preferences, and any context ' +
            'that would be important for continuing the conversation. ' +
            'Output only the summary, without any preamble.\n\n' +
            conversationText
        }
      ]);
      const content = response?.content;
      if (typeof content === 'string') return content.trim();
      return null;
    } catch (err) {
      console.warn('[Summarizer] Failed to generate summary:', err);
      return null;
    }
  }
}
