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
      queryDependencies: jest.fn(),
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

    test('should handle multiple LSP definitions correctly', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockResolvedValue([
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 20 }
          }
        },
        {
          range: {
            start: { line: 10, character: 0 },
            end: { line: 10, character: 25 }
          }
        }
      ]);
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockReadFile.mockResolvedValue('function testFunction() {}\n\nfunction anotherFunction() {}');
      mockTreeSitterTool.queryFunctions.mockResolvedValue([
        { 
          type: 'function_declaration', 
          text: 'function testFunction() {}', 
          startPosition: { row: 0, column: 0 }, 
          endPosition: { row: 0, column: 25 } 
        },
        { 
          type: 'function_declaration', 
          text: 'function anotherFunction() {}', 
          startPosition: { row: 2, column: 0 }, 
          endPosition: { row: 2, column: 30 } 
        }
      ]);
      mockTreeSitterTool.queryClasses.mockResolvedValue([]);
      mockTreeSitterTool.queryInterfaces.mockResolvedValue([]);
      mockTreeSitterTool.queryTypeDefinitions.mockResolvedValue([]);
      mockTreeSitterTool.queryVariables.mockResolvedValue([]);
      
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 0, 0);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('testFunction');
      expect(result.kind).toBe(12); // Function
      expect(result.location).toEqual({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 20 }
        }
      });
      expect(result.detail).toBe('function testFunction() {}');
    });

    test('should handle Tree-sitter signature extraction failure gracefully', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockResolvedValue({
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 20 }
        }
      });
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.queryFunctions.mockRejectedValue(new Error('Tree-sitter query failed'));
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 0, 0);
      
      expect(result).toBeDefined();
      expect(result.range).toBeDefined(); // Should use original LSP result
      expect(consoleWarnSpy).toHaveBeenCalledWith('Tree-sitter failed to extract signature, using LSP result:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
    });

    test('should handle Tree-sitter symbol extraction failure in fallback', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockRejectedValue(new Error('LSP error'));
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.queryFunctions.mockRejectedValue(new Error('Tree-sitter query failed'));
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 0, 0);
      
      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Tree-sitter definition failed:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    test('should handle precise position matching in Tree-sitter fallback', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.getDefinition.mockRejectedValue(new Error('LSP error'));
      
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockReadFile.mockResolvedValue('class MyClass {\n  myMethod() {\n    return "test";\n  }\n}');
      mockTreeSitterTool.queryFunctions.mockResolvedValue([]);
      mockTreeSitterTool.queryClasses.mockResolvedValue([
        { 
          type: 'class_declaration', 
          text: 'class MyClass {\n  myMethod() {\n    return "test";\n  }\n}', 
          startPosition: { row: 0, column: 0 }, 
          endPosition: { row: 4, column: 1 } 
        }
      ]);
      mockTreeSitterTool.queryInterfaces.mockResolvedValue([]);
      mockTreeSitterTool.queryTypeDefinitions.mockResolvedValue([]);
      mockTreeSitterTool.queryVariables.mockResolvedValue([]);
      
      // Test with position inside the class
      const result = await astAbstractLayer.getDefinition('/test/file.ts', 1, 2);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('MyClass');
      expect(result.kind).toBe(7); // Class
      expect(result.location.uri).toBe('/test/file.ts');
      expect(result.detail).toContain('class MyClass');
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

    test('should handle symbol table with no matching symbol in findReferences', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.findReferences.mockRejectedValue(new Error('LSP error'));
      
      mockSymbolTable.isBuiltTable.mockReturnValue(true);
      mockSymbolTable.getFileSymbols.mockReturnValue([
        { 
          name: 'otherFunction', 
          type: 'function', 
          location: { filePath: '/test/file.ts', line: 10, character: 0 }, 
          isExported: true, 
          references: [], 
          dependencies: [] 
        }
      ]);
      
      const result = await astAbstractLayer.findReferences('/test/file.ts', 5, 10);
      
      expect(result).toBeUndefined();
    });

    test('should handle symbol table reference processing correctly', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockLspTool.findReferences.mockRejectedValue(new Error('LSP error'));
      
      mockSymbolTable.isBuiltTable.mockReturnValue(true);
      mockSymbolTable.getFileSymbols.mockReturnValue([
        { 
          name: 'testFunction', 
          type: 'function', 
          location: { filePath: '/test/file.ts', line: 5, character: 0 }, 
          isExported: true, 
          references: [
            { filePath: '/test/file.ts', line: 10, character: 5 },
            { filePath: '/test/other.ts', line: 15, character: 8 }
          ], 
          dependencies: [] 
        }
      ]);
      
      const result = await astAbstractLayer.findReferences('/test/file.ts', 5, 0);
      
      expect(result).toEqual([
        { filePath: '/test/file.ts', line: 10, character: 5 },
        { filePath: '/test/other.ts', line: 15, character: 8 }
      ]);
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

    test('should apply intelligent truncation when token limit is exceeded', async () => {
      // Create content that will exceed token limits after comment removal
      const largeContent = 'function largeFunction() {\n' + 
        '  // This is a very large function with many lines\n'.repeat(100) +
        '}';
      mockReadFile.mockResolvedValue(largeContent);
      
      let callCount = 0;
      const estimateSpy = jest.spyOn((await import('@/infrastructure/code-analysis/token-counter')).TokenCounter, 'estimateTokenCount')
        .mockImplementation((text) => {
          callCount++;
          if (callCount === 1) {
            // Original content
            return 1000;
          } else {
            // Truncated content
            return 50;
          }
        });
      
      let truncateCalled = false;
      const truncateSpy = jest.spyOn((await import('@/infrastructure/code-analysis/token-counter')).TokenCounter, 'truncateToTokenLimit')
        .mockImplementation((text, maxTokens, preserveStructure) => {
          truncateCalled = true;
          return text.substring(0, 50) + '...';
        });
      
      const result = await astAbstractLayer.optimizeContext('/test/file.ts', { maxTokens: 10 });
      
      expect(truncateCalled).toBe(true);
      expect(result.optimizedTokens).toBeLessThan(result.originalTokens);
      expect(result.savingsPercentage).toBeGreaterThan(0);
      expect(result.technologiesUsed).toContain('symbol-table'); // Indicates truncation was used
      
      estimateSpy.mockRestore();
      truncateSpy.mockRestore();
    });

    test('should handle token counting and optimization correctly', async () => {
      const content = 'function test() {\n  console.log("hello world");\n}';
      mockReadFile.mockResolvedValue(content);
      
      // Mock TokenCounter.estimateTokenCount to return predictable values
      const estimateSpy = jest.spyOn((await import('@/infrastructure/code-analysis/token-counter')).TokenCounter, 'estimateTokenCount')
        .mockImplementation((text) => {
          if (text === content) return 20;
          if (text.includes('console.log')) return 15;
          return 10;
        });
      
      const result = await astAbstractLayer.optimizeContext('/test/file.ts', { maxTokens: 15 });
      
      expect(result.originalTokens).toBe(20);
      expect(result.optimizedTokens).toBeLessThanOrEqual(15);
      expect(result.savingsPercentage).toBeGreaterThanOrEqual(0);
      
      estimateSpy.mockRestore();
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

    test('should handle empty string correctly', () => {
      const emptyCount = (astAbstractLayer as any).estimateTokenCount('');
      expect(emptyCount).toBe(0);
    });

    test('should handle whitespace-only string correctly', () => {
      const whitespaceCount = (astAbstractLayer as any).estimateTokenCount('   \n\t  ');
      // TokenCounter counts whitespace characters, so this should be > 0
      expect(whitespaceCount).toBeGreaterThan(0);
    });
  });

  describe('private methods', () => {
    test('should handle estimateTokenCount correctly', () => {
      const count = (astAbstractLayer as any).estimateTokenCount('test string');
      expect(count).toBeGreaterThan(0);
    });

    test('should handle removeCommentsAndWhitespace correctly', () => {
      const code = 'function test() {\n  // comment\n  return "test";\n}';
      const result = (astAbstractLayer as any).removeCommentsAndWhitespace(code);
      expect(result).not.toContain('// comment');
      expect(result).toContain('function test()');
    });

    test('should handle readFile correctly', async () => {
      mockReadFile.mockResolvedValue('test content');
      const result = await (astAbstractLayer as any).readFile('/test/file.ts');
      expect(result).toBe('test content');
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

    test('should force refresh symbol table when requested', async () => {
      mockSymbolTable.isBuiltTable.mockReturnValue(true);
      mockSymbolTable.getFileSymbols.mockReturnValue([
        { name: 'test', type: 'function', location: { filePath: '/test/file.ts', line: 1, character: 0 }, isExported: true, references: [], dependencies: [] }
      ]);
      
      // First call without force refresh
      await astAbstractLayer.getFileSymbols('/test/file.ts', false);
      // Second call with force refresh
      await astAbstractLayer.getFileSymbols('/test/file.ts', true);
      
      expect(mockSymbolTable.build).toHaveBeenCalledWith(['/test/file.ts']);
      expect(mockSymbolTable.getFileSymbols).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFileDependencies', () => {
    test('should return cached result when available', async () => {
      const cachedResult = {
        filePath: '/test/file.ts',
        imports: [],
        exports: [],
        externalDependencies: [],
        internalDependencies: []
      };
      (astAbstractLayer as any).cache.set('dependencies:/test/file.ts', cachedResult);
      
      const result = await astAbstractLayer.getFileDependencies('/test/file.ts');
      expect(result).toBe(cachedResult);
    });

    test('should use Tree-sitter for dependency analysis when supported', async () => {
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.queryDependencies.mockResolvedValue({
        imports: [
          { type: 'import_statement', text: 'import { helper } from \'./utils\';', startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 35 } },
          { type: 'import_statement', text: 'import _ from \'lodash\';', startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 25 } }
        ],
        exports: []
      });
      
      const result = await astAbstractLayer.getFileDependencies('/test/file.ts');
      
      expect(result.filePath).toBe('/test/file.ts');
      expect(result.externalDependencies).toContain('lodash');
      expect(result.internalDependencies).toContain('./utils');
      expect(mockTreeSitterTool.queryDependencies).toHaveBeenCalledWith('/test/file.ts');
    });

    test('should fallback to regex-based analysis when Tree-sitter fails', async () => {
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.queryDependencies.mockRejectedValue(new Error('Tree-sitter error'));
      
      mockReadFile.mockResolvedValue(`
        import { helper } from './utils';
        import _ from 'lodash';
        export { myFunction } from './other';
      `);
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await astAbstractLayer.getFileDependencies('/test/file.ts');
      
      expect(result.filePath).toBe('/test/file.ts');
      expect(result.externalDependencies).toContain('lodash');
      expect(result.internalDependencies).toContain('./utils');
      expect(result.internalDependencies).toContain('./other');
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Dependency analysis failed:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    test('should handle unsupported files with regex fallback', async () => {
      mockTreeSitterTool.isSupportedFile.mockReturnValue(false);
      mockReadFile.mockResolvedValue(`
        import React from 'react';
        import { Component } from './components';
      `);
      
      const result = await astAbstractLayer.getFileDependencies('/test/file.tsx');
      
      expect(result.filePath).toBe('/test/file.tsx');
      expect(result.externalDependencies).toContain('react');
      expect(result.internalDependencies).toContain('./components');
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
    });

    test('should handle empty or invalid file content gracefully', async () => {
      mockTreeSitterTool.isSupportedFile.mockReturnValue(false);
      mockReadFile.mockResolvedValue('');
      
      const result = await astAbstractLayer.getFileDependencies('/test/empty.ts');
      
      expect(result.filePath).toBe('/test/empty.ts');
      expect(result.externalDependencies).toEqual([]);
      expect(result.internalDependencies).toEqual([]);
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
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

    test('should handle empty cache gracefully', () => {
      // Cache is already empty
      expect((astAbstractLayer as any).cache.size).toBe(0);
      
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

    test('should handle non-existent file paths gracefully', async () => {
      // Add some cache entries
      await astAbstractLayer.getDefinition('/test/existing.ts', 5, 10);
      const initialSize = (astAbstractLayer as any).cache.size;
      
      // Invalidate a non-existent file
      astAbstractLayer.invalidateFileCache('/test/non-existent.ts');
      
      // Cache size should remain the same
      expect((astAbstractLayer as any).cache.size).toBe(initialSize);
    });

    test('should handle empty cache gracefully', () => {
      // Cache is empty
      expect((astAbstractLayer as any).cache.size).toBe(0);
      
      astAbstractLayer.invalidateFileCache('/test/any-file.ts');
      
      expect((astAbstractLayer as any).cache.size).toBe(0);
    });

    test('should handle partial file path matches correctly', async () => {
      // Add a simple cache entry
      (astAbstractLayer as any).cache.set('definition:/test/file.ts:5:10', 'test-value');
      (astAbstractLayer as any).cache.set('definition:/test/subdir/file.ts:5:10', 'test-value2');
      
      const initialSize = (astAbstractLayer as any).cache.size;
      
      // Invalidate only the exact match
      astAbstractLayer.invalidateFileCache('/test/file.ts');
      
      // Should remove only keys containing '/test/file.ts' but not others
      expect((astAbstractLayer as any).cache.has('definition:/test/file.ts:5:10')).toBe(false);
      expect((astAbstractLayer as any).cache.has('definition:/test/subdir/file.ts:5:10')).toBe(true);
      expect((astAbstractLayer as any).cache.size).toBe(initialSize - 1);
    });
  });
});