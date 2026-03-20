import getAcpTools from '@/tools/acp';
import { buildAcpxArgs } from '@/tools/acp';
import * as childProcess from 'child_process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

describe('ACP Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildAcpxArgs', () => {
    it('should build basic prompt args for codex', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: 'fix the tests',
        mode: 'prompt',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('--approve-all');
      expect(args).toContain('--format');
      expect(args).toContain('text');
      expect(args).toContain('codex');
      expect(args).toContain('fix the tests');
      expect(args).not.toContain('exec');
    });

    it('should build exec mode args', () => {
      const args = buildAcpxArgs({
        agent: 'claude',
        prompt: 'summarize repo',
        mode: 'exec',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('claude');
      expect(args).toContain('exec');
      expect(args).toContain('summarize repo');
    });

    it('should include session name flag when provided', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: 'implement pagination',
        mode: 'prompt',
        session_name: 'backend',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('-s');
      expect(args).toContain('backend');
    });

    it('should include --cwd flag when cwd is provided', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: 'review code',
        mode: 'prompt',
        cwd: '/path/to/project',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('--cwd');
      expect(args).toContain('/path/to/project');
    });

    it('should build sessions_new args', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: '',
        mode: 'sessions_new',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('sessions');
      expect(args).toContain('new');
    });

    it('should build sessions_list args', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: '',
        mode: 'sessions_list',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('sessions');
      expect(args).toContain('list');
    });

    it('should build sessions_close args', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: '',
        mode: 'sessions_close',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('sessions');
      expect(args).toContain('close');
    });

    it('should build cancel args', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: '',
        mode: 'cancel',
        approve: 'approve-all',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('cancel');
    });

    it('should use approve-reads permission flag', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: 'check',
        mode: 'prompt',
        approve: 'approve-reads',
        timeout: 6000000,
        args: [],
      });
      expect(args).toContain('--approve-reads');
      expect(args).not.toContain('--approve-all');
    });

    it('should append extra args at the end', () => {
      const args = buildAcpxArgs({
        agent: 'codex',
        prompt: 'task',
        mode: 'prompt',
        approve: 'approve-all',
        timeout: 6000000,
        args: ['--verbose'],
      });
      expect(args[args.length - 1]).toBe('--verbose');
    });
  });

  describe('acpx_execute tool', () => {
    let acpExecuteTool: any;

    beforeAll(async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');
      const tools = await getAcpTools();
      acpExecuteTool = tools[0];
    });

    it('should have correct tool name', () => {
      expect(acpExecuteTool.name).toBe('acpx_execute');
    });

    it('should have correct tool description', () => {
      expect(acpExecuteTool.description).toContain('ACP');
      expect(acpExecuteTool.description).toContain('acpx');
    });

    it('should have a schema with agent and prompt fields', () => {
      const schema = acpExecuteTool.schema;
      expect(schema).toBeDefined();

      const parsed = schema.safeParse({ agent: 'codex', prompt: 'fix tests' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.agent).toBe('codex');
        expect(parsed.data.prompt).toBe('fix tests');
        expect(parsed.data.mode).toBe('prompt');
        expect(parsed.data.approve).toBe('approve-all');
      }
    });

    it('should default mode to prompt', () => {
      const schema = acpExecuteTool.schema;
      const parsed = schema.safeParse({ agent: 'codex', prompt: 'task' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.mode).toBe('prompt');
      }
    });

    it('should accept all valid mode values', () => {
      const schema = acpExecuteTool.schema;
      const modes = ['prompt', 'exec', 'sessions_new', 'sessions_list', 'sessions_close', 'cancel'];
      for (const mode of modes) {
        const parsed = schema.safeParse({ agent: 'codex', prompt: '', mode });
        expect(parsed.success).toBe(true);
      }
    });

    it('should accept optional session_name', () => {
      const schema = acpExecuteTool.schema;
      const parsed = schema.safeParse({
        agent: 'codex',
        prompt: 'task',
        session_name: 'backend',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.session_name).toBe('backend');
      }
    });
  });

  describe('getAcpTools', () => {
    it('should return empty array when acpx command is not available', async () => {
      (childProcess.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('command not found');
      });

      const tools = await getAcpTools();
      expect(tools).toEqual([]);
    });

    it('should return acpx tools when acpx command is available', async () => {
      (childProcess.execSync as jest.Mock).mockReturnValue('');

      const tools = await getAcpTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('acpx_execute');
    });
  });
});
