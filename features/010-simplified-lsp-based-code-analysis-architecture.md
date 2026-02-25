# 简化的基于LSP的代码分析架构

## 📋 Specification (规格说明)

### 🎯 用户故事
作为开发者，我想要一个简化的、基于LSP（Language Server Protocol）的代码分析架构，移除复杂的自定义分析组件，直接利用成熟的LSP服务器提供准确的代码分析功能，以便我能获得更可靠、更高效的代码理解能力，同时减少维护成本和复杂性。

### ✅ 验收标准
- [ ] 所有自定义代码分析组件（AST抽象层、缓存管理器、上下文选择器、依赖分析器、符号表、Tree-sitter解析器等）已被完全移除
- [ ] 实现完整的LSP客户端，能够启动、通信和管理LSP服务器进程
- [ ] 提供完整的LSP工具集，包括启动服务器、打开/关闭文档、获取信息、补全、代码操作、诊断等功能
- [ ] 所有LSP功能都有完整的单元测试覆盖，包括边界情况和集成测试
- [ ] 整体测试覆盖率保持在80%以上
- [ ] 保持与现有代码库的完全兼容性，不破坏任何现有功能
- [ ] 提供详细的中文文档和使用指南

### ⚙️ 技术约束
- **技术栈要求**: TypeScript 5+, Node.js 18+, Jest for testing
- **LSP服务器要求**: 支持标准LSP协议的任何语言服务器
- **性能要求**: LSP通信响应时间<200ms，服务器启动时间<5秒
- **安全要求**: 所有文件系统操作必须通过SafeFilesystemBackend进行，防止路径遍历攻击
- **兼容性要求**: 支持所有现代TypeScript/JavaScript项目结构

---

## 🏗️ Technical Design (技术设计)

### 📐 架构概述
简化的代码分析架构完全基于LSP（Language Server Protocol）实现，移除了所有自定义的代码分析组件。核心组件包括：

1. **LSP客户端**: 负责与LSP服务器建立连接、发送请求和处理响应
2. **LSP工具集**: 提供完整的LSP功能接口，包括服务器管理、文档操作、代码分析等
3. **安全文件系统后端**: 确保所有文件操作的安全性
4. **测试套件**: 完整的单元测试和集成测试覆盖

### 🔄 主要变更
- **移除的组件**: 
  - AST抽象层 (ast-abstract-layer.ts)
  - 缓存管理器 (cache-manager.ts)
  - 上下文选择器 (context-selector.ts)
  - 依赖分析器 (dependency-analyzer.ts)
  - 符号表 (symbol-table.ts)
  - Tree-sitter解析器 (tree-sitter-parser.ts)
  - 相关的测试文件

- **新增的组件**:
  - LSP客户端核心实现 (lsp-client.ts)
  - LSP工具集 (lsp-tools.ts)
  - LSP日志记录 (lsp-logging.ts)
  - 相关的测试文件和覆盖测试

### 🧩 依赖关系
- 移除了对Tree-sitter和自定义解析器的依赖
- 依赖标准的LSP服务器实现
- 保持与现有工具框架的兼容性

---

## 📝 Implementation Plan (实施计划)

### 阶段1: 组件移除
- [x] 移除所有自定义代码分析组件源文件
- [x] 移除相关测试文件
- [x] 更新工具索引和配置文件

### 阶段2: LSP客户端实现
- [x] 实现LSP客户端核心功能
- [x] 实现服务器启动、通信和管理
- [x] 实现完整的LSP消息处理
- [x] 添加错误处理和日志记录

### 阶段3: LSP工具集开发
- [x] 实现start_lsp工具
- [x] 实现open_document/close_document工具
- [x] 实现get_info_on_location工具
- [x] 实现get_completions工具
- [x] 实现get_code_actions工具
- [x] 实现get_diagnostics工具
- [x] 实现set_log_level工具

### 阶段4: 测试覆盖
- [x] 实现LSP客户端单元测试
- [x] 实现LSP工具集单元测试
- [x] 实现集成测试
- [x] 确保整体测试覆盖率≥80%

### 阶段5: 文档和验证
- [x] 创建功能文档
- [x] 更新相关配置文件
- [x] 运行完整的验证流程

---

## 🚀 Usage Guide (使用指南)

### 基本使用
```typescript
// 1. 启动LSP服务器
await start_lsp({ root_dir: "/path/to/project" });

// 2. 打开文件进行分析
await open_document({ file_path: "/path/to/file.ts" });

// 3. 获取代码位置信息
const info = await get_info_on_location({ 
  file_path: "/path/to/file.ts", 
  line: 10, 
  column: 5 
});

// 4. 获取代码补全
const completions = await get_completions({ 
  file_path: "/path/to/file.ts", 
  line: 10, 
  column: 5 
});

// 5. 获取代码操作建议
const actions = await get_code_actions({ 
  file_path: "/path/to/file.ts",
  start_line: 10, start_column: 5,
  end_line: 10, end_column: 10
});

// 6. 获取诊断信息
const diagnostics = await get_diagnostics({ file_path: "/path/to/file.ts" });

// 7. 关闭文件
await close_document({ file_path: "/path/to/file.ts" });
```

### 高级配置
- **日志级别**: 使用 `set_log_level` 工具调整日志详细程度
- **根目录**: LSP服务器的根目录应指向包含项目配置文件的目录
- **文件路径**: 所有文件路径都相对于LSP根目录

### 最佳实践
- 在使用任何LSP功能前，确保先启动LSP服务器
- 在完成文件操作后，记得关闭文件以释放资源
- 对于大型项目，合理设置日志级别以避免过多输出
- 确保LSP服务器支持你项目所使用的语言

---

## 📊 Impact Analysis (影响分析)

### 文件变更统计
- **新增文件**: 15+ 个（包括源文件、测试文件、模板文件）
- **修改文件**: 30+ 个（包括文档、配置、源代码等）
- **删除文件**: 15+ 个（主要是被移除的自定义代码分析组件）

### 功能影响
- **正面影响**:
  - 代码分析准确性大幅提升（依赖成熟的LSP服务器）
  - 维护成本显著降低（移除复杂自定义组件）
  - 性能优化（LSP服务器通常经过高度优化）
  - 兼容性增强（支持所有LSP兼容的语言服务器）

- **潜在风险**:
  - 依赖外部LSP服务器的可用性和稳定性
  - 需要确保LSP服务器正确配置和启动
  - 可能需要调整现有工作流以适应新的LSP架构

### 向后兼容性
- 所有现有的工具调用接口保持不变
- 现有的功能文档和使用方式无需修改
- 项目配置文件格式保持兼容
- 测试套件完全通过，确保功能一致性