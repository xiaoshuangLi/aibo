/**
 * 🌈 直观文件改动可视化工具 - 可编程 API 版本（Lark 完全兼容版）
 * 让你像在现代IDE中一样直观地查看和管理代码改动！
 * 
 * 此模块提供可编程的 API 接口，所有方法返回 Promise 和结构化数据，
 * 适用于 Lark 模式集成，而不是直接控制台输出。
 * 
 * Lark (飞书) Markdown 兼容性说明：
 * - Lark 使用标准 CommonMark Markdown 语法
 * - 代码块（```）内的内容不会被解析为 Markdown，无需转义
 * - 飞书不支持 diff 语法高亮，代码块使用无语言标识符保证内容原样显示
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface FileStatus {
  path: string;
  status: string;
  emoji: string;
  rawStatus: string;
}

interface ChangedFilesResult {
  success: boolean;
  files: FileStatus[];
  message: string;
  isEmpty?: boolean;
  error?: string;
}

interface FileDiffResult {
  success: boolean;
  filePath: string;
  type: string;
  additions: number;
  deletions: number;
  diff: string;
  summary: string;
  error?: string;
}

interface AllFilesDiffResult {
  success: boolean;
  diffs: FileDiffResult[];
  error?: string;
}

interface OperationResult {
  success: boolean;
  message: string;
  error?: string;
}

export class FileDiffVisualizer {
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  /**
   * 📁 获取所有改动的文件列表（简洁模式，Markdown增强版）
   * @returns {Promise<ChangedFilesResult>} 包含 files 数组和 message 的对象
   */
  async getChangedFiles(): Promise<ChangedFilesResult> {
    try {
      const result = execSync('git status --porcelain', { cwd: this.workingDir, encoding: 'utf8' });
      if (!result.trim()) {
        return { 
          success: true,
          files: [], 
          message: '✨ **当前工作区很干净，没有文件改动！**',
          isEmpty: true
        };
      }

      // 正确处理 git status --porcelain 输出：不要对整个结果 trim()，而是按行分割后过滤空行
      // git porcelain 格式保证每行前3个字符为 "XY "（X=index状态, Y=worktree状态, 空格分隔符）
      const lines = result.split('\n').filter(line => line.trim().length > 0);
      const files: FileStatus[] = [];
      
      for (const line of lines) {
        // 保持原始行格式，直接提取前2字符作为状态，从第4字符开始作为文件路径
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3).trim();
        
        let fileStatus = '';
        let emoji = '';
        
        // 解析 2 字符状态码：第1字符表示暂存区状态，第2字符表示工作区状态
        // 参考：https://git-scm.com/docs/git-status#_short_format
        if (status === '??') {
          fileStatus = '新增';
          emoji = '🆕';
        } else if (status.startsWith('D') || status.endsWith('D')) {
          // D? 或 ?D 或 DD - 删除文件
          fileStatus = '删除';
          emoji = '🗑️';
        } else if (status.startsWith('A') || status.endsWith('A')) {
          // A? 或 ?A 或 AA - 新增文件
          fileStatus = '新增';
          emoji = '🆕';
        } else if (status.includes('M') || status.includes('T') || status.includes('R') || status.includes('C') || status.includes('U')) {
          // 包含 M(修改)、T(类型更改)、R(重命名)、C(复制)、U(未合并) 的任何组合
          fileStatus = '修改';
          emoji = '✏️';
        } else {
          fileStatus = '其他';
          emoji = '📄';
        }
        
        files.push({
          path: filePath,
          status: fileStatus,
          emoji: emoji,
          rawStatus: status
        });
      }
      
      // 使用Markdown列表格式化文件列表，对文件路径进行完全转义
      const fileList = files.map(file => `- ${file.emoji} \`${file.path}\` ${file.status}`).join('\n');
      
      // 统计各状态数量生成摘要
      const addedCount = files.filter(f => f.status === '新增').length;
      const modifiedCount = files.filter(f => f.status === '修改').length;
      const deletedCount = files.filter(f => f.status === '删除').length;
      const summaryParts: string[] = [];
      if (addedCount > 0) summaryParts.push(`新增 ${addedCount}`);
      if (modifiedCount > 0) summaryParts.push(`修改 ${modifiedCount}`);
      if (deletedCount > 0) summaryParts.push(`删除 ${deletedCount}`);
      const categorySummary = summaryParts.length > 0 ? `（${summaryParts.join(' · ')}）` : '';
      
      const message = `✨ **${files.length} 个文件有改动**${categorySummary}\n\n${fileList}`;
      
      return {
        success: true,
        files,
        message
      };
    } catch (error) {
      return { 
        success: false,
        files: [], 
        message: '❌ **无法获取 Git 状态，请确保在 Git 仓库中运行**',
        error: (error as Error).message
      };
    }
  }

  /**
   * 🔍 获取单个文件的详细diff
   */
  async getFileDiff(filePath: string): Promise<FileDiffResult> {
    try {
      // 检查文件是否存在
      const exists = fs.existsSync(path.join(this.workingDir, filePath));
      
      if (!exists) {
        // 尝试获取删除文件的diff
        const diffResult = execSync(`git diff -- ${filePath}`, { 
          cwd: this.workingDir, 
          encoding: 'utf8'
        });
        if (diffResult.trim()) {
          return this.formatDiffOutput(diffResult, filePath, 'deleted');
        }
        return { 
          success: false,
          filePath,
          type: 'error',
          additions: 0,
          deletions: 0,
          diff: '',
          summary: '',
          error: '❌ 文件不存在或已彻底删除'
        };
      }

      // 获取文件的diff（检查工作区差异）
      let diffResult = execSync(`git diff -- ${filePath}`, { 
        cwd: this.workingDir, 
        encoding: 'utf8'
      });
      
      // 如果工作区没有差异，检查暂存区差异
      if (!diffResult.trim()) {
        diffResult = execSync(`git diff --cached -- ${filePath}`, { 
          cwd: this.workingDir, 
          encoding: 'utf8'
        });
      }
      
      if (!diffResult.trim()) {
        // 可能是新文件
        const statusResult = execSync('git status --porcelain', { cwd: this.workingDir, encoding: 'utf8' });
        // 正确处理 git status --porcelain 输出：不要对整个结果 trim()，而是按行分割后过滤空行
        const lines = statusResult.split('\n').filter(line => line.trim().length > 0);
        const isNewFile = lines.some(line => 
          line.startsWith('?? ') && line.substring(3).trim() === filePath
        );
        
        if (isNewFile) {
          const content = fs.readFileSync(path.join(this.workingDir, filePath), 'utf8');
          return this.formatNewFileOutput(content, filePath);
        }
        return { 
          success: false,
          filePath,
          type: 'error',
          additions: 0,
          deletions: 0,
          diff: '',
          summary: '',
          error: '❌ 文件没有改动（已是最新状态）'
        };
      }
      
      return this.formatDiffOutput(diffResult, filePath, 'modified');
    } catch (error) {
      return { 
        success: false,
        filePath,
        type: 'error',
        additions: 0,
        deletions: 0,
        diff: '',
        summary: '',
        error: `❌ 获取文件 diff 失败: ${(error as Error).message}`
      };
    }
  }


  /**
   * 使用普通代码块包裹原始 diff 内容，贴近原生 git 输出效果。
   * 飞书不支持 diff 语法高亮，使用无语言标识符的代码块保证内容原样显示，
   * 无需对内容进行 Markdown 转义。
   */
  private formatDiffOutput(diff: string, filePath: string, type: string): FileDiffResult {
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;
    
    // 统计增删行数
    for (const line of lines) {
      const cleanLine = line.replace(/\r/g, '');
      if (cleanLine.startsWith('+') && !cleanLine.startsWith('+++')) {
        additions++;
      } else if (cleanLine.startsWith('-') && !cleanLine.startsWith('---')) {
        deletions++;
      }
    }
    
    // 使用普通代码块包裹，贴近原生 git 输出，飞书中无需转义
    const cleanDiff = diff.replace(/\r/g, '');
    const formattedDiff = `\`\`\`\n${cleanDiff}\`\`\``;
    
    return {
      success: true,
      filePath,
      type,
      additions,
      deletions,
      diff: formattedDiff,
      summary: `<font color="green">+${additions} 行新增</font> <font color="red">-${deletions} 行删除</font>`
    };
  }

  /**
   * 🆕 格式化新文件输出（带颜色字体）
   */
  private formatNewFileOutput(content: string, filePath: string): FileDiffResult {
    const lines = content.split('\n');
    const fileExtension = path.extname(filePath).toLowerCase();
    const language = fileExtension.startsWith('.') ? fileExtension.substring(1) : 'text';
    
    // 清理内容中的回车符，确保代码块显示正常
    const cleanContent = content.replace(/\r/g, '');
    
    // 将新文件内容包装在代码块中，并标记为新增
    const formattedDiff = `\`\`\`${language}\n${cleanContent}\n\`\`\``;
    
    return {
      success: true,
      filePath,
      type: 'new',
      additions: lines.length,
      deletions: 0,
      diff: formattedDiff,
      summary: `<font color="green">+${lines.length} 行新增（新文件）</font>`
    };
  }

  /**
   * 🔍 获取所有文件的详细diff
   */
  async getAllFilesDiff(): Promise<AllFilesDiffResult> {
    const changedFiles = await this.getChangedFiles();
    if (changedFiles.isEmpty) {
      return { 
        success: false,
        diffs: [],
        error: '✨ 当前工作区很干净，没有文件改动'
      };
    }
    
    const diffs: FileDiffResult[] = [];
    for (const file of changedFiles.files) {
      const diff = await this.getFileDiff(file.path);
      diffs.push(diff);
    }
    
    return {
      success: true,
      diffs
    };
  }

  /**
   * ↩️ 撤销文件改动
   */
  async revertFile(filePath: string): Promise<OperationResult> {
    try {
      execSync(`git checkout -- ${filePath}`, { cwd: this.workingDir });
      return {
        success: true,
        message: `✅ 已撤销文件改动: \`${filePath}\``
      };
    } catch (error) {
      return {
        success: false,
        message: '',
        error: `❌ 撤销文件改动失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * ✅ 暂存文件
   */
  async stageFile(filePath: string): Promise<OperationResult> {
    try {
      execSync(`git add ${filePath}`, { cwd: this.workingDir });
      return {
        success: true,
        message: `✅ 已暂存文件: \`${filePath}\``
      };
    } catch (error) {
      return {
        success: false,
        message: '',
        error: `❌ 暂存文件失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 📦 提交暂存的文件
   */
  async commit(message: string): Promise<OperationResult> {
    try {
      execSync(`git commit -m "${message}"`, { cwd: this.workingDir });
      return {
        success: true,
        message: `✅ 提交成功: **${message}**`
      };
    } catch (error) {
      return {
        success: false,
        message: '',
        error: `❌ 提交失败: ${(error as Error).message}`
      };
    }
  }
}