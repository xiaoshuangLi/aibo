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

  it('should silently return without logging an error when acpx is aborted (ABORT_ERR)', async () => {
    setAcpPassthroughState({ agent: 'copilot' });
    const err: any = new Error('aborted');
    err.code = 'ABORT_ERR';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    await handleAcpPassthrough('new message while running', mockSession);

    // No error should be shown to the user — abort was intentional (new message came in)
    expect(mockLogAcpResponse).not.toHaveBeenCalled();
    expect(mockLogToolResult).not.toHaveBeenCalled();
  });

  it('should silently return without logging an error when acpx is aborted (AbortError name)', async () => {
    setAcpPassthroughState({ agent: 'copilot' });
    const err: any = new Error('aborted');
    err.name = 'AbortError';
    err.stdout = '';
    err.stderr = '';
    execFileAsyncMock.mockRejectedValue(err);

    await handleAcpPassthrough('interrupt me', mockSession);

    expect(mockLogAcpResponse).not.toHaveBeenCalled();
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

  it('should auto-create session and retry when "No acpx session found" error occurs', async () => {
    setAcpPassthroughState({ agent: 'copilot' });

    const noSessionErr: any = new Error('Command failed: No acpx session found');
    noSessionErr.stderr = '⚠ No acpx session found (searched up to /project).\nCreate one: acpx copilot sessions new';
    noSessionErr.stdout = '';

    execFileAsyncMock
      .mockRejectedValueOnce(noSessionErr)
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // sessions new
      .mockResolvedValueOnce({ stdout: 'copilot response', stderr: '' }); // retry

    await handleAcpPassthrough('你是 copilot 吗？', mockSession);

    // Should ultimately succeed and log the response
    expect(mockLogAcpResponse).toHaveBeenCalledWith('copilot', 'copilot response');
    // Three calls: initial prompt, sessions new, retry
    expect(execFileAsyncMock).toHaveBeenCalledTimes(3);
    const sessionNewArgs = execFileAsyncMock.mock.calls[1][1] as string[];
    expect(sessionNewArgs).toContain('copilot');
    expect(sessionNewArgs).toContain('sessions');
    expect(sessionNewArgs).toContain('new');
  });

  it('should NOT retry on non-session errors in passthrough', async () => {
    setAcpPassthroughState({ agent: 'copilot' });

    const err: any = new Error('Permission denied');
    err.code = 'EACCES';
    err.stdout = '';
    err.stderr = 'Permission denied';
    execFileAsyncMock.mockRejectedValue(err);

    await handleAcpPassthrough('task', mockSession);

    expect(mockLogAcpResponse).toHaveBeenCalledWith('copilot', expect.stringContaining('❌'));
    expect(execFileAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('should use the tool display name as toolProgress label', async () => {
    setAcpPassthroughState({ agent: 'claude' });

    // Create a mock that fires stdout data before resolving
    execFileAsyncMock.mockImplementation((..._args: any[]) => {
      const promise = Promise.resolve({ stdout: 'final result', stderr: '' }) as any;
      promise.child = {
        stdout: {
          on: (_event: string, cb: (data: Buffer) => void) => {
            if (_event === 'data') {
              cb(Buffer.from('streaming output'));
            }
          },
        },
      };
      return promise;
    });

    await handleAcpPassthrough('do something', mockSession);

    expect(mockLogToolProgress).toHaveBeenCalledWith('Claude Code 输出', 'streaming output');
    // Ensure the old formats are NOT used
    expect(mockLogToolProgress).not.toHaveBeenCalledWith(
      expect.stringMatching(/^acpx\[/),
      expect.anything(),
    );
    expect(mockLogToolProgress).not.toHaveBeenCalledWith(
      expect.stringMatching(/^ACP \[/),
      expect.anything(),
    );
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

  it('should send activation notification via logAcpResponse when passthrough activates during LLM stream', async () => {
    // Passthrough NOT active before stream
    const { processStreamChunks } = require('@/core/utils/stream');
    const { setAcpPassthroughState: setPassthrough } = require('@/presentation/lark/acp-passthrough');
    const session = createMockSession();
    const mockStream = {};
    const mockAgent = { stream: jest.fn().mockReturnValue(mockStream) };

    // Mock processStreamChunks to activate ACP passthrough as a side effect
    processStreamChunks.mockImplementationOnce(async () => {
      setPassthrough({ agent: 'claude' });
    });

    await handleUserMessage('start direct claude session', session, mockAgent);

    // logAcpResponse should have been called with activation message
    expect(session.logAcpResponse).toHaveBeenCalledWith(
      'claude',
      expect.stringContaining('ACP 直传模式已激活'),
    );
    // logSystemMessage should NOT have been called with the activation message
    expect(mockLogSystemMessage).not.toHaveBeenCalledWith(
      expect.stringContaining('ACP'),
    );
  });

  it('should include session name in activation notification', async () => {
    const { processStreamChunks } = require('@/core/utils/stream');
    const { setAcpPassthroughState: setPassthrough } = require('@/presentation/lark/acp-passthrough');
    const session = createMockSession();
    const mockStream = {};
    const mockAgent = { stream: jest.fn().mockReturnValue(mockStream) };

    processStreamChunks.mockImplementationOnce(async () => {
      setPassthrough({ agent: 'codex', sessionName: 'backend' });
    });

    await handleUserMessage('start codex session backend', session, mockAgent);

    expect(session.logAcpResponse).toHaveBeenCalledWith(
      'codex',
      expect.stringContaining('backend'),
    );
  });
});
