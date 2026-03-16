/**
 * ACP 直传模式状态管理
 *
 * 独立模块以避免 interactive.ts ↔ commander.ts 的循环依赖。
 */

/**
 * ACP 直传模式配置
 */
export interface AcpPassthroughState {
  /** ACP 代理名称 (codex / claude / gemini / cursor / copilot 等) */
  agent: string;
  /** 可选的命名会话 (-s flag) */
  sessionName?: string;
  /** 可选的工作目录 (--cwd flag) */
  cwd?: string;
}

let acpPassthroughState: AcpPassthroughState | null = null;

/** 获取当前 ACP 直传状态 */
export function getAcpPassthroughState(): AcpPassthroughState | null {
  return acpPassthroughState;
}

/** 设置 ACP 直传状态 */
export function setAcpPassthroughState(state: AcpPassthroughState | null): void {
  acpPassthroughState = state;
}

/** 清除 ACP 直传状态 */
export function clearAcpPassthroughState(): void {
  acpPassthroughState = null;
}
