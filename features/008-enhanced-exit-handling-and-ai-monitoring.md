# 增强的退出处理和人工智能监控

## 📋 Specification (规格说明)

### 🎯 用户故事
作为一名用户，我希望拥有健壮的退出处理机制，能够正确清理所有资源并自动生成全面的人工智能活动元数据文件，以确保系统可靠性并获得详细的监控数据用于分析。此外，我希望强化主进程与子代理之间的角色分离，以维护系统完整性并防止跨职责违规。

### ✅ 验收标准
- [x] `/exit` 命令正确清理所有资源并生成元数据文件
- [x] 双击Ctrl+C确认正确调用优雅关闭流程
- [x] 会话元数据文件包含完整的人工智能活动监控信息
- [x] 子代理无法访问 `write-subagent-todos` 工具
- [x] 所有代理严格遵守其职责边界
- [x] `.data` 目录受到保护，防止意外修改
- [x] 所有测试通过，代码覆盖率≥85%
- [x] Jest测试框架配置正确处理ESM（ECMAScript模块）模块

## 🏗️ Technical Design (技术设计)

### 核心组件

#### 1. 增强的退出处理
- **`handleExitCommand` 函数** (`src/presentation/console/command-handlers.ts`)
  - 支持 `session.rl.close()`（用于测试兼容性）和 `session.end()`（用于实际执行）
  - 确保在调用 `process.exit(0)` 之前完成所有清理工作
- **`setupExitHandlers` 函数** (`src/presentation/console/interactive-mode.ts`)
  - 在双击Ctrl+C确认时调用 `gracefulShutdown(session)`
  - 确保信号处理器正确清理语音录制状态并结束会话

#### 2. 人工智能监控元数据生成
- **`Session.end()` 方法** (`src/core/agent/session.ts`)
  - 在会话结束时自动调用 `SessionManager.generateSessionMetadata()`
  - 生成包含会话ID、时间戳和人工智能活动摘要的元数据文件
- **`SessionManager` 类** (`src/infrastructure/session/session-manager.ts`)
  - 新增人工智能监控元数据接口定义
  - 实现 `generateSessionMetadata()` 方法，将监控数据写入 `.data/sessions/{threadId}/metadata.json`

#### 3. 强化的子代理角色分离
- **代理系统提示更新** (`agents/*.md`)
  - 为编码器、协调员、研究员和验证员代理添加严格的职责边界描述
  - 明确禁止跨职责操作（例如，编码器代理不得执行研究任务）
- **工具过滤机制** (`src/core/agent/agent-factory.ts`)
  - 在创建子代理时过滤掉 `write-subagent-todos` 工具
  - 确保只有主进程代理才能执行任务分解和委派
- **子代理提示模板优化** (`src/infrastructure/prompt/subagent-prompt-template.ts`)
  - 从子代理中移除"多步骤任务编排和委派"能力描述
  - 强调子代理专注于特定执行任务

#### 4. 安全性和测试改进
- **安全文件系统后端** (`src/infrastructure/filesystem/safe-filesystem-backend.ts`)
  - 将 `.data` 目录添加到受保护目录列表中，防止意外修改
- **Jest测试框架配置更新** (`jest.config.ts`)
  - 将 `uuid` 添加到 `transformIgnorePatterns` 中，解决ESM（ECMAScript模块）模块转换问题
- **会话管理器测试增强** (`__tests__/infrastructure/session/session-manager.test.ts`)
  - 为人工智能监控元数据功能添加测试覆盖

## 📝 Implementation Plan (实施计划)

### 步骤1：修复退出命令资源清理
- 修改 `handleExitCommand` 以支持测试兼容性和正确的会话结束
- 更新 `setupExitHandlers` 以在双击Ctrl+C时调用 `gracefulShutdown`

### 步骤2：实现人工智能监控元数据生成
- 在 `Session.end()` 中添加自动元数据生成功能
- 在 `SessionManager` 中实现 `generateSessionMetadata` 方法
- 定义人工智能监控元数据接口

### 步骤3：强化子代理角色分离
- 使用严格的职责边界更新代理系统提示
- 实现工具过滤，防止子代理访问 `write-subagent-todos`
- 优化子代理提示模板以移除编排能力

### 步骤4：增强安全性和测试
- 在安全文件系统后端中保护 `.data` 目录
- 更新Jest测试框架配置以支持ESM（ECMAScript模块）模块
- 为新功能添加全面的测试覆盖

### 步骤5：验证和文档化
- 确保所有测试通过，覆盖率≥85%
- 创建全面的功能文档
- 验证向后兼容性

## 🚀 Usage Guide (使用指南)

### 退出命令
```bash
/exit        # 安全退出并生成元数据
Ctrl+C       # 中断当前操作
Ctrl+C (双击) # 立即退出并生成元数据
```

### 元数据文件位置
会话元数据文件自动生成于：
```
.data/sessions/{session-id}/metadata.json
```

### 子代理职责
- **编码器代理**：仅处理代码编写、编辑、调试和优化相关任务
- **协调员代理**：仅处理任务分解、策略规划、子任务委派和结果整合
- **研究员代理**：仅处理网络研究、最佳实践调研和深入分析任务
- **验证员代理**：仅处理代码验证、质量保证和测试相关任务

## 📊 Impact Analysis (影响分析)

### 文件变更

#### 新增功能：
- `src/core/agent/session.ts`：会话结束时自动生成元数据
- `src/infrastructure/session/session-manager.ts`：人工智能监控元数据接口和实现

#### 缺陷修复：
- `src/presentation/console/command-handlers.ts`：修复 `/exit` 命令资源清理问题
- `src/presentation/console/interactive-mode.ts`：修复双击Ctrl+C退出逻辑

#### 安全性增强：
- `src/infrastructure/filesystem/safe-filesystem-backend.ts`：保护 `.data` 目录
- `src/core/agent/agent-factory.ts`：过滤子代理工具

#### 文档更新：
- `agents/*.md`：更新代理职责描述
- `src/infrastructure/prompt/subagent-prompt-template.ts`：优化子代理提示模板

#### 测试改进：
- `jest.config.ts`：更新ESM模块配置
- `__tests__/infrastructure/session/session-manager.test.ts`：添加元数据测试

### 向后兼容性

#### API兼容性：
- 所有现有API保持不变

#### 行为兼容性：
- 退出行为更加健壮，但用户体验保持一致

#### 数据格式兼容性：
- 新的元数据文件不影响现有功能