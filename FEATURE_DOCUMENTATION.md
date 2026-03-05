# 📸 图像上传与处理功能

## 功能概述
本次更新为 AIBO 添加了完整的图像上传和处理能力，支持在飞书和终端模式下处理本地图像文件。

## 主要特性
- 🖼️ **本地图像读取**: 新增 `read-image` 工具，支持读取 JPEG、PNG、GIF、WebP 格式的本地图像文件
- 📤 **图像上传中间件**: 新增 `image-upload` 中间件，处理图像文件的上传和 Base64 编码
- 💬 **飞书图像集成**: 飞书适配器现在支持图像消息的发送和处理
- 🔌 **WebSocket 客户端**: 新增 WebSocket 客户端支持，用于实时通信
- 🧪 **完整测试覆盖**: 为所有新功能添加了完整的单元测试

## 技术实现
### 核心组件
1. **`src/tools/read-image.ts`** - 图像读取工具
   - 支持多种图像格式 (JPEG, PNG, GIF, WebP)
   - 自动检测图像格式并返回 Base64 编码
   - 与 vision-capable 模型无缝集成

2. **`src/core/middlewares/image-upload.ts`** - 图像上传中间件
   - 处理图像文件上传逻辑
   - 提供统一的图像处理接口
   - 支持大文件分块处理

3. **`src/presentation/lark/ws-client.ts`** - WebSocket 客户端
   - 实现实时双向通信
   - 支持飞书机器人的高级交互功能

### 飞书集成增强
- **`src/presentation/lark/adapter.ts`** - 更新了适配器以支持图像消息
- **新增测试文件** - 确保飞书图像功能的稳定性

## 使用示例
### 终端模式
```bash
# 用户可以要求 AI 分析本地图像
"分析这张图片中的内容"
# AI 会自动调用 read-image 工具读取用户指定的图像文件
```

### 飞书模式
- 用户可以直接在飞书聊天中发送图像
- AIBO 会自动处理图像并提供分析结果
- 支持图像相关的多轮对话

## 版本信息
- **包版本**: 1.0.6
- **功能状态**: 已完成并测试通过
- **兼容性**: 向后兼容，不影响现有功能

## 测试覆盖
- ✅ `__tests__/tools/read-image.test.ts` - 图像读取工具测试
- ✅ `__tests__/core/agent/image-upload.test.ts` - 图像上传中间件测试  
- ✅ `__tests__/presentation/lark/adapter-upload-image.test.ts` - 飞书图像适配器测试
- ✅ `__tests__/presentation/lark/ws-client.test.ts` - WebSocket 客户端测试
- ✅ 其他相关功能的回归测试

## 后续计划
- [ ] 添加更多图像处理功能（裁剪、缩放、滤镜等）
- [ ] 支持云存储图像上传
- [ ] 增强图像识别和分析能力