# Playwright 浏览器自动化工具集成

## 功能概述

本功能为 AIBO AI 助手集成了完整的 Playwright 浏览器自动化工具集，使 AI 能够执行网页浏览、交互、内容提取和自动化测试等操作。同时对现有的 CLI 工具（Claude、Cursor、Codex）进行了优化和改进。

## 主要特性

### 1. Playwright 浏览器自动化工具集

新增了 11 个强大的浏览器自动化工具，涵盖网页导航、交互、内容获取等完整场景：

#### 核心导航工具
- **`browser_navigate`**: 导航到指定 URL，支持多种加载状态等待策略
- **`browser_wait_load`**: 等待页面达到特定加载状态（load/domcontentloaded/networkidle）
- **`browser_wait_selector`**: 等待特定元素出现或状态变化

#### 内容获取工具
- **`browser_get_content`**: 获取当前页面的完整 HTML 内容
- **`browser_screenshot`**: 截取页面截图（支持全页截图），返回 base64 编码的 PNG 图像
- **`browser_evaluate`**: 在页面上下文中执行 JavaScript 表达式，用于复杂数据提取

#### 用户交互工具
- **`browser_click`**: 点击页面元素（支持 CSS 选择器、角色选择器、文本选择器）
- **`browser_type`**: 在输入框中输入文本（自动清空现有内容）
- **`browser_press`**: 按下键盘按键（支持组合键如 Control+a）
- **`browser_select_option`**: 在下拉菜单中选择选项
- **`browser_hover`**: 鼠标悬停在元素上（用于触发悬停菜单或工具提示）

### 2. 安全性保障

- **脚本安全检查**: `browser_evaluate` 工具内置安全策略，阻止危险操作：
  - 禁止访问 `document.cookie`
  - 禁止读取 `localStorage`/`sessionStorage`
  - 禁止使用 `eval()`、`Function()` 构造函数
  - 禁止网络请求（`fetch()`、`XMLHttpRequest`）
  - 禁止动态导入（`import()`）

- **超时保护**: 所有操作都有合理的超时限制（10-30秒），防止无限等待

- **单例浏览器管理**: 使用单例模式管理浏览器实例，确保资源高效利用

### 3. CLI 工具优化

#### Claude 工具改进
- 将权限跳过参数从 `--yolo` 更新为更明确的 `--dangerously-skip-permissions`
- 保持向后兼容性的同时提高安全性语义

#### Cursor 工具重构
- 从工厂模式重构为直接实现，提供更好的控制粒度
- 新增 `--continue` 参数支持，允许继续之前的会话
- 更精确的错误处理和进度报告

#### Codex 工具优化
- 移除冗余的 prompt flag，直接将 prompt 作为命令参数传递
- 简化调用流程，提高执行效率

### 4. 系统提示增强

更新了系统提示模板，增加了关于工具使用的详细指导：
- 明确区分直接执行 vs 子任务代理的决策准则
- 提供并行执行的最佳实践示例
- 强调在复杂决策前使用 `think` 工具进行推理

## 使用场景

### 网页内容抓取与分析
```typescript
// 获取网页标题和内容
await browserNavigateTool.invoke({ url: "https://example.com" });
const content = await browserGetContentTool.invoke();
const title = await browserEvaluateTool.invoke({ script: "document.title" });
```

### 自动化表单填写
```typescript
// 自动填写登录表单
await browserNavigateTool.invoke({ url: "https://login.example.com" });
await browserTypeTool.invoke({ selector: "#username", text: "user@example.com" });
await browserTypeTool.invoke({ selector: "#password", text: "password123" });
await browserClickTool.invoke({ selector: "button[type='submit']" });
```

### 视觉验证与调试
```typescript
// 截取页面截图用于视觉验证
const screenshot = await browserScreenshotTool.invoke({ full_page: true });
// 等待特定元素加载完成
await browserWaitSelectorTool.invoke({ selector: ".loading-spinner", state: "hidden" });
```

### 复杂数据提取
```typescript
// 提取商品价格列表
const prices = await browserEvaluateTool.invoke({
  script: "() => Array.from(document.querySelectorAll('.price')).map(el => el.textContent)"
});
```

## 技术实现细节

### 浏览器实例管理
- 使用 Chromium 无头模式启动浏览器
- 单例模式确保整个 AI 会话期间复用同一个浏览器实例
- 自动检测浏览器连接状态，必要时重新启动

### 错误处理机制
- 统一的错误格式化函数 `formatError()`
- 详细的错误信息包含工具名称和具体错误消息
- JSON 格式化输出便于 AI 解析和处理

### 测试覆盖
- 完整的单元测试覆盖所有 11 个工具
- 模拟 Playwright API 进行隔离测试
- 验证成功和失败场景的正确处理

## 依赖更新

- **新增依赖**: `playwright@^1.55.1`
- **版本兼容性**: 支持 Playwright 1.55+ 版本
- **系统要求**: 需要安装相应的浏览器二进制文件（Playwright 会自动处理）

## 向后兼容性

- 所有现有功能保持完全兼容
- CLI 工具的接口保持不变，仅内部实现优化
- 系统提示的增强不会影响现有工作流程

## 性能考虑

- **资源效率**: 单例浏览器实例避免重复启动开销
- **内存管理**: 及时清理关闭的页面实例
- **并发安全**: 工具设计支持在多线程环境中安全使用

## 未来扩展方向

1. **更多浏览器支持**: 添加 Firefox 和 WebKit 支持
2. **设备模拟**: 支持移动设备、平板等不同设备类型
3. **网络拦截**: 允许拦截和修改网络请求
4. **性能监控**: 集成页面加载性能指标收集
5. **视觉回归测试**: 支持像素级图像比较

## 故障排除

### 常见问题
1. **浏览器启动失败**: 确保系统有足够权限和磁盘空间
2. **元素找不到**: 使用 `browser_wait_selector` 确保元素已加载
3. **超时错误**: 调整超时参数或检查网络连接
4. **脚本被阻止**: 检查 `browser_evaluate` 中是否包含被禁止的操作

### 调试建议
- 使用 `browser_screenshot` 工具查看当前页面状态
- 启用详细日志记录以跟踪工具执行过程
- 在复杂场景中分步骤执行，逐步验证每个操作

## 贡献指南

欢迎对 Playwright 工具集进行扩展和改进：
1. 遵循现有的代码风格和错误处理模式
2. 为新工具编写完整的单元测试
3. 更新此文档以反映新功能
4. 考虑安全性和性能影响

---
**Commit Message**: feat(tools): 集成 Playwright 浏览器自动化工具集

**主要变更**:
- **Playwright 工具集**: 添加 11 个浏览器自动化工具，支持网页导航、交互、内容提取和截图
- **安全性增强**: `browser_evaluate` 工具内置安全策略，阻止 cookie 访问、localStorage 读取、eval() 等危险操作
- **CLI 工具优化**: Claude/Cursor/Codex 工具改进和重构
- **系统提示改进**: 增强工具使用指导和最佳实践

**测试覆盖**: 为 Playwright 工具集添加完整的单元测试，验证所有成功和失败场景

**依赖更新**: 添加 `playwright@^1.55.1` 依赖

**Fixes**: #0000 (Playwright browser automation integration)

**版本**: 1.0.5  
**作者**: AIBO Team  
**最后更新**: 2024年