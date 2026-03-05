import {
  formatSessionMetadataToMarkdown,
  handleSessionCommand,
  createHandleInternalCommand,
} from '@/presentation/lark/commander';

jest.mock('@/presentation/styling/styler', () => ({
  styled: { system: (m: string) => m, error: (m: string) => m },
}));

jest.mock('@/infrastructure/session/manager', () => {
  const mock = { getCurrentSessionMetadata: jest.fn() };
  return { SessionManager: { getInstance: () => mock } };
});

const makeSession = () => ({
  adapter: { emit: jest.fn().mockResolvedValue(undefined) },
});

describe('commander lark - additional coverage', () => {
  it('formatSessionMetadataToMarkdown with null returns no-data message', () => {
    const result = formatSessionMetadataToMarkdown(null);
    expect(result).toContain('无会话元数据');
  });

  it('formatSessionMetadataToMarkdown with M-range tokens', () => {
    const result = formatSessionMetadataToMarkdown({
      model_info: { model_name: 'gpt-4o' },
      token_usage: { total_tokens: 2_500_000, input_tokens: 1_000_000, output_tokens: 1_500_000 },
      start_time: Date.now(),
      metadata: { session_id: 'abc' },
    });
    expect(result).toContain('M');
  });

  it('formatSessionMetadataToMarkdown with K-range tokens', () => {
    const result = formatSessionMetadataToMarkdown({
      model_info: { model_name: 'gpt-4o' },
      token_usage: { total_tokens: 5000, input_tokens: 2000, output_tokens: 3000 },
      start_time: Date.now(),
      metadata: { session_id: 'abc' },
    });
    expect(result).toContain('K');
  });

  it('formatSessionMetadataToMarkdown with small token count', () => {
    const result = formatSessionMetadataToMarkdown({
      model_info: { model_name: 'gpt-4' },
      token_usage: { total_tokens: 50, input_tokens: 20, output_tokens: 30 },
      start_time: Date.now(),
      metadata: { session_id: 'xyz' },
    });
    expect(result).toContain('50');
  });

  it('handleSessionCommand with metadata emits formatted info', async () => {
    const { SessionManager } = require('@/infrastructure/session/manager');
    SessionManager.getInstance().getCurrentSessionMetadata.mockReturnValue({
      model_info: { model_name: 'claude-3' },
      token_usage: { total_tokens: 100, input_tokens: 40, output_tokens: 60 },
      start_time: Date.now(),
      metadata: { session_id: 'sess-1' },
    });
    const session = makeSession();
    const result = await handleSessionCommand(session);
    expect(result).toBe(true);
    expect(session.adapter.emit).toHaveBeenCalled();
  });

  it('handleSessionCommand without metadata emits no-data message', async () => {
    const { SessionManager } = require('@/infrastructure/session/manager');
    SessionManager.getInstance().getCurrentSessionMetadata.mockReturnValue(null);
    const session = makeSession();
    const result = await handleSessionCommand(session);
    expect(result).toBe(true);
    expect(session.adapter.emit).toHaveBeenCalled();
  });

  it('createHandleInternalCommand routes /session', async () => {
    const { SessionManager } = require('@/infrastructure/session/manager');
    SessionManager.getInstance().getCurrentSessionMetadata.mockReturnValue(null);
    const session = makeSession();
    const handler = createHandleInternalCommand(session);
    const result = await handler('/session');
    expect(result).toBe(true);
  });
});
