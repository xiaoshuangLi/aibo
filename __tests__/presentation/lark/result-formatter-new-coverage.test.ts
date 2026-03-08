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

  it('grep deepagents format: file path then indented line', () => {
    const result = formatFilesystemResult('grep', '\nsrc/foo.ts:\n  10: const x = 1;');
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

  it('formatTaskManagementResult write_todos with string result (deepagents format)', () => {
    const result = formatTaskManagementResult('write_todos', 'Updated todo list to [{"content":"Fix bug","status":"completed"}]');
    expect(result).toContain('Fix bug');
    expect(result).toContain('✅');
  });

  it('formatTaskManagementResult write_todos empty todos string', () => {
    const result = formatTaskManagementResult('write_todos', 'Updated todo list to []');
    expect(result).toContain('已清空');
  });

  it('formatTaskManagementResult write_todos with multiple statuses', () => {
    const todos = [
      { content: 'Task 1', status: 'completed' },
      { content: 'Task 2', status: 'in_progress' },
      { content: 'Task 3', status: 'pending' },
    ];
    const result = formatTaskManagementResult('write_todos', `Updated todo list to ${JSON.stringify(todos)}`);
    expect(result).toContain('Task 1');
    expect(result).toContain('🔄');
    expect(result).toContain('⬜');
  });

  it('formatTaskManagementResult write_todos plain string fallback', () => {
    const result = formatTaskManagementResult('write_todos', 'some unexpected message');
    expect(result).toContain('some unexpected message');
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
