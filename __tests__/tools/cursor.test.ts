import { cursorOpenTool } from '@/tools/cursor';
import getCursorTools from '@/tools/cursor';
import * as childProcess from 'child_process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

describe('Cursor CLI Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cursorExecuteTool', () => {
    let cursorExecuteTool: any;

    beforeAll(async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');
      const tools = await getCursorTools();
      cursorExecuteTool = tools[0];
    });

    it('should have correct tool name', () => {
      expect(cursorExecuteTool.name).toBe('cursor_execute');
    });

    it('should have correct tool description', () => {
      expect(cursorExecuteTool.description).toContain('Cursor AI CLI');
      expect(cursorExecuteTool.description).toContain('Cursor');
    });

    it('should have correct schema', () => {
      const schema = cursorExecuteTool.schema;
      expect(schema).toBeDefined();

      const parsed = schema.safeParse({ prompt: 'add unit tests' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.prompt).toBe('add unit tests');
        expect(parsed.data.timeout).toBe(6000000);
        expect(parsed.data.args).toEqual([]);
        expect(parsed.data.continueSession).toBe(false);
      }
    });

    it('should accept optional args', () => {
      const schema = cursorExecuteTool.schema;
      const parsed = schema.safeParse({
        prompt: 'refactor this module',
        args: ['--flag', 'value'],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.args).toEqual(['--flag', 'value']);
      }
    });
  });

  describe('cursorOpenTool', () => {
    it('should have correct tool name', () => {
      expect(cursorOpenTool.name).toBe('cursor_open');
    });

    it('should have correct tool description', () => {
      expect(cursorOpenTool.description).toContain('Cursor editor');
      expect(cursorOpenTool.description).toContain('cursor CLI');
    });

    it('should have correct schema', () => {
      const schema = cursorOpenTool.schema;
      expect(schema).toBeDefined();

      const parsed = schema.safeParse({ path: 'src/utils.ts' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.path).toBe('src/utils.ts');
        expect(parsed.data.timeout).toBe(30000);
      }
    });
  });

  describe('getCursorTools', () => {
    it('should return empty array when agent command is not available', async () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('command not found');
      });

      const tools = await getCursorTools();
      expect(tools).toEqual([]);
    });

    it('should return cursor tools when agent command is available', async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');

      const tools = await getCursorTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('cursor_execute');
      expect(tools[1].name).toBe('cursor_open');
    });
  });
});
