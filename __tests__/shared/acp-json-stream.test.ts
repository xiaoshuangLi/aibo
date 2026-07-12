import { AcpJsonStreamParser } from '@/shared/acp-json-stream';

describe('AcpJsonStreamParser', () => {
  const logToolProgress = jest.fn();

  beforeEach(() => logToolProgress.mockClear());

  it('streams tool lifecycle, terminal output, and assistant chunks', () => {
    const parser = new AcpJsonStreamParser({ logToolProgress }, 'Codex');
    const messages = [
      { method: 'session/update', params: { update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'npm test' } } },
      { method: 'session/update', params: { update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', _meta: { terminal_output_delta: { data: 'PASS tests\n' } } } } },
      { method: 'session/update', params: { update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' } } },
      { method: 'session/update', params: { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '完成了' } } } },
    ];

    parser.push(Buffer.from(messages.map((message) => JSON.stringify(message)).join('\n') + '\n'));

    expect(logToolProgress).toHaveBeenCalledWith('Codex 工具', '▶ npm test\n');
    expect(logToolProgress).toHaveBeenCalledWith('Codex 工具输出', 'PASS tests\n');
    expect(logToolProgress).toHaveBeenCalledWith('Codex 工具', '✓ npm test\n');
    expect(logToolProgress).toHaveBeenCalledWith('Codex 回复', '完成了');
    expect(parser.finish('')).toBe('完成了');
  });

  it('handles JSON split across stdout chunks', () => {
    const parser = new AcpJsonStreamParser({ logToolProgress }, 'Claude Code');
    const line = JSON.stringify({
      method: 'session/update',
      params: { update: { sessionUpdate: 'agent_message_chunk', content: { text: 'hello' } } },
    });
    parser.push(line.slice(0, 20));
    parser.push(`${line.slice(20)}\n`);
    expect(parser.finish('')).toBe('hello');
  });

  it('falls back to plain text for older acpx output', () => {
    const parser = new AcpJsonStreamParser({ logToolProgress }, 'Codex');
    expect(parser.finish('plain response')).toBe('plain response');
    expect(logToolProgress).toHaveBeenCalledWith('Codex 输出', 'plain response\n');
  });

  it('does not repeat completed raw output after terminal deltas', () => {
    const parser = new AcpJsonStreamParser({ logToolProgress }, 'Codex');
    parser.push(`${JSON.stringify({ method: 'session/update', params: { update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'build' } } })}\n`);
    parser.push(`${JSON.stringify({ method: 'session/update', params: { update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', _meta: { terminal_output_delta: { data: 'line\n' } } } } })}\n`);
    parser.push(`${JSON.stringify({ method: 'session/update', params: { update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', rawOutput: { formatted_output: 'line\n' } } } })}\n`);

    expect(logToolProgress.mock.calls.filter((call) => call[1] === 'line\n')).toHaveLength(1);
  });
});
