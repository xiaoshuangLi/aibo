import { ENHANCED_SYSTEM_PROMPT } from '../src/enhanced-system-prompt';
import * as os from 'os';

describe('Enhanced System Prompt', () => {
  test('should export ENHANCED_SYSTEM_PROMPT as a string', () => {
    expect(typeof ENHANCED_SYSTEM_PROMPT).toBe('string');
    expect(ENHANCED_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  test('should contain required environment information', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    // Check for OS information
    expect(prompt).toContain(`OS: ${os.platform()} ${os.arch()}`);
    
    // Check for Node.js version
    expect(prompt).toContain(`Node.js: ${process.version}`);
    
    // Check for working directory
    expect(prompt).toContain(`Working directory: ${process.cwd()}`);
  });

  test('should contain core capabilities section', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('CORE CAPABILITIES:');
    expect(prompt).toContain('1. **Autonomous Programming**');
    expect(prompt).toContain('2. **SubAgent Delegation**');
    expect(prompt).toContain('3. **Error Recovery**');
    expect(prompt).toContain('4. **Full System Access**');
  });

  test('should contain subagent framework guidelines', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('SUBAGENT FRAMEWORK:');
    expect(prompt).toContain('Use SubAgents for complex multi-step tasks');
    expect(prompt).toContain('SubAgents are ephemeral and return single structured results');
    expect(prompt).toContain('Launch multiple SubAgents in parallel when tasks are independent');
  });

  test('should contain error handling strategy', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('ERROR HANDLING & RETRY STRATEGY:');
    expect(prompt).toContain('1. **Immediate Error Analysis**');
    expect(prompt).toContain('2. **Strategy Adjustment**');
    expect(prompt).toContain('3. **Systematic Retries**');
    expect(prompt).toContain('4. **Fallback Plans**');
    expect(prompt).toContain('5. **User Communication**');
  });

  test('should contain rules section', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('RULES:');
    expect(prompt).toContain('1. ALWAYS explain actions BEFORE executing tools');
    expect(prompt).toContain('2. NEVER run destructive commands');
    expect(prompt).toContain('3. For file deletions, ALWAYS confirm first');
    expect(prompt).toContain('4. Prefer safe commands');
    expect(prompt).toContain('5. Output should be CONCISE and ACTION-ORIENTED');
    expect(prompt).toContain('6. For complex objectives requiring 3+ steps, use todo lists');
    expect(prompt).toContain('7. Break down large tasks into smaller, manageable steps');
    expect(prompt).toContain('8. When delegating to SubAgents, ensure they have complete context');
  });

  test('should contain format guidelines', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('FORMAT GUIDELINES:');
    expect(prompt).toContain('Start with brief explanation of what you\'re doing and why');
    expect(prompt).toContain('Show tool results concisely');
    expect(prompt).toContain('End with clear next step or conclusion');
  });

  test('should contain problem-solving methodology', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('PROBLEM-SOLVING METHODOLOGY:');
    expect(prompt).toContain('1. **Understand**');
    expect(prompt).toContain('2. **Research Best Practices**');
    expect(prompt).toContain('3. **Plan**');
    expect(prompt).toContain('4. **Execute**');
    expect(prompt).toContain('5. **Verify**');
    expect(prompt).toContain('6. **Recover**');
    expect(prompt).toContain('7. **Deliver**');
  });

  test('should contain feature development workflow', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('FEATURE DEVELOPMENT WORKFLOW:');
    expect(prompt).toContain('1. **Write Comprehensive Tests**');
    expect(prompt).toContain('2. **Create Feature Documentation**');
    expect(prompt).toContain('3. **Update Main Documentation**');
    expect(prompt).toContain('4. **Commit Code Properly**');
  });

  test('should contain English instructions for understanding requirements', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('IMMEDIATELY upon startup, read README.md and all features/*.md files in the working directory to understand the project architecture, features, and conventions');
    expect(prompt).toContain('Focus on reading documentation files (README.md, features/*.md) rather than code files during initial project understanding phase');
  });

  test('should contain English instructions for technical proposal approval', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    expect(prompt).toContain('PRESENT THIS TECHNICAL PROPOSAL TO THE USER FOR EXPLICIT APPROVAL BEFORE PROCEEDING WITH ANY IMPLEMENTATION');
    expect(prompt).toContain('NEVER implement any solution without user confirmation of the technical proposal');
  });

  test('should not contain any template placeholders', () => {
    const prompt = ENHANCED_SYSTEM_PROMPT;
    
    // Ensure no unresolved template variables
    expect(prompt).not.toContain('${');
    expect(prompt).not.toContain('}');
  });
});