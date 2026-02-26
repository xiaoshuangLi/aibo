// 专门为LSP工具测试设计的丰富TypeScript文件
// 包含类型错误、复杂类型和明确的补全上下文

interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

interface Product {
  id: number;
  title: string;
  price: number;
  category: 'electronics' | 'clothing' | 'books';
}

class DatabaseService {
  private users: User[] = [];
  private products: Product[] = [];
  
  constructor() {
    // 初始化一些数据
    this.users.push({ id: 1, name: "Alice", email: "alice@example.com", isActive: true });
    this.products.push({ id: 101, title: "Laptop", price: 999.99, category: "electronics" });
  }
  
  /**
   * 根据ID获取用户
   * @param userId - 用户ID
   * @returns User对象或undefined
   */
  getUserById(userId: number): User | undefined {
    return this.users.find(user => user.id === userId);
  }
  
  /**
   * 获取所有活跃用户
   * @returns 活跃用户数组
   */
  getActiveUsers(): User[] {
    return this.users.filter(user => user.isActive);
  }
  
  /**
   * 添加新产品
   * @param product - 产品对象
   */
  addProduct(product: Product): void {
    this.products.push(product);
  }
}

// 创建服务实例
const dbService = new DatabaseService();

// 测试悬停信息 - 这里会有丰富的类型信息
const currentUser = dbService.getUserById(1);

// 测试补全 - 在这个对象上应该有丰富的补全选项
if (currentUser) {
  console.log(currentUser.name);
  console.log(currentUser.email);
}

// 以下代码故意包含类型错误，用于测试诊断功能
const invalidUser: User = {
  id: "not a number", // 错误：应该是number类型
  name: 123,         // 错误：应该是string类型  
  email: true,       // 错误：应该是string类型
  isActive: "yes",   // 错误：应该是boolean类型
  missingProperty: "extra" // 错误：User接口中不存在这个属性
};

// 另一个类型错误示例
const result = dbService.getUserById("1"); // 错误：参数应该是number，不是string

// 测试方法调用的补全
const activeUsers = dbService.getActiveUsers();
if (activeUsers.length > 0) {
  const firstUser = activeUsers[0];
  // 在这里应该能获得firstUser的属性补全
  console.log(firstUser.);
}

// 测试泛型和复杂类型的悬停信息
type ApiResponse<T> = {
  data: T;
  status: 'success' | 'error';
  message?: string;
};

const userResponse: ApiResponse<User[]> = {
  data: dbService.getActiveUsers(),
  status: 'success'
};

// 在userResponse上应该有丰富的悬停信息
console.log(userResponse.data);

// 导出一些内容供外部使用
export { DatabaseService, User, Product, dbService };