/**
 * LSP消息解析器
 * 
 * 中文名称：LSP消息解析器
 * 
 * 预期行为：
 * - 正确解析LSP的Content-Length协议
 * - 处理分块的流数据
 * - 提供完整的JSON-RPC消息解析
 * - 处理各种边界情况和错误
 * 
 * 行为分支：
 * 1. 完整消息：单次接收完整的消息头和内容
 * 2. 分块消息：多次接收，需要缓冲和重组
 * 3. 头部解析：正确解析Content-Length头部
 * 4. 内容解析：正确解析JSON内容
 * 5. 错误处理：处理格式错误、超长消息等异常情况
 * 
 * @class LspMessageParser
 */
import { EventEmitter } from 'events';

/**
 * LSP消息解析器事件
 */
interface LspMessageParserEvents {
  'message': (message: any) => void;
  'error': (error: Error) => void;
}

/**
 * LSP消息解析器类
 * 
 * 中文名称：LSP消息解析器类
 * 
 * 负责解析LSP服务器的输出流
 */
export class LspMessageParser extends EventEmitter {
  private buffer: Buffer = Buffer.alloc(0);
  private contentLength: number | null = null;
  private readonly maxMessageSize: number = 10 * 1024 * 1024; // 10MB

  /**
   * 接收数据块
   * @param chunk 数据块
   */
  receiveData(chunk: Buffer): void {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    } catch (error) {
      this.emit('error', new Error(`Failed to process LSP message: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 处理缓冲区
   */
  private processBuffer(): void {
    while (this.buffer.length > 0) {
      if (this.contentLength === null) {
        // 需要解析头部
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
          // 头部不完整，等待更多数据
          break;
        }

        const header = this.buffer.slice(0, headerEnd).toString('utf8');
        this.contentLength = this.parseContentLength(header);
        
        if (this.contentLength === null) {
          throw new Error('Invalid Content-Length header');
        }

        if (this.contentLength > this.maxMessageSize) {
          throw new Error(`Message too large: ${this.contentLength} bytes`);
        }

        // 移除头部（包括\r\n\r\n）
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      if (this.contentLength !== null) {
        if (this.buffer.length < this.contentLength) {
          // 内容不完整，等待更多数据
          break;
        }

        // 提取完整的消息内容
        const content = this.buffer.slice(0, this.contentLength);
        const message = this.parseJsonContent(content);
        
        this.emit('message', message);

        // 移除已处理的内容
        this.buffer = this.buffer.slice(this.contentLength);
        this.contentLength = null;
      }
    }
  }

  /**
   * 解析Content-Length头部
   * @param header 头部字符串
   * @returns Content-Length值
   */
  private parseContentLength(header: string): number | null {
    const lines = header.split('\r\n');
    for (const line of lines) {
      if (line.startsWith('Content-Length:')) {
        const lengthStr = line.substring('Content-Length:'.length).trim();
        const length = parseInt(lengthStr, 10);
        if (isNaN(length) || length < 0) {
          return null;
        }
        return length;
      }
    }
    return null;
  }

  /**
   * 解析JSON内容
   * @param content 内容缓冲区
   * @returns 解析后的JSON对象
   */
  private parseJsonContent(content: Buffer): any {
    try {
      const jsonString = content.toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Failed to parse JSON content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清理缓冲区
   */
  clear(): void {
    this.buffer = Buffer.alloc(0);
    this.contentLength = null;
  }
}