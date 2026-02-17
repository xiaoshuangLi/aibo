import { AstAbstractLayer } from '@/infrastructure/code-analysis/ast-abstract-layer';
import { LspTool } from '@/infrastructure/code-analysis/lsp-tool';
import { TreeSitterTool } from '@/infrastructure/code-analysis/tree-sitter-tool';
import { SymbolTable } from '@/infrastructure/code-analysis/symbol-table';

// Mock all dependencies
jest.mock('../../../src/infrastructure/code-analysis/lsp-tool');
jest.mock('../../../src/infrastructure/code-analysis/tree-sitter-tool');
jest.mock('../../../src/infrastructure/code-analysis/symbol-table');

// Mock fs.promises for readFile
const mockReadFile = jest.fn();
jest.mock('fs', () => ({
  promises: {
    readFile: mockReadFile
  }
}));

describe('AstAbstractLayer', () => {
  let astAbstractLayer: AstAbstractLayer;
  let mockLspTool: jest.Mocked<LspTool>;
  let mockTreeSitterTool: jest.Mocked<TreeSitterTool>;
  let mockSymbolTable: jest.Mocked<SymbolTable>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockLspTool = {
      isSupportedFile: jest.fn(),
      getDefinition: jest.fn(),
      findReferences: jest.fn(),
      getHover: jest.fn(),
      startServer: jest.fn(),
      stopServer: jest.fn(),
      isServerRunning: jest.fn()
    } as any;

    mockTreeSitterTool = {
      isSupportedFile: jest.fn(),
      queryFunctions: jest.fn(),
      queryClasses: jest.fn(),
      queryInterfaces: jest.fn(),
      queryTypeDefinitions: jest.fn(),
      queryVariables: jest.fn(),
      queryImports: jest.fn(),
      queryExports: jest.fn(),
      extractPublicApi: jest.fn(),
      parseFile: jest.fn()
    } as any;

    mockSymbolTable = {
      isBuiltTable: jest.fn(),
      getFileSymbols: jest.fn(),
      build: jest.fn(),
      findSymbol: jest.fn(),
      getAllSymbols: jest.fn(),
      updateFile: jest.fn(),
      clear: jest.fn()
    } as any;

    const config = {
      workingDirectory: '/test',
      lspTool: mockLspTool,
      treeSitterTool: mockTreeSitterTool,
      symbolTable: mockSymbolTable
    };

    astAbstractLayer = new AstAbstractLayer(config);
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(astAbstractLayer).toBeDefined();
      expect((astAbstractLayer as any).config.workingDirectory).toBe('/test');
      expect((astAbstractLayer as any).cache.size).toBe(0);
    });
  });

  describe('getDefinition', () => {
    test('should return cached result when available', async () => {
      const cachedResult = 'cached-definition';
      (astAbstractLayer as any).cache.set('definition:/test/file.ts:5:10', cachedResult);
      
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 5, 10);
      expect(result).toBe(cachedResult);
      expect(mockLspTool.getDefinition).not.toHaveBeenCalled();
    });

    test('should use LSP when available and supported', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockResolvedValue('lsp-definition-result');
      
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 5, 10);
      
      expect(result).toBe('lsp-definition-result');
      expect(mockLspTool.getDefinition).toHaveBeenCalledWith('/test/file.ts', 5, 10);
      expect(mockTreeSitterTool.queryFunctions).not.toHaveBeenCalled();
      expect(mockSymbolTable.getFileSymbols).not.toHaveBeenCalled();
    });

    test('should fallback to Tree-sitter when LSP fails', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockRejectedValue(new Error('LSP error'));
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.queryFunctions.mockResolvedValue([
        { 
          type: 'function_declaration', 
          text: 'function testFunction() {}', 
          startPosition: { row: 0, column: 0 }, 
          endPosition: { row: 10, column: 25 } 
        }
      ]);
      mockTreeSitterTool.queryClasses.mockResolvedValue([]);
      mockTreeSitterTool.queryInterfaces.mockResolvedValue([]);
      mockTreeSitterTool.queryTypeDefinitions.mockResolvedValue([]);
      mockTreeSitterTool.queryVariables.mockResolvedValue([]);
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockReadFile.mockResolvedValue('function testFunction() {}');
      
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 0, 0);
      
      // Check if there were any errors
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      expect(result).toBeDefined();
      expect(result.name).toBe('testFunction');
      expect(result.kind).toBe(12); // Function
      expect(mockLspTool.getDefinition).toHaveBeenCalled();
      expect(mockTreeSitterTool.queryFunctions).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('LSP definition failed, falling back to Tree-sitter:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should fallback to symbol table when both LSP and Tree-sitter fail', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockRejectedValue(new Error('LSP error'));
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.queryFunctions.mockRejectedValue(new Error('Tree-sitter error'));
      
      mockSymbolTable.isBuiltTable.mockReturnValue(true);
      mockSymbolTable.getFileSymbols.mockReturnValue([
        { 
          name: 'test', 
          type: 'function', 
          location: { filePath: '/test/file.ts', line: 5, character: 0 }, 
          isExported: true, 
          references: [], 
          dependencies: [] 
        }
      ]);
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 5, 10);
      
      expect(result).toBeDefined();
      expect(mockSymbolTable.getFileSymbols).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('LSP definition failed, falling back to Tree-sitter:', expect.any(Error));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Tree-sitter definition failed:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should cache successful results', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockResolvedValue('definition-result');
      
      const result1 = await astAbstractLayer.getDefinition('/test/file.ts', 5, 10);
      const result2 = await astAbstractLayer.getDefinition('/test/file.ts', 5, 10);
      
      expect(result1).toBe('definition-result');
      expect(result2).toBe('definition-result');
      expect(mockLspTool.getDefinition).toHaveBeenCalledTimes(1); // Should only be called once due to caching
    });

    test('should return undefined when no backend is available', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(false);
      mockTreeSitterTool.isSupportedFile.mockReturnValue(false);
      mockSymbolTable.isBuiltTable.mockReturnValue(false);
      
      const result = await astAbstractLayer.getDefinition('/test/file.py', 5, 10);
      expect(result).toBeUndefined();
    });
  });

  describe('findReferences', () => {
    test('should return cached result when available', async () => {
      const cachedResult = ['ref1', 'ref2'];
      (astAbstractLayer as any).cache.set('references:/test/file.ts:5:10', cachedResult);
      
      const result = await astAbstractLayer.findReferences('/test/file.ts', 5, 10);
      expect(result).toBe(cachedResult);
      expect(mockLspTool.findReferences).not.toHaveBeenCalled();
    });

    test('should use LSP when available and supported', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.findReferences.mockResolvedValue(['ref1', 'ref2']);
      
      const result = await astAbstractLayer.findReferences('/test/file.ts', 5, 10);
      
      expect(result).toEqual(['ref1', 'ref2']);
      expect(mockLspTool.findReferences).toHaveBeenCalledWith('/test/file.ts', 5, 10);
      expect(mockSymbolTable.getFileSymbols).not.toHaveBeenCalled();
    });

    test('should fallback to symbol table when LSP fails', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.findReferences.mockRejectedValue(new Error('LSP error'));
      
      mockSymbolTable.isBuiltTable.mockReturnValue(true);
      mockSymbolTable.getFileSymbols.mockReturnValue([
        { 
          name: 'test', 
          type: 'function', 
          location: { filePath: '/test/file.ts', line: 5, character: 0 }, 
          isExported: true, 
          references: [
            { filePath: '/test/file.ts', line: 10, character: 5 },
            { filePath: '/test/file.ts', line: 15, character: 8 }
          ], 
          dependencies: [] 
        }
      ]);
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await astAbstractLayer.findReferences('/test/file.ts', 5, 10);
      
      expect(result).toEqual([
        { filePath: '/test/file.ts', line: 10, character: 5 },
        { filePath: '/test/file.ts', line: 15, character: 8 }
      ]);
      expect(mockLspTool.findReferences).toHaveBeenCalled();
      expect(mockSymbolTable.getFileSymbols).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('LSP references failed, falling back to symbol table:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
    });

    test('should cache successful results', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.findReferences.mockResolvedValue(['ref1', 'ref2']);
      
      const result1 = await astAbstractLayer.findReferences('/test/file.ts', 5, 10);
      const result2 = await astAbstractLayer.findReferences('/test/file.ts', 5, 10);
      
      expect(result1).toEqual(['ref1', 'ref2']);
      expect(result2).toEqual(['ref1', 'ref2']);
      expect(mockLspTool.findReferences).toHaveBeenCalledTimes(1); // Should only be called once due to caching
    });
  });

  describe('getHover', () => {
    test('should return cached result when available', async () => {
      const cachedResult = 'hover-info';
      (astAbstractLayer as any).cache.set('hover:/test/file.ts:5:10', cachedResult);
      
      const result = await astAbstractLayer.getHover('/test/file.ts', 5, 10);
      expect(result).toBe(cachedResult);
      expect(mockLspTool.getHover).not.toHaveBeenCalled();
    });

    test('should use LSP when available and supported', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getHover.mockResolvedValue('hover-result');
      
      const result = await astAbstractLayer.getHover('/test/file.ts', 5, 10);
      
      expect(result).toBe('hover-result');
      expect(mockLspTool.getHover).toHaveBeenCalledWith('/test/file.ts', 5, 10);
    });

    test('should cache successful results', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getHover.mockResolvedValue('hover-result');
      
      const result1 = await astAbstractLayer.getHover('/test/file.ts', 5, 10);
      const result2 = await astAbstractLayer.getHover('/test/file.ts', 5, 10);
      
      expect(result1).toBe('hover-result');
      expect(result2).toBe('hover-result');
      expect(mockLspTool.getHover).toHaveBeenCalledTimes(1); // Should only be called once due to caching
    });

    test('should return undefined when LSP is not supported', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(false);
      
      const result = await astAbstractLayer.getHover('/test/file.py', 5, 10);
      expect(result).toBeUndefined();
    });
  });

  describe('optimizeContext', () => {
    test('should return cached result when available', async () => {
      const cachedResult = {
        context: 'optimized code',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: []
      };
      (astAbstractLayer as any).cache.set('optimize:/test/file.ts:{}', cachedResult);
      
      const result = await astAbstractLayer.optimizeContext('/test/file.ts');
      expect(result).toBe(cachedResult);
    });

    test('should optimize context without publicOnly option', async () => {
      // Mock file reading
      mockReadFile.mockResolvedValue('function test() {\n  // comment\n  console.log("test");\n}');
      
      const result = await astAbstractLayer.optimizeContext('/test/file.ts');
      
      expect(result.context).toContain('function test()');
      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.optimizedTokens).toBeGreaterThan(0);
      expect(result.savingsPercentage).toBeGreaterThanOrEqual(0);
      expect(result.technologiesUsed).toEqual([]);
    });

    test('should extract public API when publicOnly is true', async () => {
      // Mock file reading
      mockReadFile.mockResolvedValue('function test() {\n  // comment\n  console.log("test");\n}');
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.extractPublicApi.mockResolvedValue([
        { type: 'function_declaration', text: 'function publicFunc() {}', startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 25 } }
      ]);
      
      const result = await astAbstractLayer.optimizeContext('/test/file.ts', { publicOnly: true });
      
      expect(result.context).toContain('function publicFunc() {}');
      expect(result.technologiesUsed).toContain('tree-sitter');
    });

    test('should handle public API extraction failure gracefully', async () => {
      // Mock file reading
      mockReadFile.mockResolvedValue('function test() {\n  // comment\n  console.log("test");\n}');
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.extractPublicApi.mockRejectedValue(new Error('Extraction failed'));
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await astAbstractLayer.optimizeContext('/test/file.ts', { publicOnly: true });
      
      expect(result.context).toContain('function test()');
      expect(result.technologiesUsed).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Tree-sitter public API extraction failed:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
    });

    test('should apply comment and whitespace removal for optimization', async () => {
      // Mock file reading with content containing comments
      const contentWithComments = 'function test() {\n  // This is a comment\n  console.log("test");\n  /* Multi-line\n     comment */\n}';
      mockReadFile.mockResolvedValue(contentWithComments);
      
      // Use a very small maxTokens to trigger comment removal
      const result = await astAbstractLayer.optimizeContext('/test/file.ts', { maxTokens: 1 });
      
      expect(result.context).not.toContain('// This is a comment');
      expect(result.context).not.toContain('/* Multi-line');
      expect(result.context).not.toContain('comment */');
    });
  });

  describe('estimateTokenCount', () => {
    test('should estimate token count correctly', () => {
      const shortText = 'hello';
      const longText = 'hello world this is a longer text';
      
      const shortCount = (astAbstractLayer as any).estimateTokenCount(shortText);
      const longCount = (astAbstractLayer as any).estimateTokenCount(longText);
      
      // Based on TokenCounter's actual implementation:
      // shortText: charCount=5, wordCount=1 -> Math.ceil(5*0.25 + 1*0.75) = Math.ceil(2) = 2
      // longText: charCount=33, wordCount=7 -> Math.ceil(33*0.25 + 7*0.75) = Math.ceil(13.5) = 14
      expect(shortCount).toBe(2);
      expect(longCount).toBe(14);
    });
  });

  describe('removeCommentsAndWhitespace', () => {
    test('should remove single line comments', () => {
      const code = 'function test() {\n  // This is a comment\n  console.log("test");\n}';
      const result = (astAbstractLayer as any).removeCommentsAndWhitespace(code);
      
      expect(result).not.toContain('// This is a comment');
      expect(result).toContain('function test()');
      expect(result).toContain('console.log("test");');
    });

    test('should remove multi-line comments', () => {
      const code = 'function test() {\n  /* This is a\n     multi-line comment */\n  console.log("test");\n}';
      const result = (astAbstractLayer as any).removeCommentsAndWhitespace(code);
      
      expect(result).not.toContain('/* This is a');
      expect(result).not.toContain('multi-line comment */');
      expect(result).toContain('function test()');
      expect(result).toContain('console.log("test");');
    });

    test('should remove extra whitespace', () => {
      const code = '\n\nfunction test() {\n  \n  console.log("test");\n  \n}\n\n';
      const result = (astAbstractLayer as any).removeCommentsAndWhitespace(code);
      
      expect(result).not.toMatch(/^\s+/);
      expect(result).not.toMatch(/\s+$/);
      expect(result).not.toContain('\n\n\n'); // Multiple blank lines
    });
  });

  describe('getFileSymbols', () => {
    test('should return symbols from symbol table when built', async () => {
      mockSymbolTable.isBuiltTable.mockReturnValue(true);
      mockSymbolTable.getFileSymbols.mockReturnValue([
        { name: 'test', type: 'function', location: { filePath: '/test/file.ts', line: 1, character: 0 }, isExported: true, references: [], dependencies: [] }
      ]);
      
      const result = await astAbstractLayer.getFileSymbols('/test/file.ts');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test');
      expect(mockSymbolTable.build).not.toHaveBeenCalled();
    });

    test('should build symbol table when not built', async () => {
      mockSymbolTable.isBuiltTable.mockReturnValue(false);
      mockSymbolTable.getFileSymbols.mockReturnValue([
        { name: 'test', type: 'function', location: { filePath: '/test/file.ts', line: 1, character: 0 }, isExported: true, references: [], dependencies: [] }
      ]);
      
      const result = await astAbstractLayer.getFileSymbols('/test/file.ts');
      
      expect(result).toHaveLength(1);
      expect(mockSymbolTable.build).toHaveBeenCalledWith(['/test/file.ts']);
      expect(mockSymbolTable.getFileSymbols).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache', () => {
    test('should clear all cached data', async () => {
      // Mock successful responses to ensure caching
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockResolvedValue('definition-result');
      mockLspTool.findReferences.mockResolvedValue(['ref1']);
      
      // Add some cached data
      await astAbstractLayer.getDefinition('/test/file.ts', 5, 10);
      await astAbstractLayer.findReferences('/test/file.ts', 5, 10);
      
      expect((astAbstractLayer as any).cache.size).toBeGreaterThan(0);
      
      astAbstractLayer.clearCache();
      
      expect((astAbstractLayer as any).cache.size).toBe(0);
    });
  });

  describe('invalidateFileCache', () => {
    test('should invalidate cache entries for specific file', async () => {
      // Mock successful responses to ensure caching
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockResolvedValue('definition-result');
      mockLspTool.findReferences.mockResolvedValue(['ref1']);
      
      // Add cache entries for different files
      await astAbstractLayer.getDefinition('/test/file1.ts', 5, 10);
      await astAbstractLayer.getDefinition('/test/file2.ts', 5, 10);
      await astAbstractLayer.findReferences('/test/file1.ts', 5, 10);
      
      expect((astAbstractLayer as any).cache.size).toBeGreaterThan(2);
      
      astAbstractLayer.invalidateFileCache('/test/file1.ts');
      
      // Should have removed entries for file1.ts but kept file2.ts
      expect((astAbstractLayer as any).cache.has('definition:/test/file2.ts:5:10')).toBe(true);
    });
  });
});