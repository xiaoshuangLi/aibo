import { codexExecuteTool } from '@/tools/codex';
import getCodexTools from '@/tools/codex';
import * as childProcess from 'child_process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

describe('Codex CLI Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('codexExecuteTool', () => {
    it('should have correct tool name', () => {
      expect(codexExecuteTool.name).toBe('codex_execute');
    });

    it('should have correct tool description', () => {
      expect(codexExecuteTool.description).toContain('Codex CLI');
      expect(codexExecuteTool.description).toContain('codex');
    });

    it('should mention backend use-case in description', () => {
      expect(codexExecuteTool.description).toContain('backend');
    });

    it('should have correct schema', () => {
      const schema = codexExecuteTool.schema;
      expect(schema).toBeDefined();

      const parsed = schema.safeParse({ prompt: 'create a REST API endpoint' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.prompt).toBe('create a REST API endpoint');
        expect(parsed.data.timeout).toBe(300000);
        expect(parsed.data.args).toEqual([]);
      }
    });

    it('should accept optional args', () => {
      const schema = codexExecuteTool.schema;
      const parsed = schema.safeParse({
        prompt: 'write a SQL migration',
        args: ['--quiet'],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.args).toEqual(['--quiet']);
      }
    });
  });

  describe('getCodexTools', () => {
    it('should return empty array when codex command is not available', async () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('command not found');
      });

      const tools = await getCodexTools();
      expect(tools).toEqual([]);
    });

    it('should return codex tools when codex command is available', async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');

      const tools = await getCodexTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('codex_execute');
    });
  });
});
