/**
 * Simple LSP Client Coverage Tests
 * Focus on covering the most critical uncovered paths
 */

import { LspClient } from '@/infrastructure/code-analysis/lsp-client';

// Mock child_process to avoid actual process spawning
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: jest.fn().mockReturnValue({
      stdin: { write: jest.fn() },
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    }),
  };
});

// Mock console to avoid test output pollution
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

describe('LspClient - Critical Coverage Tests', () => {
  let lspClient: LspClient;

  beforeEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    (require('child_process').spawn as jest.Mock).mockClear();
    
    lspClient = new LspClient({
      serverCommand: 'test-lsp-server',
      workingDirectory: '/test',
      timeout: 1000,
      maxBufferSize: 1024,
    });
  });

  afterEach(() => {
    // Clean up
    if (lspClient['childProcess']) {
      lspClient['childProcess'] = null;
    }
    lspClient['initialized'] = false;
  });

  describe('handleData edge cases', () => {
    it('should handle buffer size exceeding maxBufferSize', () => {
      const largeData = Buffer.from('a'.repeat(2000));
      // This should trigger the buffer size limit logic
      expect(() => lspClient.handleData(largeData)).not.toThrow();
    });

    it('should handle message parsing errors gracefully', () => {
      const invalidJsonData = Buffer.from('Content-Length: 10\r\n\r\ninvalidjson');
      expect(() => lspClient.handleData(invalidJsonData)).not.toThrow();
      expect(console.error).toHaveBeenCalledWith("Failed to parse LSP message:", expect.any(Error));
    });
  });

  describe('sendRequest error handling', () => {
    it('should reject when child process is not started', async () => {
      await expect(lspClient.sendRequest('test/method')).rejects.toThrow(
        "LSP process not started. Please call start_lsp first."
      );
    });
  });

  describe('initialize method', () => {
    it('should return immediately if already initialized', async () => {
      lspClient['initialized'] = true;
      await expect(lspClient.initialize()).resolves.not.toThrow();
    });
  });
});