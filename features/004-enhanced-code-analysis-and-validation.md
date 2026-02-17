# 004 - Enhanced Code Analysis and Validation Framework

## Specification

### 🎯 User Story
作为开发者，我想要增强的代码分析能力（包括依赖分析、智能上下文选择和准确的token计数）以及系统化的功能组织验证框架，以便我能更高效地理解复杂代码库、减少60-90%的token使用量，并确保我的代码更改经过适当的测试、文档化和验证后才能提交到生产环境。

### ✅ Acceptance Criteria
- [ ] 依赖分析器能够正确解析TypeScript/JavaScript文件的导入/导出语句并提取模块依赖关系
- [ ] 智能上下文选择器支持6种请求类型（definition, references, implementation, signature, full-context, dependencies）并根据token限制动态调整上下文
- [ ] Token计数器提供准确的token估算并与OpenAI的计数保持一致，支持文本截断以适应token限制
- [ ] 功能组织工作流包含4个验证脚本（测试覆盖、需求提取、文档生成、提交结构），每个脚本都能独立验证对应阶段的质量
- [ ] 所有新组件都有完整的单元测试覆盖，整体测试覆盖率≥85%
- [ ] 验证脚本能够正确识别未提交的代码更改并验证相应的工作流步骤

### ⚙️ Technical Constraints
- **技术栈要求**: TypeScript 5+, Node.js 18+, Jest for testing, Tree-sitter for parsing
- **兼容性要求**: 支持所有现代TypeScript/JavaScript项目结构
- **性能要求**: 依赖分析和上下文选择响应时间<100ms，token计数<10ms
- **安全要求**: 文件系统操作必须通过SafeFilesystemBackend进行，防止路径遍历攻击

---

## Technical Design

### 📐 Architecture Overview
增强的代码分析框架建立在现有的混合代码读取器基础上，通过三个核心组件协同工作：
1. **DependencyAnalyzer**: 负责解析模块依赖关系
2. **ContextSelector**: 负责智能上下文选择和优化  
3. **TokenCounter**: 负责token计数和截断

验证框架通过四个独立的Node.js脚本实现，每个脚本验证功能组织工作流的一个阶段，确保代码质量门禁。

### ⚙️ Core Implementation
#### Main Components/Modules
- **DependencyAnalyzer**: 解析各种导入/导出语法（named, default, namespace, sideEffect, all exports），区分内部/外部依赖
- **ContextSelector**: 实现6种上下文请求策略，集成缓存管理器提高性能，支持自适应token限制
- **TokenCounter**: 基于字符和单词的混合估算算法，提供结构感知的文本截断功能
- **Validation Scripts**: 四个独立的验证脚本，每个脚本验证工作流的一个特定阶段

#### Key Technical Decisions
- **依赖分析策略**: 选择基于正则表达式的简单解析而非完整AST遍历，以平衡准确性和性能
- **Token估算算法**: 使用字符+单词的混合估算而非集成tiktoken，以减少依赖和启动时间
- **验证脚本设计**: 每个验证脚本独立运行，不依赖其他脚本的状态，便于调试和维护

#### Data Flow/State Management
代码分析数据流：文件内容 → AST抽象层 → 依赖分析器/上下文选择器 → 优化后的上下文输出
验证数据流：git diff → 需求提取 → 文档生成 → 提交验证

### 🧩 API Changes
#### New APIs
```typescript
// 依赖分析器
interface DependencyResult {
  filePath: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  externalDependencies: string[];
  internalDependencies: string[];
}

class DependencyAnalyzer {
  parseImport(node: AstNodeInfo): ImportInfo | null;
  parseExport(node: AstNodeInfo): ExportInfo | null;
  analyzeDependencies(filePath: string, content: string): Promise<DependencyResult>;
}

// 上下文选择器
type ContextRequestType = 'definition' | 'references' | 'implementation' | 'signature' | 'full-context' | 'dependencies';

class ContextSelector {
  selectContext(
    filePath: string,
    requestType: ContextRequestType,
    options: { line?: number; character?: number; maxTokens?: number; symbolName?: string }
  ): Promise<OptimizedContext>;
}

// Token计数器
class TokenCounter {
  static estimateTokenCount(text: string): number;
  static truncateToTokenLimit(text: string, maxTokens: number, preserveStructure: boolean): string;
}
```

#### Modified APIs
- **hybrid_code_reader tool**: 现在支持新的requestType选项和maxTokens参数
- **feature-organizer skill**: 新增四阶段验证工作流

---

## Implementation Plan

### 📋 Task Breakdown
1. **实现依赖分析器** - 解析导入/导出语句，提取依赖关系 (预计: 4小时)
2. **实现智能上下文选择器** - 支持6种请求类型和token限制 (预计: 6小时)  
3. **实现Token计数器** - 提供准确估算和截断功能 (预计: 2小时)
4. **创建验证脚本** - 四个独立的验证脚本用于功能组织工作流 (预计: 8小时)
5. **编写全面测试** - 为所有新组件编写单元测试 (预计: 6小时)
6. **更新文档和README** - 更新技能文档和项目文档 (预计: 2小时)

### 🔗 Dependencies
- **Internal Dependencies**: hybrid-code-reader, ast-abstract-layer, cache-manager, safe-filesystem-backend
- **External Dependencies**: None (all functionality built on existing project dependencies)
- **Prerequisites**: Existing hybrid code reader infrastructure must be functional

### ⚠️ Risk Assessment
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 依赖分析准确性不足 | 中 | 高 | 实现全面的测试用例覆盖各种导入/导出语法变体 |
| Token估算偏差过大 | 低 | 中 | 提供保守的估算算法，并允许用户配置更精确的计数器 |
| 验证脚本过于严格 | 中 | 中 | 设计灵活的验证逻辑，提供清晰的错误信息和修复建议 |

### 🎯 Success Metrics
- **功能完整性**: 所有6种上下文请求类型正常工作，依赖分析覆盖所有常见语法
- **代码质量**: 测试覆盖率≥85%，所有组件通过类型检查
- **性能指标**: 上下文选择响应时间<100ms，token计数<10ms
- **用户体验**: 验证脚本提供清晰的反馈，帮助开发者快速识别和修复问题

---

## Usage Guide

### 📦 Installation/Configuration
无需额外安装，所有功能已集成到现有AIBO系统中。确保项目根目录存在`.env`文件配置必要的API密钥。

### 🎮 Basic Usage
```typescript
// 使用增强的混合代码读取器
const result = await hybrid_code_reader({
  filePath: "src/example.ts",
  requestType: "dependencies", // 或 "definition", "references", "implementation", "signature", "full-context"
  maxTokens: 2000
});

// 在功能组织工作流中使用验证脚本
// 阶段1: npm test && node ./skills/feature-organizer/scripts/validate-test-coverage.js
// 阶段2: node ./skills/feature-organizer/scripts/validate-requirements-extraction.js  
// 阶段3: node ./skills/feature-organizer/scripts/validate-feature-documentation.js
// 阶段4: node ./skills/feature-organizer/scripts/validate-commit-structure.js
```

### 🧪 Testing Examples
所有新功能都包含完整的单元测试，位于`__tests__/infrastructure/code-analysis/`目录下。

### 📊 Performance Considerations
- 对于大型文件，建议使用较小的maxTokens值以避免内存问题
- 依赖分析结果会被缓存，重复查询会更快
- Token计数是估算值，在关键场景建议预留20%的缓冲空间

---

## Impact Analysis

### 文件变更影响
- **新增文件**: 
  - `src/infrastructure/code-analysis/dependency-analyzer.ts`
  - `src/infrastructure/code-analysis/token-counter.ts`
  - `skills/feature-organizer/scripts/validate-commit-structure.js`
  - `skills/feature-organizer/scripts/validate-feature-documentation.js`
  - `skills/feature-organizer/scripts/validate-requirements-extraction.js`
  - `skills/feature-organizer/scripts/validate-test-coverage.js`
- **修改文件**:
  - `src/infrastructure/code-analysis/context-selector.ts`
  - `src/infrastructure/code-analysis/ast-abstract-layer.ts`
  - `src/tools/hybrid-code-reader.ts`
  - `skills/feature-organizer/SKILL.md`
  - `templates/feature-template.md`
  - 多个测试文件和配置文件

### 向后兼容性
- **Breaking Changes**: 无，所有新功能都是向后兼容的
- **Migration Required**: 否，现有代码无需修改即可使用新功能
- **Deprecation**: 无已废弃的API

### 性能影响
- **内存使用**: 增加了缓存机制，但通过智能上下文选择减少了总体内存使用
- **CPU使用**: 依赖分析和token计数增加了少量CPU开销，但通过缓存优化
- **启动时间**: 无显著影响，所有新组件按需加载