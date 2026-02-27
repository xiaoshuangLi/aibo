import { thinkTool } from '../../src/tools/think';

describe('thinkTool', () => {
  test('should have correct name and description', () => {
    expect(thinkTool.name).toBe('think');
    expect(thinkTool.description).toContain('scratchpad');
    expect(thinkTool.description).toContain('NO side effects');
  });

  test('should have correct schema with required reasoning field', () => {
    const schema = thinkTool.schema;
    expect(schema).toBeDefined();
    const result = schema.safeParse({ reasoning: 'test reasoning' });
    expect(result.success).toBe(true);
  });

  test('should reject empty reasoning string', () => {
    const schema = thinkTool.schema;
    const result = schema.safeParse({ reasoning: '' });
    expect(result.success).toBe(false);
  });

  test('should return reasoning in output with type=thinking', async () => {
    const reasoning = 'The problem has two possible causes: A and B. I will investigate A first.';
    const result = await thinkTool.invoke({ reasoning });
    const parsed = JSON.parse(result);

    expect(parsed.type).toBe('thinking');
    expect(parsed.reasoning).toBe(reasoning);
    expect(parsed.note).toContain('No actions have been taken');
  });

  test('should have NO side effects — calling think does not modify any state', async () => {
    const reasoning = 'Thinking about deleting all files... but this is just a thought.';
    const resultBefore = await thinkTool.invoke({ reasoning });
    const resultAfter = await thinkTool.invoke({ reasoning });

    // Both calls return the same structure — no state mutation
    const before = JSON.parse(resultBefore);
    const after = JSON.parse(resultAfter);
    expect(before.reasoning).toBe(after.reasoning);
    expect(before.type).toBe(after.type);
  });

  test('should handle multi-line reasoning with special characters', async () => {
    const reasoning = `
      Step 1: Analyze the problem
      Step 2: Consider options:
        - Option A: Use approach X (pros: fast, cons: fragile)
        - Option B: Use approach Y (pros: robust, cons: slow)
      Step 3: Decision: Option B because robustness > speed here
      
      Code snippet to consider: const x = arr?.map(fn) ?? [];
    `;
    const result = await thinkTool.invoke({ reasoning });
    const parsed = JSON.parse(result);
    expect(parsed.type).toBe('thinking');
    expect(parsed.reasoning).toContain('Option A');
    expect(parsed.reasoning).toContain('Option B');
  });

  test('getThinkTools returns array containing thinkTool', async () => {
    const getThinkTools = (await import('../../src/tools/think')).default;
    const tools = await getThinkTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('think');
  });
});
