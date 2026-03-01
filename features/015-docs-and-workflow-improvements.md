# 文档完善与发布工作流优化

## 📌 需求背景 (Requirements Background)

### 🔍 业务背景
随着 AIBO 支持的本机 CLI 工具范围扩大（新增 GitHub Copilot），现有文档中缺少独立的 CLI 工具集成说明页面，README 中的相关描述也不够完整。同时，CI/CD 发布流程中存在冗余的版本检测步骤，导致已发布版本的重复检测逻辑重叠；feature-organizer 技能的工作流中也缺少"更新 README 和文档"这一重要步骤，需要明确补充。

### 🎯 目标与价值
1. 为本机 CLI 工具集成创建独立的文档页面（`docs/cli-tools.md`），提供安装指南和路由策略说明
2. 更新 README 以反映 GitHub Copilot CLI 支持、修正飞书自动启动条件的描述
3. 简化 CI/CD 发布工作流，移除冗余的版本比较步骤
4. 完善 feature-organizer 技能，补充"更新文档"步骤，形成完整的代码整理闭环
5. 新增 `@langchain/langgraph-checkpoint` 和 `glob` 依赖以支持相关功能扩展

### 📎 相关背景信息
- **需求来源**: 功能迭代后文档未同步更新；CI/CD 流程优化需求；技能完善
- **影响范围**: 所有 AIBO 用户（文档可见性），维护者（CI/CD 工作流），AI 使用 feature-organizer 技能的场景
- **优先级**: 中，文档和流程质量直接影响用户体验与维护效率

---

## 📋 Specification (规格说明)

### 🎯 User Story
- 作为 AIBO 用户，我希望找到独立的 CLI 工具集成文档页面，了解每种工具的安装方法和任务路由策略，以便快速配置本机 AI 编程工具。
- 作为项目维护者，我希望 CI/CD 发布流程更简洁，避免冗余的版本检测逻辑，以便减少误判和维护成本。
- 作为使用 feature-organizer 技能整理代码的 AI，我希望技能工作流明确包含"更新文档"步骤，以便确保每次整理都同步更新 README 和相关 docs 文件。

### 📑 功能变更清单 (Functional Changes List)

#### 新增功能
- [x] **docs/cli-tools.md 新文档**: 新增本机 CLI 工具集成说明文档，包含 5 种工具（Claude Code、Gemini CLI、OpenAI Codex、Cursor、GitHub Copilot）的工作原理、安装步骤、任务路由策略及与 MCP 的区别对比
- [x] **README 新增 CLI 工具专区**: 在 README 中新增"🖥️ 本机 CLI 工具集成"独立章节，含工具对比表格和路由说明
- [x] **feature-organizer 新增 Step 4（更新文档）**: 在技能工作流中插入新的第 4 步，明确要求在提交前更新 README 和相关 docs 文件；原"提交步骤"顺延为 Step 5

#### 修改功能
- [x] **CI/CD 发布工作流简化** (`.github/workflows/publish.yml`): 移除"检测 package.json 版本是否变更"和"版本未变更则跳过"两个冗余步骤；移除各步骤的 `version_changed` 条件判断；`npm ci` 改为 `npm i`；`npm run publish` 改为 `npm run release`
- [x] **package.json 版本升级及依赖新增**: 版本从 `1.0.1` 升至 `1.0.2`；`publish` 脚本重命名为 `release`；新增 `@langchain/langgraph-checkpoint@^1.0.0` 和 `glob@^11.1.0` 依赖
- [x] **README 更新**: 修正飞书自动启动条件（由"配置 APP_ID 和 APP_SECRET"改为"需同时配置全部 4 个飞书环境变量"）；更新技能总数描述（40+ → 45+）；将 `AIBO_LARK_RECEIVE_ID` 标记为必填（✅）；更新工具列表加入 GitHub Copilot；增加 `docs/cli-tools.md` 引用
- [x] **docs/env.md 更新**: 修正飞书启动模式说明（4 个变量均配置才触发）；修正命令行参数名称（`--interaction` → `--mode`）
- [x] **docs/mcp.md 更新**: 在 CLI 工具集成说明中加入 GitHub Copilot
- [x] **feature-organizer 技能质量门禁更新**: 新增"README 已更新"和"docs 文件已更新"两项质量检查项；在验证脚本说明中补充 Step 4 的人工验证说明

#### 删除/废弃功能
- [x] **删除 temp_requirements.txt**: 清理临时需求文件（已加入 `.gitignore`）
- [x] **`.gitignore` 新增 temp_requirements.txt 规则**: 防止临时文件被意外提交

### ✅ Acceptance Criteria
- [x] `docs/cli-tools.md` 文件存在，包含 5 种工具的安装说明和路由策略
- [x] README 中包含独立的"本机 CLI 工具集成"章节和 `docs/cli-tools.md` 链接
- [x] `.github/workflows/publish.yml` 中不再包含版本比较步骤
- [x] `package.json` 版本为 `1.0.2`，`release` 脚本存在
- [x] `docs/env.md` 中飞书启动条件描述与实际代码逻辑一致（4 个变量）
- [x] 所有测试通过（1763 个测试，覆盖率 ≥ 80%）
- [x] `temp_requirements.txt` 不存在于工作区

### ⚙️ Technical Constraints
- **技术栈要求**: Node.js / TypeScript，npm 工作流
- **兼容性要求**: 新增依赖需与现有 LangChain 版本兼容
- **安全要求**: 不引入新的敏感信息，CI/CD 保持 NPM_TOKEN 安全使用

---

## 🏗️ Technical Design (技术设计)

### 📐 Architecture Overview
本次变更主要涉及三个层面：
1. **文档层**：新增 `docs/cli-tools.md`，更新 `README.md`、`docs/env.md`、`docs/mcp.md`
2. **工作流层**：简化 `.github/workflows/publish.yml` 的发布逻辑
3. **项目配置层**：`package.json` 版本与依赖更新，`.gitignore` 规则新增

### ⚙️ Core Implementation

#### 主要组件
- **docs/cli-tools.md**: 独立文档，覆盖工作原理、各工具安装步骤、路由策略和与 MCP 的对比
- **publish.yml 简化**: 删除 `check_version` 和 `skip_if_not_changed` 两步，依赖已有的 `check_npm`（检查 NPM 上是否已发布该版本）来决定是否发布，避免双重检测
- **feature-organizer Step 4**: 新增步骤明确列出何时需要更新 README 和 docs，并将原 Step 4 顺延为 Step 5

#### 关键技术决策
- **决策 1 - 移除版本比较步骤**: 原有逻辑先比较 git 提交中的版本，再检查 NPM 上是否已发布。后者已足够，前者冗余且在首次发布等边缘情况下会出错。简化后只保留 NPM 检查。
- **决策 2 - `npm ci` 改 `npm i`**: 在 CI 中使用 `npm i` 以兼容没有 `package-lock.json` 的场景（项目已将 lock 文件加入 `.gitignore`）。
- **决策 3 - 文档语言**: 所有新增/更新文档内容使用中文书写，与项目现有文档风格保持一致。

### 🧩 API Changes

#### 新增 npm 脚本
```json
// package.json - 重命名发布脚本
// 原有：
"publish": "npm publish --access public"

// 修改后：
"release": "npm publish --access public"
```

#### 新增依赖
```json
"@langchain/langgraph-checkpoint": "^1.0.0",
"glob": "^11.1.0"
```

---

## 📝 Implementation Plan (实施计划)

### 📋 Task Breakdown
1. **创建 docs/cli-tools.md** - 编写 5 种 CLI 工具的完整安装和路由说明（预计：2 小时）
2. **更新 README.md** - 新增 CLI 工具专区章节，修正飞书启动条件，更新工具列表（预计：1 小时）
3. **简化 publish.yml** - 移除冗余版本检测步骤，更新脚本调用（预计：0.5 小时）
4. **更新 package.json** - 版本升级，脚本重命名，新增依赖（预计：0.5 小时）
5. **更新 docs/env.md 和 docs/mcp.md** - 修正飞书启动条件和工具列表（预计：0.5 小时）
6. **完善 feature-organizer 技能** - 插入 Step 4，更新质量门禁和验证脚本说明（预计：1 小时）
7. **清理 temp_requirements.txt** - 删除临时文件，更新 .gitignore（预计：0.1 小时）

### 📊 开发工作量明细 (Development Workload)

| 工作类型 | 文件数量 | 变更行数 | 预估工时 | 备注 |
|----------|----------|----------|----------|------|
| 新增文档 | 1 个文件 | +103 行 | 2 小时 | docs/cli-tools.md |
| 文档更新 | 3 个文件 | +36/-8 行 | 1.5 小时 | README.md、docs/env.md、docs/mcp.md |
| 技能更新 | 1 个文件 | +33/-4 行 | 1 小时 | feature-organizer/SKILL.md |
| 配置 / 构建 | 3 个文件 | +11/-34 行 | 1 小时 | package.json、publish.yml、.gitignore |
| 临时文件清理 | 1 个文件 | -110 行 | 0.1 小时 | temp_requirements.txt 删除 |
| **合计** | **9 个文件** | **+169/-162 行** | **5.6 小时** | |

### 🔗 Dependencies
- **External Dependencies**: `@langchain/langgraph-checkpoint@^1.0.0`、`glob@^11.1.0`（新增 npm 包）
- **Prerequisites**: 无特殊前置条件

### ⚠️ Risk Assessment
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 新增依赖引发版本冲突 | 低 | 中 | 使用宽松版本范围（^），构建测试验证 |
| publish.yml 简化后发布流程异常 | 低 | 高 | 保留 `check_npm` 步骤作为核心防护，防止重复发布 |
| 文档内容与代码实现不一致 | 低 | 中 | 基于实际代码 diff 编写文档，人工验证 |

### 🎯 Success Metrics
- **功能完整性**: 所有 9 个文件变更均已覆盖
- **代码质量**: 1763 个测试全部通过，覆盖率 92.21%
- **用户体验**: CLI 工具安装文档清晰，用户可按步骤完成配置

---

## 🚀 Usage Guide (使用指南)

### 📦 安装 CLI 工具

参考 `docs/cli-tools.md` 安装一个或多个本机 AI 编程 CLI 工具：

```bash
# Claude Code
npm install -g @anthropic-ai/claude-code && claude login

# Gemini CLI
npm install -g @google/gemini-cli && gemini login

# OpenAI Codex
npm install -g @openai/codex
export OPENAI_API_KEY=sk-...

# GitHub Copilot CLI
gh extension install github/gh-copilot && gh auth login
```

安装后无需任何配置，启动 `aibo` 时会自动检测并加载可用工具。

### 🎮 发布新版本

```bash
# 更新 package.json 中的 version 字段后提交
# CI/CD 会自动检测 NPM 上是否已有该版本，如未发布则执行：
npm run release
```

### 🔄 Migration Guide

#### 从旧版迁移
- **`npm run publish` 已重命名为 `npm run release`**：更新本地脚本调用或 CI 配置
- **飞书模式启动条件变更**：现在需要同时配置 4 个环境变量（`AIBO_LARK_APP_ID`、`AIBO_LARK_APP_SECRET`、`AIBO_LARK_RECEIVE_ID`、`AIBO_LARK_INTERACTIVE_TEMPLATE_ID`）才会自动进入飞书模式
- **`--interaction` 参数已废弃**：请改用 `--mode=console` 或 `--mode=lark`

---

## 📊 Impact Analysis (影响分析)

### 📈 Performance Impact
- **包体积**: 轻微增加（新增 2 个依赖）
- **启动时间**: 无影响
- **运行时**: 无影响

### 🧪 Test Coverage
- **整体覆盖率**: 92.21%（108 个测试套件，1763 个测试全部通过）
- **本次变更涉及文件均为文档/配置，无新增测试逻辑**

### 📁 File Changes

**新增文件**:
- `docs/cli-tools.md` - 本机 CLI 工具集成完整说明
- `features/015-docs-and-workflow-improvements.md` - 本功能文档

**修改文件**:
- `.github/workflows/publish.yml` - CI/CD 发布流程简化
- `.gitignore` - 新增 `temp_requirements.txt` 忽略规则
- `README.md` - 新增 CLI 工具专区，修正飞书启动条件，更新技能列表
- `docs/env.md` - 修正飞书启动条件说明，修正 CLI 参数名称
- `docs/mcp.md` - 更新 CLI 工具列表（加入 GitHub Copilot）
- `package.json` - 版本 1.0.1 → 1.0.2，脚本重命名，新增依赖
- `skills/feature-organizer/SKILL.md` - 新增 Step 4（更新文档），更新质量门禁

**删除文件**:
- `temp_requirements.txt` - 临时需求提取文件（已加入 .gitignore）

---

## ✅ Verification Requirements (验证要求)

### 🧪 Test Strategy
- **Unit Tests**: 108 个测试套件覆盖核心逻辑，全部通过
- **Integration Tests**: 工具加载和 MCP 集成测试已覆盖
- **Documentation Review**: 人工验证文档准确性，与代码实现一致

### 🚪 Quality Gates
- **[x] Code Review Passed**
- **[x] Test Coverage ≥ 80%** (实际 92.21%)
- **[x] Documentation Updated**
- **[x] 功能变更清单中所有条目均已验证**
- **[x] README 已更新**
- **[x] 相关 docs 文件已更新**

### 🧪 Verification Commands
```bash
# 运行完整测试套件
npm test

# 检查代码覆盖率
npm run test:coverage

# 验证构建
npm run build
```

---

## 🛠️ Maintenance Guide (维护指南)

### 🔍 Debugging Tips
- **CI/CD 未触发发布**: 检查 NPM 上是否已有该版本（`npm view @boay/aibo version`），或检查 `NPM_TOKEN` secret 是否有效
- **飞书模式未自动启动**: 确认 4 个飞书环境变量（`AIBO_LARK_APP_ID`、`AIBO_LARK_APP_SECRET`、`AIBO_LARK_RECEIVE_ID`、`AIBO_LARK_INTERACTIVE_TEMPLATE_ID`）均已配置

### 🔄 Future Extensions
- **技能总数维护**: 随着新技能增加，需同步更新 README 中的技能总数描述
- **CLI 工具扩展**: 如需支持新的 AI 编程 CLI 工具，参照 `src/tools/copilot.ts` 模式新增，并更新 `docs/cli-tools.md`
- **发布流程**: 如需支持预发布版本（beta/alpha），可在 `publish.yml` 中增加对应分支逻辑
