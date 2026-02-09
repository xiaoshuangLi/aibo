import { executeBashTool } from '../src/tools/bash';

describe('Bash Tool Tests', () => {
  test('should execute simple command successfully', async () => {
    const result = await executeBashTool.invoke({ command: 'echo hello' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.stdout.trim()).toBe('hello');
  });

  test('should handle command timeout', async () => {
    const result = await executeBashTool.invoke({ 
      command: 'sleep 2', 
      timeout: 1000 
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Command timeout');
  });

  test('should handle non-existent command', async () => {
    const result = await executeBashTool.invoke({ 
      command: 'nonexistentcommand12345' 
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
  });

  test('should handle command with stderr', async () => {
    const result = await executeBashTool.invoke({ 
      command: 'echo error >&2 && exit 1' 
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.stderr).toContain('error');
  });

  test('should handle empty command', async () => {
    const result = await executeBashTool.invoke({ command: '' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});