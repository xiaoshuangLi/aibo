/**
 * Tests for voice-input manager covering:
 * - stopRecord early return when isRecordingShortcutActive is false (line 116)
 * - createKeypressHandler branches (lines 186-219)
 */

jest.mock('@/features/voice-input/recognition', () => ({
  createVoiceRecognition: jest.fn(),
  VoiceRecognition: jest.fn(),
}));

jest.mock('@/core/config', () => ({
  config: {
    specialKeyword: { keyword: '干活' },
  },
}));

/** Creates a stateful session mock so that setVoiceRecording/getVoiceASR work. */
function makeStatefulSession() {
  let voiceASR: any = null;
  let recording = false;
  return {
    getVoiceASR: jest.fn(() => voiceASR),
    isVoiceRecordingActive: jest.fn(() => recording),
    setVoiceRecording: jest.fn((active: boolean, asr: any) => {
      recording = active;
      voiceASR = asr;
    }),
    logSystemMessage: jest.fn(),
    logErrorMessage: jest.fn(),
  } as any;
}

// ── stopRecord early return ────────────────────────────────────────────────

describe('stopRecord early return when shortcut not active', () => {
  let mgr: any;

  beforeAll(() => {
    jest.isolateModules(() => {
      mgr = require('@/features/voice-input/manager');
    });
  });

  it('returns without doing anything when isRecordingShortcutActive is false', async () => {
    const session = makeStatefulSession();
    const onComplete = jest.fn();
    const onExec = jest.fn();

    await mgr.stopRecord(session, '', onComplete, onExec);

    expect(session.getVoiceASR).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExec).not.toHaveBeenCalled();
  });
});

// ── createKeypressHandler ──────────────────────────────────────────────────

describe('createKeypressHandler - single space does nothing', () => {
  let mgr: any;

  beforeAll(() => {
    jest.isolateModules(() => {
      mgr = require('@/features/voice-input/manager');
    });
  });

  it('does not start recording on a single space press', async () => {
    const session = makeStatefulSession();
    const handler = mgr.createKeypressHandler(session, () => '', jest.fn(), jest.fn());

    await handler('space');
    expect(session.logSystemMessage).not.toHaveBeenCalled();
  });
});

describe('createKeypressHandler - slow double space does not start recording', () => {
  let mgr: any;

  beforeAll(() => {
    jest.isolateModules(() => {
      mgr = require('@/features/voice-input/manager');
    });
  });

  it('treats two space presses more than 300ms apart as separate presses', async () => {
    const session = makeStatefulSession();
    const handler = mgr.createKeypressHandler(session, () => '', jest.fn(), jest.fn());

    const realNow = Date.now;
    let t = 6000;
    Date.now = () => t;
    try {
      await handler('space');
      t = 6500; // 500ms gap > 300ms
      await handler('space');
      expect(session.logSystemMessage).not.toHaveBeenCalled();
    } finally {
      Date.now = realNow;
    }
  });
});

describe('createKeypressHandler - non-space key resets timestamp', () => {
  let mgr: any;

  beforeAll(() => {
    jest.isolateModules(() => {
      mgr = require('@/features/voice-input/manager');
    });
  });

  it('pressing a non-space key resets lastSpacePressTime', async () => {
    const session = makeStatefulSession();
    const handler = mgr.createKeypressHandler(session, () => '', jest.fn(), jest.fn());

    const realNow = Date.now;
    let t = 7000;
    Date.now = () => t;
    try {
      await handler('space'); // sets timestamp
      await handler('enter'); // resets timestamp to 0
      t = 7050;
      await handler('space'); // first press again (no double-space)
      expect(session.logSystemMessage).not.toHaveBeenCalled();
    } finally {
      Date.now = realNow;
    }
  });
});

describe('createKeypressHandler - fast double space starts recording', () => {
  let mgr: any;
  let mockASR: any;

  beforeAll(() => {
    jest.isolateModules(() => {
      const { createVoiceRecognition } = require('@/features/voice-input/recognition');
      mockASR = {
        canRecord: jest.fn().mockReturnValue(true),
        startManualRecording: jest.fn().mockResolvedValue(undefined),
        stopManualRecording: jest.fn().mockResolvedValue(null),
        recognizeManualRecording: jest.fn().mockResolvedValue(null),
      };
      (createVoiceRecognition as jest.Mock).mockReturnValue(mockASR);
      mgr = require('@/features/voice-input/manager');
    });
  });

  it('starts recording on two fast space presses (< 300ms apart)', async () => {
    const session = makeStatefulSession();
    const handler = mgr.createKeypressHandler(session, () => '', jest.fn(), jest.fn());

    const realNow = Date.now;
    let t = 5000;
    Date.now = () => t;
    try {
      await handler('space');
      t = 5100; // 100ms < 300ms → double space
      await handler('space');
      expect(session.logSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining('语音输入')
      );
    } finally {
      Date.now = realNow;
    }
  });
});

describe('createKeypressHandler - double space stops recording when active', () => {
  let mgr: any;
  let mockASR: any;

  beforeAll(() => {
    jest.isolateModules(() => {
      const { createVoiceRecognition } = require('@/features/voice-input/recognition');
      mockASR = {
        canRecord: jest.fn().mockReturnValue(true),
        startManualRecording: jest.fn().mockResolvedValue(undefined),
        stopManualRecording: jest.fn().mockResolvedValue(null),
        recognizeManualRecording: jest.fn().mockResolvedValue(null),
      };
      (createVoiceRecognition as jest.Mock).mockReturnValue(mockASR);
      mgr = require('@/features/voice-input/manager');
    });
  });

  it('stops recording on fast double space when already recording', async () => {
    const session = makeStatefulSession();

    // Start recording: sets isRecordingShortcutActive = true and voiceASR = mockASR
    await mgr.startRecord(session);
    expect(session.isVoiceRecordingActive()).toBe(true);

    const handler = mgr.createKeypressHandler(session, () => '', jest.fn(), jest.fn());

    const realNow = Date.now;
    let t = 8000;
    Date.now = () => t;
    try {
      await handler('space');
      t = 8100; // 100ms < 300ms
      await handler('space'); // double space → stopRecord
      expect(mockASR.stopManualRecording).toHaveBeenCalled();
    } finally {
      Date.now = realNow;
    }
  });
});

describe('createKeypressHandler - non-space key stops recording when shortcut active', () => {
  let mgr: any;
  let mockASR: any;

  beforeAll(() => {
    jest.isolateModules(() => {
      const { createVoiceRecognition } = require('@/features/voice-input/recognition');
      mockASR = {
        canRecord: jest.fn().mockReturnValue(true),
        startManualRecording: jest.fn().mockResolvedValue(undefined),
        stopManualRecording: jest.fn().mockResolvedValue(null),
        recognizeManualRecording: jest.fn().mockResolvedValue(null),
      };
      (createVoiceRecognition as jest.Mock).mockReturnValue(mockASR);
      mgr = require('@/features/voice-input/manager');
    });
  });

  it('stops recording when any non-space key is pressed while shortcut is active', async () => {
    const session = makeStatefulSession();

    // Activate shortcut
    await mgr.startRecord(session);
    expect(session.isVoiceRecordingActive()).toBe(true);

    const handler = mgr.createKeypressHandler(session, () => '', jest.fn(), jest.fn());

    await handler('a'); // non-space → triggers stopRecord
    expect(mockASR.stopManualRecording).toHaveBeenCalled();
  });
});
