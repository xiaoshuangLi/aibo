/**
 * I/O 通道接口 - 解耦终端依赖的核心抽象
 * 
 * 中文名称：I/O 通道接口
 * 
 * 定义了与用户交互的抽象接口，支持多种输出方式和输入方式。
 * 所有核心逻辑都应该通过此接口进行 I/O 操作，而不是直接使用终端 API。
 * 
 * @module io-channel
 */

/**
 * 输出事件类型
 */
export type OutputEventType = 
  | 'aiResponse'           // AI 响应内容
  | 'toolCall'            // 工具调用
  | 'toolResult'          // 工具执行结果  
  | 'thinkingProcess'      // 思考过程
  | 'systemMessage'       // 系统消息
  | 'errorMessage'        // 错误消息
  | 'hintMessage'         // 提示消息
  | 'streamStart'         // 流开始
  | 'streamChunk'         // 流数据块
  | 'streamEnd'           // 流结束
  | 'userInputRequest'    // 用户输入请求
  | 'sessionStart'        // 会话开始
  | 'sessionEnd'          // 会话结束
  | 'commandExecuted'     // 命令执行完成
  | 'rawText'             // 原始文本输出

/**
 * 输出事件数据接口
 */
export interface OutputEvent {
  type: OutputEventType;
  data: any;
  timestamp: number;
}

/**
 * I/O 通道接口
 * 
 * 所有 I/O 操作都应该通过此接口进行，实现真正的解耦。
 */
export interface IOChannel {
  /**
   * 发送输出事件并等待所有异步监听器完成
   * @param event 输出事件
   * @returns Promise<void> - 当所有监听器完成时解析
   */
  emit(event: OutputEvent): Promise<void>;
  
  /**
   * 请求用户输入
   * @param prompt 提示信息
   */
  requestUserInput(prompt?: string): void;
  
  /**
   * 设置中断信号
   * @param signal AbortSignal
   */
  setAbortSignal(signal: AbortSignal): void;
  
  /**
   * 注册事件监听器
   * @param eventType 事件类型
   * @param listener 监听器函数
   */
  on(eventType: OutputEventType, listener: (data: any) => void): void;
  
  /**
   * 移除事件监听器
   * @param eventType 事件类型
   * @param listener 监听器函数
   */
  off(eventType: OutputEventType, listener: (data: any) => void): void;
  
  /**
   * 销毁 I/O 通道
   */
  destroy(): void;
}

/**
 * 默认的 I/O 通道实现（空实现，需要具体适配器实现）
 */
export class DefaultIOChannel implements IOChannel {
  private listeners: Map<OutputEventType, Set<(data: any) => void>> = new Map();
  
  async emit(event: OutputEvent): Promise<void> {
    const { type, data } = event;
    const eventListeners = this.listeners.get(type);
    if (eventListeners) {
      // 收集所有监听器的 Promise
      const promises: Promise<any>[] = [];
      eventListeners.forEach(listener => {
        const result = listener(data);
        // 如果监听器返回 Promise，则等待它完成
        if (result != null && typeof (result as any).then === 'function') {
          promises.push(result as Promise<any>);
        }
      });
      
      // 等待所有异步监听器完成
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    }
  }
  
  async requestUserInput(prompt?: string): Promise<void> {
    // 默认实现抛出错误，具体适配器需要重写
    throw new Error('requestUserInput not implemented');
  }
  
  setAbortSignal(signal: AbortSignal): void {
    // 默认空实现
  }
  
  on(eventType: OutputEventType, listener: (data: any) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }
  
  off(eventType: OutputEventType, listener: (data: any) => void): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }
  
  destroy(): void {
    this.listeners.clear();
  }
}