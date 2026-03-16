/**
 * Tests for Lark interactive ACP passthrough mode.
 */

const execFileAsyncMock = jest.fn().mockResolvedValue({ stdout: 'acpx response', stderr: '' });

jest.mock('child_process', () => {
  const execFileMock: any = jest.fn();
  execFileMock[Symbol.for('nodejs.util.promisify.custom')] = execFileAsyncMock;

  return {
    ...jest.requireActual('child_process'),
    execSync: jest.fn().mockReturnValue(''),
    execFile: execFileMock,
  };
});

jest.mock('@/presentation/lark/adapter', () => ({
  LarkAdapter: jest.fn().mockImplementation(() => ({
    launch: jest.fn().mockResolvedValue(undefined),
    setUserMessageCallback: jest.fn(),
  })),
}));

jest.mock('@/core/agent/factory', () => ({
  createAIAgent: jest.fn().mockResolvedValue({ stream: jest.fn() }),
}));

jest.mock('@/core/utils/stream', () => ({
  processStreamChunks: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/presentation/lark/commander', () => ({
  createHandleInternalCommand: jest.fn().mockReturnValue(jest.fn().mockResolvedValue(false)),
}));

jest.mock('@/infrastructure/code-analysis', () => ({
  LspClientManager: { shutdownAll: jest.fn().mockResolvedValue(undefined) },
}));

import {
  handleAcpPassthrough,
  handleUserMessage,
} from '@/presentation/lark/interactive';
import {
  getAcpPassthroughState,
  setAcpPassthroughState,
  clearAcpPassthroughState,
} from '@/presentation/lark/acp-passthrough';

describe('handleAcpPassthrough', () => {
  const mockLogToolCall = jest.fn();
  const mockLogToolProgress = jest.fn();
  const mockLogToolResult = jest.fn();
  const mockAbortController = { signal: {} };
  const mockLogAcpResponse = jest.fn();
  const mockLogSystemMessage = jest.fn();
  const mockSession = {
    logToolCall: mockLogToolCall,
    logToolProgress: mockLogToolProgress,
    logToolResult: mockLogToolResult,
    logAcpResponse: mockLogAcpResponse,
    logSystemMessage: mockLogSystemMessage,
    abortController: mockAbortController,
  } as any;

  beforeEach(() => {
    clearAcpPassthroughState();
    execFileAsyncMock.mockReset();
    mockLogToolCall.mockClear();
    mockLogToolProgress.mockClear();
    mockLogToolResult.mockClear();
    mockLogAcpResponse.mockClear();
    mockLogSystemMessage.mockClear();
  });

  afterEach(() => {
    clearAcpPassthroughState();
  });

  it('should do nothing when no passthrough state is set', async () => {
    await handleAcpPassthrough('hello', mockSession);
    expect(execFileAsyncMock).not.toHaveBeenCalled();
  });

  it('should call acpx with correct args when passthrough is active', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    execFileAsyncMock.mockResolvedValue({ stdout: 'result', stderr: '' });

    await handleAcpPassthrough('fix the tests', mockSession);

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      'acpx',
      expect.arrayContaining(['--approve-all', '--format', 'text', 'codex', 'fix the tests']),
      expect.any(Object),
    );
  });

  it('should include -s flag when session name is set', async () => {
    setAcpPassthroughState({ agent: 'codex', sessionName: 'backend' });
    execFileAsyncMock.mockResolvedValue({ stdout: 'result', stderr: '' });

    await handleAcpPassthrough('implement pagination', mockSession);

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('-s');
    expect(callArgs).toContain('backend');
  });

  it('should log ACP response on success (not tool call/result)', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await handleAcpPassthrough('task', mockSession);

    // New behaviour: response is shown as an ACP-titled card, not a tool call
    expect(mockLogAcpResponse).toHaveBeenCalledWith('codex', 'ok');
    expect(mockLogToolCall).not.toHaveBeenCalled();
    expect(mockLogToolResult).not.toHaveBeenCalled();
  });

  it('should log ACP response on failure', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const err: any = new Error('failed');
    err.code = 'ENOENT';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    await handleAcpPassthrough('task', mockSession);

    expect(mockLogAcpResponse).toHaveBeenCalledWith('codex', expect.stringContaining('❌'));
    expect(mockLogToolResult).not.toHaveBeenCalled();
  });

  it('should include --cwd flag when cwd is set in passthrough state', async () => {
    setAcpPassthroughState({ agent: 'codex', cwd: '/project/dir' });
    execFileAsyncMock.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await handleAcpPassthrough('task', mockSession);

    const callArgs = execFileAsyncMock.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--cwd');
    expect(callArgs).toContain('/project/dir');
  });

  it('should exit passthrough mode when user says "退出acp"', async () => {
    setAcpPassthroughState({ agent: 'codex' });

    await handleAcpPassthrough('退出acp', mockSession);

    // ACP should be cleared
    expect(getAcpPassthroughState()).toBeNull();
    // acpx should NOT be invoked for the exit command
    expect(execFileAsyncMock).not.toHaveBeenCalled();
    // User should be notified
    expect(mockLogSystemMessage).toHaveBeenCalledWith(expect.stringContaining('已退出'));
  });

  it('should exit passthrough mode when user says "exit acp"', async () => {
    setAcpPassthroughState({ agent: 'codex' });

    await handleAcpPassthrough('exit acp', mockSession);

    expect(getAcpPassthroughState()).toBeNull();
    expect(execFileAsyncMock).not.toHaveBeenCalled();
  });

  it('should forward non-exit messages to acpx normally', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    execFileAsyncMock.mockResolvedValue({ stdout: 'done', stderr: '' });

    await handleAcpPassthrough('write a hello world', mockSession);

    expect(execFileAsyncMock).toHaveBeenCalled();
    expect(getAcpPassthroughState()).not.toBeNull();
  });
});

describe('handleUserMessage with ACP passthrough', () => {
  const mockLogToolCall = jest.fn();
  const mockLogToolProgress = jest.fn();
  const mockLogToolResult = jest.fn();
  const mockLogSystemMessage = jest.fn();
  const mockEnd = jest.fn();
  const mockSetAbortController = jest.fn();
  let mockAbortController: AbortController;

  const createMockSession = () => {
    mockAbortController = new AbortController();
    const session = {
      logToolCall: mockLogToolCall,
      logToolProgress: mockLogToolProgress,
      logToolResult: mockLogToolResult,
      logAcpResponse: jest.fn(),
      logSystemMessage: mockLogSystemMessage,
      end: mockEnd,
      isRunning: false,
      abortController: mockAbortController,
      setAbortController: mockSetAbortController.mockImplementation((ac: AbortController) => {
        (session as any).abortController = ac;
      }),
      threadId: 'test-thread',
    } as any;
    return session;
  };

  beforeEach(() => {
    clearAcpPassthroughState();
    execFileAsyncMock.mockReset();
    execFileAsyncMock.mockResolvedValue({ stdout: 'acpx output', stderr: '' });
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearAcpPassthroughState();
  });

  it('should route message to ACP passthrough when state is active', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const session = createMockSession();
    const mockAgent = { stream: jest.fn() };

    await handleUserMessage('hello codex', session, mockAgent);

    // acpx should be called
    expect(execFileAsyncMock).toHaveBeenCalled();
    // LLM stream should NOT be called
    expect(mockAgent.stream).not.toHaveBeenCalled();
  });

  it('should route message to LLM when passthrough is not active', async () => {
    // No passthrough state set
    const { processStreamChunks } = require('@/core/utils/stream');
    const session = createMockSession();
    const mockStream = {};
    const mockAgent = { stream: jest.fn().mockReturnValue(mockStream) };

    await handleUserMessage('hello AI', session, mockAgent);

    expect(mockAgent.stream).toHaveBeenCalled();
    expect(processStreamChunks).toHaveBeenCalled();
  });

  it('should not enter passthrough mode for image messages', async () => {
    setAcpPassthroughState({ agent: 'codex' });
    const session = createMockSession();
    const mockStream = {};
    const mockAgent = { stream: jest.fn().mockReturnValue(mockStream) };
    // Image content is an array, not a string
    const imageContent = [{ type: 'image_url' as const, image_url: { url: 'http://example.com/img.jpg' } }];

    await handleUserMessage(imageContent, session, mockAgent);

    // Image messages bypass passthrough and go to LLM
    expect(mockAgent.stream).toHaveBeenCalled();
    expect(execFileAsyncMock).not.toHaveBeenCalled();
  });
});
