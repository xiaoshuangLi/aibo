import * as fs from 'fs';
import * as path from 'path';
import { createConsoleThreadId } from '@/core/utils';

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

// ==================== AI监控元数据接口定义 ====================

/**
 * 模型调用详情
 */
interface ModelCallDetail {
  model_name: string;
  model_version: string;
  provider: string;
  engine: string;
  call_id: string;
  sequence_number: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  input_content: string;
  output_content: string;
  finish_reason: string;
  tool_calls: ToolCallDetail[];
  metadata: Record<string, any>;
}

/**
 * 工具调用详情
 */
interface ToolCallDetail {
  tool_name: string;
  tool_id: string;
  arguments: Record<string, any>;
  status: 'pending' | 'success' | 'error';
  result?: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
}

/**
 * 子任务代理调用详情
 */
interface SubagentCallDetail {
  agent_type: string;
  agent_name: string;
  agent_description: string;
  call_id: string;
  sequence_number: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  input_parameters: Record<string, any>;
  output_result: string;
  status: 'pending' | 'completed' | 'failed';
  associated_model_call: string;
  metadata: Record<string, any>;
}

/**
 * 性能汇总
 */
interface PerformanceSummary {
  total_model_calls: number;
  total_subagent_calls: number;
  total_tool_calls: number;
  successful_tool_calls: number;
  failed_tool_calls: number;
  total_duration_ms: number;
}

/**
 * AI监控元数据记录
 */
interface AITelemetryRecord {
  // 基本标识
  request_id: string;
  trace_id: string;
  parent_id: string | null;
  span_id: string;
  
  // 时间信息
  start_time: string;
  end_time: string;
  latency_ms: number;
  first_token_time: string | null;
  time_to_first_token_ms: number | null;
  
  // 输入输出
  inputs: {
    prompt: string;
    messages: any[];
    parameters: Record<string, any>;
    context: Record<string, any>;
  };
  outputs: {
    response: string;
    generated_text: string;
    choices: Array<{
      message: { role: string; content: string };
      finish_reason: string;
    }>;
    metadata: Record<string, any>;
  };
  
  // 模型信息
  model_info: {
    model_name: string;
    model_version: string;
    provider: string;
    engine: string;
  };
  
  // 代理信息
  agent_info: {
    agent_type: string;
    agent_name: string;
    agent_version: string;
    role: string;
  };
  
  // Token使用情况
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_token_details: Record<string, number>;
    output_token_details: Record<string, number>;
  };
  
  // 成本信息
  cost_info: {
    input_cost: number;
    output_cost: number;
    total_cost: number;
    input_cost_details: Record<string, number>;
    output_cost_details: Record<string, number>;
  };
  
  // 元数据
  tags: string[];
  metadata: {
    user_id: string;
    session_id: string;
    conversation_id: string;
    application: string;
    environment: string;
    version: string;
    // 添加token使用量的格式化显示
    token_usage_formatted: {
      input_tokens_formatted: string;
      output_tokens_formatted: string;
      total_tokens_formatted: string;
    };
    // 添加按模型分组的token使用量
    model_token_usage: Record<string, {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    }>;
  };
  
  // 错误信息
  error: {
    has_error: boolean;
    error_message: string;
    error_code: string;
    error_type: string;
    stack_trace: string;
  };
  
  // 会话信息
  session_info: {
    session_id: string;
    conversation_id: string;
    user_id: string;
    tenant_id: string;
    project_id: string;
  };
  
  // 性能指标
  performance_metrics: {
    throughput_tokens_per_second: number;
    quality_score: number | null;
    relevance_score: number | null;
    safety_score: number | null;
    coherence_score: number | null;
  };
  
  // 追踪信息
  dotted_order: string;
  sequence_number: number;
  
  // 详细维度信息（新增）
  model_calls: ModelCallDetail[];
  subagent_calls: SubagentCallDetail[];
  tool_calls: ToolCallDetail[];
  performance_summary: PerformanceSummary;
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

  /**
   * 获取当前会话的AI监控元数据
   * @returns AITelemetryRecord对象，如果无法获取则返回null
   */
  public getCurrentSessionMetadata(): AITelemetryRecord | null {
    try {
      const currentSessionId = this.getCurrentSessionId();
      
      // 获取session.json文件路径
      const sessionFilePath = this.getSessionFilePath(currentSessionId);
      
      // 检查session.json是否存在
      if (!fs.existsSync(sessionFilePath)) {
        console.warn(`Session file not found for current session ${currentSessionId}: ${sessionFilePath}`);
        return null;
      }
      
      // 读取session.json内容
      const sessionContent = fs.readFileSync(sessionFilePath, 'utf-8');
      const sessionData = JSON.parse(sessionContent);
      
      // 提取AI监控元数据
      return this.extractAIMonitoringMetadata(sessionData, currentSessionId);
    } catch (error) {
      console.error('❌ Failed to get current session metadata:', error);
      return null;
    }
  }

  // ==================== AI监控元数据生成功能 ====================

  /**
   * 为指定会话生成AI监控元数据
   */
  public generateSessionMetadata(sessionId: string): boolean {
    try {
      // 获取session.json文件路径
      const sessionFilePath = this.getSessionFilePath(sessionId);
      
      // 检查session.json是否存在
      if (!fs.existsSync(sessionFilePath)) {
        console.warn(`Session file not found for session ${sessionId}: ${sessionFilePath}`);
        return false;
      }
      
      // 读取session.json内容
      const sessionContent = fs.readFileSync(sessionFilePath, 'utf-8');
      const sessionData = JSON.parse(sessionContent);
      
      // 提取AI监控元数据
      const metadata = this.extractAIMonitoringMetadata(sessionData, sessionId);
      
      // 保存到metadata.json
      const metadataFilePath = path.join(this.sessionsDir, sessionId, 'metadata.json');
      const sessionDir = path.dirname(metadataFilePath);
      
      // 确保会话目录存在
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // 原子写入metadata.json
      const tempPath = `${metadataFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(metadata, null, 2), 'utf-8');
      fs.renameSync(tempPath, metadataFilePath);
      
      // 打印token使用量信息
      this.printTokenUsageInfo(metadata);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to generate metadata for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 打印token使用量信息到控制台
   */
  private printTokenUsageInfo(metadata: AITelemetryRecord): void {
    const formattedInfo = this.formatTokenUsageInfo(metadata);
    console.log(formattedInfo);
  }

  /**
   * 生成格式化的token使用量信息
   * @param metadata AI监控元数据记录
   * @returns 格式化的token使用量信息字符串
   */
  public formatTokenUsageInfo(metadata: AITelemetryRecord): string {
    const formatted = metadata.metadata.token_usage_formatted;
    const modelUsage = metadata.metadata.model_token_usage;
    
    let result = '\n📊 **AI监控元数据 - Token使用量统计**\n';
    result += '=========================================\n';
    
    // 总体token使用量
    result += `📈 总体Token使用量:\n`;
    result += `   📥 输入Tokens: ${formatted.input_tokens_formatted} (${metadata.token_usage.input_tokens.toLocaleString()} tokens)\n`;
    result += `   📤 输出Tokens: ${formatted.output_tokens_formatted} (${metadata.token_usage.output_tokens.toLocaleString()} tokens)\n`;
    result += `   📊 总计Tokens: ${formatted.total_tokens_formatted} (${metadata.token_usage.total_tokens.toLocaleString()} tokens)\n`;
    
    // 按模型分组的token使用量
    if (modelUsage && Object.keys(modelUsage).length > 0) {
      result += `\n🤖 按模型分组的Token使用量:\n`;
      for (const [modelKey, usage] of Object.entries(modelUsage)) {
        const inputFormatted = this.formatTokenCount(usage.input_tokens);
        const outputFormatted = this.formatTokenCount(usage.output_tokens);
        const totalFormatted = this.formatTokenCount(usage.total_tokens);
        
        result += `   🧠 ${modelKey}:\n`;
        result += `      📥 输入: ${inputFormatted} (${usage.input_tokens.toLocaleString()} tokens)\n`;
        result += `      📤 输出: ${outputFormatted} (${usage.output_tokens.toLocaleString()} tokens)\n`;
        result += `      📊 总计: ${totalFormatted} (${usage.total_tokens.toLocaleString()} tokens)\n`;
      }
    }
    
    result += '=========================================\n';
    return result;
  }

  /**
   * 为所有会话生成元数据文件
   */
  public generateAllSessionsMetadata(): void {
    const sessionIds = this.getAllSessionIds();
    let successCount = 0;
    let failureCount = 0;
    
    for (const sessionId of sessionIds) {
      if (this.generateSessionMetadata(sessionId)) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    console.log(`Generated metadata for ${successCount} sessions, failed for ${failureCount} sessions`);
  }

  /**
   * 格式化token数量为K（千）或M（百万）单位
   */
  private formatTokenCount(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(2)}K`;
    } else {
      return tokens.toString();
    }
  }

  /**
   * 按模型分组统计token使用量
   */
  private groupTokenUsageByModel(modelCalls: ModelCallDetail[]): Record<string, { input_tokens: number; output_tokens: number; total_tokens: number }> {
    const modelTokenUsage: Record<string, { input_tokens: number; output_tokens: number; total_tokens: number }> = {};
    
    for (const call of modelCalls) {
      const modelKey = `${call.provider}/${call.model_name}`;
      if (!modelTokenUsage[modelKey]) {
        modelTokenUsage[modelKey] = {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0
        };
      }
      modelTokenUsage[modelKey].input_tokens += call.input_tokens;
      modelTokenUsage[modelKey].output_tokens += call.output_tokens;
      modelTokenUsage[modelKey].total_tokens += call.total_tokens;
    }
    
    return modelTokenUsage;
  }

  /**
   * 从会话数据中提取AI监控元数据
   */
  private extractAIMonitoringMetadata(sessionData: any, sessionId: string): AITelemetryRecord {
    // 提取基本信息
    const checkpoint = sessionData.checkpoint || {};
    const startTime = checkpoint.ts || new Date().toISOString();
    const endTime = sessionData.lastUpdated || startTime;
    
    // 初始化聚合数据
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let lastResponse = '';
    let hasError = false;
    let errorMessage = '';
    
    // 存储详细的模型调用、子任务代理和工具调用信息
    const modelCalls: ModelCallDetail[] = [];
    const subagentCalls: SubagentCallDetail[] = [];
    const toolCalls: ToolCallDetail[] = [];
    
    // 分析消息以提取详细信息
    if (checkpoint.channel_values?.messages) {
      const messages = checkpoint.channel_values.messages;
      let messageIndex = 0;
      
      for (const message of messages) {
        messageIndex++;
        
        if (message.type === 'constructor' && message.id?.[2] === 'AIMessage') {
          const kwargs = message.kwargs || {};
          
          // 提取模型信息
          const modelName = kwargs.response_metadata?.model_name || 'unknown';
          const modelProvider = kwargs.response_metadata?.model_provider || 'unknown';
          const modelVersion = kwargs.response_metadata?.model_version || '';
          
          // 提取token使用情况
          let inputTokens = 0;
          let outputTokens = 0;
          if (kwargs.usage_metadata) {
            inputTokens = kwargs.usage_metadata.input_tokens || 0;
            outputTokens = kwargs.usage_metadata.output_tokens || 0;
          } else if (kwargs.response_metadata?.tokenUsage) {
            inputTokens = kwargs.response_metadata.tokenUsage.promptTokens || 0;
            outputTokens = kwargs.response_metadata.tokenUsage.completionTokens || 0;
          }
          
          // 使用最后一次调用的input_tokens作为总输入Token数
          // 原因：在多步骤Agent工作流中，每次LLM调用的input_tokens包含完整的上下文历史
          // （系统提示 + 所有之前的消息），如果对所有调用求和会导致重复计数
          // 最后一次调用的input_tokens代表最终对话上下文大小，更准确地反映实际使用量
          if (inputTokens > 0) {
            totalInputTokens = inputTokens;
          }
          totalOutputTokens += outputTokens;
          
          // 提取响应内容
          const responseContent = kwargs.content || '';
          if (responseContent) {
            lastResponse = responseContent;
          }
          
          // 检查是否有错误
          if (kwargs.response_metadata?.finish_reason === 'error') {
            hasError = true;
            errorMessage = responseContent || 'Unknown error';
          }
          
          // 提取工具调用
          const extractedToolCalls: ToolCallDetail[] = [];
          if (kwargs.tool_calls) {
            for (const toolCall of kwargs.tool_calls) {
              const toolCallDetail: ToolCallDetail = {
                tool_name: toolCall.name || 'unknown',
                tool_id: toolCall.id || `tool-${Date.now()}-${Math.random()}`,
                arguments: toolCall.args || {},
                status: 'pending', // 状态会在后续的ToolMessage中更新
                start_time: startTime,
                end_time: startTime,
                duration_ms: 0
              };
              extractedToolCalls.push(toolCallDetail);
              toolCalls.push(toolCallDetail);
            }
          }
          
          // 创建模型调用详情
          const modelCall: ModelCallDetail = {
            model_name: modelName,
            model_version: modelVersion,
            provider: modelProvider,
            engine: '',
            call_id: kwargs.id || `model-call-${messageIndex}`,
            sequence_number: messageIndex,
            start_time: startTime,
            end_time: startTime,
            duration_ms: 0,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
            cost: 0, // 成本计算需要模型定价信息
            input_content: this.extractInputContent(messages, messageIndex - 1),
            output_content: responseContent,
            finish_reason: kwargs.response_metadata?.finish_reason || 'stop',
            tool_calls: extractedToolCalls,
            metadata: {
              message_id: kwargs.id,
              additional_kwargs: kwargs.additional_kwargs || {}
            }
          };
          
          modelCalls.push(modelCall);
          
          // 尝试识别子任务代理
          const subagentInfo = this.extractSubagentInfo(kwargs, messageIndex);
          if (subagentInfo) {
            subagentCalls.push(subagentInfo);
          }
        }
        else if (message.type === 'constructor' && message.id?.[2] === 'ToolMessage') {
          const kwargs = message.kwargs || {};
          
          // 更新对应的工具调用状态
          const toolCallId = kwargs.tool_call_id;
          const toolCallIndex = toolCalls.findIndex(tc => tc.tool_id === toolCallId);
          if (toolCallIndex >= 0) {
            toolCalls[toolCallIndex].status = kwargs.status === 'success' ? 'success' : 'error';
            toolCalls[toolCallIndex].result = kwargs.content || '';
            toolCalls[toolCallIndex].end_time = new Date().toISOString();
            toolCalls[toolCallIndex].duration_ms = 0; // 需要更精确的时间
          }
        }
      }
    }
    
    // 按模型分组统计token使用量
    const modelTokenUsage = this.groupTokenUsageByModel(modelCalls);
    
    // 构建完整的AI监控记录
    const metadata: AITelemetryRecord = {
      request_id: sessionId,
      trace_id: sessionId,
      parent_id: null,
      span_id: sessionId,
      start_time: startTime,
      end_time: endTime,
      latency_ms: 0,
      first_token_time: null,
      time_to_first_token_ms: null,
      inputs: {
        prompt: '',
        messages: [],
        parameters: {},
        context: {}
      },
      outputs: {
        response: lastResponse,
        generated_text: lastResponse,
        choices: [{
          message: {
            role: 'assistant',
            content: lastResponse
          },
          finish_reason: hasError ? 'error' : 'stop'
        }],
        metadata: {}
      },
      model_info: {
        model_name: modelCalls.length > 0 ? modelCalls[0].model_name : 'unknown',
        model_version: modelCalls.length > 0 ? modelCalls[0].model_version : '',
        provider: modelCalls.length > 0 ? modelCalls[0].provider : 'unknown',
        engine: ''
      },
      agent_info: {
        agent_type: 'main',
        agent_name: 'aibo-main-agent',
        agent_version: '1.0.0',
        role: 'main'
      },
      token_usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
        input_token_details: {},
        output_token_details: {}
      },
      cost_info: {
        input_cost: 0,
        output_cost: 0,
        total_cost: totalCost,
        input_cost_details: {},
        output_cost_details: {}
      },
      tags: ['aibo', 'langgraph'],
      metadata: {
        user_id: 'user-default',
        session_id: sessionId,
        conversation_id: sessionId,
        application: 'aibo',
        environment: 'development',
        version: '1.0.0',
        // 添加token使用量的格式化显示
        token_usage_formatted: {
          input_tokens_formatted: this.formatTokenCount(totalInputTokens),
          output_tokens_formatted: this.formatTokenCount(totalOutputTokens),
          total_tokens_formatted: this.formatTokenCount(totalInputTokens + totalOutputTokens)
        },
        // 添加按模型分组的token使用量
        model_token_usage: modelTokenUsage
      },
      error: {
        has_error: hasError,
        error_message: errorMessage,
        error_code: '',
        error_type: '',
        stack_trace: ''
      },
      session_info: {
        session_id: sessionId,
        conversation_id: sessionId,
        user_id: 'user-default',
        tenant_id: 'tenant-default',
        project_id: 'project-aibo'
      },
      performance_metrics: {
        throughput_tokens_per_second: 0,
        quality_score: null,
        relevance_score: null,
        safety_score: null,
        coherence_score: null
      },
      dotted_order: `${startTime}-${sessionId}`,
      sequence_number: 1,
      
      // 新增的详细维度信息
      model_calls: modelCalls,
      subagent_calls: subagentCalls,
      tool_calls: toolCalls,
      performance_summary: {
        total_model_calls: modelCalls.length,
        total_subagent_calls: subagentCalls.length,
        total_tool_calls: toolCalls.length,
        successful_tool_calls: toolCalls.filter(tc => tc.status === 'success').length,
        failed_tool_calls: toolCalls.filter(tc => tc.status === 'error').length,
        total_duration_ms: 0
      }
    };
    
    return metadata;
  }
  
  /**
   * 提取输入内容（前一条消息）
   */
  private extractInputContent(messages: any[], currentIndex: number): string {
    if (currentIndex >= 0 && currentIndex < messages.length) {
      const prevMessage = messages[currentIndex];
      if (prevMessage.type === 'constructor' && prevMessage.id?.[2] === 'HumanMessage') {
        return prevMessage.kwargs?.content || '';
      }
    }
    return '';
  }
  
  /**
   * 从AIMessage中提取子任务代理信息
   */
  private extractSubagentInfo(kwargs: any, messageIndex: number): SubagentCallDetail | null {
    // 检查是否包含子任务代理相关的工具调用或内容
    const content = kwargs.content || '';
    const toolCalls = kwargs.tool_calls || [];
    
    // 如果有write-subagent-todos或write_subagent_todos工具调用，这通常表示子任务代理
    const writeTodosTool = toolCalls.find((tc: any) => 
      tc.name === 'write-subagent-todos' || tc.name === 'write_subagent_todos'
    );
    if (writeTodosTool) {
      // 标准化工具名称为连字符格式
      const standardizedToolName = writeTodosTool.name.replace(/_/g, '-');
      return {
        agent_type: 'task_manager',
        agent_name: standardizedToolName,
        agent_description: 'Advanced task management with specialized subagent type assignments',
        call_id: `subagent-${messageIndex}`,
        sequence_number: messageIndex,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: 0,
        input_parameters: writeTodosTool.args || {},
        output_result: content,
        status: 'completed',
        associated_model_call: kwargs.id || `model-call-${messageIndex}`,
        metadata: {
          tool_call_id: writeTodosTool.id,
          message_id: kwargs.id
        }
      };
    }
    
    // 检查内容中是否包含子任务代理相关信息
    if (content.includes('subagent') || content.includes('子代理') || content.includes('子任务')) {
      // 这可能是一个子任务代理调用，但需要更多上下文来确定具体类型
      return {
        agent_type: 'generic_subagent',
        agent_name: 'generic-subagent',
        agent_description: 'Generic subagent detected from content analysis',
        call_id: `subagent-${messageIndex}`,
        sequence_number: messageIndex,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: 0,
        input_parameters: { content_analysis: content.substring(0, 100) + '...' },
        output_result: content,
        status: 'completed',
        associated_model_call: kwargs.id || `model-call-${messageIndex}`,
        metadata: {
          message_id: kwargs.id,
          detection_method: 'content_analysis'
        }
      };
    }
    
    return null;
  }

  /**
   * 获取当前会话的token使用量统计信息
   * @returns 格式化的token使用量信息字符串，如果当前会话不存在则返回null
   */
  public getCurrentSessionTokenUsageInfo(): string | null {
    try {
      const currentSessionId = this.getCurrentSessionId();
      
      // 获取session.json文件路径
      const sessionFilePath = this.getSessionFilePath(currentSessionId);
      
      // 检查session.json是否存在
      if (!fs.existsSync(sessionFilePath)) {
        console.warn(`Session file not found for current session ${currentSessionId}: ${sessionFilePath}`);
        return null;
      }
      
      // 读取session.json内容
      const sessionContent = fs.readFileSync(sessionFilePath, 'utf-8');
      const sessionData = JSON.parse(sessionContent);
      
      // 提取AI监控元数据
      const metadata = this.extractAIMonitoringMetadata(sessionData, currentSessionId);
      
      // 使用现有的formatTokenUsageInfo方法生成格式化的统计信息
      return this.formatTokenUsageInfo(metadata);
    } catch (error) {
      console.error('❌ Failed to get current session token usage info:', error);
      return null;
    }
  }
}