import {
  formatToolCallArgs,
  formatTodoWriteToolCall,
  formatAgentRunnerToolCall,
} from '@/presentation/lark/call-formatter';

describe('call-formatter - additional coverage', () => {
  it('glob with string arg returns pattern line', () => {
    const result = formatToolCallArgs('glob', '*.ts');
    expect(result).toContain('*.ts');
  });

  it('glob_files with string arg returns pattern line (backward compat)', () => {
    const result = formatToolCallArgs('glob_files', '**/*.js');
    expect(result).toContain('**/*.js');
  });

  it('grep with string arg hits default string branch', () => {
    const result = formatToolCallArgs('grep', 'search-pattern');
    expect(result).toContain('search-pattern');
  });

  it('sleep with number arg returns duration', () => {
    const result = formatToolCallArgs('sleep', 3000);
    expect(result).toContain('3000');
    expect(result).toContain('毫秒');
  });

  it('sleep with object arg returns duration', () => {
    const result = formatToolCallArgs('sleep', { duration: 1500 });
    expect(result).toContain('1500');
    expect(result).toContain('毫秒');
  });

  it('echo with string arg returns message', () => {
    const result = formatToolCallArgs('echo', 'hello world');
    expect(result).toContain('hello world');
    expect(result).toContain('消息');
  });

  it('echo with object arg returns message field', () => {
    const result = formatToolCallArgs('echo', { message: 'test message' });
    expect(result).toContain('test message');
    expect(result).toContain('消息');
  });

  it('formatAgentRunnerToolCall cursor_open with string arg', () => {
    const result = formatAgentRunnerToolCall('cursor_open', '/some/path/file.ts');
    expect(result).toContain('/some/path/file.ts');
    expect(result).toContain('路径');
  });

  it('formatAgentRunnerToolCall cursor_open with object arg including timeout', () => {
    const result = formatAgentRunnerToolCall('cursor_open', {
      path: '/workspace/app.ts',
      timeout: 5000,
    });
    expect(result).toContain('/workspace/app.ts');
    expect(result).toContain('5000');
    expect(result).toContain('超时');
  });

  it('formatAgentRunnerToolCall with cwd, timeout, and extra args', () => {
    const result = formatAgentRunnerToolCall('claude_execute', {
      prompt: 'review this code',
      cwd: '/workspace',
      timeout: 60000,
      args: ['--verbose', '--json'],
    });
    expect(result).toContain('review this code');
    expect(result).toContain('/workspace');
    expect(result).toContain('60000');
    expect(result).toContain('--verbose');
  });

  it('formatAgentRunnerToolCall with string arg returns prompt block', () => {
    const result = formatAgentRunnerToolCall('gemini_execute', 'write unit tests');
    expect(result).toContain('write unit tests');
    expect(result).toContain('提示词');
  });

  it('formatTodoWriteToolCall with empty todos array', () => {
    const result = formatTodoWriteToolCall({ todos: [] });
    expect(result).toBe('清空待办事项列表');
  });

  it('formatTodoWriteToolCall with non-object arg falls to default', () => {
    const result = formatTodoWriteToolCall('some string');
    expect(typeof result).toBe('string');
  });

  it('formatTodoWriteToolCall with null returns 无参数', () => {
    const result = formatTodoWriteToolCall(null);
    expect(result).toBe('无参数');
  });

  it('formatToolCallArgs write_todos routes to formatTodoWriteToolCall', () => {
    const result = formatToolCallArgs('write_todos', {
      todos: [{ status: 'in_progress', content: 'Fix bug' }],
    });
    expect(result).toContain('Fix bug');
    expect(result).toContain('待办事项');
  });

  it('formatToolCallArgs agent_runner (claude_execute) with JSON string arg', () => {
    const result = formatToolCallArgs(
      'claude_execute',
      JSON.stringify({ prompt: 'refactor module' })
    );
    expect(result).toContain('refactor module');
  });

  it('formatToolCallArgs write_todos also routes correctly', () => {
    const result = formatToolCallArgs('write_todos', {
      todos: [{ status: 'not_started', content: 'Fix bug' }],
    });
    expect(result).toContain('Fix bug');
    expect(result).toContain('待办事项');
  });
});
