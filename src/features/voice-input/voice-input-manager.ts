import { createVoiceRecognition, VoiceRecognition } from './voice-recognition';
import { styled } from '../../presentation/styling/output-styler';
import { handleUserInput, showPrompt } from '../../presentation/console/user-input-handler';

/**
 * Voice Input Manager module that handles voice recording and processing functionality.
 * 
 * This module provides functions for starting and stopping voice recording,
 * handling keyboard shortcuts for voice input, and processing recognized speech.
 * It integrates with the Tencent Cloud ASR service for speech recognition.
 * 
 * @module VoiceInputManager
 */

// Keyboard event handler for voice input shortcut
let isRecordingShortcutActive = false;
let time = 0;

/**
 * 清理语音录制资源
 * 
 * 中文名称：清理语音录制资源
 * 
 * 预期行为：
 * - 检查会话中是否存在活跃的语音ASR实例和录制状态
 * - 如果存在，尝试停止手动录制
 * - 重置会话的语音录制相关状态
 * - 忽略清理过程中可能发生的错误
 * 
 * 行为分支：
 * 1. 有活跃录制：调用stopManualRecording()并忽略可能的错误，然后重置状态
 * 2. 无活跃录制：直接重置状态（isVoiceRecording设为false，voiceASR设为null）
 * 3. 停止录制失败：捕获并忽略错误，仍重置状态
 * 
 * @param session - 会话对象，包含voiceASR和isVoiceRecording属性
 * @returns void - 无返回值
 * 
 * @example
 * ```typescript
 * cleanupVoiceRecording(session); // 清理语音录制资源
 * ```
 */
export function cleanupVoiceRecording(session: any): void {
  if (session.voiceASR && session.isVoiceRecording) {
    try {
      session.voiceASR.stopManualRecording().catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  session.isVoiceRecording = false;
  session.voiceASR = null;
}

/**
 * 开始语音录制
 * 
 * 中文名称：开始语音录制
 * 
 * 预期行为：
 * - 设置录音快捷键激活状态
 * - 初始化腾讯云ASR实例
 * - 检查麦克风访问权限
 * - 启动手动语音录制
 * - 处理录制过程中的错误
 * 
 * 行为分支：
 * 1. 正常情况：成功初始化ASR并启动录制，显示开始录制消息
 * 2. 麦克风不可用：显示错误信息，重置录制状态，显示提示符
 * 3. 录制启动失败：捕获异常，显示错误信息，重置录制状态，显示提示符
 * 4. 无其他异常：该函数内部处理所有异常，不会向上抛出
 * 
 * @param session - 会话对象，用于存储ASR实例和录制状态
 * @param rl - Readline接口，用于显示提示符
 * @returns Promise<void> - 无返回值的Promise
 * 
 * @example
 * ```typescript
 * await startRecord(session, rl); // 开始语音录制
 * ```
 */
export const startRecord = async (session: any, rl: any): Promise<void> => {
  isRecordingShortcutActive = true;
  try {
    console.log('\n🎙️ 开始语音输入... (再次双击空格键结束)');
    session.isVoiceRecording = true;
    session.voiceASR = createVoiceRecognition();
    
    if (!session.voiceASR.canRecord()) {
      console.log(styled.error('❌ 无法访问麦克风，请确保已安装音频录制工具（如 sox）并授予麦克风权限'));
      session.isVoiceRecording = false;
      session.voiceASR = null;
      isRecordingShortcutActive = false;
      showPrompt(session, rl);
      return;
    }
    
    await session.voiceASR.startManualRecording();
  } catch (error) {
    console.log(styled.error(`❌ 语音输入启动失败: ${(error as Error).message}`));
    session.isVoiceRecording = false;
    session.voiceASR = null;
    isRecordingShortcutActive = false;
    showPrompt(session, rl);
  }
};

/**
 * 停止语音录制
 * 
 * 中文名称：停止语音录制
 * 
 * 预期行为：
 * - 检查录音快捷键是否处于激活状态
 * - 停止手动语音录制
 * - 对录制的音频进行语音识别
 * - 根据识别结果决定如何处理（直接执行或作为输入）
 * - 清理录制资源并显示提示符
 * 
 * 行为分支：
 * 1. 快捷键未激活：直接返回，不执行任何操作
 * 2. 无音频数据：显示"未录制到音频数据"错误
 * 3. 识别成功且包含"干活"关键词：将识别结果与当前输入合并后直接执行
 * 4. 识别成功但不包含"干活"关键词：将识别结果写入Readline输入缓冲区
 * 5. 未识别到有效语音：显示"未识别到有效语音"错误
 * 6. 语音识别失败：捕获异常，显示错误信息
 * 7. 所有情况都会在finally块中清理ASR实例并显示提示符
 * 
 * @param session - 会话对象，包含voiceASR和isVoiceRecording状态
 * @param rl - Readline接口，用于处理输入和显示提示符
 * @param agent - AI代理实例，用于处理包含"干活"关键词的命令
 * @returns Promise<void> - 无返回值的Promise
 * 
 * @example
 * ```typescript
 * await stopRecord(session, rl, agent); // 停止语音录制并处理结果
 * ```
 */
export const stopRecord = async (session: any, rl: any, agent: any): Promise<void> => {
  if (!isRecordingShortcutActive) {
    return;
  }
  // Key released or different key pressed - stop recording
  // Also stop if any modifier key is released
  isRecordingShortcutActive = false;
  if (session.voiceASR && session.isVoiceRecording) {
    try {
      const audioBuffer = await session.voiceASR.stopManualRecording();
      session.isVoiceRecording = false;
      
      if (audioBuffer) {
        const result = await session.voiceASR.recognizeManualRecording(audioBuffer);
        if (result) {
          console.log(styled.system(`🎯 识别结果: "${result}"`));
          
          const max = Math.max(rl.line.length - 8, 0);

          if (result.slice(max, result.length).includes('干活')) {
            const content = rl.line + result;

            await handleUserInput(content, session, agent, rl);
          } else {
            // Process the recognized text as user input
            rl.write(result);
            for (let i = 0; i < rl.line.length + 4; i++) {
              setTimeout(() => {
                rl.write('', { name: 'right', ctrl: false, meta: false, shift: false });
              }, 10 * i);
            }
          }
          return;
        } else {
          console.log(styled.error('❌ 未识别到有效语音'));
        }
      } else {
        console.log(styled.error('❌ 未录制到音频数据'));
      }
    } catch (error) {
      console.log(styled.error(`❌ 语音识别失败: ${(error as Error).message}`));
    } finally {
      session.voiceASR = null;
      showPrompt(session, rl);
    }
  }
};

/**
 * 键盘按键事件处理器
 * 
 * 中文名称：键盘按键事件处理器
 * 
 * 预期行为：
 * - 监听键盘按键事件
 * - 检测双击空格键（300ms内）
 * - 根据按键状态控制语音录制的开始和停止
 * - 管理录音快捷键的激活状态
 * 
 * 行为分支：
 * 1. 双击空格键且未在录制：调用startRecord()开始录制
 * 2. 双击空格键且正在录制：调用stopRecord()停止录制
 * 3. 非空格键且快捷键激活：调用stopRecord()停止录制
 * 4. 单击空格键：更新时间戳但不触发录制
 * 5. 其他按键：重置时间戳
 * 
 * @param session - 会话对象，传递给录制函数
 * @param rl - Readline接口，传递给录制函数
 * @returns (str: string, key: any) => Promise<void> - 返回一个处理按键事件的异步函数
 * 
 * @example
 * ```typescript
 * process.stdin.on('keypress', onKeypress(session, rl)); // 绑定按键事件
 * ```
 */
export const onKeypress = (session: any, rl: any, agent: any) => async (str: string, key: any) => {
  const now = Date.now();
  const isSpace = key.name === 'space';

  let isDoubleSpace = false;

  if (isSpace) {
    if (time) {
      const gap = now - time;

      if (gap < 300) {
        isDoubleSpace = true;
      } else {
        time = now;
      }
    } else {
      time = now;
    }
  } else {
    time = 0;
  }

  if (isDoubleSpace) {
    // Key pressed down - start recording
    if (!isRecordingShortcutActive && !session.isVoiceRecording) {
      await startRecord(session, rl);
    } else {
      await stopRecord(session, rl, agent);
    }
  } else if (isRecordingShortcutActive) {
    await stopRecord(session, rl, agent);
  }
};