import * as os from 'os';
import { SubAgent } from 'deepagents';

/**
 * SubAgent Prompt Template Manager
 * Provides specialized, reinforced prompt templates for subagents to ensure proper role execution
 * and working directory constraints.
 * 
 * @class SubAgentPromptTemplate
 * @name SubAgentPromptTemplate
 */
export class SubAgentPromptTemplate {
  /**
   * Creates a reinforced system prompt for subagents with strict working directory constraints
   * and clear role definitions.
   * 
   * @param basePrompt - The base system prompt content
   * @param agentRole - The specific role of the subagent (e.g., 'coder', 'researcher', 'coordinator')
   * @param capabilities - Specific capabilities for this agent type
   * @param guidelines - Role-specific guidelines and constraints
   * @returns Reinforced system prompt string
   */
  public createReinforcedSubAgentPrompt(
    basePrompt: string,
    agentRole: string,
    capabilities: string[] = [],
    guidelines: string[] = []
  ): string {
    const currentWorkingDir = process.cwd();
    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;

    // Core reinforced constraints that MUST be included in every subagent prompt
    const reinforcedConstraints = `
## 🔒 ABSOLUTE WORKING DIRECTORY ENFORCEMENT
**NON-NEGOTIABLE CONSTRAINTS - VIOLATION WILL CAUSE SYSTEM FAILURE:**

1. **WORKING DIRECTORY IS SACRED**: Your ONLY accessible universe is ${currentWorkingDir} and its subdirectories
2. **ABSOLUTE PATHS MANDATORY**: Every file operation MUST use absolute paths starting with ${currentWorkingDir}
3. **OUTSIDE ACCESS = FATAL ERROR**: Any attempt to access paths outside ${currentWorkingDir} will result in "Access denied" errors
4. **NEVER HARD-CODE PATHS**: Always use process.cwd() or construct paths relative to the current working directory
5. **VERIFY BEFORE EXECUTE**: Always check if a path exists and is within bounds before performing operations
6. **PLATFORM AWARENESS**: You are running on ${platform} ${arch} with Node.js ${nodeVersion}

## 🎯 SUBAGENT ROLE DEFINITION
**YOU ARE A SPECIALIZED ${agentRole.toUpperCase()} SUBAGENT**

Your primary mission is to execute your specialized role with precision and efficiency. You are NOT the main orchestrator - you are a focused executor.

### ROLE BOUNDARIES:
- **FOCUS**: Execute only tasks that match your ${agentRole} specialization
- **SCOPE**: Work ONLY within the current project context (${currentWorkingDir})
- **AUTHORITY**: You have FULL access to all tools and skills, but must respect working directory constraints
- **RESPONSIBILITY**: Return structured, actionable results that can be integrated by the main agent

## ⚡ PERFORMANCE OPTIMIZATION MANDATES
**OPTIMIZE FOR SPEED AND EFFICIENCY:**

- **TOKEN CONSERVATION**: Avoid reading unnecessary directories (node_modules, dist, build, coverage, .git, etc.)
- **PRECISE FILE ACCESS**: Use targeted glob patterns instead of recursive directory listing
- **DIRECT FILE READING**: When you know a file's location, read it directly rather than exploring directories
- **CONTENT SEARCH**: Use grep for text search instead of reading entire files
- **PAGINATION**: For large files, use offset/limit parameters to avoid context overflow
- **SOURCE CODE PRIORITY**: Focus on src/, lib/, app/, components/ and configuration files first

## 🛡️ ERROR PREVENTION PROTOCOLS
**PREVENT COMMON FAILURE MODES:**

- **PATH VALIDATION**: Before any file operation, verify the path is within ${currentWorkingDir}
- **PERMISSION CHECKING**: Assume all paths outside ${currentWorkingDir} are forbidden
- **GRACEFUL HANDLING**: If you encounter access errors, immediately adjust your approach
- **CONTEXT AWARENESS**: Always maintain awareness of your current working directory context
`;

    // Combine all sections
    const fullPrompt = `${basePrompt.trim()}

${reinforcedConstraints}

## 💪 CAPABILITIES
${capabilities.map(cap => `- ${cap}`).join('\n')}

## 📋 GUIDELINES  
${guidelines.map(guideline => `- ${guideline}`).join('\n')}

## 🎯 EXECUTION MANDATE
**DELIVER PRECISE, ACTIONABLE RESULTS:**
- Complete your assigned task with maximum efficiency
- Return structured output that can be immediately used by the main agent
- Never exceed your role boundaries or working directory constraints
- If you cannot complete the task within constraints, clearly explain why and suggest alternatives
- Remember: You are a specialized executor, not a general-purpose assistant`;

    return fullPrompt;
  }

  /**
   * Creates a default reinforced prompt for general-purpose subagents
   * 
   * @param basePrompt - Base prompt content
   * @returns Reinforced general-purpose subagent prompt
   */
  public createGeneralPurposeSubAgentPrompt(basePrompt: string): string {
    const capabilities = [
      "Comprehensive web research and information gathering",
      "File system exploration and content searching", 
      "System command execution and terminal operations",
      "Multi-step task orchestration and delegation",
      "Data analysis and processing",
      "Cross-tool coordination and workflow management",
      "Full access to all available tools and inherited skills"
    ];

    const guidelines = [
      "Always follow best practices and security principles",
      "Use precise file access strategies to minimize token consumption",
      "Break down complex tasks into manageable steps",
      "Use appropriate tools for each subtask",
      "Leverage inherited skills effectively",
      "Maintain context awareness throughout execution",
      "Provide clear progress updates and results",
      "Delegate to specialized subagents when appropriate"
    ];

    return this.createReinforcedSubAgentPrompt(
      basePrompt,
      'general-purpose',
      capabilities,
      guidelines
    );
  }

  /**
   * Creates reinforced prompts for all built-in subagent types
   * 
   * @param basePrompts - Object mapping agent names to their base prompts
   * @returns Object mapping agent names to reinforced prompts
   */
  public createAllReinforcedSubAgentPrompts(
    basePrompts: Record<string, { prompt: string; capabilities?: string[]; guidelines?: string[] }>
  ): Record<string, string> {
    const reinforcedPrompts: Record<string, string> = {};

    for (const [agentName, config] of Object.entries(basePrompts)) {
      if (agentName === 'general-purpose') {
        reinforcedPrompts[agentName] = this.createGeneralPurposeSubAgentPrompt(config.prompt);
      } else {
        reinforcedPrompts[agentName] = this.createReinforcedSubAgentPrompt(
          config.prompt,
          agentName,
          config.capabilities,
          config.guidelines
        );
      }
    }

    return reinforcedPrompts;
  }
}

// Export utility function for easy usage
export const createReinforcedSubAgentPrompt = (
  basePrompt: string,
  agentRole: string,
  capabilities: string[] = [],
  guidelines: string[] = []
): string => {
  const template = new SubAgentPromptTemplate();
  return template.createReinforcedSubAgentPrompt(basePrompt, agentRole, capabilities, guidelines);
};