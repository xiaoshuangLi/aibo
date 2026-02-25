import { startLspTool, restartLspServerTool, openDocumentTool, closeDocumentTool, getInfoOnLocationTool, getCompletionsTool, getCodeActionsTool, getDiagnosticsTool, setLogLevelTool } from '@/tools/lsp-tools';

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => true })
}));

jest.mock('@/infrastructure/code-analysis/lsp-client', () => {
  const mockLspClient = {
    initialize: jest.fn().mockResolvedValue(undefined),
    openDocument: jest.fn().mockResolvedValue(undefined),
    closeDocument: jest.fn().mockResolvedValue(undefined),
    getHover: jest.fn().mockResolvedValue({ contents: 'Test function documentation' }),
    getCompletion: jest.fn().mockResolvedValue([{ label: 'console.log', kind: 'method' }]),
    getCodeActions: jest.fn().mockResolvedValue([{ title: 'Add missing import', kind: 'quickfix' }]),
    getDiagnostics: jest.fn().mockResolvedValue({ 'file:///test/project/test.ts': [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }, severity: 1, message: 'Error' }] }),
    restart: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    isRunning: jest.fn().mockReturnValue(true)
  };

  return {
    LspClientManager: {
      getClient: jest.fn().mockResolvedValue(mockLspClient),
      restartClient: jest.fn().mockResolvedValue(mockLspClient)
    }
  };
});

describe('LSP Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startLspTool', () => {
    it('should start LSP server with valid root directory', async () => {
      const result = await startLspTool.invoke({ root_dir: '/test/project' });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toContain('LSP server successfully started with root directory: /test/project');
    });

    it('should throw error for invalid root directory', async () => {
      (require('fs').existsSync as jest.Mock).mockReturnValueOnce(false);
      await expect(startLspTool.invoke({ root_dir: '/non/existent/path' }))
        .rejects.toThrow('Root directory does not exist: /non/existent/path');
    });
  });

  describe('restartLspServerTool', () => {
    it('should restart LSP server when running', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      const result = await restartLspServerTool.invoke({});
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toContain('LSP server successfully restarted');
    });
  });

  describe('openDocumentTool', () => {
    it('should open document with valid file path', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      const result = await openDocumentTool.invoke({ file_path: 'test.ts' });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toContain('File successfully opened: test.ts');
    });

    it('should throw error for non-existent file', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      (require('fs').existsSync as jest.Mock).mockReturnValueOnce(false);
      await expect(openDocumentTool.invoke({ file_path: 'nonexistent.ts' }))
        .rejects.toThrow('Failed to open document: File not found: /test/project/nonexistent.ts');
    });
  });

  describe('closeDocumentTool', () => {
    it('should close document with valid file path', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      const result = await closeDocumentTool.invoke({ file_path: 'test.ts' });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toContain('File successfully closed: test.ts');
    });
  });

  describe('getInfoOnLocationTool', () => {
    it('should get info on location with valid parameters', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      const mockInfo = { contents: 'Test function documentation' };
      (require('@/infrastructure/code-analysis/lsp-client').LspClientManager.getClient as jest.Mock)
        .mockResolvedValueOnce({
          getHover: jest.fn().mockResolvedValue(mockInfo)
        });
      
      const result = await getInfoOnLocationTool.invoke({ 
        file_path: 'test.ts', 
        line: 10, 
        column: 5 
      });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toBe('Test function documentation');
    });
  });

  describe('getCompletionsTool', () => {
    it('should get completions with valid parameters', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      const mockCompletions = [{ label: 'console.log', kind: 'method' }];
      (require('@/infrastructure/code-analysis/lsp-client').LspClientManager.getClient as jest.Mock)
        .mockResolvedValueOnce({
          getCompletion: jest.fn().mockResolvedValue(mockCompletions)
        });
      
      const result = await getCompletionsTool.invoke({ 
        file_path: 'test.ts', 
        line: 10, 
        column: 5 
      });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toContain('console.log');
    });
  });

  describe('getCodeActionsTool', () => {
    it('should get code actions with valid parameters', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      const mockCodeActions = [{ title: 'Add missing import', kind: 'quickfix' }];
      (require('@/infrastructure/code-analysis/lsp-client').LspClientManager.getClient as jest.Mock)
        .mockResolvedValueOnce({
          getCodeActions: jest.fn().mockResolvedValue(mockCodeActions)
        });
      
      const result = await getCodeActionsTool.invoke({ 
        file_path: 'test.ts', 
        start_line: 10, 
        start_column: 5,
        end_line: 10,
        end_column: 10
      });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toContain('Add missing import');
    });
  });

  describe('getDiagnosticsTool', () => {
    it('should get diagnostics for valid file', async () => {
      // First start the LSP server
      await startLspTool.invoke({ root_dir: '/test/project' });
      const mockDiagnostics = { 'file:///test/project/test.ts': [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }, severity: 1, message: 'Error' }] };
      (require('@/infrastructure/code-analysis/lsp-client').LspClientManager.getClient as jest.Mock)
        .mockResolvedValueOnce({
          getDiagnostics: jest.fn().mockResolvedValue(mockDiagnostics)
        });
      
      const result = await getDiagnosticsTool.invoke({ file_path: 'test.ts' });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.content[0].text).toContain('Error');
    });
  });

  describe('setLogLevelTool', () => {
    it('should set valid log level', async () => {
      const result = await setLogLevelTool.invoke({ level: 'debug' });
      expect(result).toContain('Log level set to: debug');
    });

    it('should throw error for invalid log level', async () => {
      await expect(setLogLevelTool.invoke({ level: 'invalid' as any }))
        .rejects.toThrow('Invalid option: expected one of "debug"|"info"|"notice"|"warning"|"error"|"critical"|"alert"|"emergency"');
    });
  });
});