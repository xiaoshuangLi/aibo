# 腾讯云WSA网络搜索功能

## 📋 功能概述 (Feature Overview)

### 🎯 一句话描述
默认集成腾讯云WSA（联网搜索API）网络搜索功能，提供基于搜狗搜索全网公开资源的智能搜索增强服务，支持自然语言触发的网络搜索。

### 💡 业务价值
- **解决的问题**: 现有的Web搜索工具依赖Puppeteer浏览器自动化，可能受到反爬虫机制限制，且需要维护复杂的浏览器环境。
- **带来的价值**: 提供稳定、可靠的官方网络搜索API，基于搜狗搜索的全网公开资源，提供高质量的搜索结果，包括标题、摘要、URL、发布时间等结构化信息。
- **目标用户**: 所有使用AIBO的开发者和用户，特别是需要可靠网络搜索功能的用户。

### 🔗 相关背景
- **相关 Issue/PR**: 基于用户需求，扩展腾讯云服务集成
- **设计文档**: 基于腾讯云官方WSA API文档和Node.js SDK最佳实践
- **依赖项**: 
  - 腾讯云账号和WSA服务权限
  - `tencentcloud-sdk-nodejs` SDK（已包含在项目中）
  - 与现有ASR服务共享相同的认证配置

---

## 🏗️ 技术设计 (Technical Design)

### 📐 架构概览
腾讯云WSA功能作为独立的工具模块集成到AIBO系统中，通过以下组件协同工作：
1. **WSA客户端模块**: 封装腾讯云WSA SDK，处理认证和API调用
2. **LangChain工具模块**: 将WSA搜索功能暴露给AI Agent使用
3. **配置管理模块**: 复用现有的腾讯云认证配置
4. **错误处理模块**: 统一处理搜索过程中的错误和异常

### ⚙️ 核心实现
#### 主要组件/模块
- **TencentWSA类**: 核心WSA功能封装，提供搜索方法
- **createTencentWSA工厂函数**: 创建配置化的WSA实例
- **TencentWsaSearch LangChain工具**: 集成到AI Agent工具链中

#### 关键技术决策
- **复用现有认证**: 与ASR服务共享相同的腾讯云认证配置，减少配置复杂度
- **统一错误处理**: 采用与现有工具一致的错误处理模式
- **默认启用**: 无需额外配置，只要配置了腾讯云认证信息即可使用
- **多模式搜索**: 支持自然检索结果、多模态VR结果和混合结果三种模式

#### 数据流/状态管理
1. AI Agent或用户触发网络搜索请求
2. 系统检查腾讯云认证配置是否有效
3. 创建WSA客户端实例并执行搜索请求
4. 接收搜索结果并格式化为结构化JSON
5. 返回搜索结果供AI Agent或用户使用

### 🧩 API 变更
#### 新增 API
```typescript
// TencentWSA配置接口
interface TencentWsaConfig {
  appId: string;
  secretId: string;
  secretKey: string;
  region?: string;
}

// TencentWSA核心类
class TencentWSA {
  constructor(config: Partial<TencentWsaConfig> = {});
  canSearch(): boolean;
  search(query: string, mode: number = 0): Promise<any>;
}

// 工厂函数
function createTencentWSA(config: Partial<TencentWsaConfig> = {}): TencentWSA;

// LangChain工具
const tencentWsaSearchTool: Tool;
```

#### 修改的 API
- **src/config.ts**: 更新注释以反映WSA支持
- **.env.example**: 更新环境变量说明
- **README.md**: 更新环境变量说明

---

## 🚀 使用指南 (Usage Guide)

### 📦 安装/配置
无需额外安装，此功能已集成到AIBO中。只需确保已正确配置腾讯云认证信息：

```env
# Tencent Cloud ASR and WSA Configuration
TENCENTCLOUD_APP_ID=your-app-id          # Required for voice input and web search
TENCENTCLOUD_SECRET_ID=your-secret-id    # Required for voice input and web search
TENCENTCLOUD_SECRET_KEY=your-secret-key  # Required for voice input and web search
TENCENTCLOUD_REGION=ap-shanghai          # Optional, default: ap-shanghai
```

### 🎮 基本使用
1. **AI Agent自动使用**: 
   - 当AI Agent需要网络搜索时，会自动选择使用TencentWsaSearch工具
   - 无需用户手动指定，系统会根据上下文自动选择最合适的搜索工具

2. **直接调用**:
   ```typescript
   import { createTencentWSA } from './utils/tencent-wsa';
   
   const wsa = createTencentWSA();
   const results = await wsa.search('JavaScript tutorial');
   ```

### 🏆 高级用法
#### 搜索模式
- **Mode 0 (默认)**: 自然检索结果
- **Mode 1**: 多模态VR结果
- **Mode 2**: 混合结果（多模态VR结果+自然检索结果）

#### 结果格式
搜索结果包含以下字段：
- `title`: 结果标题
- `date`: 内容发布时间
- `url`: 内容发布源URL
- `passage`: 标准摘要
- `content`: 动态摘要（尊享版字段）
- `site`: 网站名称
- `score`: 相关性得分（0-1）
- `images`: 图片列表
- `favicon`: 网站图标链接

### ⚠️ 注意事项
- 需要腾讯云WSA服务权限，可能需要申请开通
- 搜索结果质量和数量可能受账户类型影响（标准版/尊享版/精简版）
- API调用可能有频率限制，建议合理使用