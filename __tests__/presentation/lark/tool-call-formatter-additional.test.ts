import { formatToolCallArgs } from '@/presentation/lark/call-formatter';

describe('Tool Call Formatter Additional Tests', () => {
  it('should handle task tool call with complex parameters', () => {
    const args = {
      subagent_type: 'researcher',
      description: 'Test description',
      extraParam: 'value'
    };
    const result = formatToolCallArgs('task', JSON.stringify(args));
    expect(result).toContain('委派给 researcher 代理');
    expect(result).toContain('Test description');
    expect(result).toContain('extraParam');
  });

  it('should handle filesystem tools with object parameters', () => {
    // ls with object
    let result = formatToolCallArgs('ls', { path: '/custom/path' });
    expect(result).toContain('**路径**: `/custom/path`');
    
    // read_file with object
    result = formatToolCallArgs('read_file', { file_path: '/test/file.txt' });
    expect(result).toContain('**文件路径**: `/test/file.txt`');
    
    // write_file with content
    result = formatToolCallArgs('write_file', { 
      file_path: '/test/file.txt', 
      content: 'test content' 
    });
    expect(result).toContain('**文件路径**: `/test/file.txt`');
    expect(result).toContain('**内容预览**');
    
    // edit_file with old and new content
    result = formatToolCallArgs('edit_file', { 
      file_path: '/test/file.txt',
      old_string: 'old content',
      new_string: 'new content'
    });
    expect(result).toContain('**文件路径**: `/test/file.txt`');
    expect(result).toContain('**原内容**');
    expect(result).toContain('**新内容**');
    
    // glob
    result = formatToolCallArgs('glob', { pattern: '*.ts', path: '/src' });
    expect(result).toContain('**模式**: `*.ts`');
    expect(result).toContain('**路径**: `/src`');
    
    // grep
    result = formatToolCallArgs('grep', { pattern: 'test', path: '/src', glob: '*.ts' });
    expect(result).toContain('**搜索模式**: `test`');
    expect(result).toContain('**路径**: `/src`');
    expect(result).toContain('**文件过滤**: `*.ts`');
  });

  it('should handle system tools', () => {
    // execute_bash with object
    let result = formatToolCallArgs('execute_bash', { command: 'ls -la', timeout: 5000, cwd: '/home' });
    expect(result).toContain('**命令**: `ls -la`');
    expect(result).toContain('**超时**: 5000ms');
    expect(result).toContain('**工作目录**: `/home`');
    
    // sleep
    result = formatToolCallArgs('sleep', { duration: 1000 });
    expect(result).toContain('**时长**: 1000 毫秒');
    
    // echo
    result = formatToolCallArgs('echo', { message: 'Hello World' });
    expect(result).toContain('**消息**: `Hello World`');
  });

  it('should handle default cases', () => {
    // Object args
    const result1 = formatToolCallArgs('unknown_tool', { param: 'value' });
    expect(result1).toContain('```json');
    expect(result1).toContain('"param": "value"');
    
    // String args
    const result2 = formatToolCallArgs('unknown_tool', 'simple string');
    expect(result2).toBe('`simple string`');
    
    // Multi-line string
    const result3 = formatToolCallArgs('unknown_tool', 'line1\nline2');
    expect(result3).toContain('```');
    expect(result3).toContain('line1');
    expect(result3).toContain('line2');
    
    // Empty string
    expect(formatToolCallArgs('unknown_tool', '')).toBe('空参数');
    expect(formatToolCallArgs('unknown_tool', '   ')).toBe('空参数');
    
    // Null/undefined
    expect(formatToolCallArgs('ls', null)).toBe('无参数');
    expect(formatToolCallArgs('ls', undefined)).toBe('无参数');
  });
});