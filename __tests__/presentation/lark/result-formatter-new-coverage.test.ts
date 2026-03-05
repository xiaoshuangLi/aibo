import {
  formatSearchResult,
  formatTaskManagementResult,
  formatAgentRunnerResult,
  formatFilesystemResult,
} from '@/presentation/lark/result-formatter';

describe('result-formatter - additional coverage', () => {
  it('grep content line without currentFile emits bare bullet', () => {
    const result = formatFilesystemResult('grep', ' 42: found line');
    expect(result).toContain('🔹');
  });

  it('grep standard file:lineno:content format', () => {
    const result = formatFilesystemResult('grep', 'src/foo.ts:10:const x = 1;');
    expect(result).toContain('src/foo.ts');
  });

  it('formatSearchResult with JSON string items', () => {
    const item = JSON.stringify({ title: 'Test', url: 'https://example.com', description: 'Desc' });
    const result = formatSearchResult({ success: true, results: [item] });
    expect(result).toContain('Test');
  });

  it('formatSearchResult with non-JSON string item', () => {
    const result = formatSearchResult({ success: true, results: ['plain text result'] });
    expect(result).toContain('解析失败');
  });

  it('formatSearchResult with numeric item via Pages', () => {
    const result = formatSearchResult({ Pages: [42] });
    expect(result).toContain('无标题');
  });

  it('formatTaskManagementResult todo_write failure', () => {
    const result = formatTaskManagementResult('todo_write', { success: false, message: 'bad input' });
    expect(result).toContain('❌');
    expect(result).toContain('bad input');
  });

  it('formatTaskManagementResult todo_write empty todos', () => {
    const result = formatTaskManagementResult('todo_write', { todos: [] });
    expect(result).toContain('已清空');
  });

  it('formatTaskManagementResult todo_write with todos', () => {
    const result = formatTaskManagementResult('todo_write', {
      todos: [{ id: '1', status: 'completed', priority: 'high', content: 'Fix bug' }],
    });
    expect(result).toContain('Fix bug');
    expect(result).toContain('✅');
  });

  it('formatTaskManagementResult todo_read empty', () => {
    const result = formatTaskManagementResult('todo_read', { todos: [] });
    expect(result).toContain('为空');
  });

  it('formatTaskManagementResult todo_read with items', () => {
    const result = formatTaskManagementResult('todo_read', {
      todos: [{ id: '2', status: 'in_progress', priority: 'medium', content: 'Write tests' }],
      total: 1,
      summary: { not_started: 0, in_progress: 1, completed: 0 },
    });
    expect(result).toContain('Write tests');
    expect(result).toContain('🔄');
  });

  it('formatAgentRunnerResult interrupted', () => {
    const result = formatAgentRunnerResult('claude_execute', { success: false, interrupted: true });
    expect(result).toContain('中断');
  });

  it('formatAgentRunnerResult failure with stdout and stderr', () => {
    const result = formatAgentRunnerResult('gemini_execute', {
      success: false,
      error: 'exit 1',
      stdout: 'some output',
      stderr: 'error text',
    });
    expect(result).toContain('exit 1');
    expect(result).toContain('some output');
    expect(result).toContain('error text');
  });

  it('formatAgentRunnerResult cursor_open success', () => {
    const result = formatAgentRunnerResult('cursor_open', { success: true, path: '/workspace/app.ts' });
    expect(result).toContain('/workspace/app.ts');
    expect(result).toContain('✅');
  });

  it('formatAgentRunnerResult success with stdout', () => {
    const result = formatAgentRunnerResult('codex_execute', { success: true, stdout: 'done' });
    expect(result).toContain('done');
  });

  it('formatAgentRunnerResult success no output', () => {
    const result = formatAgentRunnerResult('claude_execute', { success: true });
    expect(result).toContain('✅');
  });
});
