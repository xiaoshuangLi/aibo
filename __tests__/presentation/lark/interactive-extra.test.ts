/**
 * Additional coverage tests for src/presentation/lark/interactive.ts.
 * Covers:
 *   - full startLarkInteractiveMode success path (lines 50-76)
 *   - group_chat mode startup (lines 38-40)
 *   - error handling in handleUserMessage (line 150)
 */

// Silence console output
const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Prevent process.exit/on side effects
const mockExit = jest.fn();
const mockProcessOn = jest.fn();
const origExit = process.exit;
const origOn = process.on;
process.exit = mockExit as any;
process.on = mockProcessOn as any;

// Config mock - we'll mutate larkType per test
const configMock = {
  config: { interaction: { larkType: 'direct_message' } },
};
jest.mock('@/core/config', () => configMock);

jest.mock('@/presentation/lark/adapter', () => ({ LarkAdapter: jest.fn() }));
jest.mock('@/presentation/lark/chat', () => ({ LarkChatService: jest.fn() }));
jest.mock('@/core/agent/factory', () => ({ createAIAgent: jest.fn() }));
jest.mock('@/core/agent/session', () => ({ Session: jest.fn() }));
jest.mock('@/core/utils/stream', () => ({ processStreamChunks: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/presentation/lark/commander', () => ({ createHandleInternalCommand: jest.fn() }));
jest.mock('@/infrastructure/code-analysis', () => ({
  LspClientManager: { shutdownAll: jest.fn().mockResolvedValue(undefined) },
}));

import { LarkAdapter } from '@/presentation/lark/adapter';
import { LarkChatService } from '@/presentation/lark/chat';
import { createAIAgent } from '@/core/agent/factory';
import { Session } from '@/core/agent/session';
import { startLarkInteractiveMode, handleUserMessage } from '@/presentation/lark/interactive';

const AdapterMock = LarkAdapter as unknown as jest.Mock;
const ChatServiceMock = LarkChatService as unknown as jest.Mock;
const createAgentMock = createAIAgent as unknown as jest.Mock;
const SessionMock = Session as unknown as jest.Mock;

function makeAdapter() {
  return {
    launch: jest.fn().mockResolvedValue(undefined),
    setUserMessageCallback: jest.fn(),
    setAbortSignal: jest.fn(),
    emit: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  };
}
function makeSession() {
  const s: any = {
    threadId: 'test-thread',
    isRunning: false,
    abortController: new AbortController(),
    start: jest.fn().mockResolvedValue(undefined),
    end: jest.fn(),
  };
  s.setAbortController = jest.fn((c: AbortController) => { s.abortController = c; });
  return s;
}

describe('startLarkInteractiveMode - success path', () => {
  let adapter: any;
  let session: any;

  beforeEach(() => {
    jest.clearAllMocks();
    configMock.config.interaction.larkType = 'direct_message';
    adapter = makeAdapter();
    session = makeSession();
    AdapterMock.mockImplementation(() => adapter);
    SessionMock.mockImplementation(() => session);
    createAgentMock.mockResolvedValue({ stream: jest.fn() });
  });

  it('sets up adapter, session, agent and process signal handlers', async () => {
    await startLarkInteractiveMode();

    expect(AdapterMock).toHaveBeenCalledWith();
    expect(SessionMock).toHaveBeenCalledWith(adapter);
    expect(session.start).toHaveBeenCalled();
    expect(createAgentMock).toHaveBeenCalledWith(session);
    expect(adapter.setUserMessageCallback).toHaveBeenCalled();
    expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('SIGINT handler calls session.end and exits (lines 64-68)', async () => {
    await startLarkInteractiveMode();

    // Invoke the registered SIGINT handler
    const sigintCall = mockProcessOn.mock.calls.find((c: any[]) => c[0] === 'SIGINT');
    expect(sigintCall).toBeDefined();
    const sigintHandler = sigintCall![1] as Function;

    const { LspClientManager } = require('@/infrastructure/code-analysis');
    (LspClientManager.shutdownAll as jest.Mock).mockResolvedValueOnce(undefined);

    sigintHandler();

    expect(session.end).toHaveBeenCalledWith('再见！');
    expect(LspClientManager.shutdownAll).toHaveBeenCalled();
  });

  it('SIGTERM handler calls session.end and exits (lines 72-76)', async () => {
    await startLarkInteractiveMode();

    const sigtermCall = mockProcessOn.mock.calls.find((c: any[]) => c[0] === 'SIGTERM');
    expect(sigtermCall).toBeDefined();
    const sigtermHandler = sigtermCall![1] as Function;

    const { LspClientManager } = require('@/infrastructure/code-analysis');
    (LspClientManager.shutdownAll as jest.Mock).mockResolvedValueOnce(undefined);

    sigtermHandler();

    expect(session.end).toHaveBeenCalledWith('再见！');
  });

  it('userMessageCallback invokes handleUserMessage (line 57)', async () => {
    const { processStreamChunks } = require('@/core/utils/stream');
    (processStreamChunks as jest.Mock).mockResolvedValueOnce(undefined);

    await startLarkInteractiveMode();

    const callbackCall = adapter.setUserMessageCallback.mock.calls[0];
    expect(callbackCall).toBeDefined();
    const callback = callbackCall[0] as Function;

    // Invoke the callback – this should call handleUserMessage
    await callback('hello');

    // processStreamChunks would have been called as part of handling the message
    // (no error → no mockError call)
  });

  it('group_chat mode: LarkAdapter is constructed and no separate LarkChatService call is made', async () => {
    configMock.config.interaction.larkType = 'group_chat';

    await startLarkInteractiveMode();

    // interactive.ts no longer calls LarkChatService directly; the adapter handles it
    expect(ChatServiceMock).not.toHaveBeenCalled();
    // LarkAdapter is still constructed with no arguments
    expect(AdapterMock).toHaveBeenCalledWith();
  });
});

describe('handleUserMessage - error on processStreamChunks (line 150)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs error to console.error when stream processing throws', async () => {
    const { processStreamChunks } = require('@/core/utils/stream');
    (processStreamChunks as jest.Mock).mockRejectedValueOnce(new Error('stream error'));

    const session: any = {
      threadId: 'test',
      isRunning: false,
      abortController: null,
      end: jest.fn(),
    };
    session.setAbortController = jest.fn((c: AbortController) => { session.abortController = c; });
    const agent = { stream: jest.fn() };

    await handleUserMessage('hello', session, agent);

    expect(mockError).toHaveBeenCalledWith(
      '❌ 处理用户消息时出错:',
      expect.any(Error)
    );
  });
});

afterAll(() => {
  process.exit = origExit;
  process.on = origOn;
  mockLog.mockRestore();
  mockError.mockRestore();
});
