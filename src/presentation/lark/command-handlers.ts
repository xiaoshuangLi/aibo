import { config } from '@/core/config/config';
import { styled } from '@/presentation/styling/output-styler';
import { SessionManager } from '@/infrastructure/session/session-manager';
import { executeBashTool } from '@/tools/bash';
import { getRestartCommand } from '@/shared/utils/restart-helper';

/**
 * Command Handlers module for Lark that provides internal command processing functionality.
 * 
 * This module handles all the internal commands available in the Lark interactive mode,
 * such as /help, /verbose, /new, /abort and /exit commands.
 * Each command has its own dedicated handler function with proper error handling.
 * 
 * @module lark-command-handlers
 */

// ==================== 内部命令处理器辅助函数 ====================

/**
 * 将会话元数据转换为Markdown格式
 * 
 * 中文名称：将会话元数据转换为Markdown格式
 * 
 * 预期行为：
 * - 接收session metadata对象（AITelemetryRecord结构）
 * - 将其转换为格式化的Markdown字符串
 * - 包含模型使用量、token统计、执行时间等信息
 * - 返回Markdown格式的字符串
 * 
 * 行为分支：
 * 1. 正常情况：成功转换并返回Markdown格式字符串
 * 2. 元数据为空或无效：返回空字符串或默认信息
 * 3. 无异常情况：该函数不抛出异常，始终返回字符串
 * 
 * @param metadata - 会话元数据对象，包含AI监控信息（AITelemetryRecord类型）
 * @returns string - Markdown格式的元数据信息
 */
export function formatSessionMetadataToMarkdown(metadata: any): string {
  if (!metadata) {
    return "ℹ️ **无会话元数据**\n\n当前会话没有可用的元数据信息。";
  }

  try {
    // 提取关键信息 - 支持 AITelemetryRecord 嵌套结构
    const model = metadata.model_info?.model_name || metadata.model || '未知模型';
    const totalTokens = metadata.token_usage?.total_tokens || metadata.totalTokens || 0;
    const promptTokens = metadata.token_usage?.input_tokens || metadata.promptTokens || 0;
    const completionTokens = metadata.token_usage?.output_tokens || metadata.completionTokens || 0;
    const executionTime = metadata.latency_ms ? `${(metadata.latency_ms / 1000).toFixed(2)}s` : 
                        (metadata.executionTime ? `${(metadata.executionTime / 1000).toFixed(2)}s` : '未知');
    const timestamp = metadata.start_time ? new Date(metadata.start_time).toLocaleString('zh-CN') : 
                     (metadata.timestamp ? new Date(metadata.timestamp).toLocaleString('zh-CN') : '未知时间');
    const sessionId = metadata.session_info?.session_id || metadata.sessionId || '未知会话ID';

    // 构建Markdown格式
    const markdown = `📊 **会话元数据统计**

**会话信息**
- 会话ID: \`${sessionId}\`
- 时间戳: ${timestamp}
- 执行时长: ${executionTime}

**模型使用**
- 模型: ${model}
- 总Token数: ${totalTokens.toLocaleString()}
- 输入Token: ${promptTokens.toLocaleString()}
- 输出Token: ${completionTokens.toLocaleString()}

**资源使用概览**
- Token效率: ${(completionTokens / (promptTokens || 1)).toFixed(2)} (输出/输入比)
- 平均响应时间: ${executionTime}

> 💡 这些统计数据帮助您了解AI助手的使用情况和资源消耗。
`;

    return markdown;
  } catch (error) {
    console.error('格式化会话元数据时出错:', error);
    return "⚠️ **元数据格式化失败**\n\n无法正确显示会话元数据信息。";
  }
}

/**
 * 处理帮助命令
 * 
 * 中文名称：处理帮助命令
 * 
 * 预期行为：
 * - 显示所有可用的内部命令及其说明
 * - 通过Lark消息系统发送帮助信息给用户
 * - 在控制台也显示帮助信息（用于调试）
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：总是成功显示帮助信息并返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，用于通过adapter发送消息
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 */
export async function handleHelpCommand(session: any): Promise<boolean> {
  const helpMessage = `🤖 **AIBO 助手命令指南**

✨ **核心控制命令**
• \`/help\`      - 显示此帮助指南
• \`/exit\`      - ✅ 立即安全退出
• \`/new\`       - 🆕 创建全新会话
• \`/abort\`     - ⏹️  中断当前操作
• \`/verbose\`   - 📊 切换详细/简洁模式
• \`/rebot\`     - 🔄 重启并重新构建

📂 **文件管理命令**  
• \`/show-files\` - 📋 查看工作区改动文件
• \`/show-diff\`  - 🔍 查看所有文件详细差异
• \`/diff <文件>\` - 📄 查看指定文件差异
• \`/revert <文件>\` - ↩️ 撤销文件改动
• \`/stage <文件>\` - ✅ 暂存文件改动

💡 **小贴士**
• 带 ✅ 的命令可随时使用
• 文件路径支持自动补全
• 使用 \`/verbose\` 获得更详细的输出
`;

  // 通过 Lark 消息系统发送帮助信息
  await session.adapter.emit({
    type: 'commandExecuted',
    data: { 
      command: '/help', 
      result: { 
        success: true, 
        message: helpMessage
      } 
    },
    timestamp: Date.now()
  });
  
  // 控制台显示（用于调试）
  console.log(helpMessage);
  return true;
}

/**
 * 处理切换详细输出模式命令
 * 
 * 中文名称：处理切换详细输出模式命令
 * 
 * 预期行为：
 * - 切换配置中的verbose输出模式
 * - 显示当前输出模式状态
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功切换模式并显示状态，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 */
export async function handleVerboseCommand(): Promise<boolean> {
  config.output.verbose = !config.output.verbose;
  console.log(styled.system(`${config.output.verbose ? '📊 **输出模式已切换**\n\n当前模式: **详细输出**\n\n💡 在此模式下，您将看到完整的工具输出和详细信息。' : '📋 **输出模式已切换**\n\n当前模式: **简洁输出**\n\n💡 在此模式下，长内容会自动截断以保持界面整洁。'}`));
  return true;
}

/**
 * 处理创建新会话命令
 * 
 * 中文名称：处理创建新会话命令
 * 
 * 预期行为：
 * - 获取当前会话的AI监控元数据
 * - 如果元数据存在，通过Lark消息系统发送模型使用量统计信息
 * - 为会话生成新的线程ID
 * - 显示新会话创建成功的消息
 * - 触发commandExecuted事件
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功发送使用量信息、生成新ID并显示消息，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，其threadId属性将被更新为新的会话ID
 * @returns Promise<boolean> - 始终返回true，表示命令处理成功
 */
export async function handleNewCommand(session: any): Promise<boolean> {
  const sessionManager = SessionManager.getInstance();
  
  // 先获取当前会话的AI监控元数据并通过Lark消息系统发送统计信息
  const metadata = sessionManager.getCurrentSessionMetadata();
  if (metadata) {
    const formattedInfo = formatSessionMetadataToMarkdown(metadata);
    
    // 通过 Lark 消息系统发送使用量统计信息
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: '/new', 
        result: { 
          success: true, 
          message: formattedInfo
        } 
      },
      timestamp: Date.now()
    });
  }
  
  session.threadId = sessionManager.clearCurrentSession();
  
  // 触发commandExecuted事件（新会话创建成功）
  await session.adapter.emit({
    type: 'commandExecuted',
    data: { 
      command: '/new', 
      result: { 
        success: true, 
        sessionId: session.threadId,
        message: `✅ 已创建新会话 (ID: ${session.threadId})`
      } 
    },
    timestamp: Date.now()
  });
  
  console.log(styled.system(`🆕 **新会话已创建**\n\n会话ID: \`${session.threadId}\`\n\n✅ 您现在处于全新的对话环境中，之前的上下文已被清除。`));
  return true;
}

/**
 * 处理中断当前操作命令
 * 
 * 中文名称：处理中断当前操作命令
 * 
 * 预期行为：
 * - 中断当前正在运行的操作
 * - 显示中断成功的消息
 * - 触发commandExecuted事件
 * - 返回true表示命令处理成功
 * 
 * 行为分支：
 * 1. 正常情况：成功中断操作并显示消息，返回true
 * 2. 无当前操作：显示无操作可中断的消息，返回true
 * 3. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param session - 会话对象，包含abortController用于中断操作
 * @returns Promise<boolean> - 始终返回true，表示命令处理完成
 */
export async function handleAbortCommand(session: any): Promise<boolean> {
  let success = false;
  let message = "";
  
  if (session.abortController && !session.abortController.signal.aborted) {
    session.abortController.abort();
    success = true;
    message = "⏹️ **操作已中断**\n\n当前任务已被成功取消，您可以开始新的操作。";
  } else {
    message = "ℹ️ **无操作可中断**\n\n当前没有正在运行的任务。";
  }
  
  // 触发commandExecuted事件
  await session.adapter.emit({
    type: 'commandExecuted',
    data: { 
      command: '/abort', 
      result: { 
        success: success, 
        message: message
      } 
    },
    timestamp: Date.now()
  });
  
  console.log(styled.system(message));
  return true;
}

/**
 * 处理退出命令
 * 
 * 预期行为：
 * - 显示安全退出消息
 * - 终止进程（调用process.exit(0)）
 * - 理论上返回true，但实际上不会执行到return语句
 * 
 * 行为分支：
 * 1. 正常情况：显示退出消息，终止进程
 * 2. 无异常情况：该函数不抛出异常，但实际不会返回值
 * 
 * @param session - 会话对象，用于正确结束会话
 * @returns Promise<boolean> - 理论上返回true，但实际上由于process.exit()调用而不会执行
 */
export async function handleExitCommand(session: any): Promise<boolean> {
  console.log(styled.system("👋 **正在安全退出 AIBO 助手**\n\n感谢您的使用！所有资源已正确释放。"));
  
  // End the session properly
  session.end();
  process.exit(0);
  return true;
}

/**
 * 处理重启命令
 * 
 * 中文名称：处理重启命令
 * 
 * 预期行为：
 * - 执行 npm run build 命令构建项目
 * - 验证构建是否成功（解析 JSON 响应）
 * - 如果构建成功，优雅关闭当前 Lark 会话
 * - 重新启动新的 Lark 交互模式进程
 * - 如果构建失败，显示错误信息并保持当前会话运行
 * 
 * 行为分支：
 * 1. 构建成功：关闭当前会话，使用 spawn 重新启动 Lark 模式
 * 2. 构建失败：显示构建错误信息，返回 false
 * 3. 执行异常：捕获并显示错误信息，返回 false
 * 
 * @param session - 会话对象，用于正确结束会话
 * @returns Promise<boolean> - 构建成功时返回 true（实际上会重启进程），失败时返回 false
 */
export async function handleRebotCommand(session: any): Promise<boolean> {
  try {
    const sessionManager = SessionManager.getInstance();
    
    // 先获取当前会话的AI监控元数据并通过Lark消息系统发送统计信息
    const metadata = sessionManager.getCurrentSessionMetadata();
    if (metadata) {
      const formattedInfo = formatSessionMetadataToMarkdown(metadata);
      
      // 通过 Lark 消息系统发送使用量统计信息
      await session.adapter.emit({
        type: 'commandExecuted',
        data: { 
          command: '/rebot', 
          result: { 
            success: true, 
            message: formattedInfo
          } 
        },
        timestamp: Date.now()
      });
    }
    
    console.log(styled.system("🔄 **正在执行项目构建**\n\n这可能需要几秒钟时间，请稍候..."));
    
    // 执行 npm run build 命令
    const resultJson = await executeBashTool.invoke({
      command: "npm run build",
      timeout: 60000, // 60秒超时
      cwd: process.cwd()
    });
    
    // 解析构建结果
    const result = JSON.parse(resultJson);
    
    // 检查构建结果
    if (result.success) {
      console.log(styled.system("✅ **构建成功！**\n\n正在重启 Lark 交互模式..."));
      
      // 触发commandExecuted事件
      await session.adapter.emit({
        type: 'commandExecuted',
        data: { 
          command: '/rebot', 
          result: { 
            success: true, 
            message: "✅ 构建成功，正在重启..."
          } 
        },
        timestamp: Date.now()
      });
      
      // 优雅关闭当前会话
      session.end();
      
      // 重新启动 Lark 交互模式
      // 使用工具函数获取正确的重启命令和参数
      const { spawn } = require('child_process');
      const { restartCommand, restartArgs } = getRestartCommand();
      
      const child = spawn(restartCommand, restartArgs, {
        env: { ...process.env, AIBO_INTERACTION: 'lark' },
        stdio: 'inherit',
        detached: false,
        cwd: process.cwd() // 确保工作目录正确
      });
      
      // 等待子进程启动后退出当前进程
      child.on('spawn', () => {
        process.exit(0);
      });
      
      child.on('error', (error: Error) => {
        console.error(styled.error(`❌ 重启失败: ${error.message}`));
        process.exit(1);
      });

      return true;
    } else {
      // 构建失败
      const errorMessage = `构建失败！\n错误: ${result.error}\n消息: ${result.message}\n标准输出: ${result.stdout}\n标准错误: ${result.stderr}`
        .substring(0, 1000); // 限制输出长度
      
      console.log(styled.error(errorMessage));
      
      // 触发commandExecuted事件
      await session.adapter.emit({
        type: 'commandExecuted',
        data: { 
          command: '/rebot', 
          result: { 
            success: false, 
            message: `❌ 构建失败: ${errorMessage}`
          } 
        },
        timestamp: Date.now()
      });
      
      return false;
    }
  } catch (error) {
    const errorMessage = `执行构建时发生错误: ${(error as Error).message || String(error)}`;
    console.log(styled.error(errorMessage));
    
    // 触发commandExecuted事件
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: '/rebot', 
        result: { 
          success: false, 
          message: `❌ 重启失败: ${errorMessage}`
        } 
      },
      timestamp: Date.now()
    });
    
    return false;
  }
}

/**
 * 处理未知命令
 * 
 * 中文名称：处理未知命令
 * 
 * 预期行为：
 * - 显示未知命令错误信息
 * - 提示用户输入/help查看可用命令
 * - 返回true表示命令处理完成
 * 
 * 行为分支：
 * 1. 正常情况：显示错误信息和帮助提示，返回true
 * 2. 无异常情况：该函数不抛出异常，始终返回true
 * 
 * @param command - 用户输入的未知命令字符串
 * @returns Promise<boolean> - 始终返回true，表示命令处理完成
 */
export async function handleUnknownCommand(command: string): Promise<boolean> {
  console.log(styled.error(`❌ **未知命令**\n\n您输入的命令 \`${command}\` 无法识别。\n\n💡 请输入 \`/help\` 查看所有可用命令。`));
  return true;
}

// ==================== 文件差异可视化命令处理器 ====================

/**
 * 处理显示改动文件列表命令
 * 
 * 中文名称：处理显示改动文件列表命令
 * 
 * 预期行为：
 * - 调用 FileDiffVisualizer 获取改动文件列表
 * - 将结果通过 adapter 发送给用户
 * - 在控制台显示相同信息
 * - 返回true表示命令处理成功
 * 
 * @param session - 会话对象
 * @returns Promise<boolean> - 命令处理结果
 */
export async function handleShowFilesCommand(session: any): Promise<boolean> {
  try {
    // 动态导入 FileDiffVisualizer
    const { FileDiffVisualizer } = await import('./file-diff-visualizer');
    const visualizer = new FileDiffVisualizer(process.cwd());
    
    const result = await visualizer.getChangedFiles();
    
    let displayMessage = '';
    if (result.isEmpty) {
      displayMessage = `📋 **当前工作区状态**

✅ **工作区很干净，没有文件改动！**

💡 小贴士：使用 \`/show-diff\` 查看详细改动哦～`;
    } else {
      displayMessage = `📋 **当前工作区状态**

${result.files.map((file: { path: string; emoji: string; status: string }) => 
  `- ${file.emoji} \`${file.path}\` (${file.status})`
).join('\n')}

💡 小贴士：使用 \`/show-diff\` 查看详细改动哦～`;
    }
    
    // 通过 Lark 消息系统发送
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: '/show-files', 
        result: { 
          success: result.success,
          message: displayMessage,
          files: result.files || []
        } 
      },
      timestamp: Date.now()
    });
    
    // 控制台显示
    console.log(displayMessage);
    return true;
  } catch (error) {
    const errorMessage = `❌ 获取文件列表失败: ${(error as Error).message}`;
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: '/show-files', 
        result: { 
          success: false,
          error: errorMessage
        } 
      },
      timestamp: Date.now()
    });
    console.log(styled.error(errorMessage));
    return false;
  }
}

/**
 * 处理显示所有文件详细diff命令
 * 
 * 中文名称：处理显示所有文件详细diff命令
 * 
 * @param session - 会话对象
 * @returns Promise<boolean> - 命令处理结果
 */
export async function handleShowDiffCommand(session: any): Promise<boolean> {
  try {
    const { FileDiffVisualizer } = await import('./file-diff-visualizer');
    const visualizer = new FileDiffVisualizer(process.cwd());
    
    const result = await visualizer.getAllFilesDiff();
    
    if (!result.success) {
      const errorMessage = result.error || '未知错误';
      await session.adapter.emit({
        type: 'commandExecuted',
        data: { 
          command: '/show-diff', 
          result: { 
            success: false,
            error: errorMessage
          } 
        },
        timestamp: Date.now()
      });
      console.log(styled.error(errorMessage));
      return false;
    }
    
    // 情况1: 没有文件改动
    if (result.diffs.length === 0) {
      const summaryMessage = '📋 **Diff 概览**\n\n✅ **没有检测到文件改动！**';
      
      await session.adapter.emit({
        type: 'commandExecuted',
        data: { 
          command: '/show-diff', 
          result: { 
            success: true,
            message: summaryMessage,
            diffs: []
          } 
        },
        timestamp: Date.now()
      });
      
      console.log(summaryMessage);
      return true;
    }
    
    // 情况2: 有文件改动 - 发送多条消息
    
    // 第一条消息：摘要信息
    let totalAdded = 0, totalDeleted = 0;
    let validDiffs = 0;
    
    result.diffs.forEach((diff: any) => {
      if (diff.success && diff.summary) {
        const summaryMatch = diff.summary.match(/(\d+) insertions?\(\+\), (\d+) deletions?\(\-\)/);
        if (summaryMatch) {
          totalAdded += parseInt(summaryMatch[1]);
          totalDeleted += parseInt(summaryMatch[2]);
          validDiffs++;
        }
      }
    });
    
    let summaryMessage = '📋 **Diff 概览**\n\n';
    if (validDiffs > 0) {
      summaryMessage += `📊 **总计**: ${result.diffs.length} 个文件, +${totalAdded} 行, -${totalDeleted} 行\n\n`;
    }
    
    // 列出所有文件（简洁版）
    result.diffs.forEach((diff: any, index: number) => {
      if (!diff.success) {
        summaryMessage += `${index + 1}. ❌ \`${diff.filePath}\`\n`;
      } else {
        let fileSummary = '有改动';
        if (diff.summary) {
          const summaryMatch = diff.summary.match(/(\d+) insertions?\(\+\), (\d+) deletions?\(\-\)/);
          if (summaryMatch) {
            const added = summaryMatch[1];
            const deleted = summaryMatch[2];
            fileSummary = `+${added}, -${deleted}`;
          }
        }
        summaryMessage += `${index + 1}. 📄 \`${diff.filePath}\` (${fileSummary})\n`;
      }
    });
    
    summaryMessage += '\n🔍 **详细内容将在后续消息中逐个显示...**';
    
    // 发送摘要消息
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: '/show-diff', 
        result: { 
          success: true,
          message: summaryMessage,
          diffs: result.diffs
        } 
      },
      timestamp: Date.now()
    });
    
    console.log(summaryMessage);
    
    // 后续消息：每个文件的详细 diff
    for (const [index, diff] of result.diffs.entries()) {
      let fileMessage = '';
      
      if (!diff.success) {
        fileMessage = `❌ **文件错误**\n\n📄 \`${diff.filePath}\`\n\n${diff.error}`;
      } else {
        // 文件详细信息
        fileMessage = `📄 **文件 ${index + 1}/${result.diffs.length}: \`${diff.filePath}\`**\n\n`;
        
        // 添加统计信息
        if (diff.summary) {
          fileMessage += `📊 **统计**: ${diff.summary}\n\n`;
        }
        
        // 添加完整 diff（如果存在）
        if (diff.diff) {
          fileMessage += diff.diff;
        } else {
          fileMessage += 'ℹ️ **无具体改动内容**';
        }
      }
      
      // 为每个文件发送独立消息
      await session.adapter.emit({
        type: 'commandExecuted',
        data: { 
          command: '/show-diff-file', // 使用不同的命令标识
          result: { 
            success: diff.success,
            message: fileMessage,
            fileIndex: index,
            filePath: diff.filePath,
            totalFiles: result.diffs.length
          } 
        },
        timestamp: Date.now()
      });
      
      console.log(`\n--- 文件 ${index + 1} ---`);
      console.log(fileMessage);
    }
    
    return true;
  } catch (error) {
    const errorMessage = `❌ 获取详细diff失败: ${(error as Error).message}`;
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: '/show-diff', 
        result: { 
          success: false,
          error: errorMessage
        } 
      },
      timestamp: Date.now()
    });
    console.log(styled.error(errorMessage));
    return false;
  }
}

/**
 * 处理显示特定文件diff命令
 * 
 * 中文名称：处理显示特定文件diff命令
 * 
 * @param session - 会话对象
 * @param filePath - 文件路径参数
 * @returns Promise<boolean> - 命令处理结果
 */
export async function handleDiffCommand(session: any, filePath: string): Promise<boolean> {
  try {
    const { FileDiffVisualizer } = await import('./file-diff-visualizer');
    const visualizer = new FileDiffVisualizer(process.cwd());
    
    const result = await visualizer.getFileDiff(filePath);
    
    if (!result.success) {
      const errorMessage = result.error || '未知错误';
      await session.adapter.emit({
        type: 'commandExecuted',
        data: { 
          command: `/diff ${filePath}`, 
          result: { 
            success: false,
            error: errorMessage,
            filePath
          } 
        },
        timestamp: Date.now()
      });
      console.log(styled.error(errorMessage));
      return false;
    }
    
    const displayMessage = `📄 **文件差异详情**\n\n**路径**: \`${result.filePath}\`\n${result.summary ? `\n📊 **统计**: ${result.summary}\n` : ''}\n${result.diff}\n\n### 🚀 **可执行操作**\n- ↩️ \`/revert ${result.filePath}\` - 撤销此文件的所有改动\n- ✅ \`/stage ${result.filePath}\` - 将此文件暂存到Git`;
    
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: `/diff ${filePath}`, 
        result: { 
          success: true,
          message: displayMessage,
          diff: result
        } 
      },
      timestamp: Date.now()
    });
    
    console.log(displayMessage);
    return true;
  } catch (error) {
    const errorMessage = `❌ 获取文件diff失败: ${(error as Error).message}`;
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: `/diff ${filePath}`, 
        result: { 
          success: false,
          error: errorMessage,
          filePath
        } 
      },
      timestamp: Date.now()
    });
    console.log(styled.error(errorMessage));
    return false;
  }
}

/**
 * 处理撤销文件改动命令
 * 
 * 中文名称：处理撤销文件改动命令
 * 
 * @param session - 会话对象
 * @param filePath - 文件路径参数
 * @returns Promise<boolean> - 命令处理结果
 */
export async function handleRevertCommand(session: any, filePath: string): Promise<boolean> {
  try {
    const { FileDiffVisualizer } = await import('./file-diff-visualizer');
    const visualizer = new FileDiffVisualizer(process.cwd());
    
    const result = await visualizer.revertFile(filePath);
    
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: `/revert ${filePath}`, 
        result: { 
          success: result.success,
          message: result.success ? result.message : result.error,
          filePath
        } 
      },
      timestamp: Date.now()
    });
    
    console.log(result.success ? styled.system(result.message) : styled.error(result.error || '未知错误'));
    return result.success;
  } catch (error) {
    const errorMessage = `❌ 撤销文件失败: ${(error as Error).message}`;
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: `/revert ${filePath}`, 
        result: { 
          success: false,
          error: errorMessage,
          filePath
        } 
      },
      timestamp: Date.now()
    });
    console.log(styled.error(errorMessage));
    return false;
  }
}

/**
 * 处理暂存文件命令
 * 
 * 中文名称：处理暂存文件命令
 * 
 * @param session - 会话对象
 * @param filePath - 文件路径参数
 * @returns Promise<boolean> - 命令处理结果
 */
export async function handleStageCommand(session: any, filePath: string): Promise<boolean> {
  try {
    const { FileDiffVisualizer } = await import('./file-diff-visualizer');
    const visualizer = new FileDiffVisualizer(process.cwd());
    
    const result = await visualizer.stageFile(filePath);
    
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: `/stage ${filePath}`, 
        result: { 
          success: result.success,
          message: result.success ? result.message : result.error,
          filePath
        } 
      },
      timestamp: Date.now()
    });
    
    console.log(result.success ? styled.system(result.message) : styled.error(result.error || '未知错误'));
    return result.success;
  } catch (error) {
    const errorMessage = `❌ 暂存文件失败: ${(error as Error).message}`;
    await session.adapter.emit({
      type: 'commandExecuted',
      data: { 
        command: `/stage ${filePath}`, 
        result: { 
          success: false,
          error: errorMessage,
          filePath
        } 
      },
      timestamp: Date.now()
    });
    console.log(styled.error(errorMessage));
    return false;
  }
}

// ==================== 内部命令处理器 (柯里化) ====================

/**
 * 创建内部命令处理器
 * 
 * 中文名称：创建内部命令处理器
 * 
 * 预期行为：
 * - 接收会话对象作为参数
 * - 返回一个处理内部命令的函数
 * - 根据命令字符串调用相应的命令处理函数
 * 
 * 行为分支：
 * 1. /help命令：调用handleHelpCommand()
 * 2. /verbose命令：调用handleVerboseCommand()
 * 3. /new命令：调用handleNewCommand(session)
 * 4. /abort命令：调用handleAbortCommand(session)
 * 5. /rebot命令：调用handleRebotCommand(session)
 * 6. /exit、/quit、/q或/stop命令：调用handleExitCommand(session)
 * 7. /show-files命令：调用handleShowFilesCommand(session)
 * 8. /show-diff命令：调用handleShowDiffCommand(session)
 * 9. /diff <file>命令：调用handleDiffCommand(session, filePath)
 * 10. /revert <file>命令：调用handleRevertCommand(session, filePath)
 * 11. /stage <file>命令：调用handleStageCommand(session, filePath)
 * 12. 其他未知命令：调用handleUnknownCommand(command)
 * 
 * @param session - 会话对象，包含threadId等会话状态信息
 * @returns (command: string) => Promise<boolean> - 返回一个接受命令字符串并返回Promise<boolean>的函数
 */
export function createHandleInternalCommand(session: any): (command: string) => Promise<boolean> {
  return async (command: string): Promise<boolean> => {
    // 解析命令和参数
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    
    switch (cmd) {
      case "/help":
        return await handleHelpCommand(session);
        
      case "/verbose":
        return await handleVerboseCommand();
        
      case "/new":
        return await handleNewCommand(session);
        
      case "/abort":
        return await handleAbortCommand(session);
        
      case "/rebot":
        return await handleRebotCommand(session);
        
      case "/exit":
      case "/quit":
      case "/q":
      case "/stop":
        return await handleExitCommand(session);
        
      case "/show-files":
        return await handleShowFilesCommand(session);
        
      case "/show-diff":
        return await handleShowDiffCommand(session);
        
      case "/diff":
        if (args.length === 0) {
          console.log(styled.error("❌ 用法: /diff <文件路径>"));
          return false;
        }
        return await handleDiffCommand(session, args[0]);
        
      case "/revert":
        if ( args.length === 0) {
          console.log(styled.error("❌ 用法: /revert <文件路径>"));
          return false;
        }
        return await handleRevertCommand(session, args[0]);
        
      case "/stage":
        if (args.length === 0) {
          console.log(styled.error("❌ 用法: /stage <文件路径>"));
          return false;
        }
        return await handleStageCommand(session, args[0]);
        
      default:
        return await handleUnknownCommand(command);
    }
  };
}