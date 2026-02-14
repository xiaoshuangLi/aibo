import { LspClient } from '@/infrastructure/code-analysis/lsp-client';
import { ChildProcess } from 'child_process';

// Mock child_process.spawn
jest.mock('child_process', () => {
  const mockChildProcess = {
    stdout: {
      on: jest.fn(),
      pipe: jest.fn()
    },
    stdin: {
      write: jest.fn(),
      end: jest.fn()
    },
    stderr: {
      on: jest.fn()
    },
    on: jest.fn(),
    kill: jest.fn(),
    pid: 12345
  };

  return {
    spawn: jest.fn().mockReturnValue(mockChildProcess)
  };
});

describe('LspClient', () => {
  let lspClient: LspClient;
  let mockChildProcess: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock child process
    mockChildProcess = {
      stdout: {
        on: jest.fn(),
        pipe: jest.fn()
      },
      stdin: {
        write: jest.fn(),
        end: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn(),
      kill: jest.fn(),
      pid: 12345
    };

    // Mock spawn to return our mock child process
    const spawnMock = require('child_process').spawn as jest.MockedFunction<typeof import('child_process').spawn>;
    spawnMock.mockReturnValue(mockChildProcess);

    const config = {
      serverCommand: 'typescript-language-server',
      serverArgs: ['--stdio'],
      workingDirectory: '/test',
      timeout: 5000
    };

    lspClient = new LspClient(config);
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(lspClient).toBeDefined();
      
      // Test private properties indirectly
      expect((lspClient as any).config).toBeDefined();
      expect((lspClient as any).requestCounter).toBe(1);
      expect((lspClient as any).isInitialized).toBe(false);
    });

    test('should set default timeout if not provided', () => {
      const config = {
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test'
      };

      const client = new LspClient(config);
      expect((client as any).config.timeout).toBe(30000);
    });
  });

  describe('start', () => {
    test('should throw error if LSP server is already running', async () => {
      (lspClient as any).childProcess = {} as ChildProcess;
      
      await expect(lspClient.start()).rejects.toThrow('LSP server is already running');
    });

    test('should start LSP server process successfully', async () => {
      const spawnMock = require('child_process').spawn as jest.MockedFunction<typeof import('child_process').spawn>;
      
      // Mock successful process creation
      mockChildProcess.stdout = { on: jest.fn() } as any;
      mockChildProcess.stdin = { write: jest.fn() } as any;
      mockChildProcess.stderr = { on: jest.fn() } as any;
      mockChildProcess.on = jest.fn();
      mockChildProcess.kill = jest.fn();
      
      spawnMock.mockReturnValue(mockChildProcess);
      
      // Mock initializeServer to resolve
      (lspClient as any).initializeServer = jest.fn().mockResolvedValue(undefined);
      
      await expect(lspClient.start()).resolves.toBeUndefined();
      
      expect(spawnMock).toHaveBeenCalledWith(
        'typescript-language-server',
        ['--stdio'],
        expect.objectContaining({
          cwd: '/test',
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
      
      expect((lspClient as any).isInitialized).toBe(true);
    });

    test('should handle spawn error and cleanup', async () => {
      const spawnMock = require('child_process').spawn as jest.MockedFunction<typeof import('child_process').spawn>;
      spawnMock.mockImplementation(() => {
        throw new Error('Spawn failed');
      });
      
      const cleanupSpy = jest.spyOn(lspClient as any, 'cleanup');
      
      await expect(lspClient.start()).rejects.toThrow('Failed to start LSP server');
      expect(cleanupSpy).toHaveBeenCalled();
    });

    test('should handle missing stdout/stdin', async () => {
      mockChildProcess.stdout = null;
      mockChildProcess.stdin = null;
      
      await expect(lspClient.start()).rejects.toThrow('Failed to get stdout or stdin from LSP server');
    });

    test('should setup event listeners correctly', async () => {
      // Mock initializeServer
      (lspClient as any).initializeServer = jest.fn().mockResolvedValue(undefined);
      
      await lspClient.start();
      
      // Check that stdout data listener was set up
      expect(mockChildProcess.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
      
      // Check that stderr data listener was set up
      expect(mockChildProcess.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
      
      // Check that exit listener was set up
      expect(mockChildProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });
  });

  describe('initializeServer', () => {
    test('should send initialize and initialized requests', async () => {
      const sendRequestMock = jest.fn().mockResolvedValue({});
      const sendNotificationMock = jest.fn().mockResolvedValue(undefined);
      
      (lspClient as any).sendRequest = sendRequestMock;
      (lspClient as any).sendNotification = sendNotificationMock;
      
      await (lspClient as any).initializeServer();
      
      expect(sendRequestMock).toHaveBeenCalledWith('initialize', expect.objectContaining({
        processId: expect.any(Number),
        rootUri: 'file:///test',
        capabilities: expect.objectContaining({
          textDocument: expect.objectContaining({
            completion: {},
            hover: {},
            definition: {},
            references: {},
            rename: {}
          }),
          workspace: {
            symbol: {}
          }
        })
      }));
      
      expect(sendNotificationMock).toHaveBeenCalledWith('initialized', {});
    });
  });

  describe('handleMessage', () => {
    test('should handle response messages with callbacks', () => {
      const callback = jest.fn();
      (lspClient as any).pendingRequests.set(1, callback);
      
      const message = {
        jsonrpc: '2.0' as const,
        id: 1,
        result: { capabilities: {} }
      };
      
      (lspClient as any).handleMessage(message);
      
      expect(callback).toHaveBeenCalledWith({ capabilities: {} });
      expect((lspClient as any).pendingRequests.size).toBe(0);
    });

    test('should handle error responses', () => {
      const callback = jest.fn();
      (lspClient as any).pendingRequests.set(1, callback);
      
      const message = {
        jsonrpc: '2.0' as const,
        id: 1,
        error: { code: -32601, message: 'Method not found' }
      };
      
      (lspClient as any).handleMessage(message);
      
      expect(callback).toHaveBeenCalledWith({ error: { code: -32601, message: 'Method not found' } });
    });

    test('should emit notification events', () => {
      const onSpy = jest.spyOn(lspClient, 'on');
      const emitSpy = jest.spyOn(lspClient, 'emit');
      
      const message = {
        jsonrpc: '2.0' as const,
        method: 'textDocument/publishDiagnostics',
        params: { uri: 'file:///test/file.ts', diagnostics: [] }
      };
      
      (lspClient as any).handleMessage(message);
      
      expect(emitSpy).toHaveBeenCalledWith('notification', {
        method: 'textDocument/publishDiagnostics',
        params: { uri: 'file:///test/file.ts', diagnostics: [] }
      });
    });
  });

  describe('sendRequest', () => {
    test('should throw error if server is not initialized', async () => {
      await expect(lspClient.sendRequest('textDocument/definition', {})).rejects.toThrow('LSP server is not initialized');
    });

    test('should send request with proper JSON-RPC format', async () => {
      (lspClient as any).isInitialized = true;
      (lspClient as any).sendMessage = jest.fn();
      (lspClient as any).stdin = { write: jest.fn() } as any;
      
      const promise = lspClient.sendRequest('textDocument/definition', { 
        textDocument: { uri: 'file:///test/file.ts' },
        position: { line: 1, character: 2 }
      });
      
      // Resolve the pending request
      const callback = (lspClient as any).pendingRequests.get(1);
      callback('definition-result');
      
      await expect(promise).resolves.toBe('definition-result');
      
      expect((lspClient as any).sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        jsonrpc: '2.0',
        id: 1,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri: 'file:///test/file.ts' },
          position: { line: 1, character: 2 }
        }
      }));
    });

    test('should handle request timeout', async () => {
      (lspClient as any).isInitialized = true;
      (lspClient as any).config.timeout = 1; // Very short timeout
      (lspClient as any).stdin = { write: jest.fn() } as any;
      
      await expect(lspClient.sendRequest('textDocument/definition', {})).rejects.toThrow('LSP request timeout');
    });

    test('should handle request errors', async () => {
      (lspClient as any).isInitialized = true;
      (lspClient as any).stdin = { write: jest.fn() } as any;
      
      const promise = lspClient.sendRequest('textDocument/definition', {});
      
      // Reject the pending request with error
      const callback = (lspClient as any).pendingRequests.get(1);
      callback({ error: { code: -32601, message: 'Method not found' } });
      
      await expect(promise).rejects.toThrow('LSP request failed: Method not found (code: -32601)');
    });
  });

  describe('sendNotification', () => {
    test('should throw error if server is not initialized', () => {
      expect(() => {
        lspClient.sendNotification('textDocument/didOpen', {});
      }).toThrow('LSP server is not initialized');
    });

    test('should send notification with proper JSON-RPC format', () => {
      (lspClient as any).isInitialized = true;
      (lspClient as any).sendMessage = jest.fn();
      
      lspClient.sendNotification('textDocument/didOpen', {
        textDocument: { uri: 'file:///test/file.ts', languageId: 'typescript', version: 1, text: 'console.log("test");' }
      });
      
      expect((lspClient as any).sendMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: { uri: 'file:///test/file.ts', languageId: 'typescript', version: 1, text: 'console.log("test");' }
        }
      });
    });
  });

  describe('sendMessage', () => {
    test('should throw error if stdin is not available', () => {
      (lspClient as any).stdin = null;
      
      expect(() => {
        (lspClient as any).sendMessage({ jsonrpc: '2.0', method: 'test' });
      }).toThrow('LSP server stdin is not available');
    });

    test('should send properly formatted LSP message', () => {
      const mockStdinWrite = jest.fn();
      (lspClient as any).stdin = { write: mockStdinWrite } as any;
      
      const message = { jsonrpc: '2.0', method: 'test', params: { key: 'value' } };
      (lspClient as any).sendMessage(message);
      
      const expectedContent = JSON.stringify(message);
      const expectedHeader = `Content-Length: ${Buffer.byteLength(expectedContent, 'utf8')}\r\n\r\n`;
      const expectedFullMessage = expectedHeader + expectedContent;
      
      expect(mockStdinWrite).toHaveBeenCalledWith(expectedFullMessage);
    });
  });

  describe('LSP method wrappers', () => {
    beforeEach(() => {
      (lspClient as any).isInitialized = true;
      (lspClient as any).sendRequest = jest.fn().mockResolvedValue('mock-result');
    });

    test('should call getDefinition with correct parameters', async () => {
      const result = await lspClient.getDefinition('/test/file.ts', { line: 5, character: 10 });
      
      expect(result).toBe('mock-result');
      expect((lspClient as any).sendRequest).toHaveBeenCalledWith('textDocument/definition', {
        textDocument: { uri: 'file:///test/file.ts' },
        position: { line: 5, character: 10 }
      });
    });

    test('should call findReferences with correct parameters', async () => {
      const result = await lspClient.findReferences('/test/file.ts', { line: 5, character: 10 });
      
      expect(result).toBe('mock-result');
      expect((lspClient as any).sendRequest).toHaveBeenCalledWith('textDocument/references', {
        textDocument: { uri: 'file:///test/file.ts' },
        position: { line: 5, character: 10 }
      });
    });

    test('should call getHover with correct parameters', async () => {
      const result = await lspClient.getHover('/test/file.ts', { line: 5, character: 10 });
      
      expect(result).toBe('mock-result');
      expect((lspClient as any).sendRequest).toHaveBeenCalledWith('textDocument/hover', {
        textDocument: { uri: 'file:///test/file.ts' },
        position: { line: 5, character: 10 }
      });
    });

    test('should call getWorkspaceSymbols with correct parameters', async () => {
      const result = await lspClient.getWorkspaceSymbols('MyClass');
      
      expect(result).toBe('mock-result');
      expect((lspClient as any).sendRequest).toHaveBeenCalledWith('workspace/symbol', { query: 'MyClass' });
    });
  });

  describe('shutdown', () => {
    test('should send shutdown and exit notifications', async () => {
      (lspClient as any).childProcess = {} as ChildProcess;
      (lspClient as any).sendRequest = jest.fn().mockResolvedValue(undefined);
      (lspClient as any).sendNotification = jest.fn();
      (lspClient as any).cleanup = jest.fn();
      
      await lspClient.shutdown();
      
      expect((lspClient as any).sendRequest).toHaveBeenCalledWith('shutdown', null);
      expect((lspClient as any).sendNotification).toHaveBeenCalledWith('exit', null);
      expect((lspClient as any).cleanup).toHaveBeenCalled();
    });

    test('should handle shutdown errors gracefully', async () => {
      (lspClient as any).childProcess = {} as ChildProcess;
      (lspClient as any).sendRequest = jest.fn().mockRejectedValue(new Error('Shutdown failed'));
      (lspClient as any).sendNotification = jest.fn();
      (lspClient as any).cleanup = jest.fn();
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await lspClient.shutdown();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error during LSP shutdown:', expect.any(Error));
      expect((lspClient as any).cleanup).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    test('should cleanup even if childProcess is null', async () => {
      (lspClient as any).childProcess = null;
      (lspClient as any).cleanup = jest.fn();
      
      await lspClient.shutdown();
      
      expect((lspClient as any).cleanup).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    test('should reset all internal state and kill child process', () => {
      const mockKill = jest.fn();
      (lspClient as any).childProcess = { kill: mockKill } as any;
      (lspClient as any).isInitialized = true;
      (lspClient as any).pendingRequests.set(1, jest.fn());
      (lspClient as any).messageParser = { clear: jest.fn() } as any;
      
      (lspClient as any).cleanup();
      
      expect((lspClient as any).isInitialized).toBe(false);
      expect((lspClient as any).pendingRequests.size).toBe(0);
      expect((lspClient as any).messageParser.clear).toHaveBeenCalled();
      expect(mockKill).toHaveBeenCalled();
      
      expect((lspClient as any).childProcess).toBeNull();
      expect((lspClient as any).stdout).toBeNull();
      expect((lspClient as any).stdin).toBeNull();
    });

    test('should handle null childProcess gracefully', () => {
      (lspClient as any).childProcess = null;
      (lspClient as any).messageParser = { clear: jest.fn() } as any;
      
      expect(() => {
        (lspClient as any).cleanup();
      }).not.toThrow();
    });
  });

  describe('process exit handling', () => {
    test('should cleanup on process exit', async () => {
      // Mock initializeServer to resolve
      (lspClient as any).initializeServer = jest.fn().mockResolvedValue(undefined);
      
      await lspClient.start();
      
      // Get the exit callback
      const exitCallback = (mockChildProcess.on as jest.Mock).mock.calls.find(call => call[0] === 'exit')?.[1];
      
      if (exitCallback) {
        const cleanupSpy = jest.spyOn(lspClient as any, 'cleanup');
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        
        exitCallback(0, null);
        
        expect(cleanupSpy).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('LSP Server exited with code 0, signal null');
        
        consoleLogSpy.mockRestore();
      }
    });
  });
});