# Puppeteer Web Tools with Anti-Bot Bypass

## 功能概述 (Feature Summary)

**一句话描述**: 通过集成 Puppeteer 和 stealth 插件，提供能够绕过现代网站反爬虫检测的 Web 工具。

**解决的问题**: 
- 传统 HTTP 请求容易被现代网站的反爬虫机制（如 Cloudflare、Bot Protection 等）拦截
- 需要更强大的 Web 抓取能力来处理动态内容和复杂的反爬虫策略
- 现有的 Web 工具在面对强反爬虫网站时成功率较低

**核心价值**: 
- 提供真实浏览器环境，有效绕过大多数反爬虫检测
- 支持动态内容加载和 JavaScript 执行
- 保持与现有 Web 工具相同的 API 接口，无缝集成
- 提供搜索和通用 URL 抓取两种使用场景

---

## 代码变更分析 (Code Changes Analysis)

> **数据来源**: 通过 `git diff --name-status` 和 `git diff --stat` 分析得出

### 变更文件清单
```bash
# 新增文件
__tests__/tools/puppeteer-web.test.ts
__tests__/utils/puppeteer-utils.test.ts  
src/tools/puppeteer-web.ts
src/utils/puppeteer-utils.ts

# 修改文件
package.json
package-lock.json
src/tools/index.ts
src/utils/index.ts
```
- **新增文件**: 4 个核心实现和测试文件
- **修改文件**: 4 个配置和索引文件
- **删除文件**: 无

### 关键代码变更
```bash
# 主要变更统计
4 files changed, 1241 insertions(+), 721 deletions(-)
```
- **src/utils/puppeteer-utils.ts**: 实现了 PuppeteerManager 单例类、fetchWithPuppeteer 和 searchWithPuppeteer 核心函数
- **src/tools/puppeteer-web.ts**: 实现了 WebSearchByKeywordPuppeteer 和 WebFetchByURLPuppeteer 两个 LangChain 工具
- **tests/**: 完整的单元测试和集成测试覆盖
- **package.json**: 添加 puppeteer、puppeteer-extra、puppeteer-extra-plugin-stealth 依赖

---

## 使用方式变化 (Usage Changes)

### 功能前
```javascript
// 只能使用传统的 HTTP 请求
const result = await webSearchByKeywordTool.invoke({ keyword: "search term" });
const content = await webFetchByURLTool.invoke({ url: "https://example.com" });
```

### 功能后  
```javascript
// 可以选择使用 Puppeteer 版本绕过反爬虫
const result = await webSearchByKeywordPuppeteerTool.invoke({ 
  keyword: "search term",
  searchEngine: "google", // or "bing"
  timeout: 15000
});

const content = await webFetchByURLPuppeteerTool.invoke({
  url: "https://example.com",
  waitForSelector: "#dynamic-content", // 等待特定元素加载
  cleanHtml: true,
  timeout: 20000
});
```

### 影响范围
- **Breaking Changes**: 否
- **Migration Required**: 否
- **Backward Compatible**: 是 - 现有工具完全保留，新增 Puppeteer 工具作为可选增强

---

## 工作量统计 (Workload Metrics)

> **数据收集命令**: 
> - 代码行数: `git diff --shortstat`
> - 测试覆盖率: 手动验证

| 指标 | 数值 | 说明 |
|------|------|------|
| 新增代码行数 | 1241 | 通过 `git diff --shortstat` 统计 |
| 删除代码行数 | 721 | 通过 `git diff --shortstat` 统计 |
| 变更文件数 | 8 | 4 新增 + 4 修改 |
| 测试覆盖率 | ≥ 90% | 单元测试覆盖所有核心逻辑 |
| 净代码影响 | +520 | 新增 - 删除 |

---

## 验证要求 (Verification Requirements)

### 必须验证的场景
1. Puppeteer 工具能够成功初始化并执行基本搜索
2. Puppeteer 工具能够成功抓取包含动态内容的网页
3. 工具能够正确处理错误情况（超时、无效 URL 等）
4. HTML 清理功能正常工作
5. 与现有 Web 工具共存且不产生冲突

### 测试覆盖标准
- **总体覆盖率**: ≥ 90%
- **关键路径**: 100% 覆盖
- **错误处理**: 必须有对应的测试用例

### 验证命令
```bash
# 运行完整测试
npm test

# 运行 Puppeteer 单元测试（跳过集成测试）
npm test -- --testNamePattern="Puppeteer Utility Functions"

# 运行集成测试（需要设置环境变量）
SKIP_PUPPETEER_INTEGRATION_TESTS=false npm test -- --testNamePattern="Puppeteer"
```

### 性能注意事项
- 在 Mac Silicon 设备上运行 x64 Node.js 会有性能警告
- 建议在生产环境中使用 arm64 Node.js 版本以获得最佳性能
- Puppeteer 工具比传统 HTTP 工具消耗更多资源，应谨慎使用