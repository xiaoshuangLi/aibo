import { formatToolCallArgs } from '@/presentation/lark/call-formatter';

describe('Tool Call Formatter Final Coverage Tests', () => {
  it('should handle task tool with complex object in additional parameters', () => {
    const args = {
      subagent_type: 'researcher',
      description: 'Test description',
      complexParam: { nested: { value: 'test' }, array: [1, 2, 3] }
    };
    const result = formatToolCallArgs('task', JSON.stringify(args));
    expect(result).toContain('**委派给 researcher 代理**');
    expect(result).toContain('Test description');
    expect(result).toContain('complexParam');
    expect(result).toContain('```json');
    // Don't check exact JSON format since it's pretty-printed
  });

  it('should handle filesystem tools with edge cases that trigger default handling', () => {
    // Test the default handling at the end of formatFilesystemToolCall
    // This happens when the tool name is not recognized in the switch
    const result = formatToolCallArgs('unknown_filesystem_tool', { param: 'value' });
    expect(result).toContain('```json');
    expect(result).toContain('"param": "value"');
  });

  it('should handle system tools with edge cases that trigger default handling', () => {
    // Test the default handling at the end of formatSystemToolCall
    // This happens when the tool name is not recognized in the switch
    const result = formatToolCallArgs('unknown_system_tool', { param: 'value' });
    expect(result).toContain('```json');
    expect(result).toContain('"param": "value"');
  });

  it('should handle default tool call with multi-line string containing newlines', () => {
    const result = formatToolCallArgs('unknown_tool', 'line1\nline2\nline3');
    expect(result).toContain('```');
    expect(result).toContain('line1');
    expect(result).toContain('line2');
    expect(result).toContain('line3');
  });

  it('should handle default tool call with empty object', () => {
    const result = formatToolCallArgs('unknown_tool', {});
    expect(result).toContain('```json');
    expect(result).toContain('{}');
  });

  it('should handle default tool call with null values', () => {
    const result = formatToolCallArgs('unknown_tool', { nullValue: null });
    expect(result).toContain('```json');
    expect(result).toContain('"nullValue": null');
  });
});