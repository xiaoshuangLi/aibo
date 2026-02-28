import { SessionManager } from '@/infrastructure/session';

/**
 * 知识项接口定义
 */
export interface KnowledgeItem {
  /** 知识内容 */
  content: string;
  /** 知识标题 */
  title: string;
  /** 关键字数组 */
  keywords: string[];
}

/**
 * 知识摘要接口定义
 */
export interface KnowledgeSummary {
  /** 知识标题 */
  title: string;
  /** 关键字数组 */
  keywords: string[];
}

/**
 * 添加知识项到当前会话的知识库
 * @param content - 知识内容
 * @param title - 知识标题
 * @param keywords - 关键字数组
 * @returns void
 */
export function addKnowledge(content: string, title: string, keywords: string[]): void {
  const sessionManager = SessionManager.getInstance();
  sessionManager.addKnowledgeToCurrentSession(content, title, keywords);
}

/**
 * 获取当前会话的所有完整知识项
 * @returns 所有知识项的数组
 */
export function getAllKnowledge(): KnowledgeItem[] {
  const sessionManager = SessionManager.getInstance();
  return sessionManager.getAllKnowledgeFromCurrentSession();
}

/**
 * 获取当前会话的知识项摘要信息
 * @returns 知识摘要数组
 */
export function getKnowledgeSummaries(): KnowledgeSummary[] {
  const sessionManager = SessionManager.getInstance();
  return sessionManager.getKnowledgeSummariesFromCurrentSession();
}

/**
 * 在当前会话中搜索知识项
 * @param query - 搜索查询字符串
 * @returns 匹配的知识项数组
 */
export function searchKnowledge(query: string): KnowledgeItem[] {
  const sessionManager = SessionManager.getInstance();
  return sessionManager.searchKnowledgeInCurrentSession(query);
}

/**
 * 清除当前会话的知识库
 */
export function clearKnowledge(): void {
  const sessionManager = SessionManager.getInstance();
  sessionManager.clearCurrentSessionKnowledge();
}

/**
 * 获取会话管理器实例（用于高级操作）
 * @returns SessionManager 实例
 */
export function getSessionManager(): SessionManager {
  return SessionManager.getInstance();
}