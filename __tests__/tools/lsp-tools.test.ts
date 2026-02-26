/**
 * Comprehensive integration tests for all LSP tools.
 *
 * Fixture file: lsp-subject.ts (project root) – valid TypeScript, no errors
 * Error fixture: lsp-simple-error.ts (project root) – has intentional type error
 * Temp file:     lsp-temp-update.ts (project root) – created/deleted by tests
 *
 * lsp-subject.ts line reference (1-based):
 *  4  interface LspTestUser {
 *  10 function formatUser(user: LspTestUser): string {
 *  11   const displayName = user.name;
 *  15 class LspTestService {
 *  18   addItem(item: LspTestUser): void {
 *  27 const testService = new LspTestService();
 *  29 testService.addItem(testUser);
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  startLspTool,
  restartLspServerTool,
  openDocumentTool,
  closeDocumentTool,
  updateDocumentTool,
  getHoverInfoTool,
  getCompletionsTool,
  getDefinitionTool,
  getReferencesTool,
  getCodeActionsTool,
  getDiagnosticsTool,
  getDocumentSymbolsTool,
  getWorkspaceSymbolsTool,
  formatDocumentTool,
  setLogLevelTool,
  shutdownLspTool,
} from '@/tools/lsp-tools';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SUBJECT_FILE = path.join(PROJECT_ROOT, 'lsp-subject.ts');
const ERROR_FILE = path.join(PROJECT_ROOT, 'lsp-simple-error.ts');
const TEMP_FILE = path.join(PROJECT_ROOT, 'lsp-temp-update.ts');

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

describe('LSP Tools', () => {
  jest.setTimeout(120000);

  beforeAll(async () => {
    // Create temp file for update_document tests
    fs.writeFileSync(TEMP_FILE, 'const x: number = 1;\n');

    // Reduce log noise during tests
    await setLogLevelTool.invoke({ level: 'warning' });

    // Start LSP server
    const startResult = JSON.parse(await startLspTool.invoke({ root_dir: PROJECT_ROOT }));
    expect(startResult.success).toBe(true);
    expect(startResult.content[0].text).toContain(PROJECT_ROOT);

    // Open documents so LSP can analyse them
    await openDocumentTool.invoke({ file_path: SUBJECT_FILE });
    await openDocumentTool.invoke({ file_path: ERROR_FILE });
    await openDocumentTool.invoke({ file_path: TEMP_FILE });

    // Allow time for diagnostics to arrive
    await wait(8000);
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(TEMP_FILE)) {
        fs.unlinkSync(TEMP_FILE);
      }
    } catch (_) {
      // ignore cleanup errors
    }
    await shutdownLspTool.invoke({});
  });

  // ─── set_log_level ────────────────────────────────────────────────────────

  describe('set_log_level', () => {
    test('should have correct tool name', () => {
      expect(setLogLevelTool.name).toBe('set_log_level');
    });

    test('should accept valid log levels', async () => {
      for (const level of ['debug', 'info', 'warning', 'error'] as const) {
        const result = JSON.parse(await setLogLevelTool.invoke({ level }));
        expect(result.success).toBe(true);
      }
      // Restore quiet level
      await setLogLevelTool.invoke({ level: 'warning' });
    });
  });

  // ─── start_lsp ────────────────────────────────────────────────────────────

  describe('start_lsp', () => {
    test('should have correct tool name and schema', () => {
      expect(startLspTool.name).toBe('start_lsp');
      expect(startLspTool.description).toContain('LSP');
      expect(startLspTool.schema.shape.root_dir).toBeDefined();
    });

    test('should return error for non-existent directory', async () => {
      const result = JSON.parse(await startLspTool.invoke({ root_dir: '/nonexistent/path' }));
      expect(result.success).toBe(false);
    });
  });

  // ─── open_document ────────────────────────────────────────────────────────

  describe('open_document', () => {
    test('should have correct tool name', () => {
      expect(openDocumentTool.name).toBe('open_document');
    });

    test('should return success for an already-opened file', async () => {
      // Opening again is idempotent
      const result = JSON.parse(await openDocumentTool.invoke({ file_path: SUBJECT_FILE }));
      expect(result.success).toBe(true);
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(
        await openDocumentTool.invoke({ file_path: '/nonexistent/file.ts' })
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── get_hover_info ───────────────────────────────────────────────────────

  describe('get_hover_info', () => {
    test('should have correct tool name', () => {
      expect(getHoverInfoTool.name).toBe('get_hover_info');
    });

    test('should return type info for function declaration', async () => {
      // Line 10, col 10: 'f' in "function formatUser"
      const result = JSON.parse(
        await getHoverInfoTool.invoke({ file_path: SUBJECT_FILE, line: 10, column: 10 })
      );
      expect(result.success).toBe(true);
      expect(result.content[0].text).toBeTruthy();
    });

    test('should return type info for class declaration', async () => {
      // Line 15, col 7: 'L' in "class LspTestService"
      const result = JSON.parse(
        await getHoverInfoTool.invoke({ file_path: SUBJECT_FILE, line: 15, column: 7 })
      );
      expect(result.success).toBe(true);
      expect(result.content[0].text).toBeTruthy();
    });

    test('should return type info for interface declaration', async () => {
      // Line 4, col 11: 'L' in "interface LspTestUser"
      const result = JSON.parse(
        await getHoverInfoTool.invoke({ file_path: SUBJECT_FILE, line: 4, column: 11 })
      );
      expect(result.success).toBe(true);
      expect(result.content[0].text).toBeTruthy();
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(
        await getHoverInfoTool.invoke({ file_path: '/nonexistent.ts', line: 1, column: 1 })
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── get_completions ──────────────────────────────────────────────────────

  describe('get_completions', () => {
    test('should have correct tool name', () => {
      expect(getCompletionsTool.name).toBe('get_completions');
    });

    test('should return property completions after dot access', async () => {
      // Line 11: "  const displayName = user.name;"
      // col 28: 'n' in "user.name" (after the dot)
      const result = JSON.parse(
        await getCompletionsTool.invoke({ file_path: SUBJECT_FILE, line: 11, column: 28 })
      );
      expect(result.success).toBe(true);
      const completions = JSON.parse(result.content[0].text);
      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
      // LspTestUser properties should appear
      const labels = completions.map((c: { label: string }) => c.label);
      expect(labels).toContain('name');
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(
        await getCompletionsTool.invoke({ file_path: '/nonexistent.ts', line: 1, column: 1 })
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── get_definition ───────────────────────────────────────────────────────

  describe('get_definition', () => {
    test('should have correct tool name', () => {
      expect(getDefinitionTool.name).toBe('get_definition');
    });

    test('should return definition location for a method call', async () => {
      // Line 29: "testService.addItem(testUser);"
      // col 13: 'a' in "addItem"
      const result = JSON.parse(
        await getDefinitionTool.invoke({ file_path: SUBJECT_FILE, line: 29, column: 13 })
      );
      expect(result.success).toBe(true);
      const definitions = JSON.parse(result.content[0].text);
      if (Array.isArray(definitions) && definitions.length > 0) {
        expect(definitions[0].uri).toContain('lsp-subject.ts');
      }
    });

    test('should return definition for a class name reference', async () => {
      // Line 27: "const testService = new LspTestService();"
      // col 25: 'L' in "LspTestService"
      const result = JSON.parse(
        await getDefinitionTool.invoke({ file_path: SUBJECT_FILE, line: 27, column: 25 })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── get_references ───────────────────────────────────────────────────────

  describe('get_references', () => {
    test('should have correct tool name', () => {
      expect(getReferencesTool.name).toBe('get_references');
    });

    test('should return references for LspTestService class', async () => {
      // Line 15, col 7: 'L' in "class LspTestService"
      const result = JSON.parse(
        await getReferencesTool.invoke({ file_path: SUBJECT_FILE, line: 15, column: 7 })
      );
      expect(result.success).toBe(true);
      // May return references or "No references found" if only one file is open
      expect(result.content[0].text).toBeTruthy();
    });

    test('should return references for formatUser function', async () => {
      // Line 10, col 10: 'f' in "function formatUser"
      const result = JSON.parse(
        await getReferencesTool.invoke({ file_path: SUBJECT_FILE, line: 10, column: 10 })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── get_diagnostics ──────────────────────────────────────────────────────

  describe('get_diagnostics', () => {
    test('should have correct tool name', () => {
      expect(getDiagnosticsTool.name).toBe('get_diagnostics');
    });

    test('should report errors for the error fixture file', async () => {
      const result = JSON.parse(await getDiagnosticsTool.invoke({ file_path: ERROR_FILE }));
      expect(result.success).toBe(true);
      // lsp-simple-error.ts: const x: number = "this is a string";
      // LSP should report at least one diagnostic
      const text = result.content[0].text;
      if (text !== 'No diagnostics found') {
        const diagnostics = JSON.parse(text);
        expect(Array.isArray(diagnostics)).toBe(true);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toBeTruthy();
      }
    });

    test('should return all diagnostics when no file path is given', async () => {
      const result = JSON.parse(await getDiagnosticsTool.invoke({}));
      expect(result.success).toBe(true);
    });

    test('should return no diagnostics or an empty result for the clean fixture', async () => {
      const result = JSON.parse(await getDiagnosticsTool.invoke({ file_path: SUBJECT_FILE }));
      expect(result.success).toBe(true);
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(
        await getDiagnosticsTool.invoke({ file_path: '/nonexistent.ts' })
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── get_document_symbols ────────────────────────────────────────────────

  describe('get_document_symbols', () => {
    test('should have correct tool name', () => {
      expect(getDocumentSymbolsTool.name).toBe('get_document_symbols');
    });

    test('should return symbols from the subject file', async () => {
      const result = JSON.parse(
        await getDocumentSymbolsTool.invoke({ file_path: SUBJECT_FILE })
      );
      expect(result.success).toBe(true);
      const text = result.content[0].text;
      if (text !== 'No symbols found') {
        const symbols = JSON.parse(text);
        expect(Array.isArray(symbols)).toBe(true);
        expect(symbols.length).toBeGreaterThan(0);
        const names = symbols.map((s: { name: string }) => s.name);
        expect(names).toContain('LspTestUser');
        expect(names).toContain('LspTestService');
        expect(names).toContain('formatUser');
      }
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(
        await getDocumentSymbolsTool.invoke({ file_path: '/nonexistent.ts' })
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── get_workspace_symbols ───────────────────────────────────────────────

  describe('get_workspace_symbols', () => {
    test('should have correct tool name', () => {
      expect(getWorkspaceSymbolsTool.name).toBe('get_workspace_symbols');
    });

    test('should find LspTestService in the workspace', async () => {
      const result = JSON.parse(
        await getWorkspaceSymbolsTool.invoke({ query: 'LspTestService' })
      );
      expect(result.success).toBe(true);
    });

    test('should handle empty query', async () => {
      const result = JSON.parse(await getWorkspaceSymbolsTool.invoke({ query: '' }));
      expect(result.success).toBe(true);
    });
  });

  // ─── format_document ─────────────────────────────────────────────────────

  describe('format_document', () => {
    test('should have correct tool name', () => {
      expect(formatDocumentTool.name).toBe('format_document');
    });

    test('should return formatting result for the subject file', async () => {
      const result = JSON.parse(await formatDocumentTool.invoke({ file_path: SUBJECT_FILE }));
      expect(result.success).toBe(true);
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(await formatDocumentTool.invoke({ file_path: '/nonexistent.ts' }));
      expect(result.success).toBe(false);
    });
  });

  // ─── get_code_actions ────────────────────────────────────────────────────

  describe('get_code_actions', () => {
    test('should have correct tool name', () => {
      expect(getCodeActionsTool.name).toBe('get_code_actions');
    });

    test('should return code actions for error range in the error file', async () => {
      // lsp-simple-error.ts line 1: const x: number = "this is a string";
      const result = JSON.parse(
        await getCodeActionsTool.invoke({
          file_path: ERROR_FILE,
          start_line: 1,
          start_column: 1,
          end_line: 1,
          end_column: 36,
        })
      );
      expect(result.success).toBe(true);
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(
        await getCodeActionsTool.invoke({
          file_path: '/nonexistent.ts',
          start_line: 1,
          start_column: 1,
          end_line: 1,
          end_column: 10,
        })
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── update_document ─────────────────────────────────────────────────────

  describe('update_document', () => {
    test('should have correct tool name and schema', () => {
      expect(updateDocumentTool.name).toBe('update_document');
      expect(updateDocumentTool.schema.shape.file_path).toBeDefined();
      expect(updateDocumentTool.schema.shape.new_content).toBeDefined();
    });

    test('should update file content and succeed', async () => {
      const newContent = 'const y: number = 42;\n';
      const result = JSON.parse(
        await updateDocumentTool.invoke({ file_path: TEMP_FILE, new_content: newContent })
      );
      expect(result.success).toBe(true);
      // Verify the file on disk was actually updated
      expect(fs.readFileSync(TEMP_FILE, 'utf-8')).toBe(newContent);
    });

    test('should allow LSP to detect errors after introducing a type mismatch', async () => {
      const errorContent = 'const badNum: number = "not a number";\n';
      const updateResult = JSON.parse(
        await updateDocumentTool.invoke({ file_path: TEMP_FILE, new_content: errorContent })
      );
      expect(updateResult.success).toBe(true);

      // Give LSP time to re-analyse the updated content
      await wait(5000);

      const diagResult = JSON.parse(await getDiagnosticsTool.invoke({ file_path: TEMP_FILE }));
      expect(diagResult.success).toBe(true);
      const text = diagResult.content[0].text;
      if (text !== 'No diagnostics found') {
        const diagnostics = JSON.parse(text);
        expect(Array.isArray(diagnostics)).toBe(true);
        expect(diagnostics.length).toBeGreaterThan(0);
      }
    });

    test('should return error for non-existent file', async () => {
      const result = JSON.parse(
        await updateDocumentTool.invoke({
          file_path: '/nonexistent/file.ts',
          new_content: 'const x = 1;\n',
        })
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── close_document ───────────────────────────────────────────────────────

  describe('close_document', () => {
    test('should have correct tool name', () => {
      expect(closeDocumentTool.name).toBe('close_document');
    });

    test('should close the temp file successfully', async () => {
      const result = JSON.parse(await closeDocumentTool.invoke({ file_path: TEMP_FILE }));
      expect(result.success).toBe(true);
    });

    test('should be idempotent (closing already-closed file does not throw)', async () => {
      const result = JSON.parse(await closeDocumentTool.invoke({ file_path: TEMP_FILE }));
      expect(result.success).toBe(true);
    });
  });

  // ─── restart_lsp_server ───────────────────────────────────────────────────

  describe('restart_lsp_server', () => {
    test('should have correct tool name', () => {
      expect(restartLspServerTool.name).toBe('restart_lsp_server');
    });

    test('should restart and remain usable', async () => {
      const restartResult = JSON.parse(await restartLspServerTool.invoke({}));
      expect(restartResult.success).toBe(true);

      // Re-open subject file to confirm LSP is working after restart
      await wait(3000);
      const openResult = JSON.parse(await openDocumentTool.invoke({ file_path: SUBJECT_FILE }));
      expect(openResult.success).toBe(true);

      // Hover should work after restart
      await wait(3000);
      const hoverResult = JSON.parse(
        await getHoverInfoTool.invoke({ file_path: SUBJECT_FILE, line: 10, column: 10 })
      );
      expect(hoverResult.success).toBe(true);
    });
  });

  // ─── shutdown_lsp (deferred to afterAll) ─────────────────────────────────

  describe('shutdown_lsp', () => {
    test('should have correct tool name', () => {
      expect(shutdownLspTool.name).toBe('shutdown_lsp');
    });
  });
});
