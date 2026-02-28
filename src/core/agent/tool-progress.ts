/**
 * 工具进度回调注册中心
 *
 * 中文名称：工具进度回调注册中心
 *
 * 提供全局单例回调机制，用于在工具执行过程中实时传递输出数据。
 * 工具通过 emitToolProgress 发射进度数据，
 * 中间件在每次工具调用前后通过 setToolProgressCallback 注册/注销回调。
 *
 * @module tool-progress
 */

/**
 * 进度回调函数类型
 * @param toolName - 当前执行的工具名称
 * @param chunk - 本次输出的数据片段
 */
export type ToolProgressCallback = (toolName: string, chunk: string) => void;

let currentCallback: ToolProgressCallback | null = null;

/**
 * 设置（或清除）当前活跃的进度回调函数。
 * 通常由 SessionOutputCaptureMiddleware 在每次工具调用前后调用。
 *
 * @param callback - 要注册的回调函数，传 null 表示清除
 */
export function setToolProgressCallback(callback: ToolProgressCallback | null): void {
  currentCallback = callback;
}

/**
 * 向当前活跃的回调发射一段工具输出。
 * 如果当前没有注册回调，则为空操作。
 *
 * @param toolName - 当前执行的工具名称
 * @param chunk - 本次输出的数据片段
 */
export function emitToolProgress(toolName: string, chunk: string): void {
  currentCallback?.(toolName, chunk);
}
