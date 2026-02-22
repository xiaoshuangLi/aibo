# 009 - Lark Integration Support

## Specification

**一句话描述**: 实现飞书(Lark)平台集成支持，允许用户在飞书环境中与AIBO AI助手进行交互，并支持多种交互模式的灵活切换

**解决的问题**: 
- 缺乏在企业协作平台（飞书）中直接使用AI助手的能力
- 需要在不同部署环境（控制台 vs 飞书）之间灵活切换交互模式
- 需要安全的飞书应用认证和消息处理机制
- 需要保持原有的内部命令功能在飞书环境中正常工作

**核心价值**: 
- 扩展AIBO的使用场景到企业协作平台，提升工作效率
- 提供统一的交互架构，支持多平台部署
- 保持完整的功能一致性，无论在控制台还是飞书环境中都能使用相同的命令和功能
- 通过环境变量配置实现安全的飞书集成

---

## Technical Design

### Architecture Overview
Implemented using the Adapter pattern to support multiple platforms:
- **IOChannel Interface**: Defines a unified input/output interface
- **DefaultIOChannel**: Base class implementation for console
- **LarkAdapter**: Specific implementation for Lark platform, inheriting from DefaultIOChannel
- **Session**: Session manager that performs all I/O operations through IOChannel

### Interaction Mode Decision Flow
1. **Command line arguments take priority**: `--interaction=lark|console` or `--interactive`
2. **Environment variables next**: `AIBO_LARK_MODE=true` (backward compatibility) or `AIBO_INTERACTION=lark|console`
3. **Default value**: `console`

### Lark Integration Architecture
- **Authentication**: OAuth2 authentication using App ID and App Secret
- **Message Reception**: WebSocket long connection to receive user messages
- **Message Sending**: REST API to send AI responses
- **Event Handling**: Register various output event handlers (AI response, tool calls, system messages, etc.)

### Error Handling and Security
- **Environment Variable Validation**: Validate required Lark environment variables at startup
- **Exception Handling**: Global error handling to ensure process stability
- **Signal Handling**: Properly handle SIGINT and SIGTERM signals for graceful shutdown

---

## Implementation Plan

### Completed Tasks
✅ **Core Architecture Implementation**
- [x] Implemented LarkAdapter adapter class
- [x] Implemented Lark interactive mode main entry point
- [x] Implemented Lark internal command handler
- [x] Updated main function to support multi-mode startup

✅ **Configuration System Enhancement**  
- [x] Supported command line argument parsing
- [x] Supported multi-level environment variable configuration
- [x] Updated .env.example file

✅ **Test Coverage**
- [x] Wrote unit tests for LarkAdapter
- [x] Wrote unit tests for interactive mode  
- [x] Wrote unit tests for command handler
- [x] Updated configuration tests

✅ **Dependency Management**
- [x] Added @larksuiteoapi/node-sdk dependency
- [x] Updated package.json scripts

✅ **Documentation Updates**
- [x] Created this feature documentation
- [x] Updated related feature documentation references

---

## Usage Guide

### Quick Start
1. **Get Lark App Credentials**:
   - Create an enterprise self-built app on Lark Open Platform
   - Get App ID and App Secret
   - Configure bot permissions and event subscriptions

2. **Configure Environment Variables**:
   ```bash
   # .env file
   AIBO_INTERACTION=lark
   AIBO_LARK_APP_ID=your-app-id
   AIBO_LARK_APP_SECRET=your-app-secret
   ```

3. **Start the Application**:
   ```bash
   npm run dev:lark
   # or
   AIBO_INTERACTION=lark npm run dev
   ```

4. **Use in Lark**:
   - @mention the bot in Lark group chat or private chat
   - Send messages to interact with the AI assistant
   - Use internal commands to control behavior

### Advanced Configuration
- **Custom Receive ID**: Set `AIBO_LARK_RECEIVE_ID` to specify default message recipient
- **Output Mode**: Enable verbose output with `AIBO_VERBOSE_OUTPUT=true`
- **Model Selection**: Specify AI model with `AIBO_MODEL_NAME`

### Troubleshooting
- **Authentication Failure**: Check if App ID and App Secret are correct
- **No Message Response**: Confirm Lark app has correct event subscription configured
- **Startup Error**: Check console logs and ensure all required environment variables are set

---

## Impact Analysis

### Positive Impacts
- ✅ **Expanded Use Cases**: Supports enterprise collaboration platform integration
- ✅ **Enhanced User Experience**: Direct AI assistant usage in work environment
- ✅ **Architecture Improvement**: Unified IO abstraction layer facilitates future platform extensions
- ✅ **Configuration Flexibility**: Multiple ways to configure interaction mode

### Potential Risks
- ⚠️ **Increased Dependencies**: Introduced new third-party dependency (@larksuiteoapi/node-sdk)
- ⚠️ **Configuration Complexity**: Added more environment variable configuration options
- ⚠️ **Maintenance Cost**: Requires maintaining additional platform-specific code

### Compatibility
- ✅ **Backward Compatible**: Existing console mode is completely unaffected
- ✅ **Configuration Compatible**: Supports old AIBO_LARK_MODE environment variable
- ✅ **API Compatible**: Core functionality interfaces remain unchanged

---