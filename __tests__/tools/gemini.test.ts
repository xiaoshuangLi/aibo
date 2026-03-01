import getGeminiTools from '@/tools/gemini';
import * as childProcess from 'child_process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

describe('Gemini CLI Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('geminiExecuteTool', () => {
    let geminiExecuteTool: any;

    beforeAll(async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');
      const tools = await getGeminiTools();
      geminiExecuteTool = tools[0];
    });

    it('should have correct tool name', () => {
      expect(geminiExecuteTool.name).toBe('gemini_execute');
    });

    it('should have correct tool description', () => {
      expect(geminiExecuteTool.description).toContain('Gemini CLI');
      expect(geminiExecuteTool.description).toContain('gemini');
    });

    it('should mention frontend use-case in description', () => {
      expect(geminiExecuteTool.description).toContain('frontend');
    });

    it('should have correct schema', () => {
      const schema = geminiExecuteTool.schema;
      expect(schema).toBeDefined();

      const parsed = schema.safeParse({ prompt: 'create a button component' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.prompt).toBe('create a button component');
        expect(parsed.data.timeout).toBe(6000000);
        expect(parsed.data.args).toEqual([]);
      }
    });

    it('should accept optional args', () => {
      const schema = geminiExecuteTool.schema;
      const parsed = schema.safeParse({
        prompt: 'implement quicksort',
        args: ['--model', 'gemini-3-pro'],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.args).toEqual(['--model', 'gemini-3-pro']);
      }
    });
  });

  describe('getGeminiTools', () => {
    it('should return empty array when gemini command is not available', async () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('command not found');
      });

      const tools = await getGeminiTools();
      expect(tools).toEqual([]);
    });

    it('should return gemini tools when gemini command is available', async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');

      const tools = await getGeminiTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('gemini_execute');
    });
  });
});
