import {
  handleHelpCommand,
  handleClearCommand,
  handleNewCommand,
  handleCompactCommand,
  handleUnknownCommand,
  handleExitCommand,
  createHandleInternalCommand,
} from '@/presentation/console/command-handlers';
import * as library from '@/shared/utils/library';
import { LspClientManager } from '@/infrastructure/code-analysis/lsp-client';

// Mock dependencies
jest.mock('@/core/config/config', () => ({
  config: {
    output: { verbose: false },
    model: { name: 'gpt-4o' },
  },
}));

jest.mock('@/presentation/styling/output-styler', () => ({
  styled: {
    system: (msg: string) => msg,
    error: (msg: string) => msg,
  },
}));

jest.mock('@/core/utils/interactive-logic', () => ({
  createConsoleThreadId: jest.fn().mockReturnValue('test-thread-id'),
}));

jest.mock('@/infrastructure/session/session-manager', () => ({
  SessionManager: {
    getInstance: jest.fn().mockReturnValue({
      clearCurrentSession: jest.fn().mockReturnValue('new-thread-123'),
      generateSessionMetadata: jest.fn(),
    }),
  },
}));

jest.mock('@/shared/utils/library', () => ({
  getAllKnowledge: jest.fn().mockReturnValue([]),
  addKnowledge: jest.fn(),
}));

jest.mock('@/infrastructure/code-analysis/lsp-client', () => ({
  LspClientManager: {
    shutdownAll: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/features/voice-input/voice-recognition', () => ({
  createVoiceRecognition: jest.fn().mockReturnValue({
    canRecord: jest.fn().mockReturnValue(false),
  }),
}));

jest.mock('@/presentation/console/user-input-handler', () => ({
  handleUserInput: jest.fn(),
}));

const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

// Mock process.exit to prevent actual process termination
const originalProcessExit = process.exit;
const mockProcessExit = jest.fn();
process.exit = mockProcessExit as any;

afterEach(() => {
  consoleSpy.mockClear();
  mockProcessExit.mockClear();
  // resetAllMocks resets both calls AND implementations, ensuring
  // mockImplementation changes in one test don't bleed into the next
  jest.resetAllMocks();
  // Re-apply default return values after reset
  (library.getAllKnowledge as jest.Mock).mockReturnValue([]);
  (LspClientManager.shutdownAll as jest.Mock).mockResolvedValue(undefined);
  const { SessionManager } = require('@/infrastructure/session/session-manager');
  SessionManager.getInstance.mockReturnValue({
    clearCurrentSession: jest.fn().mockReturnValue('new-thread-123'),
    generateSessionMetadata: jest.fn(),
  });
});

afterAll(() => {
  consoleSpy.mockRestore();
  process.exit = originalProcessExit;
});

// ===== handleExitCommand =====
describe('handleExitCommand', () => {
  it('should shut down LSP clients and call process.exit(0)', async () => {
    const session = { rl: null, end: jest.fn() };
    await handleExitCommand(session as any);
    expect(LspClientManager.shutdownAll).toHaveBeenCalled();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });
});

// ===== handleHelpCommand =====
describe('handleHelpCommand', () => {
  it('should return true and print help text', async () => {
    const result = await handleHelpCommand();
    expect(result).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('/help');
    expect(output).toContain('/compact');
  });
});

// ===== handleClearCommand =====
describe('handleClearCommand', () => {
  it('should return true and print session info', async () => {
    const session = { threadId: 'sess-abc' };
    const result = await handleClearCommand(session);
    expect(result).toBe(true);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('sess-abc');
  });
});

// ===== handleNewCommand =====
describe('handleNewCommand', () => {
  it('should return true and update session threadId', async () => {
    const session: any = { threadId: 'old-thread' };
    const result = await handleNewCommand(session);
    expect(result).toBe(true);
    expect(session.threadId).toBe('new-thread-123');
  });
});

// ===== handleCompactCommand =====
describe('handleCompactCommand', () => {
  it('should return true', async () => {
    const session: any = { threadId: 'old-thread' };
    const result = await handleCompactCommand(session);
    expect(result).toBe(true);
  });

  it('should update session threadId to the new session', async () => {
    const session: any = { threadId: 'old-thread' };
    await handleCompactCommand(session);
    expect(session.threadId).toBe('new-thread-123');
  });

  it('should migrate existing knowledge items to the new session', async () => {
    const knowledgeItems = [
      { content: 'Content 1', title: 'Title 1', keywords: ['kw1'] },
      { content: 'Content 2', title: 'Title 2', keywords: ['kw2', 'kw3'] },
    ];
    (library.getAllKnowledge as jest.Mock).mockReturnValue(knowledgeItems);

    const session: any = { threadId: 'old-thread' };
    await handleCompactCommand(session);

    expect(library.addKnowledge).toHaveBeenCalledTimes(2);
    expect(library.addKnowledge).toHaveBeenCalledWith('Content 1', 'Title 1', ['kw1']);
    expect(library.addKnowledge).toHaveBeenCalledWith('Content 2', 'Title 2', ['kw2', 'kw3']);
  });

  it('should display knowledge titles when items are migrated', async () => {
    (library.getAllKnowledge as jest.Mock).mockReturnValue([
      { content: 'Content A', title: 'My Goal', keywords: [] },
    ]);

    const session: any = { threadId: 'old-thread' };
    await handleCompactCommand(session);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('My Goal');
    expect(output).toContain('1 条知识项');
  });

  it('should display guidance when knowledge base is empty', async () => {
    (library.getAllKnowledge as jest.Mock).mockReturnValue([]);

    const session: any = { threadId: 'old-thread' };
    await handleCompactCommand(session);

    expect(library.addKnowledge).not.toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('知识库为空');
  });

  it('should return true even when getAllKnowledge throws', async () => {
    (library.getAllKnowledge as jest.Mock).mockImplementation(() => {
      throw new Error('storage error');
    });
    const session: any = { threadId: 'old-thread' };
    const result = await handleCompactCommand(session);
    expect(result).toBe(true);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('storage error');
  });
});

// ===== handleUnknownCommand =====
describe('handleUnknownCommand', () => {
  it('should return true and print error', async () => {
    const result = await handleUnknownCommand('/bogus');
    expect(result).toBe(true);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('/bogus');
  });
});

// ===== createHandleInternalCommand =====
describe('createHandleInternalCommand', () => {
  it('should route /compact to handleCompactCommand', async () => {
    const session: any = { threadId: 'old-thread' };
    const agent: any = {};
    const handler = createHandleInternalCommand(session, agent);
    const result = await handler('/compact');
    expect(result).toBe(true);
    expect(session.threadId).toBe('new-thread-123');
  });

  it('should route /new to handleNewCommand', async () => {
    const session: any = { threadId: 'old-thread' };
    const agent: any = {};
    const handler = createHandleInternalCommand(session, agent);
    const result = await handler('/new');
    expect(result).toBe(true);
    expect(session.threadId).toBe('new-thread-123');
  });

  it('should route /help to handleHelpCommand', async () => {
    const session: any = {};
    const agent: any = {};
    const handler = createHandleInternalCommand(session, agent);
    const result = await handler('/help');
    expect(result).toBe(true);
  });

  it('should route unknown commands to handleUnknownCommand', async () => {
    const session: any = {};
    const agent: any = {};
    const handler = createHandleInternalCommand(session, agent);
    const result = await handler('/nonexistent');
    expect(result).toBe(true);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('/nonexistent');
  });
});
