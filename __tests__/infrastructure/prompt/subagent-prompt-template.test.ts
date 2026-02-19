import { SubAgentPromptTemplate, createReinforcedSubAgentPrompt } from '../../../src/infrastructure/prompt/subagent-prompt-template';

describe('SubAgentPromptTemplate', () => {
  let template: SubAgentPromptTemplate;

  beforeEach(() => {
    template = new SubAgentPromptTemplate();
  });

  describe('createReinforcedSubAgentPrompt', () => {
    it('should create a reinforced prompt with all required sections', () => {
      const basePrompt = 'Base system prompt';
      const agentRole = 'coder';
      const capabilities = ['Code writing', 'Debugging'];
      const guidelines = ['Follow best practices', 'Write clean code'];

      const result = template.createReinforcedSubAgentPrompt(basePrompt, agentRole, capabilities, guidelines);

      expect(result).toContain('Base system prompt');
      expect(result).toContain('ABSOLUTE WORKING DIRECTORY ENFORCEMENT');
      expect(result).toContain('SUBAGENT ROLE DEFINITION');
      expect(result).toContain('YOU ARE A SPECIALIZED CODER SUBAGENT');
      expect(result).toContain('Code writing');
      expect(result).toContain('Follow best practices');
      expect(result).toContain('EXECUTION MANDATE');
    });

    it('should include current working directory in constraints', () => {
      const basePrompt = 'Test prompt';
      const result = template.createReinforcedSubAgentPrompt(basePrompt, 'test');

      expect(result).toContain(process.cwd());
    });

    it('should handle empty capabilities and guidelines arrays', () => {
      const basePrompt = 'Test prompt';
      const result = template.createReinforcedSubAgentPrompt(basePrompt, 'test', [], []);

      expect(result).toContain('Test prompt');
      expect(result).toContain('CAPABILITIES');
      expect(result).toContain('GUIDELINES');
    });

    it('should work with undefined capabilities and guidelines', () => {
      const basePrompt = 'Test prompt';
      // @ts-ignore - testing undefined inputs
      const result = template.createReinforcedSubAgentPrompt(basePrompt, 'test', undefined, undefined);

      expect(result).toContain('Test prompt');
      expect(result).toContain('CAPABILITIES');
      expect(result).toContain('GUIDELINES');
    });
  });

  describe('createGeneralPurposeSubAgentPrompt', () => {
    it('should create a general-purpose prompt with predefined capabilities and guidelines', () => {
      const basePrompt = 'General base prompt';
      const result = template.createGeneralPurposeSubAgentPrompt(basePrompt);

      expect(result).toContain('General base prompt');
      expect(result).toContain('general-purpose');
      expect(result).toContain('Comprehensive web research');
      expect(result).toContain('File system exploration');
      expect(result).toContain('Always follow best practices');
      expect(result).toContain('Use precise file access strategies');
    });
  });

  describe('createAllReinforcedSubAgentPrompts', () => {
    it('should create prompts for all provided agent types', () => {
      const basePrompts = {
        'general-purpose': {
          prompt: 'General prompt'
        },
        'coder': {
          prompt: 'Coder prompt',
          capabilities: ['Write code'],
          guidelines: ['Follow coding standards']
        },
        'researcher': {
          prompt: 'Researcher prompt',
          capabilities: ['Conduct research'],
          guidelines: ['Cite sources']
        }
      };

      const result = template.createAllReinforcedSubAgentPrompts(basePrompts);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['general-purpose']).toContain('General prompt');
      expect(result['coder']).toContain('Coder prompt');
      expect(result['researcher']).toContain('Researcher prompt');
      expect(result['general-purpose']).toContain('general-purpose');
      expect(result['coder']).toContain('CODER');
      expect(result['researcher']).toContain('RESEARCHER');
    });

    it('should handle agents without capabilities and guidelines', () => {
      const basePrompts = {
        'validator': {
          prompt: 'Validator prompt'
        }
      };

      const result = template.createAllReinforcedSubAgentPrompts(basePrompts);

      expect(result['validator']).toContain('Validator prompt');
      expect(result['validator']).toContain('VALIDATOR');
    });
  });

  describe('createReinforcedSubAgentPrompt utility function', () => {
    it('should create a reinforced prompt using the utility function', () => {
      const basePrompt = 'Utility test prompt';
      const agentRole = 'tester';
      const capabilities = ['Run tests'];
      const guidelines = ['Write comprehensive tests'];

      const result = createReinforcedSubAgentPrompt(basePrompt, agentRole, capabilities, guidelines);

      expect(result).toContain('Utility test prompt');
      expect(result).toContain('TESTER');
      expect(result).toContain('Run tests');
      expect(result).toContain('Write comprehensive tests');
    });
  });
});