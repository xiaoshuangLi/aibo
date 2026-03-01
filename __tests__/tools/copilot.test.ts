import getCopilotTools from '@/tools/copilot';
import * as childProcess from 'child_process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

describe('GitHub Copilot CLI Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('copilotExecuteTool', () => {
    let copilotExecuteTool: any;

    beforeAll(async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');
      const tools = await getCopilotTools();
      copilotExecuteTool = tools[0];
    });

    it('should have correct tool name', () => {
      expect(copilotExecuteTool.name).toBe('copilot_execute');
    });

    it('should have correct tool description', () => {
      expect(copilotExecuteTool.description).toContain('GitHub Copilot CLI');
      expect(copilotExecuteTool.description).toContain('copilot');
    });

    it('should mention coding use-cases in description', () => {
      expect(copilotExecuteTool.description).toContain('editing files');
    });

    it('should have correct schema', () => {
      const schema = copilotExecuteTool.schema;
      expect(schema).toBeDefined();

      const parsed = schema.safeParse({ prompt: 'fix the bug in src/utils.ts' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.prompt).toBe('fix the bug in src/utils.ts');
        expect(parsed.data.timeout).toBe(300000);
        expect(parsed.data.args).toEqual([]);
      }
    });

    it('should accept optional args', () => {
      const schema = copilotExecuteTool.schema;
      const parsed = schema.safeParse({
        prompt: 'add unit tests for UserService',
        args: ['--no-interactive'],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.args).toEqual(['--no-interactive']);
      }
    });
  });

  describe('getCopilotTools', () => {
    it('should return empty array when copilot command is not available', async () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('command not found');
      });

      const tools = await getCopilotTools();
      expect(tools).toEqual([]);
    });

    it('should return copilot tools when copilot command is available', async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');

      const tools = await getCopilotTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('copilot_execute');
    });
  });
});
