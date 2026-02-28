import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

/**
 * 递归查找工作目录下的所有skills目录，排除无用目录
 * @param workDir 工作目录路径
 * @returns 所有skills目录的相对路径数组
 */
export function findSkillsDirectories(workDir: string): string[] {
  const skillsDirs: string[] = [];
  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    '.cache',
    'dist',
    'coverage',
    '__tests__',
    '.husky',
    '.vscode',
    '.idea',
    'build',
    'out',
    'temp',
    'tmp'
  ]);
  
  /**
   * 递归扫描目录查找skills目录
   * @param currentDir 当前扫描的目录
   * @param relativePath 相对于工作目录的相对路径
   */
  function scanDirectory(currentDir: string, relativePath: string = '') {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          
          // 跳过忽略的目录
          if (ignoredDirs.has(dirName)) {
            continue;
          }
          
          const currentRelativePath = relativePath ? `${relativePath}/${dirName}` : dirName;
          const fullPath = join(currentDir, dirName);
          
          // 检查当前目录是否包含skills子目录
          const skillsDirPath = join(fullPath, 'skills');
          if (existsSync(skillsDirPath) && readdirSync(skillsDirPath).length > 0) {
            const skillsRelativePath = `./${currentRelativePath}/skills/`;
            skillsDirs.push(skillsRelativePath);
          }
          
          // 递归扫描子目录
          scanDirectory(fullPath, currentRelativePath);
        }
      }
    } catch (error) {
      // 忽略权限错误或其他读取错误
      console.debug(`Skipping directory due to error: ${currentDir}`, error);
    }
  }
  
  // 首先检查根目录的skills
  const rootSkillsDir = join(workDir, 'skills');
  if (existsSync(rootSkillsDir) && readdirSync(rootSkillsDir).length > 0) {
    skillsDirs.push('./skills/');
  }
  
  // 递归扫描整个工作目录
  scanDirectory(workDir);
  
  // 如果没有找到任何skills目录，返回默认路径
  return skillsDirs.length > 0 ? skillsDirs : ['./skills/'];
}