/**
 * Extra coverage tests for src/presentation/console/interactive.ts.
 * Covers:
 *   - onVoiceInputComplete callback body (lines 198-204)
 *   - onExecuteCommand callback (line 210)
 *   - process.stdin keypress handler (lines 221-225)
 */

// Capture callbacks passed to createKeypressHandler
let capturedOnVoiceInputComplete: ((text: string) => void) | null = null;
let capturedOnExecuteCommand: ((cmd: string) => Promise<void>) | null = null;
const mockKeypressHandler = jest.fn();

jest.mock('@/features/voice-input/manager', () => ({
  createKeypressHandler: jest.fn().mockImplementation(
    (_s: any, _g: any, onVCI: any, onEC: any) => {
      capturedOnVoiceInputComplete = onVCI;
      capturedOnExecuteCommand = onEC;
      return mockKeypressHandler;
    }
  ),
}));

// Track created session mock objects
let lastSessionMock: any = null;

jest.mock('@/core/agent/session', () => ({
  Session: jest.fn().mockImplementation(() => {
    lastSessionMock = {
      threadId: 'test-thread',
      isRunning: false,
      start: jest.fn(),
      end: jest.fn(),
      requestUserInput: jest.fn(),
      isVoiceRecordingActive: jest.fn().mockReturnValue(false),
      getVoiceASR: jest.fn().mockReturnValue(null),
      setVoiceRecording: jest.fn(),
    };
    return lastSessionMock;
  }),
}));

// Track created adapter mock objects
let lastAdapterMock: any = null;

jest.mock('@/presentation/console/adapter', () => ({
  TerminalAdapter: jest.fn().mockImplementation(() => {
    lastAdapterMock = {
      rl: {
        on: jest.fn(),
        prompt: jest.fn(),
        write: jest.fn(),
        line: '',
      },
      destroy: jest.fn(),
      setAbortSignal: jest.fn(),
      emit: jest.fn().mockResolvedValue(undefined),
    };
    return lastAdapterMock;
  }),
}));

jest.mock('@/core/agent/factory', () => ({
  createAIAgent: jest.fn().mockResolvedValue({ stream: jest.fn() }),
}));

jest.mock('@/presentation/console/commander', () => ({
  createHandleInternalCommand: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('@/presentation/console/input', () => ({
  handleUserInput: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/infrastructure/session/manager', () => ({
  SessionManager: {
    getInstance: jest.fn().mockReturnValue({
      getCurrentSessionId: jest.fn().mockReturnValue('test-session-id'),
    }),
  },
}));

jest.mock('@/core/config', () => ({
  config: { model: { name: 'test-model' }, specialKeyword: { keyword: '干活' }, language: { code: 'en' }, persona: { style: undefined } },
}));

const origIsTTY = (process.stdin as any).isTTY;
const origSetRawMode = (process.stdin as any).setRawMode;

describe('startInteractiveMode - voice callback coverage', () => {
  let stdinKeypressHandlers: Function[];

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnVoiceInputComplete = null;
    capturedOnExecuteCommand = null;
    lastSessionMock = null;
    lastAdapterMock = null;
    stdinKeypressHandlers = [];

    // Intercept process.stdin.on('keypress', ...) calls
    (process.stdin as any).on = jest.fn().mockImplementation((event: string, handler: Function) => {
      if (event === 'keypress') stdinKeypressHandlers.push(handler);
      return process.stdin;
    });
    (process.stdin as any).setRawMode = jest.fn();
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true });
    (process.stdin as any).setRawMode = origSetRawMode;
  });

  it('onVoiceInputComplete invokes rl.prompt and rl.write (lines 198-204)', async () => {
    const { startInteractiveMode } = require('@/presentation/console/interactive');
    await startInteractiveMode();

    expect(capturedOnVoiceInputComplete).toBeDefined();
    capturedOnVoiceInputComplete!('recognized text');

    expect(lastAdapterMock.rl.prompt).toHaveBeenCalled();
    expect(lastAdapterMock.rl.write).toHaveBeenCalledWith('recognized text');
  });

  it('onExecuteCommand calls handleUserInput (line 210)', async () => {
    const { startInteractiveMode } = require('@/presentation/console/interactive');
    await startInteractiveMode();

    expect(capturedOnExecuteCommand).toBeDefined();

    const { handleUserInput } = require('@/presentation/console/input');
    await capturedOnExecuteCommand!('run tests');

    expect(handleUserInput).toHaveBeenCalledWith(
      'run tests', lastSessionMock, expect.any(Object)
    );
  });

  it('keypress event triggers voiceKeypressHandler (lines 221-225)', async () => {
    const { startInteractiveMode } = require('@/presentation/console/interactive');
    await startInteractiveMode();

    expect(stdinKeypressHandlers.length).toBeGreaterThan(0);

    await stdinKeypressHandlers[0]('s', { name: 'space' });

    expect(mockKeypressHandler).toHaveBeenCalledWith('space');
  });

  it('keypress skips voiceKeypressHandler when session.isRunning (early return)', async () => {
    const { startInteractiveMode } = require('@/presentation/console/interactive');
    await startInteractiveMode();

    // Set isRunning on the captured session mock
    lastSessionMock.isRunning = true;

    await stdinKeypressHandlers[0]('s', { name: 'space' });

    expect(mockKeypressHandler).not.toHaveBeenCalled();
  });
});
