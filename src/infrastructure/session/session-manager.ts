import * as fs from 'fs';
import * as path from 'path';
import { createConsoleThreadId } from '@/core/utils/interactive-logic';

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
 * 统一会话管理器
 * 负责管理会话ID持久化和会话知识库持久化
 */
export class SessionManager {
  private static instance: SessionManager | null = null;
  private readonly sessionsDir: string;
  private currentSessionId: string | null = null;
  private sessionKnowledgeStore: Map<string, KnowledgeItem[]>;

  private constructor(
    sessionsDir: string = path.join(process.cwd(), '.data', 'sessions')
  ) {
    this.sessionsDir = sessionsDir;
    this.sessionKnowledgeStore = new Map<string, KnowledgeItem[]>();
    
    // 确保 .data 目录存在
    const dataDir = path.dirname(this.sessionsDir);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 确保 sessions 目录存在
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    
    // 初始化时加载当前会话ID
    this.loadCurrentSession();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SessionManager {
    if (SessionManager.instance === null) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * 获取元数据文件路径
   */
  private getMetadataFile(): string {
    return path.join(path.dirname(this.sessionsDir), 'metadata.json');
  }

  /**
   * 加载当前会话ID
   */
  private loadCurrentSession(): void {
    try {
      const metadataFile = this.getMetadataFile();
      if (fs.existsSync(metadataFile)) {
        const content = fs.readFileSync(metadataFile, 'utf-8');
        const metadata = JSON.parse(content);
        if (metadata.currentSessionId) {
          this.currentSessionId = metadata.currentSessionId;
        }
      }
    } catch (error) {
      console.warn('Failed to load current session ID from metadata:', error);
      this.currentSessionId = null;
    }
  }

  /**
   * 保存当前会话ID到元数据文件
   */
  private saveCurrentSession(): void {
    try {
      if (this.currentSessionId) {
        const metadataFile = this.getMetadataFile();
        const metadataDir = path.dirname(metadataFile);
        
        // 确保 .data 目录存在
        if (!fs.existsSync(metadataDir)) {
          fs.mkdirSync(metadataDir, { recursive: true });
        }
        
        const metadata = {
          currentSessionId: this.currentSessionId,
          lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error('Failed to save current session ID to metadata:', error);
    }
  }

  /**
   * 获取当前会话ID
   * 如果没有当前会话，则创建一个新的
   */
  public getCurrentSessionId(): string {
    if (!this.currentSessionId) {
      this.createSession();
    }
    return this.currentSessionId!;
  }

  /**
   * 创建新的会话
   */
  public createSession(): string {
    const newSessionId = createConsoleThreadId();
    this.currentSessionId = newSessionId;
    this.saveCurrentSession();
    return newSessionId;
  }

  /**
   * 切换到指定会话
   */
  public switchToSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.saveCurrentSession();
  }

  /**
   * 清除当前会话（创建新会话）
   */
  public clearCurrentSession(): string {
    return this.createSession();
  }

  /**
   * 获取所有可用的会话ID
   */
  public getAllSessionIds(): string[] {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      const sessionDirs = files.filter(file => 
        file.startsWith('session-') && !file.startsWith('.')
      );
      return sessionDirs;
    } catch (error) {
      console.error('Failed to get all session IDs:', error);
      return [];
    }
  }

  // ==================== 知识库管理功能 ====================

  /**
   * 获取指定会话的会话文件路径 (session.json)
   */
  private getSessionFilePath(sessionId: string): string {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    return path.join(sessionDir, 'session.json');
  }

  /**
   * 获取指定会话的知识库文件路径 (knowledge.json)
   */
  private getKnowledgeStorePath(sessionId: string): string {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    return path.join(sessionDir, 'knowledge.json');
  }

  /**
   * 从文件加载指定会话的知识库
   */
  private loadKnowledgeStore(sessionId: string): KnowledgeItem[] {
    const storePath = this.getKnowledgeStorePath(sessionId);
    
    try {
      if (fs.existsSync(storePath)) {
        const fileContent = fs.readFileSync(storePath, 'utf-8');
        const knowledgeStore = JSON.parse(fileContent);
        
        // 验证数据结构
        if (Array.isArray(knowledgeStore)) {
          return knowledgeStore;
        }
      }
    } catch (error) {
      console.warn(`Failed to load knowledge store for session ${sessionId}:`, error);
    }
    
    return [];
  }

  /**
   * 保存指定会话的知识库到文件
   */
  private saveKnowledgeStore(sessionId: string, knowledgeStore: KnowledgeItem[]): void {
    const storePath = this.getKnowledgeStorePath(sessionId);
    const sessionDir = path.dirname(storePath);
    
    try {
      // 确保会话知识库目录存在
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // 原子写入
      const tempPath = `${storePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(knowledgeStore, null, 2), 'utf-8');
      fs.renameSync(tempPath, storePath);
    } catch (error) {
      console.error(`Failed to save knowledge store for session ${sessionId}:`, error);
    }
  }

  /**
   * 获取指定会话的知识库（懒加载）
   */
  private getKnowledgeStoreForSession(sessionId: string): KnowledgeItem[] {
    if (!this.sessionKnowledgeStore.has(sessionId)) {
      const loadedStore = this.loadKnowledgeStore(sessionId);
      this.sessionKnowledgeStore.set(sessionId, loadedStore);
    }
    return this.sessionKnowledgeStore.get(sessionId)!;
  }

  /**
   * 添加知识项到指定会话的知识库
   */
  public addKnowledge(sessionId: string, content: string, title: string, keywords: string[]): void {
    const knowledgeStore = this.getKnowledgeStoreForSession(sessionId);
    
    const newKnowledgeItem: KnowledgeItem = {
      content,
      title,
      keywords
    };
    
    knowledgeStore.push(newKnowledgeItem);
    this.sessionKnowledgeStore.set(sessionId, knowledgeStore);
    this.saveKnowledgeStore(sessionId, knowledgeStore);
  }

  /**
   * 获取指定会话的所有完整知识项
   */
  public getAllKnowledge(sessionId: string): KnowledgeItem[] {
    const knowledgeStore = this.getKnowledgeStoreForSession(sessionId);
    return [...knowledgeStore];
  }

  /**
   * 获取指定会话的知识项摘要信息
   */
  public getKnowledgeSummaries(sessionId: string): KnowledgeSummary[] {
    const knowledgeStore = this.getKnowledgeStoreForSession(sessionId);
    return knowledgeStore.map(item => ({
      title: item.title,
      keywords: [...item.keywords]
    }));
  }

  /**
   * 在指定会话中搜索知识项
   */
  public searchKnowledge(sessionId: string, query: string): KnowledgeItem[] {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return [];
    }
    
    const searchTerm = query.trim().toLowerCase();
    const knowledgeStore = this.getKnowledgeStoreForSession(sessionId);
    
    return knowledgeStore.filter(item => 
      item.title.toLowerCase().includes(searchTerm) ||
      item.keywords.some(keyword => 
        typeof keyword === 'string' && keyword.toLowerCase().includes(searchTerm)
      )
    );
  }

  /**
   * 清除指定会话的知识库
   */
  public clearKnowledge(sessionId: string): void {
    this.sessionKnowledgeStore.set(sessionId, []);
    this.saveKnowledgeStore(sessionId, []);
  }

  /**
   * 获取所有知识库会话ID列表
   */
  public getAllKnowledgeSessionIds(): string[] {
    // 知识库和会话ID现在是相同的，因为都在同一个目录结构下
    return this.getAllSessionIds();
  }

  // ==================== 便捷方法（使用当前会话） ====================

  /**
   * 添加知识项到当前会话的知识库
   */
  public addKnowledgeToCurrentSession(content: string, title: string, keywords: string[]): void {
    const currentSessionId = this.getCurrentSessionId();
    this.addKnowledge(currentSessionId, content, title, keywords);
  }

  /**
   * 获取当前会话的所有完整知识项
   */
  public getAllKnowledgeFromCurrentSession(): KnowledgeItem[] {
    const currentSessionId = this.getCurrentSessionId();
    return this.getAllKnowledge(currentSessionId);
  }

  /**
   * 获取当前会话的知识项摘要信息
   */
  public getKnowledgeSummariesFromCurrentSession(): KnowledgeSummary[] {
    const currentSessionId = this.getCurrentSessionId();
    return this.getKnowledgeSummaries(currentSessionId);
  }

  /**
   * 在当前会话中搜索知识项
   */
  public searchKnowledgeInCurrentSession(query: string): KnowledgeItem[] {
    const currentSessionId = this.getCurrentSessionId();
    return this.searchKnowledge(currentSessionId, query);
  }

  /**
   * 清除当前会话的知识库
   */
  public clearCurrentSessionKnowledge(): void {
    const currentSessionId = this.getCurrentSessionId();
    this.clearKnowledge(currentSessionId);
  }
}