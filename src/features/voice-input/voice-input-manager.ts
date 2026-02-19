import { createVoiceRecognition, VoiceRecognition } from '@/features/voice-input/voice-recognition';
import { Session } from '@/core/agent/session';
import { config } from '@/core/config/config';

// Keyboard event handler state
let isRecordingShortcutActive = false;
let lastSpacePressTime = 0;

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
 */
export function cleanupVoiceRecording(session: Session): void {
  const voiceASR = session.getVoiceASR();
  if (voiceASR && session.isVoiceRecordingActive()) {
    try {
      voiceASR.stopManualRecording().catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  session.setVoiceRecording(false, null);
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
 * 1. 正常情况：成功初始化ASR并启动录制，发送开始录制事件
 * 2. 麦克风不可用：发送错误事件，重置录制状态
 * 3. 录制启动失败：捕获异常，发送错误事件，重置录制状态
 * 
 * @param session - 会话对象，用于存储ASR实例和录制状态
 * @returns Promise<void> - 无返回值的Promise
 */
export const startRecord = async (session: Session): Promise<void> => {
  isRecordingShortcutActive = true;
  try {
    session.logSystemMessage('🎙️ 开始语音输入... (再次双击空格键结束)');
    session.setVoiceRecording(true, createVoiceRecognition());
    
    const voiceASR = session.getVoiceASR();
    if (!voiceASR || !voiceASR.canRecord()) {
      session.logErrorMessage('❌ 无法访问麦克风，请确保已安装音频录制工具（如 sox）并授予麦克风权限');
      session.setVoiceRecording(false, null);
      isRecordingShortcutActive = false;
      return;
    }
    
    await voiceASR.startManualRecording();
  } catch (error) {
    session.logErrorMessage(`❌ 语音输入启动失败: ${(error as Error).message}`);
    session.setVoiceRecording(false, null);
    isRecordingShortcutActive = false;
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
 * - 清理录制资源
 * 
 * 行为分支：
 * 1. 快捷键未激活：直接返回，不执行任何操作
 * 2. 无音频数据：发送"未录制到音频数据"错误事件
 * 3. 识别成功且包含"干活"关键词：将识别结果与当前输入合并后直接执行
 * 4. 识别成功但不包含"干活"关键词：触发语音输入完成事件
 * 5. 未识别到有效语音：发送"未识别到有效语音"错误事件
 * 6. 语音识别失败：捕获异常，发送错误事件
 * 7. 所有情况都会在finally块中清理ASR实例
 * 
 * @param session - 会话对象，包含voiceASR和isVoiceRecording状态
 * @param currentInput - 当前用户输入内容（用于检测"干活"关键词）
 * @param onVoiceInputComplete - 语音输入完成回调函数
 * @param onExecuteCommand - 执行命令回调函数
 * @returns Promise<void> - 无返回值的Promise
 */
export const stopRecord = async (
  session: Session, 
  currentInput: string,
  onVoiceInputComplete: (recognizedText: string) => void,
  onExecuteCommand: (command: string) => void
): Promise<void> => {
  if (!isRecordingShortcutActive) {
    return;
  }
  
  // Key released or different key pressed - stop recording
  // Also stop if any modifier key is released
  isRecordingShortcutActive = false;
  
  const voiceASR = session.getVoiceASR();
  if (voiceASR && session.isVoiceRecordingActive()) {
    try {
      const audioBuffer = await voiceASR.stopManualRecording();
      session.setVoiceRecording(false, null);
      
      if (audioBuffer) {
        const result = await voiceASR.recognizeManualRecording(audioBuffer);
        if (result) {
          session.logSystemMessage(`🎯 识别结果: "${result}"`);
          
          const max = Math.max(currentInput.length - 8, 0);
          if (result.slice(max, result.length).includes(config.specialKeyword.keyword)) {
            const content = currentInput + result;
            onExecuteCommand(content);
          } else {
            onVoiceInputComplete(result);
          }
          return;
        } else {
          session.logErrorMessage('❌ 未识别到有效语音');
        }
      } else {
        session.logErrorMessage('❌ 未录制到音频数据');
      }
    } catch (error) {
      session.logErrorMessage(`❌ 语音识别失败: ${(error as Error).message}`);
    } finally {
      session.setVoiceRecording(false, null);
    }
  }
};

/**
 * 键盘按键事件处理器工厂函数
 * 
 * 中文名称：键盘按键事件处理器工厂函数
 * 
 * 预期行为：
 * - 创建一个处理键盘按键事件的函数
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
 * @param currentInput - 当前用户输入内容
 * @param onVoiceInputComplete - 语音输入完成回调
 * @param onExecuteCommand - 执行命令回调
 * @returns (keyName: string) => Promise<void> - 返回一个处理按键事件的异步函数
 */
export const createKeypressHandler = (
  session: Session,
  getCurrentInput: () => string,
  onVoiceInputComplete: (recognizedText: string) => void,
  onExecuteCommand: (command: string) => void
) => async (keyName: string): Promise<void> => {
  const now = Date.now();
  const isSpace = keyName === 'space';

  let isDoubleSpace = false;

  if (isSpace) {
    if (lastSpacePressTime) {
      const gap = now - lastSpacePressTime;
      if (gap < 300) {
        isDoubleSpace = true;
      } else {
        lastSpacePressTime = now;
      }
    } else {
      lastSpacePressTime = now;
    }
  } else {
    lastSpacePressTime = 0;
  }

  if (isDoubleSpace) {
    // Key pressed down - start recording
    if (!isRecordingShortcutActive && !session.isVoiceRecordingActive()) {
      await startRecord(session);
    } else {
      await stopRecord(
        session, 
        getCurrentInput(), 
        onVoiceInputComplete, 
        onExecuteCommand
      );
    }
  } else if (isRecordingShortcutActive) {
    await stopRecord(
      session, 
      getCurrentInput(), 
      onVoiceInputComplete, 
      onExecuteCommand
    );
  }
};