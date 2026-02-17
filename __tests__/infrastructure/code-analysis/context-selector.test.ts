import { ContextSelector } from '@/infrastructure/code-analysis/context-selector';
import { AstAbstractLayer } from '@/infrastructure/code-analysis/ast-abstract-layer';
import { CacheManager } from '@/infrastructure/code-analysis/cache-manager';

// Don't fully mock the dependencies, just create mock instances
// jest.mock('@/infrastructure/code-analysis/ast-abstract-layer');
// jest.mock('@/infrastructure/code-analysis/cache-manager');

describe('ContextSelector', () => {
  let contextSelector: ContextSelector;
  let mockAstLayer: jest.Mocked<AstAbstractLayer>;
  let mockCacheManager: jest.Mocked<CacheManager>;

  beforeEach(() => {
    // Create mock instances manually
    mockAstLayer = {
      getFileSymbols: jest.fn(),
      getDefinition: jest.fn(),
      findReferences: jest.fn(),
      optimizeContext: jest.fn(),
      readFile: jest.fn(),
      getFileDependencies: jest.fn(),
    } as unknown as jest.Mocked<AstAbstractLayer>;
    
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
    } as unknown as jest.Mocked<CacheManager>;

    const config = {
      astLayer: mockAstLayer,
      cacheManager: mockCacheManager,
      defaultMaxTokens: 1000
    };

    contextSelector = new ContextSelector(config);
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(contextSelector).toBeDefined();
    });
  });

  describe('selectContext', () => {
    test('should return cached context when available', async () => {
      const mockContext: import('@/infrastructure/code-analysis/ast-abstract-layer').OptimizedContext = {
        context: 'cached context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(mockContext);
      
      const result = await contextSelector.selectContext('test.ts', 'definition');
      expect(result).toBe(mockContext);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    test('should cache new context when not available', async () => {
      const mockContext: import("@/infrastructure/code-analysis/ast-abstract-layer").OptimizedContext = {
        context: 'new context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.optimizeContext.mockResolvedValue(mockContext);
      
      const result = await contextSelector.selectContext('test.ts', 'full-context');
      expect(result).toBe(mockContext);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    test('should handle definition request type', async () => {
      const mockSymbol = {
        name: 'testFunction',
        kind: 12,
        detail: 'function testFunction(): void',
        location: { uri: 'test.ts', range: { start: { line: 0, character: 0 } } }
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getDefinition.mockResolvedValue(mockSymbol);
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toContain('function testFunction(): void');
    });

    test('should handle references request type', async () => {
      const mockContext: import("@/infrastructure/code-analysis/ast-abstract-layer").OptimizedContext = {
        context: 'references context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.findReferences.mockResolvedValue([
        { location: { uri: 'test.ts', range: { start: { line: 1, character: 0 } } } }
      ]);
      
      const result = await contextSelector.selectContext('test.ts', 'references', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toContain('References:');
    });

    test('should handle implementation request type', async () => {
      const mockContext: import("@/infrastructure/code-analysis/ast-abstract-layer").OptimizedContext = {
        context: 'implementation context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.optimizeContext.mockResolvedValue(mockContext);
      
      const result = await contextSelector.selectContext('test.ts', 'implementation');
      expect(result).toBe(mockContext);
    });

    test('should handle signature request type', async () => {
      const mockSymbols = [
        {
          name: 'TestClass',
          type: 'class' as any,
          location: { filePath: 'test.ts', line: 1, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export class TestClass { public method(): void; }'
        },
        {
          name: 'testFunction',
          type: 'function' as any,
          location: { filePath: 'test.ts', line: 5, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export function testFunction(): string;'
        }
      ];
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue(mockSymbols);
      
      const result = await contextSelector.selectContext('test.ts', 'signature');
      expect(result.context).toContain('// Classes');
      expect(result.context).toContain('// Functions');
      expect(result.technologiesUsed).toContain('symbol-table');
    });

    test('should handle full-context request type', async () => {
      const mockContext: import("@/infrastructure/code-analysis/ast-abstract-layer").OptimizedContext = {
        context: 'full context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.optimizeContext.mockResolvedValue(mockContext);
      
      const result = await contextSelector.selectContext('test.ts', 'full-context');
      expect(result).toBe(mockContext);
    });

    test('should handle dependencies request type', async () => {
      const mockContext: import("@/infrastructure/code-analysis/ast-abstract-layer").OptimizedContext = {
        context: 'dependencies context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileDependencies.mockResolvedValue({
        filePath: 'test.ts',
        imports: [],
        exports: [],
        externalDependencies: [],
        internalDependencies: []
      });
      
      const result = await contextSelector.selectContext('test.ts', 'dependencies');
      expect(result.context).toContain('Dependencies for:');
    });

    test('should handle fallback request type', async () => {
      const mockContext: import("@/infrastructure/code-analysis/ast-abstract-layer").OptimizedContext = {
        context: 'fallback context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      // Mock fs.readFile
      jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue('file content');
      
      const result = await contextSelector.selectContext('test.ts', 'unknown' as any);
      expect(result.context).toBe('file content');
    });

    test('should compress context when exceeding maxTokens', async () => {
      const largeContext: import("@/infrastructure/code-analysis/ast-abstract-layer").OptimizedContext = {
        context: 'a'.repeat(2000), // Large context that exceeds token limit
        originalTokens: 2000,
        optimizedTokens: 2000,
        savingsPercentage: 0,
        technologiesUsed: ['symbol-table']
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.optimizeContext.mockResolvedValue(largeContext);
      
      const result = await contextSelector.selectContext('test.ts', 'full-context', {
        maxTokens: 100
      });
      
      expect(result.optimizedTokens).toBeLessThanOrEqual(100);
    });

    test('should handle definition request with symbol name', async () => {
      const mockSymbols = [
        {
          name: 'testFunction',
          type: 'function' as any,
          location: { filePath: 'test.ts', line: 5, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export function testFunction(): string { return "test"; }'
        }
      ];
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue(mockSymbols);
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        symbolName: 'testFunction'
      });
      
      expect(result.context).toContain('export function testFunction(): string { return "test"; }');
    });

    test('should handle definition request with symbol name but no text', async () => {
      const mockSymbols = [
        {
          name: 'testFunction',
          type: 'function' as any,
          location: { filePath: 'test.ts', line: 5, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: ''
        }
      ];
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue(mockSymbols);
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        symbolName: 'testFunction'
      });
      
      expect(result.context).toContain('function testFunction');
    });

    test('should handle definition request with symbol name not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue([]);
      mockAstLayer.optimizeContext.mockResolvedValue({
        context: 'public only context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      });
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        symbolName: 'nonExistentFunction'
      });
      
      expect(result.context).toBe('public only context');
    });

    test('should format definition context with documentation', async () => {
      const mockDefinition = {
        documentation: '/**\n * Test function\n */',
        detail: 'function testFunction(): void',
        location: { uri: 'test.ts', range: { start: { line: 0, character: 0 } } }
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getDefinition.mockResolvedValue(mockDefinition);
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toContain('/**\n * Test function\n */');
      expect(result.context).toContain('function testFunction(): void');
    });

    test('should format definition context without detail', async () => {
      const mockDefinition = {
        name: 'TestClass',
        kind: 7,
        containerName: 'MyNamespace',
        location: { uri: 'test.ts', range: { start: { line: 0, character: 0 } } }
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getDefinition.mockResolvedValue(mockDefinition);
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toContain('class TestClass');
      expect(result.context).toContain('in MyNamespace');
    });

    test('should handle references request with symbol name', async () => {
      const mockSymbols = [
        {
          name: 'testFunction',
          type: 'function' as any,
          location: { filePath: 'test.ts', line: 5, character: 0 },
          isExported: true,
          references: [
            { filePath: 'other.ts', line: 10, character: 5 },
            { filePath: 'another.ts', line: 15, character: 8 }
          ],
          dependencies: [],
          text: 'export function testFunction(): string;'
        }
      ];
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue(mockSymbols);
      
      const result = await contextSelector.selectContext('test.ts', 'references', {
        symbolName: 'testFunction'
      });
      
      expect(result.context).toContain('References:');
      expect(result.context).toContain('other.ts:11:6');
      expect(result.context).toContain('another.ts:16:9');
    });

    test('should handle implementation request with symbol name', async () => {
      const mockSymbols = [
        {
          name: 'testFunction',
          type: 'function' as any,
          location: { filePath: 'test.ts', line: 5, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export function testFunction() {\n  return "implementation";\n}'
        }
      ];
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue(mockSymbols);
      
      const result = await contextSelector.selectContext('test.ts', 'implementation', {
        symbolName: 'testFunction'
      });
      
      expect(result.context).toContain('return "implementation"');
      expect(result.optimizedTokens).toBeGreaterThan(0);
    });

    test('should handle signature request with empty symbols', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue([]);
      // Mock readFile for fallback
      jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue(`
export class TestClass {}
export function testFunction() {}
      `.trim());
      
      const result = await contextSelector.selectContext('test.ts', 'signature');
      
      expect(result.context).toContain('class TestClass {...}');
      expect(result.context).toContain('function testFunction();');
    });

    test('should handle signature request with various symbol types', async () => {
      const mockSymbols = [
        {
          name: 'TestClass',
          type: 'class' as any,
          location: { filePath: 'test.ts', line: 1, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export class TestClass { public method(): void; }'
        },
        {
          name: 'TestInterface',
          type: 'interface' as any,
          location: { filePath: 'test.ts', line: 5, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export interface TestInterface { prop: string; }'
        },
        {
          name: 'TestType',
          type: 'type' as any,
          location: { filePath: 'test.ts', line: 10, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export type TestType = string | number;'
        },
        {
          name: 'testMethod',
          type: 'function' as any,
          containerName: 'TestClass',
          location: { filePath: 'test.ts', line: 15, character: 0 },
          isExported: false,
          references: [],
          dependencies: [],
          text: 'public testMethod(): void {}'
        },
        {
          name: 'TEST_CONSTANT',
          type: 'variable' as any,
          location: { filePath: 'test.ts', line: 20, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export const TEST_CONSTANT = "value";'
        }
      ];
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue(mockSymbols);
      
      const result = await contextSelector.selectContext('test.ts', 'signature');
      
      expect(result.context).toContain('// Classes');
      expect(result.context).toContain('// Interfaces');
      expect(result.context).toContain('// Type Aliases');
      expect(result.context).toContain('// Methods');
      expect(result.context).toContain('// Variables/Constants');
      expect(result.context).toContain('class TestClass {...}');
      expect(result.context).toContain('interface TestInterface { prop: string; }');
      expect(result.context).toContain('type TestType = string | number;');
      expect(result.context).toContain('public testMethod(): void;');
      expect(result.context).toContain('export const TEST_CONSTANT;');
    });

    test('should create optimized context with proper token calculation', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.optimizeContext.mockResolvedValue({
        context: 'optimized content',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      });
      
      const result = await contextSelector.selectContext('test.ts', 'full-context');
      
      expect(result.originalTokens).toBe(100);
      expect(result.optimizedTokens).toBe(50);
      expect(result.savingsPercentage).toBe(50);
    });

    test('should handle edge case with empty context', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.optimizeContext.mockResolvedValue({
        context: '',
        originalTokens: 0,
        optimizedTokens: 0,
        savingsPercentage: 0,
        technologiesUsed: ['symbol-table']
      });
      
      const result = await contextSelector.selectContext('test.ts', 'full-context');
      
      expect(result.context).toBe('');
      expect(result.originalTokens).toBe(0);
      expect(result.optimizedTokens).toBe(0);
    });

    test('should handle error in getDefinitionContext gracefully', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getDefinition.mockRejectedValue(new Error('AST error'));
      mockAstLayer.optimizeContext.mockResolvedValue({
        context: 'fallback context',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      });
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toBe('fallback context');
    });

    test('should handle error in getImplementationContext gracefully', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getDefinition.mockRejectedValue(new Error('AST error'));
      mockAstLayer.optimizeContext.mockResolvedValue({
        context: 'fallback implementation',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      });
      
      const result = await contextSelector.selectContext('test.ts', 'implementation', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toBe('fallback implementation');
    });

    test('should handle error in getSignatureContext gracefully', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockRejectedValue(new Error('AST error'));
      
      const result = await contextSelector.selectContext('test.ts', 'signature');
      
      // Should return empty context when error occurs
      expect(result.context).toBe('');
    });
  });

  describe('clearCache', () => {
    test('should clear cache manager', async () => {
      await contextSelector.clearCache();
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    test('should return cache manager stats', () => {
      const mockStats = {
        memoryHits: 1,
        memoryMisses: 2,
        fileHits: 3,
        fileMisses: 4,
        memorySize: 100,
        fileSize: 200,
        memoryItems: 5,
        fileItems: 6
      };
      
      mockCacheManager.getStats.mockReturnValue(mockStats);
      
      const result = contextSelector.getCacheStats();
      expect(result).toBe(mockStats);
    });
  });

  // Test private methods indirectly through public interface
  describe('private method coverage', () => {
    test('should test isCompleteFunctionSignature logic', async () => {
      // This will be covered through the definition context formatting tests above
      // The method isCompleteFunctionSignature is called internally when formatting definitions
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getDefinition.mockResolvedValue({
        detail: 'async function test(): Promise<void> { return; }',
        location: { uri: 'test.ts', range: { start: { line: 0, character: 0 } } }
      });
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toContain('async function test(): Promise<void> { return; }');
    });

    test('should test extractSignatureFromText logic', async () => {
      const mockSymbols = [
        {
          name: 'testFunction',
          type: 'function' as any,
          location: { filePath: 'test.ts', line: 5, character: 0 },
          isExported: true,
          references: [],
          dependencies: [],
          text: 'export function testFunction(param: string): string { return param; }'
        }
      ];
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue(mockSymbols);
      
      const result = await contextSelector.selectContext('test.ts', 'signature');
      
      // Should extract just the signature without the body
      expect(result.context).toContain('export function testFunction(param: string): string;');
    });

    test('should test extractPublicApiFromSource logic', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue([]);
      // Mock readFile to return source code
      jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue(`
// Comment
export class TestClass {
  method() {}
}

export function testFunction() {
  return "test";
}

const internalVar = "internal";
export const exportedVar = "exported";
      `.trim());
      
      const result = await contextSelector.selectContext('test.ts', 'signature');
      
      expect(result.context).toContain('class TestClass {...}');
      expect(result.context).toContain('function testFunction();');
      expect(result.context).toContain('export const exportedVar;');
      // Should not contain internalVar since it's not exported
      expect(result.context).not.toContain('internalVar');
    });

    // Additional tests for edge cases and remaining branches
    test('should handle definition context with container name', async () => {
      const mockDefinition = {
        name: 'method',
        kind: 12,
        containerName: 'MyClass',
        location: { uri: 'test.ts', range: { start: { line: 0, character: 0 } } }
      };
      
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getDefinition.mockResolvedValue(mockDefinition);
      
      const result = await contextSelector.selectContext('test.ts', 'definition', {
        line: 0,
        character: 0
      });
      
      expect(result.context).toContain('function method');
      expect(result.context).toContain('in MyClass');
    });

    test('should handle references context with symbol name not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue([]);
      
      const result = await contextSelector.selectContext('test.ts', 'references', {
        symbolName: 'nonExistent'
      });
      
      expect(result.context).toBe('No references found');
    });

    test('should handle implementation context with symbol name not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue([]);
      mockAstLayer.optimizeContext.mockResolvedValue({
        context: 'fallback implementation',
        originalTokens: 100,
        optimizedTokens: 50,
        savingsPercentage: 50,
        technologiesUsed: ['symbol-table']
      });
      
      const result = await contextSelector.selectContext('test.ts', 'implementation', {
        symbolName: 'nonExistent'
      });
      
      expect(result.context).toBe('fallback implementation');
    });

    test('should create optimized context with zero original tokens', async () => {
      const result = await (contextSelector as any).createOptimizedContext('test', '');
      expect(result.originalTokens).toBe(0);
      expect(result.optimizedTokens).toBeGreaterThan(0);
      expect(result.savingsPercentage).toBe(0);
    });

    test('should create optimized context with same original and optimized', async () => {
      const result = await (contextSelector as any).createOptimizedContext('test', 'test');
      expect(result.originalTokens).toBe(result.optimizedTokens);
      expect(result.savingsPercentage).toBe(0);
    });

    test('should handle extractPublicApiFromSource with complex patterns', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAstLayer.getFileSymbols.mockResolvedValue([]);
      // Mock readFile to return source code with various patterns
      jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue(`
export interface ComplexInterface {
  prop: string;
}

export type ComplexType = {
  nested: {
    value: number;
  };
};

export async function asyncFunction() {}

const arrowFunc = (param: string) => param;

export { arrowFunc };
      `.trim());
      
      const result = await contextSelector.selectContext('test.ts', 'signature');
      
      expect(result.context).toContain('interface ComplexInterface');
      expect(result.context).toContain('type ComplexType =');
      expect(result.context).toContain('async function asyncFunction();');
      // Note: arrow functions might not be detected by current regex
    });
  });
});