import {
  handleSessionCommand,
  createHandleInternalCommand,
} from '@/presentation/console/commander';

jest.mock('@/core/config', () => ({
  config: { output: { verbose: false }, model: { name: 'gpt-4o' } },
}));
jest.mock('@/presentation/styling/styler', () => ({
  styled: { system: (m: string) => m, error: (m: string) => m },
}));
jest.mock('@/core/utils/interactive', () => ({
  createConsoleThreadId: jest.fn().mockReturnValue('thread-1'),
}));
jest.mock('@/infrastructure/session/manager', () => {
  const mock = { getCurrentSessionMetadata: jest.fn(), clearCurrentSession: jest.fn().mockReturnValue('new-id') };
  return { SessionManager: { getInstance: () => mock } };
});
jest.mock('@/shared/utils/library', () => ({ getAllKnowledge: jest.fn().mockReturnValue([]), addKnowledge: jest.fn() }));
jest.mock('@/infrastructure/code-analysis/client', () => ({ LspClientManager: { shutdownAll: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/features/voice-input/recognition', () => ({ createVoiceRecognition: jest.fn().mockReturnValue({ canRecord: jest.fn().mockReturnValue(false) }) }));

const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
afterAll(() => { mockLog.mockRestore(); });

const makeSession = () => ({ end: jest.fn(), isRunning: false, abortController: null, setAbortController: jest.fn() });

describe('console commander - session coverage', () => {
  it('handleSessionCommand with M-range tokens prints stats', async () => {
    const { SessionManager } = require('@/infrastructure/session/manager');
    SessionManager.getInstance().getCurrentSessionMetadata.mockReturnValue({
      model_info: { model_name: 'claude-3' },
      token_usage: { total_tokens: 3_000_000, input_tokens: 1_000_000, output_tokens: 2_000_000 },
      start_time: Date.now(),
      metadata: { session_id: 'sess-M' },
    });
    const result = await handleSessionCommand(makeSession());
    expect(result).toBe(true);
  });

  it('handleSessionCommand with K-range tokens', async () => {
    const { SessionManager } = require('@/infrastructure/session/manager');
    SessionManager.getInstance().getCurrentSessionMetadata.mockReturnValue({
      model_info: { model_name: 'gpt-4' },
      token_usage: { total_tokens: 5000, input_tokens: 2000, output_tokens: 3000 },
      start_time: Date.now(),
      metadata: { session_id: 'sess-K' },
    });
    const result = await handleSessionCommand(makeSession());
    expect(result).toBe(true);
  });

  it('handleSessionCommand without metadata prints no-data message', async () => {
    const { SessionManager } = require('@/infrastructure/session/manager');
    SessionManager.getInstance().getCurrentSessionMetadata.mockReturnValue(null);
    const result = await handleSessionCommand(makeSession());
    expect(result).toBe(true);
  });

  it('createHandleInternalCommand routes /session', async () => {
    const { SessionManager } = require('@/infrastructure/session/manager');
    SessionManager.getInstance().getCurrentSessionMetadata.mockReturnValue(null);
    const handler = createHandleInternalCommand(makeSession(), {});
    const result = await handler('/session');
    expect(result).toBe(true);
  });
});
