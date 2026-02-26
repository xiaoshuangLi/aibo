// LSP 功能测试文件
import { EventEmitter } from 'events';

/**
 * 用户接口定义
 */
interface User {
  id: number;
  name: string;
  email: string;
  isActive?: boolean;
}

/**
 * 配置选项类型
 */
type ConfigOptions = {
  timeout: number;
  retries: number;
  debug: boolean;
};

/**
 * 数据库连接类
 */
class DatabaseConnection {
  private connection: string;
  private isConnected: boolean = false;

  constructor(private config: ConfigOptions) {
    this.connection = `db://${config.timeout}ms`;
  }

  /**
   * 连接到数据库
   */
  async connect(): Promise<boolean> {
    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, this.config.timeout));
    this.isConnected = true;
    return this.isConnected;
  }

  /**
   * 断开数据库连接
   */
  disconnect(): void {
    this.isConnected = false;
  }

  /**
   * 获取用户信息
   */
  async getUser(id: number): Promise<User | null> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    // 模拟数据库查询
    const users: User[] = [
      { id: 1, name: 'Alice', email: 'alice@example.com', isActive: true },
      { id: 2, name: 'Bob', email: 'bob@example.com', isActive: false },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', isActive: true }
    ];
    
    return users.find(user => user.id === id) || null;
  }
}

/**
 * 服务管理器类
 */
class ServiceManager extends EventEmitter {
  private db: DatabaseConnection;
  private services: Map<string, any> = new Map();

  constructor(config: ConfigOptions) {
    super();
    this.db = new DatabaseConnection(config);
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    const connected = await this.db.connect();
    if (connected) {
      this.emit('initialized', { status: 'success' });
    }
  }

  /**
   * 注册新服务
   */
  registerService(name: string, service: any): void {
    this.services.set(name, service);
  }

  /**
   * 获取服务
   */
  getService<T>(name: string): T | undefined {
    return this.services.get(name);
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(userId: number): Promise<User | null> {
    return await this.db.getUser(userId);
  }
}

/**
 * 工具函数
 */
const utils = {
  /**
   * 格式化用户信息
   */
  formatUser(user: User): string {
    return `${user.name} <${user.email}> (${user.isActive ? 'active' : 'inactive'})`;
  },

  /**
   * 验证邮箱格式
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
};

// 导出所有内容
export { User, ConfigOptions, DatabaseConnection, ServiceManager, utils };