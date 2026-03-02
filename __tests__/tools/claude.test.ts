import getClaudeTools from '@/tools/claude';
import * as childProcess from 'child_process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

describe('Claude CLI Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('claudeExecuteTool', () => {
    let claudeExecuteTool: any;

    beforeAll(async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');
      const tools = await getClaudeTools();
      claudeExecuteTool = tools[0];
    });

    it('should have correct tool name', () => {
      expect(claudeExecuteTool.name).toBe('claude_execute');
    });

    it('should have correct tool description', () => {
      expect(claudeExecuteTool.description).toContain('Claude Code CLI');
      expect(claudeExecuteTool.description).toContain('claude');
    });

    it('should have correct schema', () => {
      const schema = claudeExecuteTool.schema;
      expect(schema).toBeDefined();

      const parsed = schema.safeParse({ prompt: 'fix the bug' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.prompt).toBe('fix the bug');
        expect(parsed.data.timeout).toBe(6000000);
        expect(parsed.data.args).toEqual([]);
        expect(parsed.data.continueSession).toBe(false);
      }
    });

    it('should accept optional args', () => {
      const schema = claudeExecuteTool.schema;
      const parsed = schema.safeParse({
        prompt: 'write tests',
        args: ['--model', 'claude-opus-4-5'],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.args).toEqual(['--model', 'claude-opus-4-5']);
      }
    });
  });

  describe('getClaudeTools', () => {
    it('should return empty array when claude command is not available', async () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('command not found');
      });

      const tools = await getClaudeTools();
      expect(tools).toEqual([]);
    });

    it('should return claude tools when claude command is available', async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');

      const tools = await getClaudeTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('claude_execute');
    });
  });
});
