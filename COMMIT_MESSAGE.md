feat: 添加 Web 工具 HTML 清理功能

- 为 WebSearchByKeywordTool 添加实际搜索结果获取和 HTML 清理功能
- 为 WebFetchByURLTool 添加自动 HTML 内容清理，支持可选禁用
- 实现 cleanHtmlContent 函数，移除 script、style、nav、footer、广告等无用元素
- 添加全面的测试覆盖，确保 90%+ 的代码覆盖率
- 保持完全向后兼容，无 Breaking Changes
- 相关功能: #006-enhanced-web-tools-with-html-cleaning