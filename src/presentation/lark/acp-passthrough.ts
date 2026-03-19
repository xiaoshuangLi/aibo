/**
 * ACP 直传模式状态管理
 *
 * 独立模块以避免 interactive.ts ↔ commander.ts 的循环依赖。
 *
 * 实际状态存储在 @/shared/acp-session（可被 tools/ 层和 presentation/ 层共享访问）。
 * 本模块保留原始接口作为别名，以维持向后兼容性。
 */

export type { AcpSessionState as AcpPassthroughState } from '@/shared/acp-session';

export {
  getAcpSessionState as getAcpPassthroughState,
  setAcpSessionState as setAcpPassthroughState,
  clearAcpSessionState as clearAcpPassthroughState,
} from '@/shared/acp-session';
