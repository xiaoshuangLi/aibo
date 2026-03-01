# Skills 进阶：超越纯文档驱动

本文档详细说明 AIBO Skills 系统在 Markdown 文档之外所具备的能力，以及未来可以进一步扩展的方向。

---

## 目录

1. [Skills 的三层加载架构](#1-skills-的三层加载架构)
2. [第一层：触发元数据（SKILL.md frontmatter）](#2-第一层触发元数据)
3. [第二层：工作流指导（SKILL.md body）](#3-第二层工作流指导)
4. [第三层：可执行的 Bundled Resources](#4-第三层可执行的-bundled-resources)
   - [4.1 scripts/ — 可执行脚本](#41-scripts--可执行脚本)
   - [4.2 references/ — 按需参考文档](#42-references--按需参考文档)
   - [4.3 assets/ — 静态资源模板](#43-assets--静态资源模板)
5. [现有典型案例](#5-现有典型案例)
6. [未来扩展方向](#6-未来扩展方向)
   - [6.1 TypeScript 插件模块（plugin.ts）](#61-typescript-插件模块-plugints)
   - [6.2 Skill 生命周期钩子](#62-skill-生命周期钩子)
   - [6.3 Skill 间依赖与组合](#63-skill-间依赖与组合)
   - [6.4 Skill 版本管理与分发](#64-skill-版本管理与分发)
   - [6.5 Skill 沙箱与安全隔离](#65-skill-沙箱与安全隔离)
7. [总结：能力层次对比](#7-总结能力层次对比)

---

## 1. Skills 的三层加载架构

Skills 并不是"一次性加载所有内容"的静态文档，而是基于**渐进式披露（Progressive Disclosure）**原则设计的三层结构：

```
第一层：触发元数据（常驻上下文，~100 词）
         ↓ AI 判定需要激活该 Skill
第二层：SKILL.md 正文（按需加载，< 5000 词）
         ↓ AI 执行任务，按需读取其他资源
第三层：Bundled Resources（按需执行/加载，无大小限制）
         scripts/    → AI 调用 bash 直接执行，无需读入上下文
         references/ → AI 用 view_file 按需读入参考文档
         assets/     → AI 直接使用或输出，无需读入上下文
```

这个设计解决了两个核心矛盾：
- **质量 vs. Token 成本**：高质量参考资料（如完整 API 文档）可以放入 `references/`，只在真正需要时才占用上下文窗口
- **灵活性 vs. 确定性**：复杂、容易出错的操作可以用 `scripts/` 实现确定性逻辑，AI 只负责调用，而不是每次从头推断

---

## 2. 第一层：触发元数据

每个 Skill 的 `SKILL.md` 开头都有 YAML frontmatter，**这是 Skills 系统中最核心的非文档元素**：

```yaml
---
name: webapp-testing
description: >
  Toolkit for interacting with and testing local web applications using
  Playwright. Use when verifying frontend functionality, debugging UI
  behavior, capturing browser screenshots, or viewing browser logs.
---
```

| 字段 | 作用 |
|------|------|
| `name` | Skill 唯一标识符，用于日志和调试 |
| `description` | **AI 路由的核心依据**：模型通过此字段判断是否激活该 Skill；必须包含"何时使用"的明确描述 |
| `license`（可选） | 许可证说明，使用商业模板类 Skill 时需要 |
| `compatibility`（可选） | 环境要求（如需要特定 Python 版本或系统命令） |

**关键点**：`description` 不仅仅是文档，它是 AI 决策引擎的路由规则。一个精心设计的 `description` 能让 AI 在合适的场景下自动激活 Skill，而糟糕的描述则会导致 Skill 永远不被触发或被错误触发。

---

## 3. 第二层：工作流指导

SKILL.md 正文被激活后才加载，它的价值在于提供 AI **没有的领域知识**：

- 特定工具的调用约定（例如：`python scripts/with_server.py --help` 优先于读源码）
- 错误处理的最佳实践（例如："动态 webapp 必须等待 `networkidle` 再操作"）
- 项目特定的规范（例如：公司内部 API 接口约定、代码提交格式）
- 决策树（例如：静态 HTML vs. 动态 webapp 的不同处理路径）

正文本身不是可执行代码，但它通过**结构化指令**将 AI 的行为约束到一条高质量的路径上。

---

## 4. 第三层：可执行的 Bundled Resources

这是 Skills 超越文档驱动的核心所在。

### 4.1 `scripts/` — 可执行脚本

可执行脚本将**确定性逻辑**从 AI 的推理过程中剥离出来，直接通过 `bash` 工具运行：

**典型用途：**
- 二进制文件处理（PDF 合并/旋转、Office 文档解包/重打包）
- 服务器生命周期管理（启动/等待/关闭测试服务器）
- 数据校验（测试覆盖率检查、提交结构验证）
- 复杂环境依赖操作（LibreOffice 格式转换、Playwright 自动化）

**运行方式：**

```bash
# AI 通过 execute_bash 工具直接运行脚本
python skills/docx/scripts/accept_changes.py input.docx output.docx
python skills/webapp-testing/scripts/with_server.py --server "npm run dev" --port 3000 -- python my_test.py
node skills/feature-organizer/scripts/validate-test-coverage.js
```

**设计原则：**
- 脚本设计为"黑盒"——AI 先运行 `--help` 了解用法，而不是读源码
- 避免将脚本加载到上下文窗口（大型脚本会浪费 Token）
- 脚本提供标准化的退出码和结构化输出，AI 可以解读

**支持的脚本类型：**
- Python（`.py`）：适合数据处理、文件操作、系统自动化
- Bash（`.sh`）：适合 Shell 命令组合
- Node.js（`.js`/`.ts`）：适合 npm 生态工具调用和 JavaScript 相关验证

### 4.2 `references/` — 按需参考文档

参考文档是**超大型知识库的分片存储**，AI 按需读取，而不是一次性加载：

**典型用途：**
- 数据库表结构（BigQuery schema、PostgreSQL DDL）
- 外部 API 文档片段（不需要每次都调用 `web_fetch`）
- 公司内部规范（代码规范、接口协议、业务逻辑说明）
- 变体特定内容（AWS vs. GCP vs. Azure 的部署模式）

**结构示例（mcp-builder skill）：**
```
mcp-builder/
├── SKILL.md                          ← 总览 + 导航
└── reference/
    ├── mcp_best_practices.md         ← MCP 最佳实践
    ├── node_mcp_server.md            ← TypeScript 实现模式
    └── python_mcp_server.md          ← Python 实现模式
```

当用户选择 TypeScript 时，AI 只读 `node_mcp_server.md`，不加载 Python 文档，节省约 50% 的 Token 消耗。

**设计原则：**
- SKILL.md 中必须明确标注"何时读取哪个参考文件"
- 超过 100 行的参考文件应在顶部包含目录
- 信息只存在一处（SKILL.md 或 references/），不重复

### 4.3 `assets/` — 静态资源模板

Assets 是输出物的原材料，AI 直接使用而无需读入上下文：

**典型用途：**
- Office 文档模板（`.pptx`/`.docx` 起始模板）
- 前端项目脚手架（HTML/React/Vue 样板代码目录）
- 品牌资产（Logo 图片、品牌字体）
- 主题配置文件（CSS 变量、设计 Token）

**使用方式：**
```bash
# AI 直接复制模板并修改，而不是从零生成
cp skills/theme-factory/themes/arctic-frost.md ./my-theme.md

# 或直接引用 assets 路径
python generate.py --template skills/algorithmic-art/templates/viewer.html
```

**与 scripts/ 的区别：** assets 是被使用的静态内容，scripts 是被执行的动态逻辑。

---

## 5. 现有典型案例

| Skill | scripts/ | references/ | assets/ | 核心非文档能力 |
|-------|----------|-------------|---------|--------------|
| `docx` | ✅ Python | ❌ | ❌ | LibreOffice 格式转换、Word XML 解包/重打包 |
| `pdf` | ✅ Python | ✅ | ❌ | PDF 表单填写、签名、图像转换；按需加载 API 文档 |
| `webapp-testing` | ✅ Python | ❌ | ✅ | 服务器生命周期管理；Playwright 示例代码 |
| `feature-organizer` | ✅ Node.js | ❌ | ✅ | 自动测试覆盖率检查、提交结构校验、Git diff 分析 |
| `mcp-builder` | ✅ Python | ✅ | ❌ | MCP 连接测试；按框架分发的技术文档 |
| `skill-creator` | ✅ Python | ✅ | ❌ | Skill 模板初始化、打包验证 |
| `slack-gif-creator` | ✅ Python | ❌ | ❌ | GIF 帧合成、缓动动画、Slack 上传 |
| `pptx` | ✅ Python | ✅ | ❌ | PowerPoint 生成和解析；按功能分发的参考文档 |
| `xlsx` | ✅ Python | ❌ | ❌ | Excel 读写、公式操作 |
| `theme-factory` | ❌ | ❌ | ✅ | 10 套完整主题文件，AI 直接选用 |
| `algorithmic-art` | ❌ | ❌ | ✅ | HTML 可视化模板 |

---

## 6. 未来扩展方向

当前 Skills 已经远超纯文档驱动，但仍有几个方向可以进一步增强能力：

### 6.1 TypeScript 插件模块（`plugin.ts`）

**现状限制：** Skills 中的脚本只能通过 `bash` 工具运行，无法直接向主进程注册新的 LangChain 工具。如果想添加新工具（如调用某个特定 API 的专用 Tool），必须修改 `src/tools/` 下的 TypeScript 源码。

**扩展方案：** 允许 Skill 目录包含 `plugin.ts` 入口文件，在 Agent 启动时自动加载：

```
my-skill/
├── SKILL.md
├── plugin.ts         ← 新增：向主进程注册 LangChain 工具
└── scripts/
    └── helper.py
```

```typescript
// my-skill/plugin.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export default function register() {
  return [
    tool(
      async ({ query }) => {
        // 调用特定 API、访问数据库、执行复杂逻辑
        return `result for ${query}`;
      },
      {
        name: 'my_skill_query',
        description: 'Query the internal company database',
        schema: z.object({ query: z.string() }),
      }
    ),
  ];
}
```

**加载机制（示意）：**
```typescript
// src/core/agent/factory.ts 中扩展 Skills 加载
for (const skillDir of allSkillsDirs) {
  const pluginPath = path.join(skillDir, 'plugin.ts');
  if (fs.existsSync(pluginPath)) {
    const { default: register } = await import(pluginPath);
    const pluginTools = register();
    tools.push(...pluginTools);
  }
}
```

**价值：** 企业用户可以在不修改 AIBO 核心代码的情况下，通过 Skill 插件接入内部系统（CRM、ERP、私有数据库），实现完全的业务定制。

### 6.2 Skill 生命周期钩子

**现状限制：** Skills 没有生命周期概念——无法在任务开始/结束时自动执行初始化或清理逻辑。

**扩展方案：** 在 `plugin.ts` 中支持标准生命周期钩子：

```typescript
// my-skill/plugin.ts
export const hooks = {
  // 每次 Agent 会话启动时调用（如：检查依赖、预热连接池）
  onSessionStart: async (context: SkillContext) => {
    await db.connect();
  },

  // 每次任务完成后调用（如：提交事务、清理临时文件）
  onTaskComplete: async (context: SkillContext) => {
    await db.disconnect();
    await cleanupTempFiles(context.workDir);
  },

  // Agent 关闭时调用（如：保存状态、上传日志）
  onSessionEnd: async (context: SkillContext) => {
    await reportMetrics();
  },
};
```

**典型应用场景：**
- 数据库 Skill：在 `onSessionStart` 建立连接，在 `onSessionEnd` 关闭
- 测试 Skill：在 `onTaskComplete` 自动上传测试报告到 CI 系统
- 通知 Skill：在 `onTaskComplete` 发送飞书/Slack 通知

### 6.3 Skill 间依赖与组合

**现状限制：** 每个 Skill 是独立的，无法声明"我需要另一个 Skill 提供的能力"。

**扩展方案：** 在 frontmatter 中声明依赖关系：

```yaml
---
name: ci-cd-advanced
description: Advanced CI/CD pipeline management with test reporting.
requires:
  - webapp-testing    # 需要 webapp-testing 提供的 Playwright 脚本
  - slack-gif-creator # 需要 slack-gif-creator 处理测试截图
---
```

加载时自动解析依赖链，确保所有依赖 Skill 一同激活，其 `scripts/` 和 `assets/` 路径均可访问。

**价值：** 支持构建高阶 Skill（Meta-Skill），将多个基础 Skill 组合成面向特定业务场景的完整工作流，而不是让每个 Skill 都重新实现基础能力。

### 6.4 Skill 版本管理与分发

**现状限制：** Skills 的 `SKILL.md` 没有版本号，多人共同维护时无法追踪变更；也没有标准化的安装/更新机制。

**扩展方案：**

**a. frontmatter 增加 `version` 字段：**
```yaml
---
name: docx
version: 2.1.0
description: ...
---
```

**b. 支持 `.skill` 打包格式（skill-creator 已有雏形）：**
```bash
# 从 npm 注册表安装 Skill
aibo skill install @company/internal-crm-skill
aibo skill install aibo-skill-playwright@2.1.0

# 更新
aibo skill update docx

# 列出已安装
aibo skill list
```

`package.json` 中增加专属依赖字段：
```json
{
  "aibo": {
    "skills": {
      "docx": "^2.0.0",
      "@company/internal-crm": "^1.5.0"
    }
  }
}
```

**价值：** 团队可以将私有 Skill 发布到内网 npm 仓库，像管理 npm 包一样管理 AI 能力模块；Skills 有明确版本，CI/CD 可以固定版本确保稳定性。

### 6.5 Skill 沙箱与安全隔离

**现状限制：** Skill 脚本通过 `bash` 工具直接在宿主机执行，没有任何沙箱限制。恶意或有缺陷的 Skill 脚本可能访问任意文件系统位置或执行危险命令。

**扩展方案：**

**a. 脚本执行路径限制：**
在 `SafeFilesystemBackend` 的思路基础上，为 Skill 脚本执行添加工作目录限制：
```typescript
// 脚本只能在 project root 或 /tmp 下执行
executeScript(script, { allowedPaths: [process.cwd(), '/tmp'] });
```

**b. Skill 权限声明：**
```yaml
---
name: dangerous-skill
description: ...
permissions:
  filesystem: read-write    # read-only | read-write | none
  network: restricted       # none | restricted | full
  subprocess: allowed       # none | allowed
---
```

用户安装需要高权限的 Skill 时，AIBO 弹出提示确认。

**价值：** 让 Skills 系统可以安全地接受来自社区或第三方的 Skill，降低供应链攻击风险。

---

## 7. 总结：能力层次对比

| 层次 | 实现方式 | 现状 | 未来 |
|------|----------|------|------|
| **AI 行为引导** | SKILL.md frontmatter + body | ✅ 完整支持 | 可增加结构化决策树格式 |
| **确定性脚本执行** | `scripts/` (Python/Bash/JS) | ✅ 完整支持 | 增加沙箱/权限控制 |
| **大型参考文档** | `references/` (Markdown) | ✅ 完整支持 | 增加向量索引，支持语义检索 |
| **静态资源模板** | `assets/` (任意文件) | ✅ 完整支持 | 增加版本管理和热更新 |
| **注册 LangChain 工具** | `plugin.ts` | ❌ 尚未支持 | **最具价值的扩展点** |
| **生命周期钩子** | `plugin.ts hooks` | ❌ 尚未支持 | 高价值，适合连接池/通知场景 |
| **Skill 间依赖** | frontmatter `requires` | ❌ 尚未支持 | 中等价值，适合构建 Meta-Skill |
| **版本管理与分发** | `.skill` 包 + npm | ⚠️ 打包工具有雏形 | 生态建设的长期目标 |
| **安全沙箱** | 权限声明 + 路径限制 | ❌ 尚未支持 | 开放生态的前提条件 |

**核心结论：** Skills 的现有三层架构（SKILL.md + scripts + references + assets）已经非常强大，覆盖了绝大多数场景。最有价值的下一步是支持 `plugin.ts`，让 Skills 能够直接注册 LangChain 工具，彻底打通 AI 能力扩展的最后一公里——不再需要修改 AIBO 核心源码。
