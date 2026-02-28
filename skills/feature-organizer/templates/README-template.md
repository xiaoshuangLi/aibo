# 项目 README 模板

## 1. 项目标题 (Project Title)
- 使用简洁、描述性的标题
- 标题应清楚表达项目的核心功能或目的

## 2. 项目简介 (Introduction)
- **一句话概述**：用一句话描述项目是什么
- **详细描述**：解释项目的背景、解决的问题、目标用户
- **核心价值**：说明项目的主要优势和独特卖点

## 3. 功能特性 (Features)
- 使用无序列表列出主要功能特性
- 每个特性应简洁明了，突出关键能力
- 可以使用 ✨、🚀、⚡ 等 emoji 增强可读性（可选）

## 4. 快速开始 (Quick Start)
### 先决条件 (Prerequisites)
- 列出运行项目所需的环境、依赖版本等
- 例如：Node.js v18+, Python 3.8+, Docker 等

### 安装步骤 (Installation)
```bash
# 克隆仓库
git clone <repository-url>
cd <project-name>

# 安装依赖
npm install  # 或 yarn install, pip install -r requirements.txt 等

# 配置环境变量（如果需要）
cp .env.example .env
# 编辑 .env 文件配置相关参数
```

### 基本使用 (Basic Usage)
```bash
# 启动开发服务器
npm run dev

# 运行测试
npm test

# 构建生产版本
npm run build
```

## 5. 详细文档 (Detailed Documentation)
- 提供详细的 API 文档链接或说明
- 配置选项说明
- 高级用法示例
- 常见问题解答 (FAQ)
- MCP 工具集成说明（如适用，参见 `docs/mcp.md`）

## 6. 项目结构 (Project Structure)
```
project-root/
├── src/                    # 源代码目录
├── __tests__/             # 测试文件目录
├── docs/                  # 文档目录（env.md、mcp.md 等）
├── features/              # 功能文档目录
├── templates/             # 模板文件目录
├── scripts/               # 脚本工具目录
├── dist/                  # 构建输出目录
├── coverage/              # 测试覆盖率报告
├── .github/               # GitHub 工作流配置
├── package.json           # 依赖和脚本配置
├── tsconfig.json          # TypeScript 配置
├── jest.config.ts         # 测试配置
└── README.md              # 项目文档
```

## 7. 开发指南 (Development Guide)
### 本地开发
- 如何设置开发环境
- 开发工作流程说明
- 代码规范和约定

### 测试要求
- **测试覆盖率**：所有新功能必须达到 90% 以上的测试覆盖率
- **测试位置**：测试文件必须放在 `__tests__` 目录
- **测试类型**：包括单元测试、集成测试和端到端测试

### 提交规范
- 使用 `skills/feature-organizer/templates/git-commit-template.md` 中定义的提交模板
- 遵循 conventional commits 规范
- 提交信息必须包含相关功能描述和变更说明

### 文档更新
- 每个新功能必须在 `features/` 目录创建对应的文档
- 使用 `skills/feature-organizer/templates/feature-template.md` 作为文档模板
- 更新此 README.md 文件以反映新功能

## 8. 贡献指南 (Contributing)
- 如何报告 bug
- 如何提出功能请求
- 代码贡献流程
- 代码审查标准

## 9. 许可证 (License)
- 明确项目的许可证类型
- 例如：MIT License, Apache 2.0, GPL 等

## 10. 致谢 (Acknowledgements)
- 感谢使用的开源项目
- 特别贡献者致谢
- 相关资源链接

## 11. 联系方式 (Contact)
- 项目维护者联系方式
- 社区支持渠道
- 问题反馈地址

---

**注意**：此模板为标准 README 结构指南，请根据实际项目需求调整各部分内容。确保文档保持最新，与代码实现保持同步。