import { isRunningInTsNode, getRestartCommand } from '@/shared/utils/restart-helper';

describe('Restart Helper', () => {
  describe('isRunningInTsNode', () => {
    it('should return true when ts-node symbol is present', () => {
      const originalProcess = { ...process };
      (process as any)[Symbol.for('ts-node.register.instance')] = {};
      
      expect(isRunningInTsNode()).toBe(true);
      
      // Restore original process
      Object.keys(process).forEach(key => {
        delete (process as any)[key];
      });
      Object.assign(process, originalProcess);
    });

    it('should return true when TS_NODE_DEV environment variable is set', () => {
      const originalEnv = process.env.TS_NODE_DEV;
      process.env.TS_NODE_DEV = 'true';
      
      expect(isRunningInTsNode()).toBe(true);
      
      process.env.TS_NODE_DEV = originalEnv;
    });

    it('should return true when execArgv contains ts-node', () => {
      const originalExecArgv = process.execArgv;
      (process as any).execArgv = ['--require', 'ts-node/register'];
      
      expect(isRunningInTsNode()).toBe(true);
      
      (process as any).execArgv = originalExecArgv;
    });

    it('should return true when main file is TypeScript', () => {
      const originalArgv = process.argv;
      (process as any).argv = ['node', 'src/main.ts'];
      
      expect(isRunningInTsNode()).toBe(true);
      
      (process as any).argv = originalArgv;
    });

    it('should return false when not running in ts-node', () => {
      const originalProcess = { ...process };
      const originalEnv = { ...process.env };
      const originalExecArgv = process.execArgv;
      const originalArgv = process.argv;
      
      // Remove all ts-node indicators
      delete (process as any)[Symbol.for('ts-node.register.instance')];
      delete process.env.TS_NODE_DEV;
      (process as any).execArgv = [];
      (process as any).argv = ['node', 'dist/main.js'];
      
      expect(isRunningInTsNode()).toBe(false);
      
      // Restore original values
      Object.keys(process).forEach(key => {
        delete (process as any)[key];
      });
      Object.assign(process, originalProcess);
      process.env = originalEnv;
      (process as any).execArgv = originalExecArgv;
      (process as any).argv = originalArgv;
    });
  });

  describe('getRestartCommand', () => {
    it('should return ts-node restart command when running in ts-node', () => {
      const originalArgv = process.argv;
      (process as any).argv = ['node', 'src/main.ts', '--test'];
      
      const result = getRestartCommand();
      
      expect(result.restartCommand).toBe('node');
      expect(result.restartArgs).toContain('node_modules/ts-node/dist/bin.js');
      expect(result.restartArgs).toContain('src/main.ts');
      expect(result.restartArgs).toContain('--test');
      
      (process as any).argv = originalArgv;
    });

    it('should return compiled node restart command when not running in ts-node', () => {
      const originalProcess = { ...process };
      const originalEnv = { ...process.env };
      const originalExecArgv = process.execArgv;
      const originalArgv = process.argv;
      
      // Simulate compiled environment
      delete (process as any)[Symbol.for('ts-node.register.instance')];
      delete process.env.TS_NODE_DEV;
      (process as any).execArgv = [];
      (process as any).argv = ['/usr/bin/node', 'dist/main.js', '--test'];
      
      const result = getRestartCommand();
      
      expect(result.restartCommand).toBe('/usr/bin/node');
      expect(result.restartArgs).toContain('dist/main.js');
      expect(result.restartArgs).toContain('--test');
      
      // Restore original values
      Object.keys(process).forEach(key => {
        delete (process as any)[key];
      });
      Object.assign(process, originalProcess);
      process.env = originalEnv;
      (process as any).execArgv = originalExecArgv;
      (process as any).argv = originalArgv;
    });
  });
});