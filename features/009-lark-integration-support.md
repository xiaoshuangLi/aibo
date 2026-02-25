# 飞书集成支持

## 📋 Specification (规格说明)

**一句话描述**: 实现飞书(Lark)平台集成支持，允许用户在飞书环境中与AIBO AI助手进行交互，并支持多种交互模式的灵活切换

**解决的问题**: 
- 缺乏在企业协作平台（飞书）中直接使用AI助手的能力
- 需要在不同部署环境（控制台 vs 飞书）之间灵活切换交互模式
- 需要安全的飞书应用认证和消息处理机制
- 需要保持原有的内部命令功能在飞书环境中正常工作

**核心价值**: 
- 扩展AIBO的使用场景到企业协作平台，提升工作效率
- 提供统一的交互架构，支持多平台部署
- 保持完整的功能一致性，无论在控制台还是飞书环境中都能使用相同的命令和功能
- 通过环境变量配置实现安全的飞书集成

---

## 🏗️ Technical Design (技术设计)

### 📐 架构概览
采用适配器模式实现多平台支持：
- **Adapter 接口**: 定义统一的输入/输出接口
- **DefaultAdapter**: 控制台的基础类实现
- **LarkAdapter**: 飞书平台的特定实现，继承自 DefaultAdapter
- **Session**: 会话管理器，通过 Adapter 执行所有 I/O 操作

### ⚙️ 交互模式决策流程
1. **命令行参数优先级最高**: `--interaction=lark|console` 或 `--interactive`
2. **环境变量次之**: `AIBO_LARK_MODE=true`（向后兼容）或 `AIBO_INTERACTION=lark|console`
3. **默认值**: `console`

### 🧩 飞书集成架构
- **认证机制**: 使用 App ID 和 App Secret 进行 OAuth2 认证
- **消息接收**: 通过 WebSocket 长连接接收用户消息
- **消息发送**: 通过 REST API 发送 AI 响应
- **事件处理**: 注册各种输出事件处理器（AI 响应、工具调用、系统消息等）

### 🔒 错误处理与安全
- **环境变量验证**: 启动时验证必需的飞书环境变量
- **异常处理**: 全局错误处理确保进程稳定性
- **信号处理**: 正确处理 SIGINT 和 SIGTERM 信号以实现优雅关闭

---

## 📝 Implementation Plan (实施计划)

### ✅ 已完成任务
✅ **核心架构实现**
- [x] 实现了 LarkAdapter 适配器类
- [x] 实现了飞书交互模式主入口点
- [x] 实现了飞书内部命令处理器
- [x] 更新了主函数以支持多模式启动

✅ **配置系统增强**  
- [x] 支持命令行参数解析
- [x] 支持多级环境变量配置
- [x] 更新了 .env.example 文件

✅ **测试覆盖**
- [x] 编写了 LarkAdapter 的单元测试
- [x] 编写了交互模式的单元测试
- [x] 编写了命令处理器的单元测试
- [x] 更新了配置相关的测试

✅ **依赖管理**
- [x] 添加了 @larksuiteoapi/node-sdk 依赖
- [x] 更新了 package.json 脚本

✅ **文档更新**
- [x] 创建了此功能文档
- [x] 更新了相关功能文档的引用

---

## 🚀 Usage Guide (使用指南)

### 📦 快速开始
1. **获取飞书应用凭证**:
   - 在飞书开放平台创建企业自建应用
   - 获取 App ID 和 App Secret
   - 配置机器人权限和事件订阅

2. **配置环境变量**:
   ```bash
   # .env 文件
   AIBO_INTERACTION=lark
   AIBO_LARK_APP_ID=your-app-id
   AIBO_LARK_APP_SECRET=your-app-secret
   ```

3. **启动应用程序**:
   ```bash
   npm run dev:lark
   # 或
   AIBO_INTERACTION=lark npm run dev
   ```

4. **Use in Lark**:
   - @mention the bot in Lark group chat or private chat
   - Send messages to interact with the AI assistant
   - Use internal commands to control behavior

### Advanced Configuration
- **Custom Receive ID**: Set `AIBO_LARK_RECEIVE_ID` to specify default message recipient
- **Output Mode**: Enable verbose output with `AIBO_VERBOSE_OUTPUT=true`
- **Model Selection**: Specify AI model with `AIBO_MODEL_NAME`

### Troubleshooting
- **Authentication Failure**: Check if App ID and App Secret are correct
- **No Message Response**: Confirm Lark app has correct event subscription configured
- **Startup Error**: Check console logs and ensure all required environment variables are set

---

## 📊 Impact Analysis (影响分析)

### Positive Impacts
- ✅ **Expanded Use Cases**: Supports enterprise collaboration platform integration
- ✅ **Enhanced User Experience**: Direct AI assistant usage in work environment
- ✅ **Architecture Improvement**: Unified IO abstraction layer facilitates future platform extensions
- ✅ **Configuration Flexibility**: Multiple ways to configure interaction mode

### Potential Risks
- ⚠️ **Increased Dependencies**: Introduced new third-party dependency (@larksuiteoapi/node-sdk)
- ⚠️ **Configuration Complexity**: Added more environment variable configuration options
- ⚠️ **Maintenance Cost**: Requires maintaining additional platform-specific code

### Compatibility
- ✅ **Backward Compatible**: Existing console mode is completely unaffected
- ✅ **Configuration Compatible**: Supports old AIBO_LARK_MODE environment variable
- ✅ **API Compatible**: Core functionality interfaces remain unchanged

---