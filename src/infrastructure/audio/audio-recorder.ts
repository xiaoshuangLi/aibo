/**
 * 音频录制器
 * 
 * 中文名称：音频录制器
 * 
 * 该模块提供音频录制功能，使用node-record-lpcm16库从麦克风捕获音频。
 * 支持手动录制、自动识别和连续语音录制模式。
 * 
 * @module AudioRecorder
 */

import fs from 'fs';

// Import the recorder module correctly
// @ts-ignore
import recorder from 'node-record-lpcm16';

/**
 * 音频录制器类
 * 
 * 中文名称：音频录制器类
 * 
 * 该类封装了音频录制的底层细节，提供简单易用的API来录制音频。
 */
export class AudioRecorder {
  private currentRecorder: any = null;
  private recordingChunks: Buffer[] = [];
  private isRecording: boolean = false;

  /**
   * 检查系统是否可以录制音频
   * 
   * 中文名称：检查系统是否可以录制音频
   * 
   * 预期行为：
   * - 检查系统是否具备音频录制能力
   * - 返回布尔值表示录制是否可能
   * 
   * 行为分支：
   * 1. 当前实现：总是返回true（简化实现）
   * 2. 注释中的实现：尝试创建测试录音器并验证功能
   * 
   * @returns boolean - 如果系统可以录制音频则返回true，否则返回false
   * 
   * @note
   * - 当前实现简化为总是返回true
   * - 完整实现需要测试sox工具和麦克风权限
   */
  public canRecord(): boolean {
    return true;
    // try {
    //   const file = fs.createWriteStream('test.wav', { encoding: 'binary' })
    //   // Try to create a recorder instance
    //   const testRecorder = recorder.record({
    //     sampleRate: 16000,
    //     channels: 1,
    //     threshold: 0.5,
    //     recorder: 'sox',
    //   });
    //   testRecorder.stream().pipe(file); // Clean up immediately
    //   setTimeout(() => testRecorder.stop(), 1000)
    //   return true;
    // } catch (error) {
    //   console.error('Audio recording capability check failed:', error);
    //   return false;
    // }
  }

  /**
   * 开始手动音频录制
   * 
   * 中文名称：开始手动音频录制
   * 
   * 预期行为：
   * - 检查是否已经在录制
   * - 如果是，抛出错误
   * - 如果不是，初始化新的录音器实例
   * - 设置音频数据监听器
   * - 标记为录制状态
   * 
   * 行为分支：
   * 1. 已在录制：抛出"Manual recording is already in progress"错误
   * 2. 录制初始化失败：抛出"Failed to initialize audio recorder"错误
   * 3. 正常录制：成功启动录制并标记状态
   * 
   * @throws {Error} 如果已在录制或初始化失败
   */
  public startManualRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Manual recording is already in progress');
    }

    return new Promise((resolve, reject) => {
      try {
        this.recordingChunks = [];
        this.currentRecorder = recorder.record({
          sampleRate: 16000,
          channels: 1,
          threshold: 0.5,
          recorder: 'sox',
        });

        this.currentRecorder.stream().on('data', (chunk: Buffer) => {
          this.recordingChunks.push(chunk);
        });

        this.currentRecorder.stream().on('error', (err: Error) => {
          console.error('❌ Manual recording error:', err.message);
          this.cleanupRecording();
          reject(new Error(`Audio recording failed: ${err.message}`));
        });

        this.isRecording = true;
        console.log('🎙️ Manual recording started...');
        resolve();
      } catch (error) {
        this.cleanupRecording();
        reject(new Error(`Failed to initialize audio recorder: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * 停止手动音频录制
   * 
   * 中文名称：停止手动音频录制
   * 
   * 预期行为：
   * - 检查是否正在录制
   * - 如果不是，返回null
   * - 如果是，停止录制器
   * - 合并录制的音频块
   * - 重置录制状态
   * - 返回音频Buffer
   * 
   * 行为分支：
   * 1. 未在录制：返回null
   * 2. 无音频数据：记录警告并返回null
   * 3. 有音频数据：返回合并的音频Buffer
   * 
   * @returns Promise<Buffer | null> - 录制的音频数据或null
   */
  public stopManualRecording(): Promise<Buffer | null> {
    if (!this.isRecording) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      if (this.currentRecorder) {
        this.currentRecorder.stop();
        this.currentRecorder = null;
      }

      const audioBuffer = Buffer.concat(this.recordingChunks);
      this.cleanupRecording();

      if (audioBuffer.length === 0) {
        console.log('⚠️  No audio data recorded');
        resolve(null);
      } else {
        console.log(`✅ Manual recording stopped (${audioBuffer.length} bytes)`);
        resolve(audioBuffer);
      }
    });
  }

  /**
   * 检查是否正在手动录制
   * 
   * 中文名称：检查是否正在手动录制
   * 
   * 预期行为：
   * - 返回当前录制状态
   * 
   * 行为分支：
   * 1. 正常情况：返回isRecording的布尔值
   * 
   * @returns boolean - 如果正在录制返回true，否则返回false
   */
  public isManualRecording(): boolean {
    return this.isRecording;
  }

  /**
   * 清理录制资源
   * 
   * 中文名称：清理录制资源
   * 
   * 预期行为：
   * - 停止当前录音器（如果存在）
   * - 清空录制块数组
   * - 重置录制状态
   * 
   * 行为分支：
   * 1. 有活跃录音器：停止并清理
   * 2. 无活跃录音器：直接重置状态
   */
  private cleanupRecording(): void {
    if (this.currentRecorder) {
      try {
        this.currentRecorder.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.currentRecorder = null;
    }
    this.recordingChunks = [];
    this.isRecording = false;
  }

  /**
   * 录制音频
   * 
   * 中文名称：录制音频
   * 
   * 预期行为：
   * - 使用node-record-lpcm16库从麦克风录制音频
   * - 设置16kHz采样率、单声道、0.5阈值
   * - 使用sox作为录音后端
   * - 在指定持续时间后停止录制
   * - 返回录制的音频缓冲区
   * 
   * 行为分支：
   * 1. 正常录制：成功录制指定时长的音频并返回Buffer
   * 2. 录制初始化失败：抛出"Failed to initialize audio recorder"错误
   * 3. 录制过程中出错：抛出"Audio recording failed"错误
   * 
   * @param duration - 录制持续时间（毫秒）
   * @returns Promise<Buffer> - 录制的音频数据Buffer的Promise
   * @throws {Error} 如果录音初始化或录制过程中发生错误
   */
  public async recordAudio(duration: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let recordingTime = 0;
      const interval = 100; // Check every 100ms
      
      try {
        const recorderInstance = recorder.record({
          sampleRate: 16000,
          channels: 1,
          threshold: 0.5,
          recorder: 'sox',
        });
        
        recorderInstance.stream().on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          recordingTime += interval;
          
          if (recordingTime >= duration) {
            recorderInstance.stop();
            const audioBuffer = Buffer.concat(chunks);
            resolve(audioBuffer);
          }
        });
        
        recorderInstance.stream().on('error', (err: Error) => {
          reject(new Error(`Audio recording failed: ${err.message}`));
        });
      } catch (error) {
        reject(new Error(`Failed to initialize audio recorder: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }
}