import { sleepTool, echoTool } from '../src/tools/utils';

describe('Utility Tools Tests', () => {
  test('should echo message correctly', async () => {
    const result = await echoTool.invoke({ message: 'Hello World' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.echoed).toBe('Hello World');
  });

  test('should handle empty message', async () => {
    const result = await echoTool.invoke({ message: '' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.echoed).toBe('');
  });

  test('should sleep for valid duration', async () => {
    const startTime = Date.now();
    const result = await sleepTool.invoke({ duration: 10 });
    const endTime = Date.now();
    const parsed = JSON.parse(result);
    
    expect(parsed.success).toBe(true);
    expect(endTime - startTime).toBeGreaterThanOrEqual(10);
  });

  // Note: Invalid durations are caught by Zod schema validation before reaching the tool function
  // So we don't need to test those cases as they would throw validation errors
});