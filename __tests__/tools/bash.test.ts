import { executeBashTool } from '../../src/tools/bash';

// Since the actual bash tool executes system commands, we'll test the structure
// rather than the actual command execution for safety

describe('Bash Tool', () => {
  test('should have correct tool schema', () => {
    expect(executeBashTool.name).toBe('execute_bash');
    expect(executeBashTool.description).toContain('Execute a bash/shell command');
    
    // Test schema validation
    const schema = executeBashTool.schema;
    expect(schema.shape.command).toBeDefined();
    expect(schema.shape.timeout).toBeDefined();
    expect(schema.shape.cwd).toBeDefined();
  });

  test('should handle successful command execution structure', async () => {
    // This test will actually try to run 'echo "test"', which should work
    // but we won't assert on the exact output since it may vary
    const result = await executeBashTool.invoke({ 
      command: 'echo "test"', 
      timeout: 5000 
    });
    
    const parsedResult = JSON.parse(result);
    expect(parsedResult).toHaveProperty('success');
    expect(parsedResult).toHaveProperty('command');
    expect(parsedResult.command).toBe('echo "test"');
    // stdout and stderr may vary, so we just check they exist
    expect(parsedResult).toHaveProperty('stdout');
    expect(parsedResult).toHaveProperty('stderr');
  });

  test('should handle command with error structure', async () => {
    // Test a command that should fail
    const result = await executeBashTool.invoke({ 
      command: 'nonexistent-command-12345', 
      timeout: 1000 
    });
    
    const parsedResult = JSON.parse(result);
    expect(parsedResult).toHaveProperty('success');
    expect(parsedResult).toHaveProperty('command');
    expect(parsedResult.command).toBe('nonexistent-command-12345');
    expect(parsedResult).toHaveProperty('error');
    expect(parsedResult).toHaveProperty('message');
  });

  test('should handle command timeout', async () => {
    // Test a command that will timeout (sleep for longer than timeout)
    const result = await executeBashTool.invoke({ 
      command: 'sleep 2', 
      timeout: 1000 // 1 second timeout, but sleep for 2 seconds
    });
    
    const parsedResult = JSON.parse(result);
    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toBe('Command timeout');
    expect(parsedResult.message).toContain('exceeded 1000ms timeout limit');
    expect(parsedResult.command).toBe('sleep 2');
  });

  test('should handle command with stdout and stderr', async () => {
    // Test a command that produces both stdout and stderr
    const result = await executeBashTool.invoke({ 
      command: 'echo "stdout" && echo "stderr" >&2', 
      timeout: 1000 
    });
    
    const parsedResult = JSON.parse(result);
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.stdout).toContain('stdout');
    expect(parsedResult.stderr).toContain('stderr');
  });

  test('should handle empty stdout and stderr', async () => {
    // Test a command that produces no output
    const result = await executeBashTool.invoke({ 
      command: 'true', 
      timeout: 1000 
    });
    
    const parsedResult = JSON.parse(result);
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.stdout).toBe('(empty)');
    expect(parsedResult.stderr).toBe('(empty)');
  });
});