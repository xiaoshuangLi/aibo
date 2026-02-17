import { DependencyAnalyzer } from '@/infrastructure/code-analysis/dependency-analyzer';
import { AstNodeInfo } from '@/infrastructure/code-analysis/tree-sitter-parser';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  describe('constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(analyzer).toBeDefined();
    });
  });

  describe('parseImport', () => {
    test('should parse side effect import', () => {
      const node: AstNodeInfo = {
        text: "import '@angular/core';",
        type: 'import_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 25 }
      };
      
      const result = analyzer.parseImport(node);
      
      expect(result).toEqual({
        type: 'sideEffect',
        source: '@angular/core',
        node
      });
    });

    test('should parse default import', () => {
      const node: AstNodeInfo = {
        text: "import React from 'react';",
        type: 'import_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 26 }
      };
      
      const result = analyzer.parseImport(node);
      
      expect(result).toEqual({
        type: 'default',
        source: 'react',
        defaultName: 'React',
        node
      });
    });

    test('should parse namespace import', () => {
      const node: AstNodeInfo = {
        text: "import * as fs from 'fs';",
        type: 'import_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 24 }
      };
      
      const result = analyzer.parseImport(node);
      
      expect(result).toEqual({
        type: 'namespace',
        source: 'fs',
        namespaceName: 'fs',
        node
      });
    });

    test('should parse named import', () => {
      const node: AstNodeInfo = {
        text: "import { Component } from '@angular/core';",
        type: 'import_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 42 }
      };
      
      const result = analyzer.parseImport(node);
      
      expect(result).toEqual({
        type: 'named',
        source: '@angular/core',
        specifiers: ['Component'],
        node
      });
    });

    test('should parse mixed import (default + named)', () => {
      const node: AstNodeInfo = {
        text: "import React, { Component } from 'react';",
        type: 'import_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 39 }
      };
      
      const result = analyzer.parseImport(node);
      
      expect(result).toEqual({
        type: 'named',
        source: 'react',
        defaultName: 'React',
        specifiers: ['Component'],
        node
      });
    });

    test('should return null for invalid import', () => {
      const node: AstNodeInfo = {
        text: "const x = 1;",
        type: 'variable_declaration',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 11 }
      };
      
      const result = analyzer.parseImport(node);
      expect(result).toBeNull();
    });
  });

  describe('parseExport', () => {
    test('should parse default export', () => {
      const node: AstNodeInfo = {
        text: "export default class MyClass {}",
        type: 'export_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 29 }
      };
      
      const result = analyzer.parseExport(node);
      
      expect(result).toEqual({
        type: 'default',
        node
      });
    });

    test('should parse re-export all', () => {
      const node: AstNodeInfo = {
        text: "export * from './utils';",
        type: 'export_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 23 }
      };
      
      const result = analyzer.parseExport(node);
      
      expect(result).toEqual({
        type: 'all',
        source: './utils',
        node
      });
    });

    test('should parse re-export named', () => {
      const node: AstNodeInfo = {
        text: "export { helper } from './utils';",
        type: 'export_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 32 }
      };
      
      const result = analyzer.parseExport(node);
      
      expect(result).toEqual({
        type: 'named',
        source: './utils',
        specifiers: ['helper'],
        node
      });
    });

    test('should parse named export', () => {
      const node: AstNodeInfo = {
        text: "export { Component, Input };",
        type: 'export_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 27 }
      };
      
      const result = analyzer.parseExport(node);
      
      expect(result).toEqual({
        type: 'named',
        specifiers: ['Component', 'Input'],
        node
      });
    });

    test('should parse declaration export', () => {
      const node: AstNodeInfo = {
        text: "export interface MyInterface { prop: string; }",
        type: 'export_statement',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 45 }
      };
      
      const result = analyzer.parseExport(node);
      
      expect(result).toEqual({
        type: 'declaration',
        node
      });
    });

    test('should return null for invalid export', () => {
      const node: AstNodeInfo = {
        text: "const x = 1;",
        type: 'variable_declaration',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 11 }
      };
      
      const result = analyzer.parseExport(node);
      expect(result).toBeNull();
    });
  });

  describe('analyzeDependencies', () => {
    test('should analyze dependencies with imports and exports', () => {
      const imports: AstNodeInfo[] = [
        {
          text: "import { Injectable } from '@nestjs/common';",
          type: 'import_statement',
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: 44 }
        },
        {
          text: "import * as path from 'path';",
          type: 'import_statement',
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 29 }
        }
      ];
      
      const exports: AstNodeInfo[] = [
        {
          text: "export { DependencyAnalyzer };",
          type: 'export_statement',
          startPosition: { row: 2, column: 0 },
          endPosition: { row: 2, column: 31 }
        },
        {
          text: "export * from './utils';",
          type: 'export_statement',
          startPosition: { row: 3, column: 0 },
          endPosition: { row: 3, column: 23 }
        }
      ];
      
      const result = analyzer.analyzeDependencies('test.ts', { imports, exports });
      
      expect(result.filePath).toBe('test.ts');
      expect(result.imports.length).toBe(2);
      expect(result.exports.length).toBe(2);
      expect(result.externalDependencies).toEqual(['@nestjs/common', 'path']);
      expect(result.internalDependencies).toEqual(['./utils']);
    });

    test('should handle empty dependencies', () => {
      const result = analyzer.analyzeDependencies('empty.ts', { imports: [], exports: [] });
      
      expect(result.filePath).toBe('empty.ts');
      expect(result.imports.length).toBe(0);
      expect(result.exports.length).toBe(0);
      expect(result.externalDependencies.length).toBe(0);
      expect(result.internalDependencies.length).toBe(0);
    });

    test('should deduplicate dependencies', () => {
      const imports: AstNodeInfo[] = [
        {
          text: "import { Injectable } from '@nestjs/common';",
          type: 'import_statement',
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: 44 }
        },
        {
          text: "import { Logger } from '@nestjs/common';",
          type: 'import_statement',
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 38 }
        }
      ];
      
      const result = analyzer.analyzeDependencies('test.ts', { imports, exports: [] });
      
      // Should deduplicate external dependencies
      expect(result.externalDependencies).toEqual(['@nestjs/common']);
    });
  });

  describe('formatDependencies', () => {
    test('should format dependencies with all sections', () => {
      const result = {
        filePath: 'test.ts',
        imports: [
          {
            type: 'sideEffect' as const,
            source: '@angular/core',
            node: {} as AstNodeInfo
          },
          {
            type: 'default' as const,
            source: 'react',
            defaultName: 'React',
            node: {} as AstNodeInfo
          },
          {
            type: 'namespace' as const,
            source: 'fs',
            namespaceName: 'fs',
            node: {} as AstNodeInfo
          },
          {
            type: 'named' as const,
            source: '@nestjs/common',
            specifiers: ['Injectable', 'Logger'],
            node: {} as AstNodeInfo
          }
        ],
        exports: [
          {
            type: 'default' as const,
            node: {} as AstNodeInfo
          },
          {
            type: 'all' as const,
            source: './utils',
            node: {} as AstNodeInfo
          },
          {
            type: 'named' as const,
            source: './types',
            specifiers: ['MyInterface'],
            node: {} as AstNodeInfo
          },
          {
            type: 'declaration' as const,
            node: {} as AstNodeInfo
          }
        ],
        externalDependencies: ['@angular/core', 'react', 'fs', '@nestjs/common'],
        internalDependencies: ['./utils', './types']
      };
      
      const formatted = analyzer.formatDependencies(result);
      
      expect(formatted).toContain('Dependencies for: test.ts');
      expect(formatted).toContain('Imports:');
      expect(formatted).toContain('Exports:');
      expect(formatted).toContain('External dependencies:');
      expect(formatted).toContain('Internal dependencies:');
    });

    test('should format empty dependencies', () => {
      const result = {
        filePath: 'empty.ts',
        imports: [],
        exports: [],
        externalDependencies: [],
        internalDependencies: []
      };
      
      const formatted = analyzer.formatDependencies(result);
      
      expect(formatted).toBe('Dependencies for: empty.ts\n');
    });
  });
});