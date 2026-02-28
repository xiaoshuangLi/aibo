import { loadSubAgents, getDefaultGeneralPurposeSubAgent } from '@/infrastructure/agents/loader';
import { SubAgent } from 'deepagents';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';

describe('Agent Loader', () => {
  const testDir = '/tmp/test-agents-dir';
  const agentsDir = join(testDir, 'agents');
  const nestedAgentsDir = join(testDir, 'nested', 'agents');

  beforeEach(async () => {
    // 清理之前的测试目录
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // 目录可能不存在
    }
    
    // 创建测试目录结构
    mkdirSync(agentsDir, { recursive: true });
    mkdirSync(nestedAgentsDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理错误
    }
  });

  describe('getDefaultGeneralPurposeSubAgent', () => {
    test('should return default general purpose subagent configuration', () => {
      const agent = getDefaultGeneralPurposeSubAgent();
      
      expect(agent).toBeDefined();
      expect(agent.name).toBe('general-purpose');
      expect(agent.description).toBe('General-purpose agent for researching complex questions, searching for files and content, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. This agent has access to all tools as the main agent.');
      expect(agent.systemPrompt).toContain('You are a versatile general-purpose assistant capable of handling a wide range of tasks including research, file operations, system commands, and multi-step problem solving.');
      expect(agent.systemPrompt).toContain('Full access to all available tools and inherited skills');
      expect(agent.systemPrompt).toContain('Delegate to specialized subagents when appropriate');
    });
  });

  describe('loadSubAgents', () => {
    test('should return empty array when no agents directories found', () => {
      const result = loadSubAgents('/tmp/nonexistent-dir');
      expect(result).toEqual([]);
    });

    test('should load agents from root agents directory', () => {
      // 创建一个简单的agent文件
      const agentContent = `---\nname: test-agent\ndescription: Test agent description\n---\nThis is the system prompt for test agent.`;
      writeFileSync(join(agentsDir, 'test-agent.md'), agentContent);
      
      const result = loadSubAgents(testDir);
      
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('test-agent');
      expect(result[0].description).toBe('Test agent description');
      // 现在系统提示会被强化模板包装，检查是否包含原始内容
      expect(result[0].systemPrompt).toContain('This is the system prompt for test agent.');
      // 检查是否包含强化约束
      expect(result[0].systemPrompt).toContain('ABSOLUTE WORKING DIRECTORY ENFORCEMENT');
      expect(result[0].systemPrompt).toContain('SUBAGENT ROLE DEFINITION');
    });

    test('should load agents from nested agents directories', () => {
      // 创建根目录的agent
      const rootAgentContent = `---\nname: root-agent\n---\nRoot agent system prompt.`;
      writeFileSync(join(agentsDir, 'root-agent.md'), rootAgentContent);
      
      // 创建嵌套目录的agent
      const nestedAgentContent = `---\nname: nested-agent\n---\nNested agent system prompt.`;
      writeFileSync(join(nestedAgentsDir, 'nested-agent.md'), nestedAgentContent);
      
      const result = loadSubAgents(testDir);
      
      expect(result.length).toBe(2);
      const agentNames = result.map(agent => agent.name);
      expect(agentNames).toContain('root-agent');
      expect(agentNames).toContain('nested-agent');
    });

    test('should handle missing frontmatter', () => {
      // 创建没有frontmatter的agent文件
      const content = 'This is a simple agent without frontmatter.';
      writeFileSync(join(agentsDir, 'simple-agent.md'), content);
      
      const result = loadSubAgents(testDir);
      
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('simple-agent'); // 使用文件名
      expect(result[0].description).toContain('simple-agent.md');
      // 现在系统提示会被强化模板包装，检查是否包含原始内容
      expect(result[0].systemPrompt).toContain(content);
      // 检查是否包含强化约束
      expect(result[0].systemPrompt).toContain('ABSOLUTE WORKING DIRECTORY ENFORCEMENT');
      expect(result[0].systemPrompt).toContain('SUBAGENT ROLE DEFINITION');
    });

    test('should handle invalid YAML frontmatter gracefully', () => {
      // 创建包含无效YAML的agent文件
      const invalidContent = `---
name: invalid-agent
invalid-yaml: [unclosed array
---
This should still work.`;
      writeFileSync(join(agentsDir, 'invalid-agent.md'), invalidContent);
      
      // 应该跳过这个文件，返回空数组
      const result = loadSubAgents(testDir);
      expect(result.length).toBe(0);
    });

    test('should handle optional fields in frontmatter', () => {
      const agentContent = `---
name: advanced-agent
description: Advanced agent with optional fields
model: gpt-4
tools: ["tool1", "tool2"]
skills: ["skill1", "skill2"]
middleware: ["middleware1"]
interruptOn: ["condition1"]
---
Advanced system prompt.`;
      writeFileSync(join(agentsDir, 'advanced-agent.md'), agentContent);
      
      const result = loadSubAgents(testDir);
      
      expect(result.length).toBe(1);
      const agent = result[0];
      expect(agent.name).toBe('advanced-agent');
      expect(agent.description).toBe('Advanced agent with optional fields');
      expect(agent.model).toBe('gpt-4');
      expect(agent.tools).toEqual(['tool1', 'tool2']);
      expect(agent.skills).toEqual(['skill1', 'skill2']);
      expect(agent.middleware).toEqual(['middleware1']);
      expect(agent.interruptOn).toEqual(['condition1']);
      // 现在系统提示会被强化模板包装，检查是否包含原始内容
      expect(agent.systemPrompt).toContain('Advanced system prompt.');
      // 检查是否包含强化约束
      expect(agent.systemPrompt).toContain('ABSOLUTE WORKING DIRECTORY ENFORCEMENT');
      expect(agent.systemPrompt).toContain('SUBAGENT ROLE DEFINITION');
    });

    test('should ignore non-markdown files', () => {
      // 创建markdown文件
      writeFileSync(join(agentsDir, 'valid-agent.md'), '---\nname: valid\n---\nValid agent');
      // 创建非markdown文件
      writeFileSync(join(agentsDir, 'not-agent.txt'), 'This should be ignored');
      
      const result = loadSubAgents(testDir);
      
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('valid');
    });

    test('should handle file read errors gracefully', () => {
      // 创建一个agent文件
      writeFileSync(join(agentsDir, 'existing-agent.md'), '---\nname: existing\n---\nExisting agent');
      
      // 模拟文件读取错误的情况很难在测试中重现，
      // 但我们可以确保函数不会抛出异常
      expect(() => {
        loadSubAgents(testDir);
      }).not.toThrow();
    });

    test('should exclude node_modules and other build directories', () => {
      // 创建一个在node_modules中的agents目录
      const nodeModulesAgents = join(testDir, 'node_modules', 'agents');
      mkdirSync(nodeModulesAgents, { recursive: true });
      writeFileSync(join(nodeModulesAgents, 'ignored-agent.md'), '---\nname: ignored\n---\nShould be ignored');
      
      // 创建正常的agents目录
      writeFileSync(join(agentsDir, 'normal-agent.md'), '---\nname: normal\n---\nNormal agent');
      
      const result = loadSubAgents(testDir);
      
      // 应该只找到正常目录的agent，忽略node_modules中的
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('normal');
    });

    test('should handle empty agents directory', () => {
      // agents目录存在但为空
      const result = loadSubAgents(testDir);
      expect(result).toEqual([]);
    });

    test('should use filename as name when not specified in frontmatter', () => {
      const content = `---
description: Agent without name
---
System prompt.`;
      writeFileSync(join(agentsDir, 'filename-as-name.md'), content);
      
      const result = loadSubAgents(testDir);
      
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('filename-as-name');
      expect(result[0].description).toBe('Agent without name');
    });
  });
});