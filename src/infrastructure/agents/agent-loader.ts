import { readFileSync } from 'fs';
import { join } from 'path';
import { SubAgent } from 'deepagents';
import * as yaml from 'js-yaml';

/**
 * Agent Loader module for loading subagent configurations from Markdown files.
 * 
 * This module provides functionality to parse Markdown files with YAML frontmatter
 * located in the agents directory and convert them into SubAgent configurations
 * compatible with DeepAgents framework.
 * 
 * @module agent-loader
 */

/**
 * 递归查找所有名为 'agents' 的目录
 * 
 * 中文名称：查找所有agents目录
 * 
 * 预期行为：
 * - 从指定根目录开始递归搜索
 * - 找到所有名为 'agents' 的目录
 * - 排除 node_modules、dist、coverage 等构建目录
 * - 返回所有agents目录的绝对路径数组
 * 
 * 行为分支：
 * 1. 正常情况：返回所有找到的agents目录路径
 * 2. 目录不存在：返回空数组
 * 3. 读取错误：跳过该目录并记录警告
 * 
 * @param rootDir - 搜索的根目录
 * @returns 所有agents目录的路径数组
 */
function findAllAgentsDirectories(rootDir: string): string[] {
  const fs = require('fs');
  const path = require('path');
  
  const agentsDirs: string[] = [];
  const excludedDirs = new Set(['node_modules', 'dist', 'coverage', '.git', 'build', 'out']);
  
  function walk(currentDir: string) {
    try {
      if (!fs.existsSync(currentDir)) {
        return;
      }
      
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // 跳过排除的目录
          if (excludedDirs.has(item)) {
            continue;
          }
          
          // 如果是agents目录，添加到结果中
          if (item === 'agents') {
            agentsDirs.push(fullPath);
          }
          
          // 继续递归搜索子目录
          walk(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to traverse directory ${currentDir}: ${error}`);
    }
  }
  
  walk(rootDir);
  return agentsDirs;
}

/**
 * 解析YAML frontmatter从Markdown文件
 * 
 * 中文名称：解析YAML frontmatter
 * 
 * 预期行为：
 * - 读取Markdown文件内容
 * - 提取YAML frontmatter部分（位于---和---之间）
 * - 使用js-yaml解析YAML为JavaScript对象
 * - 返回frontmatter对象和剩余的Markdown内容
 * 
 * 行为分支：
 * 1. 正常情况：找到YAML frontmatter，返回解析后的对象和剩余内容
 * 2. 无frontmatter：返回空对象和完整文件内容
 * 3. 解析错误：抛出错误信息
 * 
 * @param content - Markdown文件的完整内容
 * @returns 包含frontmatter对象和剩余内容的对象
 * @throws {Error} 如果YAML解析失败
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  try {
    const yamlContent = match[1];
    const body = match[2];
    const frontmatter = yaml.load(yamlContent) as Record<string, any>;
    return { frontmatter, body };
  } catch (error) {
    throw new Error(`Failed to parse YAML frontmatter: ${error}`);
  }
}

/**
 * 从所有agents目录加载subagent配置
 * 
 * 中文名称：加载所有subagent配置
 * 
 * 预期行为：
 * - 递归查找工作目录下所有名为 'agents' 的目录
 * - 扫描每个agents目录中的所有.md文件
 * - 解析每个文件的YAML frontmatter
 * - 提取name、description等必要字段
 * - 将Markdown正文作为systemPrompt
 * - 返回SubAgent数组
 * 
 * 行为分支：
 * 1. 正常情况：成功加载所有agents，返回SubAgent配置数组
 * 2. 目录不存在：返回空数组
 * 3. 文件读取错误：跳过该文件并记录警告
 * 4. 缺少必要字段：使用文件名作为name，使用文件内容作为description
 * 
 * @param rootDir - 搜索的根目录（通常是工作目录）
 * @returns SubAgent配置数组
 */
export function loadSubAgents(rootDir: string): SubAgent[] {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // 查找所有agents目录
    const agentsDirs = findAllAgentsDirectories(rootDir);
    
    if (agentsDirs.length === 0) {
      console.warn(`No agents directories found in ${rootDir}`);
      return [];
    }
    
    const subAgents: SubAgent[] = [];
    
    // 处理每个agents目录
    for (const agentsDir of agentsDirs) {
      try {
        if (!fs.existsSync(agentsDir)) {
          continue;
        }
        
        const files = fs.readdirSync(agentsDir);
        const markdownFiles = files.filter((file: string) => file.endsWith('.md'));
        
        for (const file of markdownFiles) {
          try {
            const filePath = path.join(agentsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const { frontmatter, body } = parseFrontmatter(content);
            
            // 确保每个文件都有name和description
            const name = frontmatter.name || file.replace(/\.md$/, '');
            const description = frontmatter.description || `Agent loaded from ${filePath}`;
            
            const subAgent: SubAgent = {
              name,
              description,
              systemPrompt: body.trim()
            };
            
            // 可选字段 - 只有在frontmatter中明确指定时才设置
            if ('model' in frontmatter) {
              subAgent.model = frontmatter.model;
            }
            if ('tools' in frontmatter) {
              subAgent.tools = frontmatter.tools;
            }
            if ('skills' in frontmatter) {
              subAgent.skills = frontmatter.skills;
            }
            if ('middleware' in frontmatter) {
              subAgent.middleware = frontmatter.middleware;
            }
            if ('interruptOn' in frontmatter) {
              subAgent.interruptOn = frontmatter.interruptOn;
            }
            
            subAgents.push(subAgent);
            
          } catch (error) {
            console.warn(`Failed to load agent file ${file} from ${agentsDir}: ${error}`);
            continue;
          }
        }
        
      } catch (error) {
        console.warn(`Failed to process agents directory ${agentsDir}: ${error}`);
        continue;
      }
    }
    
    return subAgents;
  } catch (error) {
    console.error(`Failed to load subagents from ${rootDir}: ${error}`);
    return [];
  }
}

/**
 * 获取默认的通用子代理配置
 * 
 * 中文名称：获取默认通用子代理
 * 
 * 预期行为：
 * - 返回一个预定义的通用子代理配置
 * - 该代理具有完整的工具访问权限
 * - 继承主代理的所有skills
 * - 使用详细的系统提示
 * 
 * 行为分支：
 * 1. 正常情况：返回默认的通用子代理配置
 * 
 * @returns 默认的通用子代理配置
 */
export function getDefaultGeneralPurposeSubAgent(): SubAgent {
  return {
    name: "general-purpose",
    description: "Handles general tasks requiring full capabilities and skill inheritance",
    systemPrompt: `You are a general-purpose AI assistant with full capabilities. You can handle any task that requires planning, analysis, execution, and problem-solving.

## Capabilities
- Full access to all available tools
- Inheritance of all main agent skills  
- Comprehensive problem-solving abilities
- Multi-step task planning and execution
- Context management and memory utilization
- Subagent delegation when needed

## Guidelines
- Break down complex tasks into manageable steps
- Use appropriate tools for each subtask  
- Leverage inherited skills effectively
- Maintain context awareness throughout execution
- Provide clear progress updates and results
- Delegate to specialized subagents when appropriate`
  };
}