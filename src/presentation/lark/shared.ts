/**
 * Lark 格式化共享工具函数
 * 
 * 中文名称：Lark 共享工具
 * 
 * 为 Lark 飞书适配器提供通用的格式化和文本处理功能，
 * 被 tool-call-formatter.ts 和 tool-result-formatter.ts 共同使用。
 * 
 * @module lark-shared
 */

/**
 * 零宽空格字符 - 用于避免 Lark 将缩进行识别为代码块
 */
export const ZERO_WIDTH_SPACE = '\u200B';

/**
 * 根据文件路径和内容推断代码语言类型
 * @param filePath - 文件路径（可选）
 * @param content - 代码内容（可选）  
 * @returns 推断的语言类型，如果无法确定则返回 undefined
 */
export const inferLanguageType = (filePath?: string, content?: string): string | undefined => {
  // 如果有文件路径，优先根据文件扩展名判断
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext) {
      const extensionMap: Record<string, string> = {
        // JavaScript/TypeScript
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript', 
        'tsx': 'typescript',
        // Python
        'py': 'python',
        // Shell/Bash
        'sh': 'bash',
        'bash': 'bash',
        // HTML/CSS
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        // Java
        'java': 'java',
        // C/C++
        'c': 'c',
        'cpp': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        // Go
        'go': 'go',
        // Rust
        'rs': 'rust',
        // Ruby
        'rb': 'ruby',
        // PHP
        'php': 'php',
        // XML/YAML/TOML
        'xml': 'xml',
        'yml': 'yaml',
        'yaml': 'yaml',
        'toml': 'toml',
        // JSON
        'json': 'json',
        // Markdown
        'md': 'markdown',
        'markdown': 'markdown',
        // SQL
        'sql': 'sql',
        // Swift
        'swift': 'swift',
        // Kotlin
        'kt': 'kotlin',
        'kts': 'kotlin',
        // Scala
        'scala': 'scala',
        // Perl
        'pl': 'perl',
        // Lua
        'lua': 'lua',
        // R
        'r': 'r',
        // MATLAB
        'm': 'matlab',
        // Makefile
        'makefile': 'makefile',
        'mk': 'makefile',
        // Docker
        'dockerfile': 'docker_file'
      };
      
      if (extensionMap[ext]) {
        return extensionMap[ext];
      }
    }
  }
  
  // 如果没有文件路径或无法从扩展名判断，尝试从内容推断
  if (content) {
    const firstLines = content.split('\n').slice(0, 5).join('\n').toLowerCase();
    
    // 检查 shebang
    if (firstLines.startsWith('#!/bin/bash') || firstLines.startsWith('#!/usr/bin/env bash')) {
      return 'bash';
    }
    if (firstLines.startsWith('#!/bin/sh') || firstLines.startsWith('#!/usr/bin/env sh')) {
      return 'shell';
    }
    if (firstLines.startsWith('#!/usr/bin/env python')) {
      return 'python';
    }
    if (firstLines.startsWith('#!/usr/bin/env node')) {
      return 'javascript';
    }
    
    // 检查常见语法特征
    if (firstLines.includes('import ') || firstLines.includes('export ') || 
        firstLines.includes('function ') || firstLines.includes('const ') || 
        firstLines.includes('let ') || firstLines.includes('var ')) {
      // 检查是否包含 TypeScript 特征
      if (firstLines.includes(': ') || firstLines.includes('interface ') || 
          firstLines.includes('type ') || firstLines.includes('declare ')) {
        return 'typescript';
      }
      return 'javascript';
    }
    
    if (firstLines.includes('def ') || firstLines.includes('class ') || 
        firstLines.includes('import ') || firstLines.includes('from ')) {
      return 'python';
    }
    
    if (firstLines.includes('#include') || firstLines.includes('int main') || 
        firstLines.includes('void ') || firstLines.includes('struct ')) {
      return 'c';
    }
    
    if (firstLines.includes('#include') && (firstLines.includes('std::') || 
        firstLines.includes('using namespace') || firstLines.includes('class '))) {
      return 'cpp';
    }
    
    if (firstLines.includes('package ') && firstLines.includes('func ')) {
      return 'go';
    }
    
    if (firstLines.includes('fn ') && firstLines.includes('let ') && 
        firstLines.includes('mut ')) {
      return 'rust';
    }
    
    if (firstLines.includes('public class') || firstLines.includes('private ') || 
        firstLines.includes('protected ') || firstLines.includes('static void main')) {
      return 'java';
    }
  }
  
  // 无法确定语言类型
  return undefined;
};

/**
 * 在文本行首添加零宽空格以避免 Lark 代码块识别
 * @param text - 要处理的文本
 * @returns 处理后的文本
 */
export const escapeLarkIndentation = (text: string): string => {
  if (!text) return text;
  
  // 按行分割文本
  const lines = text.split('\n');
  
  // 为每一行添加零宽空格（如果该行以空白字符开头）
  const processedLines = lines.map(line => {
    // 如果行以空白字符（空格、制表符等）开头，则在开头添加零宽空格
    if (line.length > 0 && /^\s/.test(line)) {
      return ZERO_WIDTH_SPACE + line;
    }
    return line;
  });
  
  return processedLines.join('\n');
};

/**
 * 转义 Lark 特殊字符
 * @param text - 要转义的文本
 * @returns 转义后的文本
 */
export const escapeLarkSpecialChars = (text: string): string => {
  if (!text) return text;
  
  // Lark 支持完整的 Markdown，但某些特殊字符可能需要处理
  // 目前主要处理可能导致解析问题的字符
  let escapedText = text;
  
  // 转义反斜杠（如果后面跟着特殊字符）
  escapedText = escapedText.replace(/\\/g, '\\\\');
  
  // 转义可能导致问题的其他字符（根据实际需要添加）
  // 这里保持相对保守，因为 Lark 的 Markdown 解析相对宽松
  
  return escapedText;
};

/**
 * 完整的 Lark 文本处理函数
 * @param text - 要处理的原始文本
 * @param options - 处理选项
 * @returns 处理后的文本
 */
export const processLarkText = (
  text: string, 
  options: { 
    escapeIndentation?: boolean; 
    escapeSpecialChars?: boolean;
    preserveCodeBlocks?: boolean;
  } = {}
): string => {
  if (!text) return text;
  
  const { 
    escapeIndentation = true, 
    escapeSpecialChars = true,
    preserveCodeBlocks = false 
  } = options;
  
  let processedText = text;
  
  // 如果需要保留代码块，则先提取代码块内容
  if (preserveCodeBlocks) {
    // 提取并临时替换代码块
    const codeBlockRegex = /(```[\s\S]*?```)/g;
    const tempCodeBlocks: string[] = [];
    processedText = processedText.replace(codeBlockRegex, (match) => {
      tempCodeBlocks.push(match);
      return `__CODE_BLOCK_${tempCodeBlocks.length - 1}__`;
    });
    
    // 应用零宽空格转义（避免缩进被识别为代码块）
    if (escapeIndentation) {
      processedText = escapeLarkIndentation(processedText);
    }
    
    // 应用特殊字符转义
    if (escapeSpecialChars) {
      processedText = escapeLarkSpecialChars(processedText);
    }
    
    // 恢复代码块
    processedText = processedText.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
      return tempCodeBlocks[parseInt(index)] || '';
    });
  } else {
    // 不保留代码块的情况
    if (escapeIndentation) {
      processedText = escapeLarkIndentation(processedText);
    }
    
    if (escapeSpecialChars) {
      processedText = escapeLarkSpecialChars(processedText);
    }
  }
  
  return processedText;
};

/**
 * 检测内容是否包含错误信息
 * @param content - 要检测的内容
 * @returns 是否包含错误信息
 */
export const isErrorContent = (content: string): boolean => {
  return content.toLowerCase().includes('error') || 
         content.toLowerCase().includes('exception') ||
         content.includes('stderr') ||
         content.startsWith('Error:') ||
         content.startsWith('Exception:');
};

/**
 * 检测内容是否为JSON格式
 * @param content - 要检测的内容
 * @returns 是否为JSON格式
 */
export const isJsonContent = (content: string): boolean => {
  const trimmed = content.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
};

/**
 * 检测工具类型
 * @param name - 工具名称
 * @returns 工具类型分类
 */
export const getToolType = (name: string): string => {
  // 文件系统工具
  if (['ls', 'read_file', 'write_file', 'edit_file', 'glob', 'grep'].includes(name)) {
    return 'filesystem';
  }
  // 系统/Bash工具
  if (['execute_bash', 'sleep', 'echo'].includes(name)) {
    return 'system';
  }
  // GitHub工具
  if (name === 'WebFetchFromGithub') {
    return 'github';
  }
  // 代码分析工具
  if (name === 'hybrid_code_reader') {
    return 'code_analysis';
  }
  // 知识库工具
  if (['add_knowledge', 'get_knowledge_summaries', 'search_knowledge'].includes(name)) {
    return 'knowledge';
  }
  // 搜索工具
  if (name === 'TencentWsaSearch') {
    return 'search';
  }
  // 任务管理工具
  if (name === 'write-subagent-todos' || name === 'write_todos' || name === 'task') {
    return 'task_management';
  }
  // Composio工具
  if (name.startsWith('COMPOSIO_')) {
    return 'composio';
  }
  // 其他工具
  return 'other';
};