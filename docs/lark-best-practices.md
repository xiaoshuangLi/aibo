# 飞书（Lark）工作模式集成最佳实践

本文档全面梳理飞书平台可供集成到 AIBO Lark 工作模式的能力，并总结通过手机即时通讯进行 AI 辅助编程的最佳实践，帮助团队显著提升开发效率。

---

## 目录

- [一、现有集成能力回顾](#一现有集成能力回顾)
- [二、飞书可集成能力全景](#二飞书可集成能力全景)
  - [2.1 消息与交互增强](#21-消息与交互增强)
  - [2.2 飞书文档（Docs）集成](#22-飞书文档docs集成)
  - [2.3 飞书多维表格（Bitable）集成](#23-飞书多维表格bitable集成)
  - [2.4 飞书任务（Task）集成](#24-飞书任务task集成)
  - [2.5 飞书日历集成](#25-飞书日历集成)
  - [2.6 飞书文件与图片能力](#26-飞书文件与图片能力)
  - [2.7 飞书机器人菜单](#27-飞书机器人菜单)
  - [2.8 飞书消息表情回应](#28-飞书消息表情回应)
  - [2.9 飞书消息编辑与撤回](#29-飞书消息编辑与撤回)
  - [2.10 飞书审批流程](#210-飞书审批流程)
  - [2.11 飞书群组管理增强](#211-飞书群组管理增强)
- [三、手机 IM 编程最佳实践](#三手机-im-编程最佳实践)
  - [3.1 语音输入工作流](#31-语音输入工作流)
  - [3.2 移动端任务分解策略](#32-移动端任务分解策略)
  - [3.3 消息组织与线程管理](#33-消息组织与线程管理)
  - [3.4 异步工作流设计](#34-异步工作流设计)
  - [3.5 通知与告警管理](#35-通知与告警管理)
- [四、推荐集成优先级路线图](#四推荐集成优先级路线图)
- [五、实战配置示例](#五实战配置示例)

---

## 一、现有集成能力回顾

AIBO 当前已实现的飞书集成能力：

| 能力 | 状态 | 说明 |
|------|------|------|
| WebSocket 长连接接收消息 | ✅ 已实现 | 通过 `@larksuiteoapi/node-sdk` 实时接收用户消息 |
| 私聊（p2p）模式 | ✅ 已实现 | 直接与机器人私聊触发 AI 任务 |
| 群聊（group_chat）模式 | ✅ 已实现 | 在指定群聊中与 AI 交互，支持按工作目录自动创建/复用群 |
| 互动卡片消息（Interactive Card）| ✅ 已实现 | 通过模板 ID 发送富文本卡片，支持 `title` + `content` 变量 |
| 内部命令系统（/help, /new 等）| ✅ 已实现 | 支持多种斜杠命令控制 AIBO 行为 |
| 工具进度实时推送 | ✅ 已实现 | 工具执行过程中分批推送进度消息（缓冲 3 秒或 800 字符） |
| 会话重启（/rebot）| ✅ 已实现 | 在飞书中直接重启 AIBO 会话 |
| 语音输入（ASR）| ✅ 已实现（控制台模式）| 腾讯云 ASR 语音转文字，待扩展到飞书语音消息 |

---

## 二、飞书可集成能力全景

### 2.1 消息与交互增强

#### 2.1.1 消息线程（Message Thread）回复

**当前痛点**：所有 AIBO 消息均以独立消息发送到群聊，长对话难以追溯上下文。

**方案**：将同一任务的 AI 响应、工具调用、工具结果统一回复到同一消息线程（Thread），保持任务上下文的视觉连贯性。

**飞书 API**：`im.message.reply`，传入 `reply_in_thread: true`

```typescript
// 回复到消息线程
await client.im.message.reply({
  path: { message_id: parentMessageId },
  data: {
    content: JSON.stringify({ text: replyContent }),
    msg_type: 'text',
    reply_in_thread: true,
  },
});
```

**效益**：
- 每个用户请求产生一个独立 Thread，工具调用链在 Thread 内展开
- 群聊主视图只显示任务入口消息，不被工具进度淹没
- 用户可以一眼看到任务完成状态，按需展开 Thread 查看详情

---

#### 2.1.2 消息 Reaction（表情回应）

**当前痛点**：无法快速告知用户"任务已接收"或"正在处理"。

**方案**：
- 收到用户消息时，立即用 `⏳` 表情回应，表示任务已接收
- 任务完成后，改为 `✅` 表情回应
- 任务失败时，改为 `❌` 表情回应

**飞书 API**：`im.message.reaction.create` / `im.message.reaction.delete`

```typescript
// 为消息添加表情回应
await client.im.messageReaction.create({
  path: { message_id: userMessageId },
  data: { reaction_type: { emoji_type: 'DONE' } }, // ✅
});
```

**效益**：
- 用户发出消息后立即得到视觉反馈，无需等待完整响应
- 消息列表中直观看到任务状态，减少"有没有收到"的疑虑

---

#### 2.1.3 飞书语音消息（Audio Message）处理

**当前痛点**：飞书语音消息无法被 AIBO 识别处理，用户只能发文字。

**方案**：拦截 `im.message.receive_v1` 中 `msg_type = 'audio'` 的消息，下载音频文件后通过腾讯云 ASR 转写，再交由 AI 处理。

**飞书 API**：`im.messageResource.get` 下载音频 + 腾讯云 ASR 转写

```typescript
// 下载飞书音频消息
const audioResp = await client.im.messageResource.get({
  path: { message_id: messageId, file_key: fileKey },
  params: { type: 'audio' },
});
// 保存为临时文件后送入 ASR
```

**效益**：
- 移动端用户可直接发语音，AIBO 自动转写后处理
- 解决在手机上打字不方便的痛点，尤其适合描述复杂需求

---

#### 2.1.4 飞书图片消息处理（视觉输入）

**当前痛点**：无法通过图片向 AIBO 传递视觉信息（如截图、设计稿、报错截图）。

**方案**：拦截 `msg_type = 'image'` 的消息，下载图片后以 base64 格式传给支持视觉的多模态模型（如 GPT-4o、Claude 3.5）进行分析。

**典型场景**：
- 发送报错截图，AI 自动分析并修复
- 发送 UI 设计稿，AI 生成对应前端代码
- 发送数据库 ER 图，AI 生成建表 SQL

---

### 2.2 飞书文档（Docs）集成

**当前痛点**：AIBO 输出的代码审查报告、技术方案、会议纪要等长文档只能在聊天中查看，无法持久化沉淀。

**方案**：为以下场景自动创建/更新飞书文档：

| 场景 | 触发命令 | 飞书 API |
|------|----------|----------|
| 代码审查报告 | `/review` 或 AI 完成 code-review | `docx.document.create` + `docx.documentBlock.create` |
| 技术方案文档 | `AIBO 帮我写一个技术方案` | `docx.document.create` |
| Sprint 任务清单 | AI 分解任务后 | `docx.document.create` |
| 错误日志分析 | AI 分析完错误后 | `docx.documentBlock.patch` |

**飞书 API**：
```typescript
// 创建飞书文档
const doc = await client.docx.document.create({
  data: {
    folder_token: targetFolderToken, // 可配置目标文件夹
    title: `AIBO 代码审查报告 - ${new Date().toLocaleDateString()}`,
  },
});

// 向文档追加内容块
await client.docx.documentBlock.create({
  path: { document_id: doc.data.document.document_id },
  data: {
    children: [
      {
        block_type: 2, // 文本块
        text: { elements: [{ text_run: { content: reviewContent } }] },
      },
    ],
  },
});
```

**效益**：
- AI 生成的重要内容自动归档到团队知识库
- 文档可与飞书知识空间（Wiki）深度集成，形成团队知识沉淀
- 支持多人协同编辑，团队成员可在 AI 生成内容基础上补充完善

---

### 2.3 飞书多维表格（Bitable）集成

**当前痛点**：AI 识别出的 Bug、TODO 项散落在聊天记录中，无法系统化追踪。

**方案**：为项目自动维护飞书多维表格，用于任务和缺陷跟踪。

#### 典型多维表格结构

**任务跟踪表**：

| 字段 | 类型 | 说明 |
|------|------|------|
| 任务标题 | 文本 | AI 分解的子任务名称 |
| 状态 | 单选 | 待处理 / 进行中 / 已完成 / 阻塞 |
| 优先级 | 单选 | P0 / P1 / P2 / P3 |
| 负责人 | 人员 | 分配给团队成员 |
| AI 分析 | 文本 | AIBO 对该任务的分析说明 |
| 创建时间 | 日期 | 自动填充 |

**飞书 API**：
```typescript
// 向多维表格新增任务记录
await client.bitable.appTableRecord.create({
  path: {
    app_token: BITABLE_APP_TOKEN,
    table_id: TASKS_TABLE_ID,
  },
  data: {
    fields: {
      '任务标题': taskTitle,
      '状态': '待处理',
      '优先级': 'P1',
      'AI 分析': aiAnalysis,
      '创建时间': new Date().toISOString(),
    },
  },
});
```

**触发场景**：
- `/new` 命令开始新任务时，自动在多维表格中创建任务记录
- AI 完成任务后，自动更新状态为"已完成"
- AI 在代码审查中发现 Bug 时，自动创建 Bug 记录
- `/abort` 中断任务时，自动标记状态为"阻塞"

**效益**：
- AI 辅助开发的所有任务全程可追踪
- 管理层可通过多维表格视图（看板、甘特图）实时了解进度
- 与飞书 OKR、项目管理模块打通，形成完整研发管理闭环

---

### 2.4 飞书任务（Task）集成

**当前痛点**：AI 分解的子任务无法直接变成飞书中的可指派任务。

**方案**：将 AIBO 分解的任务列表同步到飞书任务系统。

**飞书 API**：`task.task.create`

```typescript
// 创建飞书任务
await client.task.task.create({
  data: {
    summary: taskTitle,
    description: taskDescription,
    due: {
      is_all_day: false,
      timestamp: dueDateTimestamp,
    },
    members: [
      { id: assigneeOpenId, type: 'user', role: 'assignee' },
    ],
    origin: {
      platform_i18n_name: 'AIBO AI 助手',
    },
  },
});
```

**效益**：
- AI 规划的任务直接落地为飞书任务，无需手动转录
- 团队成员在飞书任务视图中看到 AI 安排的工作
- 任务完成后自动通知相关人员

---

### 2.5 飞书日历集成

**当前痛点**：Code Review、发布计划等需要手动创建日历事件。

**方案**：在以下场景自动创建日历事件：

| 场景 | 触发条件 |
|------|----------|
| 代码审查会议 | AI 完成代码审查后，提议安排评审 |
| 发布窗口提醒 | AI 分析 CI/CD 流程后预估发布时间 |
| 技术分享 | AI 生成技术方案后，提议安排分享 |

**飞书 API**：`calendar.calendarEvent.create`

```typescript
await client.calendar.calendarEvent.create({
  path: { calendar_id: 'primary' },
  data: {
    summary: `代码审查 - ${projectName}`,
    description: reviewSummary,
    start_time: { timestamp: startTimestamp, timezone: 'Asia/Shanghai' },
    end_time: { timestamp: endTimestamp, timezone: 'Asia/Shanghai' },
    attendees: teamMemberOpenIds.map(id => ({ user_id: id })),
  },
});
```

---

### 2.6 飞书文件与图片能力

#### 2.6.1 发送代码文件

**方案**：当 AI 生成的代码文件较大时，直接以文件形式发送，而非将代码粘贴在消息中。

**飞书 API**：`im.file.create` + `im.message.create`（msg_type: 'file'）

```typescript
// 上传文件
const fileResp = await client.im.file.create({
  data: {
    file_type: 'stream',
    file_name: 'generated_code.ts',
    // duration 字段仅对音视频文件有意义（单位：毫秒），普通文件可省略
    file: Buffer.from(codeContent),
  },
});

// 发送文件消息
await client.im.message.create({
  params: { receive_id_type: 'chat_id' },
  data: {
    receive_id: chatId,
    msg_type: 'file',
    content: JSON.stringify({ file_key: fileResp.data.file_key }),
  },
});
```

#### 2.6.2 发送图片（截图、流程图）

**方案**：AIBO 生成的架构图、流程图（通过 D3.js、Mermaid 等渲染后截图）可以直接发送到飞书。

**效益**：大文件不再占用聊天消息空间，飞书会自动存储并提供下载链接。

---

### 2.7 飞书机器人菜单

**当前痛点**：用户需要记忆斜杠命令，使用门槛较高。

**方案**：配置飞书机器人全局菜单（Bot Menu），提供可视化的快捷操作入口。

**菜单结构建议**：
```
AIBO 菜单
├── 🚀 开始新任务        → 发送 /new
├── 📋 查看命令列表      → 发送 /help
├── 📊 查看会话信息      → 发送 /metadata
├── 🔄 重启机器人        → 发送 /rebot
├── ⛔ 中断当前任务      → 发送 /abort
└── 📖 打开文档          → 跳转到飞书文档
```

**飞书配置**：在飞书开放平台 → 应用功能 → 机器人 → 自定义菜单 中配置。

**效益**：
- 降低用户学习成本，一键触发常用功能
- 移动端用户操作更方便，无需打字输入命令
- 减少错误输入，提升操作成功率

---

### 2.8 飞书消息表情回应

**实现优先级**：⭐⭐⭐⭐⭐（高）

参见 [2.1.2 消息 Reaction](#212-消息-reaction表情回应)。

推荐的 Emoji 状态映射：

| 状态 | Emoji | 飞书 emoji_type |
|------|-------|-----------------|
| 已接收，处理中 | ⏳ | `PENDING` |
| 任务完成 | ✅ | `DONE` |
| 任务失败 | ❌ | `THUMBSDOWN` |
| 需要人工确认 | 👀 | `EYES` |
| 思考中 | 🤔 | `THINKING` |

---

### 2.9 飞书消息编辑与撤回

**当前痛点**：工具进度消息频繁发送，产生大量消息噪音。

**方案一（消息编辑）**：不再发送新消息，而是持续**编辑同一条消息**来更新进度。

**飞书 API**：`im.message.patch`（部分服务商支持）

```typescript
// 编辑已有消息（更新进度）
await client.im.message.patch({
  path: { message_id: progressMessageId },
  data: {
    content: JSON.stringify({ text: newProgressContent }),
  },
});
```

**方案二（消息固定）**：将重要的任务完成消息 Pin 到群聊，方便快速定位。

**飞书 API**：`im.chat.announcement.patch`（群公告）

**效益**：减少消息数量，让聊天记录更整洁，重要信息更突出。

---

### 2.10 飞书审批流程

**当前痛点**：AIBO 执行高风险操作（如删除文件、推送到主分支）时，缺乏人工确认机制。

**方案**：为高风险操作创建飞书审批单，等待人工批准后再执行。

**飞书 API**：`approval.instance.create`

```typescript
// 创建审批实例（高风险操作确认）
const approvalResp = await client.approval.instance.create({
  data: {
    approval_code: HIGH_RISK_APPROVAL_CODE, // 在飞书审批平台预先定义的审批模板
    user_id: initiatorOpenId,
    form: JSON.stringify([
      { id: 'operation', type: 'textarea', value: `将要执行：${dangerousOperation}` },
      { id: 'reason', type: 'textarea', value: `原因：${operationReason}` },
    ]),
  },
});
```

**触发条件**（可配置）：
- 删除重要文件（根目录、配置文件等）
- 推送代码到 `main`/`master` 分支
- 执行数据库迁移
- 部署到生产环境

**效益**：在 AI 自动化能力和人工控制之间建立安全边界，防止 AI 误操作。

---

### 2.11 飞书群组管理增强

**当前痛点**：团队成员加入项目时，需要手动拉入工作群。

**方案**：基于当前已有的 `LarkChatService`（自动创建/复用工作目录对应群聊），进一步增强：

1. **自动 @相关人员**：当 AI 完成特定模块任务时，自动 @ 对应 code owner
2. **群公告自动更新**：每次发布后，自动更新群公告（版本号、发布内容）
3. **工作时间过滤**：非工作时间收到消息时，自动延迟到工作时间处理（可配置）

**飞书 API**：`im.chatMembers.create`（拉人入群）、`im.chat.announcement.patch`（更新群公告）

---

## 三、手机 IM 编程最佳实践

### 3.1 语音输入工作流

**适用场景**：在无法方便打字的情况下（通勤、会议间隙）快速下达 AI 任务。

**最佳实践**：

1. **结构化语音指令**：养成"动词+对象+约束"的口述习惯
   - ❌ 不好："帮我看看代码"
   - ✅ 好："帮我审查 src/auth/login.ts 文件，重点检查 SQL 注入风险和错误处理"

2. **分段表达复杂需求**：将复杂需求分成多条语音消息，每条一个明确目标
   - 第一条：说明背景和目标
   - 第二条：列出具体约束和要求
   - 第三条：说明预期输出格式

3. **用飞书语音消息 + AIBO 转写**：
   - 在飞书中发送语音消息（60 秒上限）
   - AIBO 自动转写并处理（集成腾讯云 ASR 到 Lark 模式后）

4. **复查与修正**：语音转文字后先确认内容，再继续输入或修改后重新发送

---

### 3.2 移动端任务分解策略

**核心原则**：在手机上不适合做长时间监控，要充分利用 AI 的异步能力。

**推荐工作流**：

```
手机上下达任务
    ↓
AIBO 分解为子任务（并行执行）
    ↓
AIBO 实时推送进度到飞书群
    ↓
移动端收到完成通知（表情回应变为 ✅）
    ↓
手机上快速审查结果（飞书卡片格式化展示）
    ↓
如需修改，发语音或文字描述修改点
    ↓
AIBO 继续执行
```

**避免的反模式**：
- ❌ 在手机上盯着一条条工具调用消息等待
- ❌ 任务执行中频繁打断 AI（除非有明显问题）
- ❌ 一次发送过多需求，导致 AI 方向不明确

---

### 3.3 消息组织与线程管理

**建议**：为不同类型的工作创建专属群聊（利用现有的 `group_chat` 模式）：

| 群聊类型 | 用途 | 推荐配置 |
|----------|------|----------|
| `项目名-aibo-dev` | 日常开发任务 | `--type=group_chat` |
| `项目名-aibo-review` | 代码审查专用 | `--type=group_chat` |
| `项目名-aibo-deploy` | 部署与运维 | `--type=group_chat` |
| 私聊 | 个人探索性任务 | `--type=user_chat`（默认） |

**线程使用规范**（集成 Thread 功能后）：
- 每个 AI 任务 = 一个 Thread
- Thread 内包含：用户请求 → 工具调用链 → 最终结果
- 主消息列表只显示任务入口和最终结论

---

### 3.4 异步工作流设计

**场景**：发起一个耗时任务（如完整的代码审查、大规模重构）后，希望先去做其他事。

**最佳实践**：

1. **任务启动确认**：AIBO 接收任务后立即发送确认（当前已通过表情回应实现）

2. **里程碑通知**：为长任务配置阶段性通知（建议新增功能）
   ```
   # 建议的未来命令格式示例：
   /task "重构认证模块" --notify-on-milestone
   ```
   可在 AIBO 完成每个子阶段时主动发消息通知

3. **完成摘要**：任务完成后自动发送 `任务摘要卡片`，包含：
   - 完成的子任务列表
   - 修改的文件清单
   - 遇到的问题和解决方案
   - 建议的后续步骤

4. **结果持久化**：重要任务结果自动归档到飞书文档（不依赖聊天记录）

---

### 3.5 通知与告警管理

**避免消息轰炸**：

| 场景 | 推荐策略 |
|------|----------|
| 工具调用进度 | 合并到 Thread 内，或每 30 秒一条汇总消息 |
| 子代理并行执行进度 | 仅发送开始和结束通知 |
| 错误信息 | 立即 @ 用户，使用 `❌` 卡片突出显示 |
| 成功完成 | 修改原消息表情为 `✅`，可选发一条摘要 |
| 需要用户确认 | 发送交互式卡片（按钮：继续 / 中止 / 修改） |

**通知分级建议**（可通过环境变量配置）：

```dotenv
# 通知级别：quiet（静默）/ normal（正常）/ verbose（详细）
AIBO_LARK_NOTIFY_LEVEL=normal
```

- `quiet`：只发送最终结果和错误
- `normal`：发送任务开始、关键里程碑、最终结果
- `verbose`：发送所有工具调用和进度（当前默认行为）

---

## 四、推荐集成优先级路线图

基于实现复杂度和业务价值综合评估：

### 第一阶段（立即可做，高价值）

| # | 功能 | 实现复杂度 | 效益 |
|---|------|------------|------|
| 1 | 消息表情回应（状态反馈）| 低 ⭐ | 用户体验大幅提升 |
| 2 | 飞书机器人菜单 | 低 ⭐ | 降低使用门槛，移动端友好 |
| 3 | 飞书语音消息转写 | 中 ⭐⭐ | 移动端输入效率 ×3 |
| 4 | 通知级别控制（`AIBO_LARK_NOTIFY_LEVEL`）| 低 ⭐ | 减少消息噪音 |

### 第二阶段（短期规划，中高价值）

| # | 功能 | 实现复杂度 | 效益 |
|---|------|------------|------|
| 5 | 消息线程（Thread）支持 | 中 ⭐⭐ | 聊天记录结构化 |
| 6 | 飞书文档自动生成 | 中 ⭐⭐ | 知识沉淀 |
| 7 | 图片消息处理（视觉输入）| 中 ⭐⭐ | 支持截图驱动开发 |
| 8 | 飞书多维表格任务追踪 | 高 ⭐⭐⭐ | 项目管理闭环 |

### 第三阶段（长期规划，战略价值）

| # | 功能 | 实现复杂度 | 效益 |
|---|------|------------|------|
| 9 | 飞书审批流（高风险操作） | 高 ⭐⭐⭐ | 安全合规 |
| 10 | 飞书任务同步 | 高 ⭐⭐⭐ | 研发管理一体化 |
| 11 | 飞书日历集成 | 中 ⭐⭐ | 自动化会议安排 |
| 12 | 飞书文件发送（大文件） | 低 ⭐ | 代码文件分发 |

---

## 五、实战配置示例

### 完整 `.env` 配置（含建议的新增变量）

```dotenv
# ===== 现有 Lark 配置 =====
AIBO_LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
AIBO_LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_LARK_RECEIVE_ID=ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIBO_LARK_INTERACTIVE_TEMPLATE_ID=AAq0xxxxxxxxxxx

# ===== 建议新增 Lark 配置 =====

# 飞书文档目标文件夹（用于自动创建文档）
AIBO_LARK_DOCS_FOLDER_TOKEN=fldcxxxxxxxxxxxxxxxx

# 飞书多维表格（用于任务追踪）
AIBO_LARK_BITABLE_APP_TOKEN=bascxxxxxxxxxxxxxxxx
AIBO_LARK_BITABLE_TASK_TABLE_ID=tblxxxxxxxxxxxxxxxx

# 通知级别：quiet / normal / verbose
AIBO_LARK_NOTIFY_LEVEL=normal

# 高风险操作审批码（飞书审批平台配置）
AIBO_LARK_HIGH_RISK_APPROVAL_CODE=XXXXXXXX

# 飞书日历 ID（用于自动创建日历事件，primary 为个人主日历）
AIBO_LARK_CALENDAR_ID=primary
```

### 推荐的飞书应用权限清单

在飞书开放平台 → 权限管理 中申请以下权限（按需开启）：

**消息相关（必须）**：
- `im:message` — 读取和发送消息
- `im:message:send_as_bot` — 以机器人发消息
- `im:message.reactions:write` — 为消息添加/删除表情回应 ⭐新增
- `im:message:reply` — 回复消息（Thread 支持）⭐新增

**文件相关**：
- `im:file` — 发送文件消息 ⭐新增
- `im:resource` — 读取消息中的文件（音频转写） ⭐新增

**群组相关**：
- `im:chat` — 管理群聊
- `im:chat:readonly` — 读取群聊信息

**文档相关**（按需）：
- `docx:document` — 读写飞书文档 ⭐新增

**多维表格相关**（按需）：
- `bitable:app` — 读写多维表格 ⭐新增

**任务相关**（按需）：
- `task:task:write_as_app` — 创建任务 ⭐新增

**日历相关**（按需）：
- `calendar:calendar` — 管理日历事件 ⭐新增

**审批相关**（按需）：
- `approval:approval` — 创建审批实例 ⭐新增

---

> 💡 **快速上手建议**：先完成第一阶段的 4 项功能（表情回应、机器人菜单、语音消息、通知级别控制），即可获得明显的效率提升，且实现成本最低。
>
> 📖 更多飞书 OpenAPI 文档：[https://open.feishu.cn/document/home/index](https://open.feishu.cn/document/home/index)
