# Tencent Cloud ASR Voice Input

## 📋 功能概述 (Feature Overview)

### 🎯 一句话描述
实现实时语音输入功能，通过腾讯云ASR服务将麦克风录制的音频转换为文本，支持命令行交互模式下的语音输入。

### 💡 业务价值
- **解决的问题**: 用户在命令行环境中需要手动输入文本，对于长文本或复杂指令输入效率较低，且无法满足无障碍使用需求。
- **带来的价值**: 提供便捷的语音输入方式，提升用户交互体验，支持无障碍访问，并增加AI助手的多模态交互能力。
- **目标用户**: 所有使用AIBO命令行工具的开发者和用户，特别是需要频繁输入长文本或希望使用语音交互的用户。

### 🔗 相关背景
- **相关 Issue/PR**: 无特定Issue，作为核心功能增强的一部分
- **设计文档**: 基于腾讯云官方ASR API文档和Node.js SDK最佳实践
- **依赖项**: 
  - 腾讯云账号和ASR服务权限
  - `tencentcloud-sdk-nodejs` SDK
  - `node-record-lpcm16` 音频录制库
  - 系统音频录制工具（如sox）

---

## 🏗️ 技术设计 (Technical Design)

### 📐 架构概览
Tencent Cloud ASR功能作为独立的工具模块集成到AIBO系统中，通过以下组件协同工作：
1. **音频录制模块**: 使用`node-record-lpcm16`库捕获麦克风音频
2. **ASR客户端模块**: 封装腾讯云ASR SDK，处理认证和API调用
3. **交互集成模块**: 在命令行交互模式中提供`/voice`命令和键盘快捷键支持
4. **配置管理模块**: 通过环境变量管理腾讯云认证信息

### ⚙️ 核心实现
#### 主要组件/模块
- **TencentASR类**: 核心ASR功能封装，提供录音、识别、连续识别等方法
- **createTencentASR工厂函数**: 创建配置化的ASR实例
- **交互命令处理器**: 在`/voice`命令和双击空格键中调用ASR功能

#### 关键技术决策
- **选择腾讯云ASR**: 腾讯云ASR在中文语音识别方面具有高准确率和低延迟优势
- **PCM音频格式**: 使用16kHz单声道PCM格式，平衡音质和传输效率
- **异步非阻塞设计**: 所有ASR操作都是异步的，不会阻塞主程序执行
- **手动录制模式**: 支持按住快捷键开始录制，松开结束，提供更好的用户体验

#### 数据流/状态管理
1. 用户触发语音输入（`/voice`命令或双击空格键）
2. 系统检查麦克风访问权限和录制能力
3. 开始音频录制，收集音频数据块
4. 录制结束后，将音频数据编码为Base64
5. 调用腾讯云ASR API进行语音识别
6. 接收识别结果并作为用户输入传递给AI Agent处理

### 🧩 API 变更
#### 新增 API
```typescript
// TencentASR配置接口
interface TencentAsrConfig {
  appId: string;
  secretId: string;
  secretKey: string;
  region?: string;
  engineModelType?: string;
  voiceFormat?: string;
  hotwordId?: string;
  filterDirty?: number;
  filterModal?: number;
  filterPunc?: number;
  convertNumMode?: number;
  wordInfo?: number;
}

// TencentASR核心类
class TencentASR {
  constructor(config: Partial<TencentAsrConfig> = {});
  canRecord(): boolean;
  recognizeSpeech(duration: number = 5000): Promise<string | null>;
  startManualRecording(): Promise<void>;
  stopManualRecording(): Promise<Buffer | null>;
  isManualRecording(): boolean;
  startContinuousRecognition(
    onResult: (text: string) => void,
    onError: (error: Error) => void
  ): () => void;
}

// 工厂函数
function createTencentASR(config: Partial<TencentAsrConfig> = {}): TencentASR;
```

#### 修改的 API
- **src/index.ts**: 添加了`/voice`和`/speech`命令处理逻辑
- **src/config.ts**: 添加了腾讯云ASR相关的环境变量配置

#### 废弃的 API
- 无废弃API

---

## 🚀 使用指南 (Usage Guide)

### 📦 安装/配置
1. **安装依赖**:
   ```bash
   npm install tencentcloud-sdk-nodejs node-record-lpcm16
   ```

2. **系统依赖**:
   - 确保系统已安装音频录制工具（如sox）
   - macOS: `brew install sox --with-flac --with-lame --with-libvorbis`
   - Ubuntu/Debian: `sudo apt-get install sox libsox-fmt-all`

3. **环境变量配置**:
   在`.env`文件中添加腾讯云认证信息：
   ```env
   # Tencent Cloud ASR Configuration
   TENCENTCLOUD_APP_ID=your-app-id
   TENCENTCLOUD_SECRET_ID=your-secret-id
   TENCENTCLOUD_SECRET_KEY=your-secret-key
   TENCENTCLOUD_REGION=ap-shanghai
   ```

### 🎮 基本使用
```typescript
import { createTencentASR } from './utils/tencent-asr';

// 创建ASR实例
const asr = createTencentASR();

// 录制5秒音频并识别
const result = await asr.recognizeSpeech(5000);
if (result) {
  console.log(`识别结果: ${result}`);
}
```

### 🏆 高级用法
#### 手动录制模式
```typescript
// 开始手动录制
await asr.startManualRecording();

// ... 用户说话 ...

// 停止录制并获取结果
const audioBuffer = await asr.stopManualRecording();
if (audioBuffer) {
  const result = await asr.recognizeManualRecording(audioBuffer);
  console.log(`识别结果: ${result}`);
}
```

#### 连续识别模式
```typescript
// 启动连续识别
const stopRecognition = asr.startContinuousRecognition(
  (text) => {
    console.log(`识别到语音: ${text}`);
    // 处理识别结果
  },
  (error) => {
    console.error('识别错误:', error);
  }
);

// 停止连续识别
stopRecognition();
```

### 🔄 迁移指南
#### 从旧版本迁移
此功能为新增功能，无需迁移。只需按照上述配置步骤启用即可。