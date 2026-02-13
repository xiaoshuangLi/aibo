import { LspServiceManager } from '../../../src/infrastructure/code-analysis/lsp-service-manager';
import { LspClient } from '../../../src/infrastructure/code-analysis/lsp-client';

// Mock LspClient
jest.mock('../../../src/infrastructure/code-analysis/lsp-client');

describe('LspServiceManager', () => {
  let lspServiceManager: LspServiceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const config = {
      workingDirectory: '/test',
      serverTimeout: 5000
    };

    lspServiceManager = new LspServiceManager(config);
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(lspServiceManager).toBeDefined();
      expect((lspServiceManager as any).config.workingDirectory).toBe('/test');
      expect((lspServiceManager as any).config.serverTimeout).toBe(5000);
    });

    test('should set default server timeout if not provided', () => {
      const config = {
        workingDirectory: '/test'
      };

      const manager = new LspServiceManager(config);
      expect((manager as any).config.serverTimeout).toBe(30000);
    });
  });

  describe('getFileExtension', () => {
    test('should return correct file extension', () => {
      expect((lspServiceManager as any).getFileExtension('/test/file.ts')).toBe('.ts');
      expect((lspServiceManager as any).getFileExtension('/test/file.TS')).toBe('.ts');
      expect((lspServiceManager as any).getFileExtension('/test/file.js')).toBe('.js');
      expect((lspServiceManager as any).getFileExtension('/test/file.jsx')).toBe('.jsx');
      expect((lspServiceManager as any).getFileExtension('/test/file.tsx')).toBe('.tsx');
    });

    test('should handle files without extensions', () => {
      expect((lspServiceManager as any).getFileExtension('/test/file')).toBe('');
    });
  });

  describe('getServerConfig', () => {
    test('should return server config for supported file types', () => {
      const tsConfig = (lspServiceManager as any).getServerConfig('/test/file.ts');
      expect(tsConfig).toEqual({
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test',
        timeout: 5000
      });

      const jsConfig = (lspServiceManager as any).getServerConfig('/test/file.js');
      expect(jsConfig).toEqual({
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test',
        timeout: 5000
      });
    });

    test('should return null for unsupported file types', () => {
      const config = (lspServiceManager as any).getServerConfig('/test/file.py');
      expect(config).toBeNull();
    });
  });

  describe('getOrCreateLspClient', () => {
    test('should return null for unsupported file types', async () => {
      const client = await (lspServiceManager as any).getOrCreateLspClient('/test/file.py');
      expect(client).toBeNull();
    });

    test('should create and cache new LSP client for supported file types', async () => {
      const mockClient = {
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      const client1 = await (lspServiceManager as any).getOrCreateLspClient('/test/file.ts');
      const client2 = await (lspServiceManager as any).getOrCreateLspClient('/test/file.js');

      // Both should be the same cached instance since they use the same server
      expect(client1).toBe(client2);
      expect(LspClientMock).toHaveBeenCalledTimes(1);
      expect(mockClient.start).toHaveBeenCalledTimes(1);
    });

    test('should handle LSP client creation errors', async () => {
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementationOnce(() => {
        throw new Error('Client creation failed');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const client = await (lspServiceManager as any).getOrCreateLspClient('/test/file.ts');
      
      expect(client).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create LSP client for /test/file.ts:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    test('should cache clients by server command and working directory', async () => {
      const mockClient1 = {
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const mockClient2 = {
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementationOnce(() => mockClient1 as any);
      LspClientMock.mockImplementationOnce(() => mockClient2 as any);

      // Same working directory - should use same client
      const client1 = await (lspServiceManager as any).getOrCreateLspClient('/test/file1.ts');
      const client2 = await (lspServiceManager as any).getOrCreateLspClient('/test/file2.js');
      
      expect(client1).toBe(client2);
      expect(LspClientMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDefinition', () => {
    test('should throw error for unsupported file types', async () => {
      await expect(lspServiceManager.getDefinition('/test/file.py', { line: 1, character: 2 }))
        .rejects.toThrow('No LSP server available for file: /test/file.py');
    });

    test('should call LSP client getDefinition method', async () => {
      const mockClient = new LspClient({
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test'
      });
      
      // Mock the methods we need
      mockClient.start = jest.fn().mockResolvedValue(undefined);
      mockClient.getDefinition = jest.fn().mockResolvedValue('definition-result');
      mockClient.shutdown = jest.fn().mockResolvedValue(undefined);
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      const result = await lspServiceManager.getDefinition('/test/file.ts', { line: 5, character: 10 });
      
      expect(result).toBe('definition-result');
      expect(mockClient.getDefinition).toHaveBeenCalledWith('/test/file.ts', { line: 5, character: 10 });
    });

    test('should handle concurrent requests with same ID', async () => {
      const mockClient = {
        start: jest.fn().mockResolvedValue(undefined),
        getDefinition: jest.fn().mockResolvedValue('definition-result'),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      // First request
      const promise1 = lspServiceManager.getDefinition('/test/file.ts', { line: 5, character: 10 });
      
      // Second request with same parameters should throw
      await expect(lspServiceManager.getDefinition('/test/file.ts', { line: 5, character: 10 }))
        .rejects.toThrow('Request already in progress');
      
      // Wait for first request to complete
      await promise1;
    });
  });

  describe('findReferences', () => {
    test('should throw error for unsupported file types', async () => {
      await expect(lspServiceManager.findReferences('/test/file.py', { line: 1, character: 2 }))
        .rejects.toThrow('No LSP server available for file: /test/file.py');
    });

    test('should call LSP client findReferences method', async () => {
      const mockClient = new LspClient({
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test'
      });
      
      // Mock the methods we need
      mockClient.start = jest.fn().mockResolvedValue(undefined);
      mockClient.findReferences = jest.fn().mockResolvedValue('references-result');
      mockClient.shutdown = jest.fn().mockResolvedValue(undefined);
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      const result = await lspServiceManager.findReferences('/test/file.ts', { line: 5, character: 10 });
      
      expect(result).toBe('references-result');
      expect(mockClient.findReferences).toHaveBeenCalledWith('/test/file.ts', { line: 5, character: 10 });
    });

    test('should handle concurrent requests with same ID', async () => {
      const mockClient = {
        start: jest.fn().mockResolvedValue(undefined),
        findReferences: jest.fn().mockResolvedValue('references-result'),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      // First request
      const promise1 = lspServiceManager.findReferences('/test/file.ts', { line: 5, character: 10 });
      
      // Second request with same parameters should throw
      await expect(lspServiceManager.findReferences('/test/file.ts', { line: 5, character: 10 }))
        .rejects.toThrow('Request already in progress');
      
      // Wait for first request to complete
      await promise1;
    });
  });

  describe('getHover', () => {
    test('should throw error for unsupported file types', async () => {
      await expect(lspServiceManager.getHover('/test/file.py', { line: 1, character: 2 }))
        .rejects.toThrow('No LSP server available for file: /test/file.py');
    });

    test('should call LSP client getHover method', async () => {
      const mockClient = new LspClient({
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test'
      });
      
      // Mock the methods we need
      mockClient.start = jest.fn().mockResolvedValue(undefined);
      mockClient.getHover = jest.fn().mockResolvedValue('hover-result');
      mockClient.shutdown = jest.fn().mockResolvedValue(undefined);
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      const result = await lspServiceManager.getHover('/test/file.ts', { line: 5, character: 10 });
      
      expect(result).toBe('hover-result');
      expect(mockClient.getHover).toHaveBeenCalledWith('/test/file.ts', { line: 5, character: 10 });
    });

    test('should handle concurrent requests with same ID', async () => {
      const mockClient = {
        start: jest.fn().mockResolvedValue(undefined),
        getHover: jest.fn().mockResolvedValue('hover-result'),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      // First request
      const promise1 = lspServiceManager.getHover('/test/file.ts', { line: 5, character: 10 });
      
      // Second request with same parameters should throw
      await expect(lspServiceManager.getHover('/test/file.ts', { line: 5, character: 10 }))
        .rejects.toThrow('Request already in progress');
      
      // Wait for first request to complete
      await promise1;
    });
  });

  describe('getWorkspaceSymbols', () => {
    test('should throw error when no LSP server is available', async () => {
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementationOnce(() => {
        throw new Error('Client creation failed');
      });

      await expect(lspServiceManager.getWorkspaceSymbols('MyClass'))
        .rejects.toThrow('No LSP server available for workspace symbols');
    });

    test('should call LSP client getWorkspaceSymbols method', async () => {
      const mockClient = new LspClient({
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test'
      });
      
      // Mock the methods we need
      mockClient.start = jest.fn().mockResolvedValue(undefined);
      mockClient.getWorkspaceSymbols = jest.fn().mockResolvedValue('symbols-result');
      mockClient.shutdown = jest.fn().mockResolvedValue(undefined);
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      const result = await lspServiceManager.getWorkspaceSymbols('MyClass');
      
      expect(result).toBe('symbols-result');
      expect(mockClient.getWorkspaceSymbols).toHaveBeenCalledWith('MyClass');
    });

    test('should handle concurrent workspace symbol requests', async () => {
      const mockClient = {
        start: jest.fn().mockResolvedValue(undefined),
        getWorkspaceSymbols: jest.fn().mockResolvedValue('symbols-result'),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      // First request
      const promise1 = lspServiceManager.getWorkspaceSymbols('MyClass');
      
      // Second request with same query should throw
      await expect(lspServiceManager.getWorkspaceSymbols('MyClass'))
        .rejects.toThrow('Request already in progress');
      
      // Wait for first request to complete
      await promise1;
    });
  });

  describe('shutdownAll', () => {
    test('should shutdown all LSP clients and clear caches', async () => {
      const mockClient1 = {
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const mockClient2 = {
        start: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      } as unknown as LspClient;
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementationOnce(() => mockClient1 as any);
      LspClientMock.mockImplementationOnce(() => mockClient2 as any);

      // Create some clients
      await (lspServiceManager as any).getOrCreateLspClient('/test/file1.ts');
      await (lspServiceManager as any).getOrCreateLspClient('/test/file2.js');

      expect((lspServiceManager as any).serverInstances.size).toBe(1); // Same server type

      await lspServiceManager.shutdownAll();

      expect(mockClient1.shutdown).toHaveBeenCalled();
      expect((lspServiceManager as any).serverInstances.size).toBe(0);
      expect((lspServiceManager as any).activeRequests.size).toBe(0);
    });

    test('should handle shutdown errors gracefully', async () => {
      const mockClient = new LspClient({
        serverCommand: 'typescript-language-server',
        serverArgs: ['--stdio'],
        workingDirectory: '/test'
      });
      
      // Mock the methods we need
      mockClient.start = jest.fn().mockResolvedValue(undefined);
      mockClient.shutdown = jest.fn().mockRejectedValue(new Error('Shutdown failed'));
      
      const LspClientMock = LspClient as jest.MockedClass<typeof LspClient>;
      LspClientMock.mockImplementation(() => mockClient as any);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await (lspServiceManager as any).getOrCreateLspClient('/test/file.ts');
      await lspServiceManager.shutdownAll();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect((lspServiceManager as any).serverInstances.size).toBe(0);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('isSupportedFile', () => {
    test('should return true for supported file types', () => {
      expect(lspServiceManager.isSupportedFile('/test/file.ts')).toBe(true);
      expect(lspServiceManager.isSupportedFile('/test/file.js')).toBe(true);
      expect(lspServiceManager.isSupportedFile('/test/file.jsx')).toBe(true);
      expect(lspServiceManager.isSupportedFile('/test/file.tsx')).toBe(true);
    });

    test('should return false for unsupported file types', () => {
      expect(lspServiceManager.isSupportedFile('/test/file.py')).toBe(false);
      expect(lspServiceManager.isSupportedFile('/test/file.java')).toBe(false);
      expect(lspServiceManager.isSupportedFile('/test/file.go')).toBe(false);
    });

    test('should handle files without extensions', () => {
      expect(lspServiceManager.isSupportedFile('/test/file')).toBe(false);
    });
  });
});