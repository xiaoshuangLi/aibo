import { SymbolTable, SymbolType } from '@/infrastructure/code-analysis/symbol-table';
import { LspTool } from '@/infrastructure/code-analysis/lsp-tool';
import { TreeSitterTool } from '@/infrastructure/code-analysis/tree-sitter-tool';

// Mock implementations
jest.mock('../../../src/infrastructure/code-analysis/lsp-tool');
jest.mock('../../../src/infrastructure/code-analysis/tree-sitter-tool');

describe('SymbolTable', () => {
  let symbolTable: SymbolTable;
  let mockLspTool: jest.Mocked<LspTool>;
  let mockTreeSitterTool: jest.Mocked<TreeSitterTool>;

  beforeEach(() => {
    // Create mock instances
    mockLspTool = {
      isSupportedFile: jest.fn(),
      getWorkspaceSymbols: jest.fn(),
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
      queryExports: jest.fn()
    } as any;

    const config = {
      workingDirectory: '/test',
      lspTool: mockLspTool,
      treeSitterTool: mockTreeSitterTool
    };

    symbolTable = new SymbolTable(config);
  });

  describe('constructor', () => {
    test('should initialize with empty symbols and fileSymbols', () => {
      expect(symbolTable).toBeDefined();
      // We can't directly access private properties, but we can test public methods
      expect(symbolTable.isBuiltTable()).toBe(false);
    });
  });

  describe('build', () => {
    test('should build symbol table from file list', async () => {
      const filePaths = ['file1.ts', 'file2.js'];
      
      // Mock file processing
      (symbolTable as any).processFile = jest.fn().mockResolvedValue(undefined);
      
      await symbolTable.build(filePaths);
      
      expect((symbolTable as any).processFile).toHaveBeenCalledTimes(2);
      expect((symbolTable as any).processFile).toHaveBeenCalledWith('file1.ts');
      expect((symbolTable as any).processFile).toHaveBeenCalledWith('file2.js');
      expect(symbolTable.isBuiltTable()).toBe(true);
    });

    test('should clear existing symbols before building', async () => {
      // Add some symbols first
      (symbolTable as any).symbols.set('test::symbol', { name: 'symbol' } as any);
      (symbolTable as any).fileSymbols.set('test', ['test::symbol']);
      (symbolTable as any).isBuilt = true;
      
      // Mock processFile to not add anything
      (symbolTable as any).processFile = jest.fn().mockResolvedValue(undefined);
      
      await symbolTable.build(['newfile.ts']);
      
      // Should be cleared
      expect((symbolTable as any).symbols.size).toBe(0);
      expect((symbolTable as any).fileSymbols.size).toBe(0);
      expect(symbolTable.isBuiltTable()).toBe(true);
    });
  });

  describe('processFile', () => {
    test('should use LSP for supported files', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      mockTreeSitterTool.isSupportedFile.mockReturnValue(false);
      
      (symbolTable as any).processFileWithLsp = jest.fn().mockResolvedValue(undefined);
      (symbolTable as any).processFileWithTreeSitter = jest.fn().mockResolvedValue(undefined);
      
      await (symbolTable as any).processFile('test.ts');
      
      expect((symbolTable as any).processFileWithLsp).toHaveBeenCalledWith('/test/test.ts');
      expect((symbolTable as any).processFileWithTreeSitter).not.toHaveBeenCalled();
    });

    test('should use Tree-sitter for unsupported LSP files', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(false);
      mockTreeSitterTool.isSupportedFile.mockReturnValue(true);
      
      (symbolTable as any).processFileWithLsp = jest.fn().mockResolvedValue(undefined);
      (symbolTable as any).processFileWithTreeSitter = jest.fn().mockResolvedValue(undefined);
      
      await (symbolTable as any).processFile('test.py');
      
      expect((symbolTable as any).processFileWithLsp).not.toHaveBeenCalled();
      expect((symbolTable as any).processFileWithTreeSitter).toHaveBeenCalledWith('/test/test.py');
    });

    test('should handle absolute file paths correctly', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      (symbolTable as any).processFileWithLsp = jest.fn().mockResolvedValue(undefined);
      
      await (symbolTable as any).processFile('/absolute/path/file.ts');
      
      expect((symbolTable as any).processFileWithLsp).toHaveBeenCalledWith('/absolute/path/file.ts');
    });

    test('should log error and continue on processing failure', async () => {
      mockLspTool.isSupportedFile.mockReturnValue(true);
      (symbolTable as any).processFileWithLsp = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await (symbolTable as any).processFile('test.ts');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to process file /test/test.ts:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('processFileWithLsp', () => {
    test('should process workspace symbols and add to symbol table', async () => {
      const mockSymbols = [
        {
          name: 'testFunction',
          kind: 12, // function
          location: {
            uri: 'file:///test/test.ts',
            range: { start: { line: 5, character: 10 }, end: { line: 5, character: 20 } }
          }
        },
        {
          name: 'TestClass',
          kind: 5, // class
          location: {
            uri: 'file:///test/test.ts',
            range: { start: { line: 10, character: 5 }, end: { line: 10, character: 15 } }
          }
        }
      ];
      
      mockLspTool.getWorkspaceSymbols.mockResolvedValue(mockSymbols);
      
      await (symbolTable as any).processFileWithLsp('/test/test.ts');
      
      // Check that symbols were added
      const functionSymbol = symbolTable.findSymbol('testFunction', '/test/test.ts');
      expect(functionSymbol).toBeDefined();
      expect(functionSymbol!.name).toBe('testFunction');
      expect(functionSymbol!.type).toBe('function');
      expect(functionSymbol!.location.filePath).toBe('/test/test.ts');
      expect(functionSymbol!.location.line).toBe(5);
      expect(functionSymbol!.location.character).toBe(10);
      expect(functionSymbol!.isExported).toBe(true);
      
      const classSymbol = symbolTable.findSymbol('TestClass', '/test/test.ts');
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.name).toBe('TestClass');
      expect(classSymbol!.type).toBe('class');
    });

    test('should fallback to Tree-sitter on LSP error', async () => {
      mockLspTool.getWorkspaceSymbols.mockRejectedValue(new Error('LSP error'));
      
      (symbolTable as any).processFileWithTreeSitter = jest.fn().mockResolvedValue(undefined);
      
      await (symbolTable as any).processFileWithLsp('/test/test.ts');
      
      expect((symbolTable as any).processFileWithTreeSitter).toHaveBeenCalledWith('/test/test.ts');
    });

    test('should handle empty or invalid workspace symbols', async () => {
      mockLspTool.getWorkspaceSymbols.mockResolvedValue(null);
      
      await (symbolTable as any).processFileWithLsp('/test/test.ts');
      
      // Should not throw and should not add any symbols
      expect(symbolTable.getAllSymbols()).toHaveLength(0);
    });
  });

  describe('processFileWithTreeSitter', () => {
    test('should process all AST node types', async () => {
      const mockFunctions = [{
        type: 'function_declaration',
        text: 'function testFunc() {}',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 20 }
      }];
      const mockClasses = [{
        type: 'class_declaration',
        text: 'class TestClass {}',
        startPosition: { row: 5, column: 0 },
        endPosition: { row: 5, column: 18 }
      }];
      const mockInterfaces = [{
        type: 'interface_declaration',
        text: 'interface TestInterface {}',
        startPosition: { row: 10, column: 0 },
        endPosition: { row: 10, column: 26 }
      }];
      const mockTypes = [{
        type: 'type_alias_declaration',
        text: 'type TestType = string;',
        startPosition: { row: 15, column: 0 },
        endPosition: { row: 15, column: 22 }
      }];
      
      mockTreeSitterTool.queryFunctions.mockResolvedValue(mockFunctions);
      mockTreeSitterTool.queryClasses.mockResolvedValue(mockClasses);
      mockTreeSitterTool.queryInterfaces.mockResolvedValue(mockInterfaces);
      mockTreeSitterTool.queryTypeDefinitions.mockResolvedValue(mockTypes);
      
      await (symbolTable as any).processFileWithTreeSitter('/test/test.ts');
      
      const symbols = symbolTable.getAllSymbols();
      expect(symbols).toHaveLength(4);
      
      const functionSymbol = symbols.find(s => s.name === 'testFunc');
      expect(functionSymbol).toBeDefined();
      expect(functionSymbol!.type).toBe('function');
      expect(functionSymbol!.location.line).toBe(1);
      
      const classSymbol = symbols.find(s => s.name === 'TestClass');
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.type).toBe('class');
      expect(classSymbol!.location.line).toBe(5);
      
      const interfaceSymbol = symbols.find(s => s.name === 'TestInterface');
      expect(interfaceSymbol).toBeDefined();
      expect(interfaceSymbol!.type).toBe('interface');
      expect(interfaceSymbol!.location.line).toBe(10);
      
      const typeSymbol = symbols.find(s => s.name === 'TestType');
      expect(typeSymbol).toBeDefined();
      expect(typeSymbol!.type).toBe('type');
      expect(typeSymbol!.location.line).toBe(15);
    });

    test('should handle exported symbols correctly', async () => {
      const mockFunctions = [
        {
          type: 'function_declaration',
          text: 'export function exportedFunc() {}',
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 32 }
        },
        {
          type: 'function_declaration',
          text: 'function nonExportedFunc() {}',
          startPosition: { row: 2, column: 0 },
          endPosition: { row: 2, column: 27 }
        }
      ];
      
      mockTreeSitterTool.queryFunctions.mockResolvedValue(mockFunctions);
      mockTreeSitterTool.queryClasses.mockResolvedValue([]);
      mockTreeSitterTool.queryInterfaces.mockResolvedValue([]);
      mockTreeSitterTool.queryTypeDefinitions.mockResolvedValue([]);
      
      await (symbolTable as any).processFileWithTreeSitter('/test/test.ts');
      
      const symbols = symbolTable.getAllSymbols();
      expect(symbols).toHaveLength(2);
      
      const exportedFunc = symbols.find(s => s.name === 'exportedFunc');
      expect(exportedFunc).toBeDefined();
      expect(exportedFunc!.isExported).toBe(true);
      
      const nonExportedFunc = symbols.find(s => s.name === 'nonExportedFunc');
      expect(nonExportedFunc).toBeDefined();
      expect(nonExportedFunc!.isExported).toBe(false);
    });

    test('should handle extraction of names from AST nodes', async () => {
      const mockFunctions = [
        {
          type: 'function_declaration',
          text: 'function complexName$123_() {}',
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 28 }
        },
        {
          type: 'function_declaration',
          text: 'function () {}',
          startPosition: { row: 2, column: 0 },
          endPosition: { row: 2, column: 14 }
        }
      ];
      
      mockTreeSitterTool.queryFunctions.mockResolvedValue(mockFunctions);
      mockTreeSitterTool.queryClasses.mockResolvedValue([]);
      mockTreeSitterTool.queryInterfaces.mockResolvedValue([]);
      mockTreeSitterTool.queryTypeDefinitions.mockResolvedValue([]);
      
      await (symbolTable as any).processFileWithTreeSitter('/test/test.ts');
      
      const symbols = symbolTable.getAllSymbols();
      expect(symbols).toHaveLength(2);
      
      const namedSymbol = symbols.find(s => s.name === 'complexName$123_');
      expect(namedSymbol).toBeDefined();
      
      const unnamedSymbol = symbols.find(s => s.name === 'unknown');
      expect(unnamedSymbol).toBeDefined();
    });

    test('should log error and continue on Tree-sitter processing failure', async () => {
      mockTreeSitterTool.queryFunctions.mockRejectedValue(new Error('Tree-sitter error'));
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await (symbolTable as any).processFileWithTreeSitter('/test/test.ts');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Tree-sitter processing failed for /test/test.ts:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('extractNameFromAstNode', () => {
    test('should extract function name correctly', () => {
      const result = (symbolTable as any).extractNameFromAstNode({ 
        type: 'function_declaration',
        text: 'function myFunction() {}',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 22 }
      });
      expect(result).toBe('myFunction');
    });

    test('should extract class name correctly', () => {
      const result = (symbolTable as any).extractNameFromAstNode({ 
        type: 'class_declaration',
        text: 'class MyClass {}',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 15 }
      });
      expect(result).toBe('MyClass');
    });

    test('should extract interface name correctly', () => {
      const result = (symbolTable as any).extractNameFromAstNode({ 
        type: 'interface_declaration',
        text: 'interface MyInterface {}',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 23 }
      });
      expect(result).toBe('MyInterface');
    });

    test('should extract type name correctly', () => {
      const result = (symbolTable as any).extractNameFromAstNode({ 
        type: 'type_alias_declaration',
        text: 'type MyType = string;',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 20 }
      });
      expect(result).toBe('MyType');
    });

    test('should return unknown for invalid patterns', () => {
      const result = (symbolTable as any).extractNameFromAstNode({ 
        type: 'invalid',
        text: 'invalid syntax',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 14 }
      });
      expect(result).toBe('unknown');
    });
  });

  describe('isExported', () => {
    test('should return true for export declarations', () => {
      expect((symbolTable as any).isExported('export function test() {}')).toBe(true);
      expect((symbolTable as any).isExported('export class Test {}')).toBe(true);
      expect((symbolTable as any).isExported('export interface Test {}')).toBe(true);
      expect((symbolTable as any).isExported('export type Test = string;')).toBe(true);
    });

    test('should return false for non-export declarations', () => {
      expect((symbolTable as any).isExported('function test() {}')).toBe(false);
      expect((symbolTable as any).isExported('class Test {}')).toBe(false);
      expect((symbolTable as any).isExported('interface Test {}')).toBe(false);
      expect((symbolTable as any).isExported('type Test = string;')).toBe(false);
    });

    test('should handle whitespace correctly', () => {
      expect((symbolTable as any).isExported('  export function test() {}  ')).toBe(true);
      expect((symbolTable as any).isExported('\texport class Test {}\n')).toBe(true);
    });
  });

  describe('mapLspSymbolKindToType', () => {
    test('should map LSP symbol kinds correctly', () => {
      expect((symbolTable as any).mapLspSymbolKindToType(5)).toBe('class');
      expect((symbolTable as any).mapLspSymbolKindToType(11)).toBe('interface');
      expect((symbolTable as any).mapLspSymbolKindToType(12)).toBe('function');
      expect((symbolTable as any).mapLspSymbolKindToType(13)).toBe('variable');
      expect((symbolTable as any).mapLspSymbolKindToType(999)).toBe('variable'); // default
    });
  });

  describe('addSymbol', () => {
    test('should add symbol to symbols map and fileSymbols map', () => {
      const symbol = {
        name: 'testSymbol',
        type: 'function' as SymbolType,
        location: { filePath: '/test/file.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      
      (symbolTable as any).addSymbol(symbol);
      
      const key = '/test/file.ts::testSymbol';
      expect((symbolTable as any).symbols.get(key)).toEqual(symbol);
      expect((symbolTable as any).fileSymbols.get('/test/file.ts')).toEqual([key]);
    });

    test('should handle multiple symbols in same file', () => {
      const symbol1 = {
        name: 'symbol1',
        type: 'function' as SymbolType,
        location: { filePath: '/test/file.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      
      const symbol2 = {
        name: 'symbol2',
        type: 'class' as SymbolType,
        location: { filePath: '/test/file.ts', line: 5, character: 0 },
        isExported: false,
        references: [],
        dependencies: []
      };
      
      (symbolTable as any).addSymbol(symbol1);
      (symbolTable as any).addSymbol(symbol2);
      
      const keys = (symbolTable as any).fileSymbols.get('/test/file.ts');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('/test/file.ts::symbol1');
      expect(keys).toContain('/test/file.ts::symbol2');
    });
  });

  describe('findSymbol', () => {
    beforeEach(() => {
      const symbol = {
        name: 'testSymbol',
        type: 'function' as SymbolType,
        location: { filePath: '/test/file.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      (symbolTable as any).addSymbol(symbol);
    });

    test('should find symbol by name and file path', () => {
      const result = symbolTable.findSymbol('testSymbol', '/test/file.ts');
      expect(result).toBeDefined();
      expect(result!.name).toBe('testSymbol');
    });

    test('should return undefined for non-existent symbol', () => {
      const result = symbolTable.findSymbol('nonExistent', '/test/file.ts');
      expect(result).toBeUndefined();
    });

    test('should find symbol by name only (global search)', () => {
      const result = symbolTable.findSymbol('testSymbol');
      expect(result).toBeDefined();
      expect(result!.name).toBe('testSymbol');
    });

    test('should return first match in global search', () => {
      // Add another symbol with same name in different file
      const symbol2 = {
        name: 'testSymbol',
        type: 'class' as SymbolType,
        location: { filePath: '/test/other.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      (symbolTable as any).addSymbol(symbol2);
      
      const result = symbolTable.findSymbol('testSymbol');
      expect(result).toBeDefined();
      // Should return one of them (order not guaranteed, but should exist)
      expect(result!.name).toBe('testSymbol');
    });
  });

  describe('getFileSymbols', () => {
    beforeEach(() => {
      const symbol1 = {
        name: 'symbol1',
        type: 'function' as SymbolType,
        location: { filePath: '/test/file1.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      
      const symbol2 = {
        name: 'symbol2',
        type: 'class' as SymbolType,
        location: { filePath: '/test/file1.ts', line: 5, character: 0 },
        isExported: false,
        references: [],
        dependencies: []
      };
      
      const symbol3 = {
        name: 'symbol3',
        type: 'interface' as SymbolType,
        location: { filePath: '/test/file2.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      
      (symbolTable as any).addSymbol(symbol1);
      (symbolTable as any).addSymbol(symbol2);
      (symbolTable as any).addSymbol(symbol3);
    });

    test('should return all symbols for a file', () => {
      const result = symbolTable.getFileSymbols('/test/file1.ts');
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('symbol1');
      expect(result.map(s => s.name)).toContain('symbol2');
    });

    test('should return empty array for file with no symbols', () => {
      const result = symbolTable.getFileSymbols('/test/nonexistent.ts');
      expect(result).toHaveLength(0);
    });
  });

  describe('getAllSymbols', () => {
    test('should return all symbols in symbol table', () => {
      const symbol1 = {
        name: 'symbol1',
        type: 'function' as SymbolType,
        location: { filePath: '/test/file1.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      
      const symbol2 = {
        name: 'symbol2',
        type: 'class' as SymbolType,
        location: { filePath: '/test/file2.ts', line: 5, character: 0 },
        isExported: false,
        references: [],
        dependencies: []
      };
      
      (symbolTable as any).addSymbol(symbol1);
      (symbolTable as any).addSymbol(symbol2);
      
      const result = symbolTable.getAllSymbols();
      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('symbol1');
      expect(result.map(s => s.name)).toContain('symbol2');
    });

    test('should return empty array when no symbols', () => {
      const result = symbolTable.getAllSymbols();
      expect(result).toHaveLength(0);
    });
  });

  describe('updateFile', () => {
    test('should remove old symbols and reprocess file', async () => {
      // Add initial symbols
      const oldSymbol = {
        name: 'oldSymbol',
        type: 'function' as SymbolType,
        location: { filePath: '/test/file.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      (symbolTable as any).addSymbol(oldSymbol);
      
      // Mock reprocessing to add new symbol
      (symbolTable as any).processFile = jest.fn().mockImplementation(async () => {
        const newSymbol = {
          name: 'newSymbol',
          type: 'class' as SymbolType,
          location: { filePath: '/test/file.ts', line: 5, character: 0 },
          isExported: false,
          references: [],
          dependencies: []
        };
        (symbolTable as any).addSymbol(newSymbol);
      });
      
      await symbolTable.updateFile('/test/file.ts');
      
      // Old symbol should be removed, new symbol should be added
      const symbols = symbolTable.getAllSymbols();
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('newSymbol');
    });

    test('should handle file with no existing symbols', async () => {
      (symbolTable as any).processFile = jest.fn().mockResolvedValue(undefined);
      
      await symbolTable.updateFile('/test/newfile.ts');
      
      expect((symbolTable as any).processFile).toHaveBeenCalledWith('/test/newfile.ts');
    });
  });

  describe('clear', () => {
    test('should clear all symbols and reset built status', () => {
      const symbol = {
        name: 'testSymbol',
        type: 'function' as SymbolType,
        location: { filePath: '/test/file.ts', line: 1, character: 0 },
        isExported: true,
        references: [],
        dependencies: []
      };
      (symbolTable as any).addSymbol(symbol);
      (symbolTable as any).isBuilt = true;
      
      symbolTable.clear();
      
      expect(symbolTable.getAllSymbols()).toHaveLength(0);
      expect(symbolTable.getFileSymbols('/test/file.ts')).toHaveLength(0);
      expect(symbolTable.isBuiltTable()).toBe(false);
    });
  });

  describe('isBuiltTable', () => {
    test('should return correct built status', () => {
      expect(symbolTable.isBuiltTable()).toBe(false);
      
      (symbolTable as any).isBuilt = true;
      
      expect(symbolTable.isBuiltTable()).toBe(true);
    });
  });
});