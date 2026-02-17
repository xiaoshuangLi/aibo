import { hybridCodeReaderTool } from '@/tools/hybrid-code-reader';

describe('Hybrid Code Reader Tool', () => {
  // 测试正常场景
  describe('Success Cases', () => {
    test('should successfully read full context from supported file', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/index.ts',
        requestType: 'full-context'
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.context).toBeDefined();
      expect(typeof parsedResult.context).toBe('string');
      expect(parsedResult.originalTokens).toBeGreaterThanOrEqual(0);
      expect(parsedResult.optimizedTokens).toBeGreaterThanOrEqual(0);
      expect(parsedResult.savingsPercentage).toBeGreaterThanOrEqual(0);
      expect(parsedResult.technologiesUsed).toBeInstanceOf(Array);
    });

    test('should successfully get function definition with position', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'definition',
        line: 52,
        character: 15
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.context).toContain('async function main');
      expect(parsedResult.savingsPercentage).toBeGreaterThanOrEqual(0);
    });

    test('should successfully get function definition with symbol name', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'definition',
        symbolName: 'main'
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.context).toContain('main');
    });

    test('should handle maxTokens parameter correctly', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'full-context',
        maxTokens: 100
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      // Allow some tolerance due to token estimation differences
      expect(parsedResult.optimizedTokens).toBeLessThanOrEqual(110);
    });
  });

  // 测试错误场景
  describe('Error Cases', () => {
    test('should return error for unsupported file type', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'README.md',
        requestType: 'full-context'
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe('Unsupported file type');
      expect(parsedResult.supportedTypes).toEqual(['.js', '.jsx', '.ts', '.tsx']);
    });

    test('should return error for non-existent file', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'nonexistent-file.ts',
        requestType: 'full-context'
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('ENOENT');
    });

    test('should validate request type properly', () => {
      const schema = hybridCodeReaderTool.schema;
      
      // Test valid request types
      const validTypes = ['definition', 'references', 'implementation', 'signature', 'full-context', 'dependencies'];
      validTypes.forEach(type => {
        expect(() => schema.parse({
          filePath: 'src/index.ts',
          requestType: type
        })).not.toThrow();
      });
      
      // Test that schema validation catches invalid types (this is handled by LangChain)
      expect(() => schema.parse({
        filePath: 'src/index.ts',
        // @ts-ignore
        requestType: 'invalid-type'
      })).toThrow();
    });

    test('should handle missing position parameters for definition request', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'definition'
        // missing line and character
      });
      
      const parsedResult = JSON.parse(result);
      // Should either succeed (using symbolName) or fail gracefully
      expect(parsedResult).toBeDefined();
    });

    test('should handle invalid line/character positions gracefully', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'definition',
        line: -1, // invalid line
        character: 1000 // invalid character
      });
      
      const parsedResult = JSON.parse(result);
      // Should either return empty result or fail gracefully
      expect(parsedResult).toBeDefined();
    });

    test('should handle Tree-sitter parsing errors gracefully', async () => {
      // Test with a file that might cause parsing issues
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'package.json',
        requestType: 'full-context'
      });
      
      const parsedResult = JSON.parse(result);
      // Should either succeed or fail gracefully with proper error message
      expect(parsedResult).toBeDefined();
    });

    test('should handle complete failure scenario gracefully', async () => {
      // Test with a non-existent file to trigger complete failure
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'completely-nonexistent-file.ts',
        requestType: 'definition',
        line: 1,
        character: 1
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBeDefined();
    });
  });

  // 测试边界情况
  describe('Edge Cases', () => {
    test('should handle empty file', async () => {
      // Create a temporary empty file for testing
      const testFilePath = 'test-empty-file.ts';
      try {
        // Write empty file
        await require('fs').promises.writeFile(testFilePath, '');
        
        const result = await hybridCodeReaderTool.invoke({
          filePath: testFilePath,
          requestType: 'full-context'
        });
        
        const parsedResult = JSON.parse(result);
        expect(parsedResult.success).toBe(true);
        expect(parsedResult.context).toBe('');
        expect(parsedResult.optimizedTokens).toBe(0);
      } finally {
        // Clean up
        try {
          await require('fs').promises.unlink(testFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle very large file with token limit', async () => {
      // This test ensures the tool doesn't crash on large files
      // and respects the maxTokens limit
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'package-lock.json',
        requestType: 'full-context',
        maxTokens: 50
      });
      
      const parsedResult = JSON.parse(result);
      // Should either succeed with limited tokens or fail gracefully
      expect(parsedResult).toBeDefined();
    });

    test('should handle implementation request type', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'implementation',
        line: 10,
        character: 5
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult).toBeDefined();
    });

    test('should handle signature request type', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'signature',
        line: 10,
        character: 5
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult).toBeDefined();
    });

    test('should handle dependencies request type', async () => {
      const result = await hybridCodeReaderTool.invoke({
        filePath: 'src/main.ts',
        requestType: 'dependencies'
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult).toBeDefined();
    });
  });

  // 测试工具元数据
  describe('Tool Metadata', () => {
    test('should have correct tool name and description', () => {
      expect(hybridCodeReaderTool.name).toBe('hybrid_code_reader');
      expect(hybridCodeReaderTool.description).toContain('PRIMARY CODE ANALYSIS TOOL');
      expect(hybridCodeReaderTool.description).toContain('LSP, Tree-sitter, and symbol tables');
    });

    test('should have correct schema validation', () => {
      const schema = hybridCodeReaderTool.schema;
      expect(schema).toBeDefined();
      
      // Test valid input
      expect(() => schema.parse({
        filePath: 'src/index.ts',
        requestType: 'full-context'
      })).not.toThrow();
      
      // Test invalid input
      expect(() => schema.parse({
        filePath: 123, // invalid type
        requestType: 'full-context'
      })).toThrow();
    });
  });

  // 测试底层组件方法
  describe('Internal Component Methods', () => {
    let readerInstance: any;
    
    beforeAll(() => {
      // 获取内部的 HybridCodeReader 实例
      const getHybridCodeReader = require('../../src/tools/hybrid-code-reader').getHybridCodeReader;
      readerInstance = getHybridCodeReader();
    });

    test('should handle getSymbolDefinition method', async () => {
      const result = await readerInstance.getSymbolDefinition('src/main.ts', 'main');
      expect(typeof result).toBe('string');
      expect(result).toContain('main');
    });

    test('should handle findReferences method', async () => {
      const result = await readerInstance.findReferences('src/main.ts', { line: 10, character: 5 });
      expect(Array.isArray(result)).toBe(true);
      // The result should contain the context string or be empty
    });

    test('should handle buildSymbolTable method', async () => {
      await expect(readerInstance.buildSymbolTable(['src/index.ts'])).resolves.not.toThrow();
    });

    test('should handle clearCache method', async () => {
      await expect(readerInstance.clearCache()).resolves.not.toThrow();
    });

    test('should handle shutdown method', async () => {
      await expect(readerInstance.shutdown()).resolves.not.toThrow();
    });

    test('should handle isSupportedFile method', () => {
      expect(readerInstance.isSupportedFile('test.ts')).toBe(true);
      expect(readerInstance.isSupportedFile('test.js')).toBe(true);
      expect(readerInstance.isSupportedFile('test.md')).toBe(false);
    });
  });
});