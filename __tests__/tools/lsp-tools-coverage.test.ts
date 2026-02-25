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
    getDiagnostics: jest.fn().mockResolvedValue([]),
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

describe('LSP Tools Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should cover all LSP tool operations successfully', async () => {
    // Test startLspTool
    const startResult = await startLspTool.invoke({ root_dir: '/test/project' });
    expect(startResult).toContain('LSP server successfully started');

    // Test restartLspServerTool
    const restartResult = await restartLspServerTool.invoke({ root_dir: '/test/project' });
    expect(restartResult).toContain('LSP server successfully restarted');

    // Test openDocumentTool
    const openResult = await openDocumentTool.invoke({ file_path: '/test/file.ts' });
    expect(openResult).toContain('File successfully opened');

    // Test closeDocumentTool
    const closeResult = await closeDocumentTool.invoke({ file_path: '/test/file.ts' });
    expect(closeResult).toContain('File successfully closed');

    // Test getInfoOnLocationTool
    const infoResult = await getInfoOnLocationTool.invoke({ 
      file_path: '/test/file.ts', 
      line: 1, 
      column: 1 
    });
    expect(infoResult).toContain('Test function documentation');

    // Test getCompletionsTool
    const completionsResult = await getCompletionsTool.invoke({ 
      file_path: '/test/file.ts', 
      line: 1, 
      column: 1 
    });
    expect(completionsResult).toContain('console.log');

    // Test getCodeActionsTool
    const codeActionsResult = await getCodeActionsTool.invoke({ 
      file_path: '/test/file.ts', 
      start_line: 1, 
      start_column: 1,
      end_line: 1,
      end_column: 5
    });
    expect(codeActionsResult).toContain('Add missing import');

    // Test getDiagnosticsTool
    const diagnosticsResult = await getDiagnosticsTool.invoke({ 
      file_path: '/test/file.ts' 
    });
    expect(diagnosticsResult).toContain('file:///test/file.ts');

    // Test setLogLevelTool
    const logLevelResult = await setLogLevelTool.invoke({ level: 'debug' });
    expect(logLevelResult).toContain('Log level set to: debug');
  });

  it('should handle basic edge cases', async () => {
    // Test with valid but boundary values
    const boundaryResult = await getCompletionsTool.invoke({ 
      file_path: '/test/file.ts', 
      line: 0, 
      column: 0 
    });
    expect(boundaryResult).toContain('console.log');
  });
});