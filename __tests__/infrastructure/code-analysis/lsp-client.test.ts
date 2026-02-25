import { LspClient } from '@/infrastructure/code-analysis/lsp-client';

// Mock console.log to prevent actual output during tests
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

// Mock console.error to prevent actual output during tests  
const originalConsoleError = console.error;
const mockConsoleError = jest.fn();
console.error = mockConsoleError;

// Mock child_process
const mockChildProcess = {
  stdin: {
    write: jest.fn()
  },
  stdout: {
    on: jest.fn()
  },
  stderr: {
    on: jest.fn()
  },
  on: jest.fn(),
  unref: jest.fn()
};

jest.mock('child_process', () => ({
  spawn: jest.fn(() => mockChildProcess)
}));

describe('LSP Client', () => {
  let lspClient: any;
  const testConfig = {
    serverCommand: 'test-server',
    workingDirectory: '/test',
    serverArgs: ['--stdio']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    (require('child_process').spawn as jest.Mock).mockReturnValue(mockChildProcess);
  });

  describe('Constructor', () => {
    it('should initialize with default config values', () => {
      lspClient = new LspClient(testConfig);
      
      expect(lspClient.config.timeout).toBe(10000);
      expect(lspClient.config.maxBufferSize).toBe(10 * 1024 * 1024);
      expect(lspClient.initialized).toBe(false);
      expect(lspClient.openedDocuments.size).toBe(0);
    });

    it('should use custom config values when provided', () => {
      const customConfig = {
        ...testConfig,
        timeout: 5000,
        maxBufferSize: 5 * 1024 * 1024
      };
      
      lspClient = new LspClient(customConfig);
      
      expect(lspClient.config.timeout).toBe(5000);
      expect(lspClient.config.maxBufferSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('startProcess', () => {
    it('should start child process with correct parameters', () => {
      lspClient = new LspClient(testConfig);
      // @ts-ignore - accessing private method for testing
      lspClient.startProcess();
      
      expect(require('child_process').spawn).toHaveBeenCalledWith(
        'test-server',
        ['--stdio'],
        expect.objectContaining({
          cwd: '/test'
        })
      );
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Starting LSP client'));
    });

    it('should handle missing serverArgs', () => {
      const configWithoutArgs = {
        serverCommand: 'test-server',
        workingDirectory: '/test'
      };
      
      lspClient = new LspClient(configWithoutArgs);
      // @ts-ignore
      lspClient.startProcess();
      
      expect(require('child_process').spawn).toHaveBeenCalledWith(
        'test-server',
        [],
        expect.objectContaining({
          cwd: '/test'
        })
      );
    });
  });

  describe('handleMessage', () => {
    it('should handle response message correctly', async () => {
      lspClient = new LspClient(testConfig);
      
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      // @ts-ignore
      lspClient.responsePromises.set(1, { resolve: mockResolve, reject: mockReject });
      
      const testMessage = {
        jsonrpc: "2.0",
        id: 1,
        result: {"capabilities": {}}
      };
      
      // @ts-ignore
      await lspClient.handleMessage(testMessage);
      
      expect(mockResolve).toHaveBeenCalledWith({"capabilities": {}});
    });

    it('should handle error response message correctly', async () => {
      lspClient = new LspClient(testConfig);
      
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      // @ts-ignore
      lspClient.responsePromises.set(2, { resolve: mockResolve, reject: mockReject });
      
      const testMessage = {
        jsonrpc: "2.0",
        id: 2,
        error: {"code": -32601, "message": "Method not found"}
      };
      
      // @ts-ignore
      await lspClient.handleMessage(testMessage);
      
      expect(mockReject).toHaveBeenCalledWith({"code": -32601, "message": "Method not found"});
    });

    it('should handle notification message correctly', async () => {
      lspClient = new LspClient(testConfig);
      
      const testMessage = {
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: {
          uri: "file:///test/file.ts",
          diagnostics: [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 5 }
              },
              severity: 1,
              message: "Error"
            }
          ]
        }
      };
      
      // @ts-ignore
      await lspClient.handleMessage(testMessage);
      
      // @ts-ignore
      expect(lspClient.documentDiagnostics.get("file:///test/file.ts")).toEqual([
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 }
          },
          severity: 1,
          message: "Error"
        }
      ]);
    });
  });

  describe('sendRequest', () => {
    it('should reject if process not started', async () => {
      lspClient = new LspClient(testConfig);
      
      await expect(
        // @ts-ignore
        lspClient.sendRequest('test/method')
      ).rejects.toThrow('LSP process not started');
    });

    it('should send request with proper LSP header format', async () => {
      lspClient = new LspClient(testConfig);
      // @ts-ignore
      lspClient.childProcess = mockChildProcess;
      
      const promise = // @ts-ignore
        lspClient.sendRequest('test/method', { param: 'value' });
      
      const expectedRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "test/method", 
        params: { param: "value" }
      };
      
      const content = JSON.stringify(expectedRequest);
      const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
      
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(header + content);
      
      // Resolve the promise to avoid hanging
      // @ts-ignore
      const responsePromise = lspClient.responsePromises.get(1);
      if (responsePromise) {
        responsePromise.resolve({ result: 'success' });
      }
      
      await expect(promise).resolves.toEqual({ result: 'success' });
    });

    it('should handle request timeout', async () => {
      lspClient = new LspClient({
        ...testConfig,
        timeout: 10 // very short timeout for testing
      });
      // @ts-ignore
      lspClient.childProcess = mockChildProcess;
      
      await expect(
        // @ts-ignore
        lspClient.sendRequest('test/method')
      ).rejects.toThrow('Timeout waiting for response');
    });
  });

  describe('sendNotification', () => {
    it('should log error if process not started', () => {
      lspClient = new LspClient(testConfig);
      
      // @ts-ignore
      lspClient.sendNotification('test/notification');
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('LSP process not started'));
    });

    it('should send notification with proper format', () => {
      lspClient = new LspClient(testConfig);
      // @ts-ignore
      lspClient.childProcess = mockChildProcess;
      
      // @ts-ignore
      lspClient.sendNotification('test/notification', { param: 'value' });
      
      const expectedNotification = {
        jsonrpc: "2.0",
        method: "test/notification",
        params: { param: "value" }
      };
      
      const content = JSON.stringify(expectedNotification);
      const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
      
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(header + content);
    });
  });

  describe('handleMessage', () => {
    it('should handle response messages', async () => {
      lspClient = new LspClient(testConfig);
      
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      // @ts-ignore
      lspClient.responsePromises.set(1, { resolve: mockResolve, reject: mockReject });
      
      const responseMessage = {
        jsonrpc: "2.0",
        id: 1,
        result: { data: "success" }
      };
      
      // @ts-ignore
      await lspClient.handleMessage(responseMessage);
      
      expect(mockResolve).toHaveBeenCalledWith({ data: "success" });
      expect(lspClient.responsePromises.size).toBe(0);
    });

    it('should handle error response messages', async () => {
      lspClient = new LspClient(testConfig);
      
      const mockResolve = jest.fn();
      const mockReject = jest.fn();
      // @ts-ignore
      lspClient.responsePromises.set(1, { resolve: mockResolve, reject: mockReject });
      
      const errorMessage = {
        jsonrpc: "2.0", 
        id: 1,
        error: { code: -32601, message: "Method not found" }
      };
      
      // @ts-ignore
      await lspClient.handleMessage(errorMessage);
      
      expect(mockReject).toHaveBeenCalledWith({ code: -32601, message: "Method not found" });
      expect(lspClient.responsePromises.size).toBe(0);
    });

    it('should handle publishDiagnostics notification', async () => {
      lspClient = new LspClient(testConfig);
      
      const diagnosticsMessage = {
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: {
          uri: "file:///test.ts",
          diagnostics: [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
              severity: 1,
              message: "Error message"
            }
          ]
        }
      };
      
      // @ts-ignore
      await lspClient.handleMessage(diagnosticsMessage);
      
      // @ts-ignore
      expect(lspClient.documentDiagnostics.get("file:///test.ts")).toEqual([
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          severity: 1,
          message: "Error message"
        }
      ]);
    });
  });

  describe('handleData', () => {
    it('should handle incomplete message', () => {
      lspClient = new LspClient(testConfig);
      
      const incompleteData = Buffer.from('Content-Length: 100\r\n\r\n{"jsonrpc":"2.0"');
      // @ts-ignore
      lspClient.handleData(incompleteData);
      
      expect(lspClient.buffer).toBe('Content-Length: 100\r\n\r\n{"jsonrpc":"2.0"');
    });

    it('should handle buffer size limit', () => {
      lspClient = new LspClient({
        ...testConfig,
        maxBufferSize: 10
      });
      
      const largeData = Buffer.from('a'.repeat(20));
      // @ts-ignore
      lspClient.handleData(largeData);
      
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Buffer size exceeded'));
      expect(lspClient.buffer.length).toBeLessThanOrEqual(10);
    });
  });

  // Clean up after all tests
  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });
});