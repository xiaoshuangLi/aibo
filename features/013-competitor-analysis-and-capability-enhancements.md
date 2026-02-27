# 竞品分析与能力拓展

## 📋 Specification (规格说明)

### 🎯 User Story
作为AIBO项目的开发者，我想要深入了解市面上其他优秀的自主编程智能体，通过对标分析找出AIBO的差距和提升空间，并合理拓展AIBO的核心能力，以便让AIBO在自主编程智能体领域具有更强的竞争力和实用价值。

### ✅ Acceptance Criteria
- [ ] 完成主流自主编程智能体的全面对比分析
- [ ] 识别并记录AIBO与竞品的关键能力差距
- [ ] 新增 `repo_map` 工具：仓库结构概览，提供代码库的紧凑全局视图
- [ ] 新增 `issue-to-pr` 技能：端到端的GitHub Issue解决工作流
- [ ] 所有新增功能有完整测试覆盖
- [ ] 更新系统提示词和README文档

### ⚙️ Technical Constraints
- **技术栈要求**: TypeScript 5+, Node.js 18+, Jest for testing
- **兼容性要求**: 支持macOS、Linux、Windows平台
- **性能要求**: repo_map工具响应时间<2秒（典型项目）
- **安全要求**: 所有文件系统操作遵循安全最佳实践

---

## 🔍 竞品深度分析

### 1. Devin (Cognition AI) — 首款"AI软件工程师"

**核心能力**:
- 🌐 **持久化浏览器操作**：能够打开浏览器、填写表单、登录网站、操作UI
- 🧠 **长期规划与检查点**：将复杂任务分解为带检查点的长时序计划，可暂停恢复
- 🔄 **完整开发生命周期**：从理解需求 → 编写代码 → 运行测试 → 提交PR，全流程自主
- 💾 **项目上下文持久化**：跨会话记忆项目背景、决策和进度
- 🐳 **沙箱执行环境**：在隔离容器中安全执行代码，避免污染宿主环境
- 🐛 **自动Bug复现**：能够根据Issue描述复现问题，验证修复

**AIBO差距**:
- ❌ 浏览器交互仅限于内容获取，不能操作UI（填表、点击等）
- ❌ 无跨会话项目进度持久化（仅有知识库，无任务进度）
- ❌ 无沙箱容器隔离执行环境

---

### 2. SWE-agent (Princeton NLP) — GitHub Issue专项解决者

**核心能力**:
- 🎯 **Issue-to-PR自动化**：接收GitHub Issue链接 → 理解问题 → 修改代码 → 创建PR
- 🗺️ **仓库导航专项优化**：专为代码库导航设计的工具集（搜索、查看、编辑）
- 🔁 **测试驱动的修复循环**：运行测试 → 失败 → 分析 → 修复 → 重新测试
- 📝 **结构化行动空间**：明确定义的动作集合（open_file, scroll, find_file, search_dir等）
- 🧪 **真实环境验证**：在实际运行环境中验证修复效果

**AIBO差距**:
- ⚠️ 无专门的Issue-to-PR完整工作流技能
- ⚠️ 缺乏结构化的Bug复现 → 修复 → 验证闭环

---

### 3. Aider — 终端原生的代码协作工具

**核心能力**:
- 🗺️ **仓库地图（Repo Map）**: 使用ctags/tree-sitter生成全仓库符号索引，让AI"看到"整个代码库结构而无需逐文件读取
- 🔀 **多模型策略**：根据任务复杂度动态切换模型（弱模型做代码编辑，强模型做架构决策）
- 📝 **Git原生集成**：每次AI修改自动提交，完整的git历史追踪
- 🎯 **精确的编辑格式**：SEARCH/REPLACE块编辑格式，最小化diff噪声
- 📊 **成本追踪**：实时显示token使用量和API成本
- 🔄 **Lint-then-retry**：代码修改后自动lint，有错误则自动重试

**AIBO差距**:
- ❌ **无仓库地图工具** — 这是Aider最核心的竞争优势，AIBO依赖LSP但缺乏紧凑的全局视图
- ❌ 无自动git提交集成
- ❌ 无token成本追踪

---

### 4. OpenHands (OpenDevin) — 开源全能AI开发者

**核心能力**:
- 🐳 **Docker沙箱**：所有代码执行在容器中进行，完全隔离
- 🌐 **完整Web浏览**：支持真实浏览器操作（Playwright驱动）
- 🤝 **人机协作模式**：支持在任意步骤暂停等待人工输入
- 📦 **微代理架构**：多种专门的微代理（CodeAct、BrowsingAgent等）
- 🔗 **GitHub直连**：直接操作GitHub API进行完整的仓库管理

**AIBO差距**:
- ❌ 无容器隔离执行
- ❌ 浏览器仅支持内容获取，不支持完整交互

---

### 5. GitHub Copilot Workspace — IDE深度集成的AI编程助手

**核心能力**:
- 🧩 **Issue-to-Code工作流**：从GitHub Issue直接生成实现计划和代码变更
- 📋 **结构化计划展示**：可视化展示任务分解和实现步骤
- 🔍 **仓库级代码理解**：深度整合GitHub代码搜索和语义理解
- 💬 **PR上下文感知**：在PR评论中直接触发代码修改
- 🔄 **多文件协调编辑**：跨文件的一致性修改

**AIBO差距**:
- ❌ 无结构化任务计划的可视化展示
- ❌ 与GitHub PR工作流集成不深

---

### 6. Cursor — AI原生IDE

**核心能力**:
- ⚡ **Cmd+K实时编辑**：在光标位置即时AI修改
- 📁 **@文件/符号引用**：在提示词中精确引用代码符号
- 🔍 **语义代码库搜索**：向量数据库驱动的语义搜索
- 🌳 **完整代码库理解**：使用embedding索引整个代码库
- 🤖 **Composer模式**：多文件协调修改模式

**AIBO差距**:
- ❌ 无向量embedding的语义代码搜索
- ❌ 无IDE集成，纯CLI

---

## 📊 能力差距矩阵

| 能力维度 | Devin | SWE-agent | Aider | OpenHands | AIBO |
|---------|-------|-----------|-------|-----------|------|
| 仓库结构概览 | ✅ | ✅ | ✅(RepoMap) | ✅ | ⚠️(LSP) |
| Issue-to-PR工作流 | ✅ | ✅ | ⚠️ | ✅ | ⚠️(Skill) |
| 浏览器UI交互 | ✅ | ❌ | ❌ | ✅ | ❌ |
| 容器沙箱执行 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 多智能体协作 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 技能系统 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 知识库管理 | ⚠️ | ❌ | ❌ | ❌ | ✅ |
| 企业通讯集成 | ❌ | ❌ | ❌ | ❌ | ✅(Lark) |
| 语音输入 | ❌ | ❌ | ❌ | ❌ | ✅ |
| MCP集成 | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Git自动提交 | ✅ | ✅ | ✅ | ✅ | ⚠️(Bash) |

---

## 🚀 优先能力拓展方案

### P0 (立即实施) — 仓库地图工具 (Repo Map)

**战略价值**: Aider的核心竞争优势。让AI在不读取所有文件的情况下理解整个代码库结构。

**实现方案**: 新增 `repo_map` 工具：
- 扫描仓库目录结构
- 提取关键文件（入口点、核心模块、配置文件）
- 统计代码规模（文件数、总行数、语言分布）
- 识别项目架构（模块依赖关系）
- 生成紧凑的树形结构视图

**预期收益**: 
- 减少探索阶段的token消耗30-50%
- 提高大型代码库的任务成功率
- 让AI更快定位相关文件

### P0 (立即实施) — Issue-to-PR技能

**战略价值**: SWE-agent最核心的场景。补齐AIBO在GitHub工作流自动化方面的完整闭环。

**实现方案**: 新增 `issue-to-pr` 技能文档：
- 标准化的Issue理解 → 代码修改 → 测试验证 → PR创建工作流
- 与现有GitHub Automation技能和Composio集成
- 与现有Code Review技能协同

### P1 (短期实施) — 多模型策略

**战略价值**: Aider的架构优势。根据任务复杂度动态选择模型，平衡成本和性能。

**实现方案**: 扩展配置系统支持：
- 轻量模型（用于文件搜索、简单编辑）
- 强力模型（用于架构设计、复杂推理）
- 自动路由逻辑

### P2 (中期实施) — 容器沙箱执行

**战略价值**: Devin/OpenHands的安全执行优势。在隔离环境中运行代码，避免副作用。

**实现方案**: 集成Docker执行后端：
- 可选的Docker沙箱bash工具
- 自动挂载项目目录
- 执行结果的标准化捕获

---

## 🏗️ Technical Design (技术设计)

### repo_map 工具架构

```
repo_map(rootDir, options)
  ├── directoryTree     — 递归目录结构（过滤无关目录）
  ├── entryPoints       — 识别入口文件（main.ts, index.ts, app.ts等）
  ├── keyFiles          — package.json, tsconfig.json, README.md等
  ├── moduleStats       — 文件统计（按类型分组）
  └── architectureSummary — 顶层模块及其职责描述
```

### issue-to-pr 技能工作流

```
GitHub Issue URL
  ↓
1. UNDERSTAND: 读取Issue，提取问题描述、复现步骤、期望行为
  ↓
2. LOCATE: 使用repo_map + grep_files 定位相关代码
  ↓
3. REPRODUCE: 编写/运行测试复现问题
  ↓
4. FIX: 实施最小化代码修改
  ↓
5. VERIFY: 运行测试套件确认修复，无回归
  ↓
6. PR: 创建包含清晰描述的Pull Request
```

---

## 📝 Implementation Plan (实施计划)

### 📋 Task Breakdown
1. **repo_map工具实现** - 新增 `src/tools/repo-map.ts`，实现仓库结构概览 (4小时)
2. **工具注册** - 更新 `src/tools/index.ts` 注册新工具 (0.5小时)
3. **issue-to-pr技能** - 新增 `skills/issue-to-pr/SKILL.md` (2小时)
4. **系统提示词更新** - 在系统提示词中添加repo_map工具指引 (1小时)
5. **测试编写** - 为repo_map工具编写完整单元测试 (3小时)
6. **README更新** - 更新项目文档反映新能力 (1小时)

### 🔗 Dependencies
- **Internal Dependencies**: 现有工具系统、glob工具
- **External Dependencies**: 无新增依赖（使用现有的glob和fs模块）
- **Prerequisites**: 现有测试套件通过

### ⚠️ Risk Assessment
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 大型仓库性能问题 | 中 | 中 | 添加文件数量限制和深度限制 |
| 输出token过多 | 低 | 中 | 添加maxFiles和depth参数控制输出大小 |

### 🎯 Success Metrics
- **功能完整性**: repo_map工具能在2秒内生成典型Node.js项目的结构概览
- **代码质量**: 测试覆盖率≥85%，所有测试通过
- **实用价值**: AI使用repo_map后，探索新代码库的效率提升显著

---

## 🚀 Usage Guide (使用指南)

### repo_map 工具使用示例
```typescript
// 获取当前项目的结构概览
const map = await repo_map({ rootDir: process.cwd() });

// 自定义深度和文件数量限制
const map = await repo_map({ 
  rootDir: "/path/to/project", 
  maxDepth: 4,
  maxFiles: 200 
});
```

### issue-to-pr 技能触发方式
```
# 用户输入
请帮我解决这个GitHub Issue: https://github.com/owner/repo/issues/123

# AIBO自动执行
1. 读取Issue内容
2. 使用repo_map了解仓库结构  
3. 定位相关代码
4. 实施修复
5. 创建PR
```

---

## 📊 Impact Analysis (影响分析)

### 新增文件
- `src/tools/repo-map.ts` — 仓库地图工具实现
- `__tests__/tools/repo-map.test.ts` — 工具单元测试
- `skills/issue-to-pr/SKILL.md` — Issue到PR工作流技能

### 修改文件
- `src/tools/index.ts` — 注册新的repo_map工具
- `src/shared/constants/system-prompts.ts` — 添加repo_map使用指引
- `README.md` — 更新功能列表

### 向后兼容性
- **完全向后兼容**: 所有现有API保持不变
- **增量添加**: 所有新功能都是纯增量，不影响现有功能
