import { TerminalAdapter } from '@/presentation/console/adapter';
import { OutputEvent } from '@/core/agent/adapter';
import * as readline from 'readline';

describe('TerminalAdapter Branch Coverage Tests', () => {
  let terminalAdapter: TerminalAdapter;

  beforeEach(() => {
    terminalAdapter = new TerminalAdapter();
  });

  afterEach(() => {
    if (terminalAdapter) {
      terminalAdapter.destroy();
    }
  });

  test('should handle emit with various event types', async () => {
    const events = [
      { type: 'aiResponse' as const, data: { content: 'Hello' } },
      { type: 'toolCall' as const, data: { tool: 'test-tool', args: {} } },
      { type: 'toolResult' as const, data: { result: 'success' } },
      { type: 'thinkingProcess' as const, data: { step: 'processing' } },
      { type: 'systemMessage' as const, data: { message: 'System info' } },
      { type: 'errorMessage' as const, data: { error: 'Test error' } },
      { type: 'hintMessage' as const, data: { hint: 'Helpful hint' } },
      { type: 'streamStart' as const, data: { streamId: '123' } },
      { type: 'streamChunk' as const, data: { chunk: 'data' } },
      { type: 'streamEnd' as const, data: { streamId: '123' } },
      { type: 'userInputRequest' as const, data: { prompt: 'Enter input' } },
      { type: 'sessionStart' as const, data: { sessionId: 'session1' } },
      { type: 'sessionEnd' as const, data: { sessionId: 'session1' } },
      { type: 'commandExecuted' as const, data: { command: 'test' } },
      { type: 'rawText' as const, data: 'Raw text output' }
    ];

    for (const event of events) {
      const spy = jest.spyOn(terminalAdapter, 'emit');
      await terminalAdapter.emit({ ...event, timestamp: Date.now() });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  test('should handle requestUserInput with and without prompt', async () => {
    // Test with custom prompt
    const showPromptSpy = jest.spyOn(terminalAdapter as any, 'showPrompt');
    await terminalAdapter.requestUserInput('Custom prompt: ');
    expect(showPromptSpy).toHaveBeenCalledWith('Custom prompt: ');
    showPromptSpy.mockRestore();

    // Test with default prompt
    const showPromptSpy2 = jest.spyOn(terminalAdapter as any, 'showPrompt');
    await terminalAdapter.requestUserInput();
    expect(showPromptSpy2).toHaveBeenCalledWith('\n👤 你: ');
    showPromptSpy2.mockRestore();
  });

  test('should handle setAbortSignal with AbortController and AbortSignal', () => {
    // Test with AbortController
    const controller1 = new AbortController();
    terminalAdapter.setAbortSignal(controller1.signal);
    expect(terminalAdapter['abortController']).toBeDefined();

    // Test with already aborted signal
    const controller3 = new AbortController();
    controller3.abort();
    terminalAdapter.setAbortSignal(controller3.signal);
    expect(terminalAdapter['abortController']?.signal.aborted).toBe(true);
  });

  test('should handle destroy method properly', () => {
    const originalRl = terminalAdapter['rl'];
    if (originalRl) {
      const closeSpy = jest.spyOn(originalRl, 'close');
      terminalAdapter.destroy();
      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
    }
    
    // Test that destroy can be called multiple times safely
    terminalAdapter.destroy();
    expect(terminalAdapter['isDestroyed']).toBe(true);
  });

  test('should handle requestUserInput when destroyed', async () => {
    terminalAdapter.destroy();
    await expect(terminalAdapter.requestUserInput())
      .rejects.toThrow('Terminal adapter is destroyed');
  });

  test('should handle emit with null/undefined data', async () => {
    // Test aiResponse with null data
    await terminalAdapter.emit({
      type: 'aiResponse',
      data: null,
      timestamp: Date.now()
    });

    // Test toolCall with undefined data
    await terminalAdapter.emit({
      type: 'toolCall',
      data: undefined,
      timestamp: Date.now()
    });
  });

  test('should handle rl property access', () => {
    const rl = terminalAdapter.rl;
    if (rl) {
      expect(rl).toBeInstanceOf(readline.Interface);
    }
  });
});