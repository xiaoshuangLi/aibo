export interface AcpProgressSink {
  logToolProgress(toolName: string, chunk: string): void;
}

/**
 * Incrementally consumes acpx --format json output (one JSON-RPC message per
 * line) and turns useful ACP updates into concise user-visible progress.
 */
export class AcpJsonStreamParser {
  private buffer = '';
  private sawJsonEvent = false;
  private sawStdoutData = false;
  private assistantText = '';
  private readonly toolTitles = new Map<string, string>();
  private readonly toolsWithTerminalDelta = new Set<string>();

  constructor(
    private readonly sink: AcpProgressSink,
    private readonly displayName: string,
  ) {}

  push(chunk: string | Buffer): void {
    const text = chunk.toString();
    if (!text) return;
    this.sawStdoutData = true;
    this.buffer += text;

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      this.consumeLine(line);
    }
  }

  /** Return the assistant response while retaining compatibility with text mocks/older acpx. */
  finish(bufferedStdout: string): string {
    if (!this.sawStdoutData && bufferedStdout) {
      this.push(bufferedStdout.endsWith('\n') ? bufferedStdout : `${bufferedStdout}\n`);
    } else if (this.buffer.trim()) {
      this.consumeLine(this.buffer);
      this.buffer = '';
    }

    if (this.sawJsonEvent) {
      return this.assistantText.trim() || '✅ ACP 任务已完成。';
    }
    return bufferedStdout || '(empty)';
  }

  private consumeLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: any;
    try {
      message = JSON.parse(trimmed);
    } catch {
      // Preserve progress support for older acpx versions and plain-text output.
      this.sink.logToolProgress(`${this.displayName} 输出`, `${line}\n`);
      return;
    }

    this.sawJsonEvent = true;
    if (message?.method === 'session/update') {
      this.consumeSessionUpdate(message.params?.update);
    } else if (message?.method === 'session/request_permission') {
      const reason = message.params?._meta?.codex?.params?.reason;
      this.emit('权限请求', reason || '正在处理工具权限请求');
    }
  }

  private consumeSessionUpdate(update: any): void {
    if (!update || typeof update !== 'object') return;
    const kind = update.sessionUpdate;
    const toolCallId = typeof update.toolCallId === 'string' ? update.toolCallId : undefined;

    if (kind === 'agent_message_chunk') {
      const text = this.contentText(update.content);
      if (text) {
        this.assistantText += text;
        this.sink.logToolProgress(`${this.displayName} 回复`, text);
      }
      return;
    }

    if (kind === 'tool_call' && toolCallId) {
      const title = this.cleanText(update.title) || update.kind || '工具调用';
      this.toolTitles.set(toolCallId, title);
      this.emit('工具', `▶ ${title}`);
      return;
    }

    if (kind !== 'tool_call_update' || !toolCallId) return;

    const delta = update?._meta?.terminal_output_delta?.data;
    if (typeof delta === 'string' && delta) {
      this.toolsWithTerminalDelta.add(toolCallId);
      this.sink.logToolProgress(`${this.displayName} 工具输出`, delta);
    }

    if (update.status === 'completed') {
      if (!this.toolsWithTerminalDelta.has(toolCallId)) {
        const formatted = update.rawOutput?.formatted_output;
        if (typeof formatted === 'string' && formatted.trim()) {
          this.sink.logToolProgress(`${this.displayName} 工具输出`, formatted);
        }
      }
      this.emit('工具', `✓ ${this.toolTitles.get(toolCallId) || '工具调用完成'}`);
    } else if (update.status === 'failed') {
      this.emit('工具', `✗ ${this.toolTitles.get(toolCallId) || '工具调用失败'}`);
    }
  }

  private emit(section: string, text: string): void {
    this.sink.logToolProgress(`${this.displayName} ${section}`, `${text}\n`);
  }

  private contentText(content: any): string {
    if (typeof content === 'string') return content;
    return typeof content?.text === 'string' ? content.text : '';
  }

  private cleanText(value: unknown): string {
    if (typeof value !== 'string') return '';
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 500 ? `${normalized.slice(0, 500)}…` : normalized;
  }
}
