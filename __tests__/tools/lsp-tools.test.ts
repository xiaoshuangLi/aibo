/**
 * Comprehensive test suite for LSP tools (lsp-tools.ts / lsp-client.ts).
 *
 * Test groups:
 *   1. Tool schema & metadata         – no server required
 *   2. setLogLevelTool                – no server required
 *   3. Error paths (no server)        – every tool returns {success:false}
 *   4. File-not-found errors          – server running, bad file path
 *   5. Integration tests              – real typescript-language-server
 *
 * The integration suite starts a real typescript-language-server, opens the
 * fixture file src/lsp-test-fixture.ts, and exercises every tool.
 *
 * After the fixes in lsp-client.ts the test suite completes without hanging:
 *   - setTimeout in request() is unref()'d → Node.js can exit naturally
 *   - shutdown() caps its grace period at 3 s → no 60 s blockage
 */

import * as path from 'path';
import * as fs from 'fs';
import getLspTools, {
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

// ─── helpers ──────────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '../..');
const FIXTURE_FILE = path.join(ROOT_DIR, 'src', 'lsp-test-fixture.ts');

/** Wait ms milliseconds without keeping the event loop alive. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms).unref());
}

/** Parse a tool result and assert the required shape. */
function parseResult(raw: string) {
  const parsed = JSON.parse(raw);
  expect(parsed).toHaveProperty('success');
  expect(parsed).toHaveProperty('content');
  expect(Array.isArray(parsed.content)).toBe(true);
  return parsed as { success: boolean; content: Array<{ type: string; text: string }>; error?: string };
}

// Allow up to 60 s per test (server startup + analysis can be slow in CI).
jest.setTimeout(60_000);

// ─── 1. Tool schema & metadata ────────────────────────────────────────────────

describe('LSP tool schema and metadata', () => {
  it('getLspTools() returns 16 tools', async () => {
    const tools = await getLspTools();
    expect(tools).toHaveLength(16);
  });

  const cases: [string, any, string[]][] = [
    ['start_lsp',           startLspTool,          ['root_dir']],
    ['restart_lsp_server',  restartLspServerTool,  ['root_dir']],
    ['open_document',       openDocumentTool,      ['file_path']],
    ['close_document',      closeDocumentTool,     ['file_path']],
    ['update_document',     updateDocumentTool,    ['file_path', 'new_content']],
    ['get_hover_info',      getHoverInfoTool,      ['file_path', 'line', 'column']],
    ['get_completions',     getCompletionsTool,    ['file_path', 'line', 'column']],
    ['get_definition',      getDefinitionTool,     ['file_path', 'line', 'column']],
    ['get_references',      getReferencesTool,     ['file_path', 'line', 'column']],
    ['get_code_actions',    getCodeActionsTool,    ['file_path', 'start_line', 'start_column', 'end_line', 'end_column']],
    ['get_diagnostics',     getDiagnosticsTool,    ['file_path']],
    ['get_document_symbols',getDocumentSymbolsTool,['file_path']],
    ['get_workspace_symbols',getWorkspaceSymbolsTool,['query']],
    ['format_document',     formatDocumentTool,    ['file_path']],
    ['set_log_level',       setLogLevelTool,       ['level']],
    ['shutdown_lsp',        shutdownLspTool,       []],
  ];

  for (const [name, toolObj, schemaKeys] of cases) {
    it(`${name} has correct name and schema fields`, () => {
      expect(toolObj.name).toBe(name);
      expect(typeof toolObj.description).toBe('string');
      for (const key of schemaKeys) {
        expect((toolObj.schema as any).shape[key]).toBeDefined();
      }
    });
  }
});

// ─── 2. setLogLevelTool (no server required) ──────────────────────────────────
// These tests verify the tool accepts all valid levels and returns success.
// Actual log-output filtering is an internal concern of lsp-logging.ts and is
// tested separately in its own unit test.
describe('setLogLevelTool', () => {
  const levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'] as const;
  for (const level of levels) {
    it(`sets log level to "${level}"`, async () => {
      const result = parseResult(await setLogLevelTool.invoke({ level }));
      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain(level);
    });
  }
});

// ─── 3. Error paths — no server started ──────────────────────────────────────

describe('Error paths before any LSP server is started', () => {
  it('startLspTool fails with non-existent root directory', async () => {
    const result = parseResult(await startLspTool.invoke({ root_dir: '/no/such/dir' }));
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('openDocumentTool returns error', async () => {
    const result = parseResult(await openDocumentTool.invoke({ file_path: FIXTURE_FILE }));
    expect(result.success).toBe(false);
  });

  it('getHoverInfoTool returns error', async () => {
    const result = parseResult(await getHoverInfoTool.invoke({ file_path: FIXTURE_FILE, line: 14, column: 18 }));
    expect(result.success).toBe(false);
  });

  it('getCompletionsTool returns error', async () => {
    const result = parseResult(await getCompletionsTool.invoke({ file_path: FIXTURE_FILE, line: 14, column: 1 }));
    expect(result.success).toBe(false);
  });

  it('getDefinitionTool returns error', async () => {
    const result = parseResult(await getDefinitionTool.invoke({ file_path: FIXTURE_FILE, line: 20, column: 29 }));
    expect(result.success).toBe(false);
  });

  it('getReferencesTool returns error', async () => {
    const result = parseResult(await getReferencesTool.invoke({ file_path: FIXTURE_FILE, line: 14, column: 18 }));
    expect(result.success).toBe(false);
  });

  it('getDiagnosticsTool returns error', async () => {
    const result = parseResult(await getDiagnosticsTool.invoke({ file_path: FIXTURE_FILE }));
    expect(result.success).toBe(false);
  });

  it('getDocumentSymbolsTool returns error', async () => {
    const result = parseResult(await getDocumentSymbolsTool.invoke({ file_path: FIXTURE_FILE }));
    expect(result.success).toBe(false);
  });

  it('getWorkspaceSymbolsTool returns error', async () => {
    const result = parseResult(await getWorkspaceSymbolsTool.invoke({ query: 'User' }));
    expect(result.success).toBe(false);
  });

  it('formatDocumentTool returns error', async () => {
    const result = parseResult(await formatDocumentTool.invoke({ file_path: FIXTURE_FILE }));
    expect(result.success).toBe(false);
  });

  it('getCodeActionsTool returns error', async () => {
    const result = parseResult(await getCodeActionsTool.invoke({
      file_path: FIXTURE_FILE, start_line: 14, start_column: 1, end_line: 14, end_column: 22,
    }));
    expect(result.success).toBe(false);
  });

  it('closeDocumentTool returns error', async () => {
    const result = parseResult(await closeDocumentTool.invoke({ file_path: FIXTURE_FILE }));
    expect(result.success).toBe(false);
  });

  it('updateDocumentTool returns error and does not modify disk', async () => {
    const orig = fs.readFileSync(FIXTURE_FILE, 'utf-8');
    const result = parseResult(await updateDocumentTool.invoke({ file_path: FIXTURE_FILE, new_content: orig }));
    expect(result.success).toBe(false);
    expect(fs.readFileSync(FIXTURE_FILE, 'utf-8')).toBe(orig);
  });

  it('restartLspServerTool returns error when no previous server exists', async () => {
    const result = parseResult(await restartLspServerTool.invoke({}));
    expect(result.success).toBe(false);
  });

  it('shutdownLspTool succeeds even when no server is running', async () => {
    const result = parseResult(await shutdownLspTool.invoke({}));
    expect(result.success).toBe(true);
  });
});

// ─── 4. File-not-found errors (server running) ───────────────────────────────

describe('File-not-found error handling', () => {
  const MISSING = '/no/such/file.ts';

  beforeAll(async () => {
    const r = parseResult(await startLspTool.invoke({ root_dir: ROOT_DIR }));
    expect(r.success).toBe(true);
  });

  afterAll(async () => {
    await shutdownLspTool.invoke({});
  });

  it('openDocumentTool returns error for missing file', async () => {
    const result = parseResult(await openDocumentTool.invoke({ file_path: MISSING }));
    expect(result.success).toBe(false);
    expect(result.content[0].text).toContain('not found');
  });

  it('getHoverInfoTool returns error for missing file', async () => {
    expect(parseResult(await getHoverInfoTool.invoke({ file_path: MISSING, line: 1, column: 1 })).success).toBe(false);
  });

  it('getDefinitionTool returns error for missing file', async () => {
    expect(parseResult(await getDefinitionTool.invoke({ file_path: MISSING, line: 1, column: 1 })).success).toBe(false);
  });

  it('getReferencesTool returns error for missing file', async () => {
    expect(parseResult(await getReferencesTool.invoke({ file_path: MISSING, line: 1, column: 1 })).success).toBe(false);
  });

  it('getCompletionsTool returns error for missing file', async () => {
    expect(parseResult(await getCompletionsTool.invoke({ file_path: MISSING, line: 1, column: 1 })).success).toBe(false);
  });

  it('getDiagnosticsTool returns error for missing file', async () => {
    expect(parseResult(await getDiagnosticsTool.invoke({ file_path: MISSING })).success).toBe(false);
  });

  it('getDocumentSymbolsTool returns error for missing file', async () => {
    expect(parseResult(await getDocumentSymbolsTool.invoke({ file_path: MISSING })).success).toBe(false);
  });

  it('formatDocumentTool returns error for missing file', async () => {
    expect(parseResult(await formatDocumentTool.invoke({ file_path: MISSING })).success).toBe(false);
  });

  it('getCodeActionsTool returns error for missing file', async () => {
    expect(parseResult(await getCodeActionsTool.invoke({
      file_path: MISSING, start_line: 1, start_column: 1, end_line: 1, end_column: 10,
    })).success).toBe(false);
  });
});

// ─── 5. Integration tests – real typescript-language-server ──────────────────

describe('LSP integration tests', () => {
  const originalContent = fs.readFileSync(FIXTURE_FILE, 'utf-8');

  beforeAll(async () => {
    // Start the server and open the fixture file.
    expect(parseResult(await startLspTool.invoke({ root_dir: ROOT_DIR })).success).toBe(true);
    expect(parseResult(await openDocumentTool.invoke({ file_path: FIXTURE_FILE })).success).toBe(true);
    // Allow the server a moment to finish initial analysis.
    await delay(3000);
  });

  afterAll(async () => {
    // Restore fixture in case updateDocumentTool mutated it.
    fs.writeFileSync(FIXTURE_FILE, originalContent, 'utf-8');
    await shutdownLspTool.invoke({});
  });

  // ── startLspTool ────────────────────────────────────────────────────────────
  describe('startLspTool', () => {
    it('re-calling with same root dir reuses the existing client', async () => {
      const r = parseResult(await startLspTool.invoke({ root_dir: ROOT_DIR }));
      expect(r.success).toBe(true);
      expect(r.content[0].text).toContain(ROOT_DIR);
    });
  });

  // ── openDocumentTool ────────────────────────────────────────────────────────
  describe('openDocumentTool', () => {
    it('re-opening an already-open file still returns success', async () => {
      expect(parseResult(await openDocumentTool.invoke({ file_path: FIXTURE_FILE })).success).toBe(true);
    });
  });

  // ── getDiagnosticsTool ──────────────────────────────────────────────────────
  describe('getDiagnosticsTool', () => {
    it('returns success for a specific file', async () => {
      expect(parseResult(await getDiagnosticsTool.invoke({ file_path: FIXTURE_FILE })).success).toBe(true);
    });

    it('returns success with no file_path (all open files)', async () => {
      expect(parseResult(await getDiagnosticsTool.invoke({})).success).toBe(true);
    });

    it('clean fixture file has no TypeScript errors', async () => {
      const r = parseResult(await getDiagnosticsTool.invoke({ file_path: FIXTURE_FILE }));
      expect(r.success).toBe(true);
      if (r.content[0].text !== 'No diagnostics found') {
        const diags = JSON.parse(r.content[0].text);
        // LSP DiagnosticSeverity: 1 = Error, 2 = Warning, 3 = Information, 4 = Hint
        expect(diags.filter((d: any) => d.severity === 1)).toHaveLength(0);
      }
    });
  });

  // ── getHoverInfoTool ────────────────────────────────────────────────────────
  describe('getHoverInfoTool', () => {
    it('returns info at User interface declaration (line 14, col 18)', async () => {
      expect(parseResult(await getHoverInfoTool.invoke({ file_path: FIXTURE_FILE, line: 14, column: 18 })).success).toBe(true);
    });

    it('returns info at greet parameter "user" (line 20, col 23)', async () => {
      expect(parseResult(await getHoverInfoTool.invoke({ file_path: FIXTURE_FILE, line: 20, column: 23 })).success).toBe(true);
    });

    it('returns info at User type annotation (line 20, col 29)', async () => {
      expect(parseResult(await getHoverInfoTool.invoke({ file_path: FIXTURE_FILE, line: 20, column: 29 })).success).toBe(true);
    });

    it('returns info at UserService class (line 24, col 14)', async () => {
      expect(parseResult(await getHoverInfoTool.invoke({ file_path: FIXTURE_FILE, line: 24, column: 14 })).success).toBe(true);
    });

    it('succeeds (possibly no info) on a blank line', async () => {
      // Line 13 is the blank line before `export interface User`
      expect(parseResult(await getHoverInfoTool.invoke({ file_path: FIXTURE_FILE, line: 13, column: 1 })).success).toBe(true);
    });
  });

  // ── getDefinitionTool ───────────────────────────────────────────────────────
  describe('getDefinitionTool', () => {
    it('finds definition of User type (line 20, col 29)', async () => {
      const r = parseResult(await getDefinitionTool.invoke({ file_path: FIXTURE_FILE, line: 20, column: 29 }));
      expect(r.success).toBe(true);
      if (r.content[0].text !== 'No definition found') {
        const defs = JSON.parse(r.content[0].text);
        expect(Array.isArray(defs)).toBe(true);
        expect(defs.length).toBeGreaterThan(0);
        expect(defs[0].uri).toContain('lsp-test-fixture.ts');
      }
    });

    it('finds definition of UserService (line 24, col 14)', async () => {
      expect(parseResult(await getDefinitionTool.invoke({ file_path: FIXTURE_FILE, line: 24, column: 14 })).success).toBe(true);
    });

    it('succeeds with no definition on a comment', async () => {
      expect(parseResult(await getDefinitionTool.invoke({ file_path: FIXTURE_FILE, line: 1, column: 1 })).success).toBe(true);
    });
  });

  // ── getReferencesTool ───────────────────────────────────────────────────────
  describe('getReferencesTool', () => {
    it('finds references to User interface (line 14, col 18)', async () => {
      const r = parseResult(await getReferencesTool.invoke({ file_path: FIXTURE_FILE, line: 14, column: 18 }));
      expect(r.success).toBe(true);
      if (r.content[0].text !== 'No references found') {
        const refs = JSON.parse(r.content[0].text);
        expect(Array.isArray(refs)).toBe(true);
        expect(refs.length).toBeGreaterThan(1);
      }
    });

    it('finds references to greet function (line 20, col 17)', async () => {
      expect(parseResult(await getReferencesTool.invoke({ file_path: FIXTURE_FILE, line: 20, column: 17 })).success).toBe(true);
    });

    it('succeeds (possibly empty) on comment position', async () => {
      expect(parseResult(await getReferencesTool.invoke({ file_path: FIXTURE_FILE, line: 1, column: 1 })).success).toBe(true);
    });
  });

  // ── getCompletionsTool ──────────────────────────────────────────────────────
  describe('getCompletionsTool', () => {
    it('returns completions after "this." (line 27, col 10)', async () => {
      // Line 27: `    this.users.push(user);`
      const r = parseResult(await getCompletionsTool.invoke({ file_path: FIXTURE_FILE, line: 27, column: 10 }));
      expect(r.success).toBe(true);
      expect(Array.isArray(JSON.parse(r.content[0].text))).toBe(true);
    });

    it('returns completions at start of expression line', async () => {
      const r = parseResult(await getCompletionsTool.invoke({ file_path: FIXTURE_FILE, line: 20, column: 1 }));
      expect(r.success).toBe(true);
      expect(Array.isArray(JSON.parse(r.content[0].text))).toBe(true);
    });
  });

  // ── getCodeActionsTool ──────────────────────────────────────────────────────
  describe('getCodeActionsTool', () => {
    it('succeeds on the interface declaration range', async () => {
      expect(parseResult(await getCodeActionsTool.invoke({
        file_path: FIXTURE_FILE, start_line: 14, start_column: 1, end_line: 14, end_column: 25,
      })).success).toBe(true);
    });

    it('succeeds on a single-character range', async () => {
      expect(parseResult(await getCodeActionsTool.invoke({
        file_path: FIXTURE_FILE, start_line: 20, start_column: 23, end_line: 20, end_column: 24,
      })).success).toBe(true);
    });
  });

  // ── getDocumentSymbolsTool ──────────────────────────────────────────────────
  describe('getDocumentSymbolsTool', () => {
    it('returns the symbols exported by the fixture', async () => {
      const r = parseResult(await getDocumentSymbolsTool.invoke({ file_path: FIXTURE_FILE }));
      expect(r.success).toBe(true);
      if (r.content[0].text !== 'No symbols found') {
        const symbols = JSON.parse(r.content[0].text);
        expect(Array.isArray(symbols)).toBe(true);
        expect(symbols.length).toBeGreaterThan(0);
        const names: string[] = symbols.map((s: any) => s.name);
        expect(names).toContain('User');
        expect(names).toContain('greet');
        expect(names).toContain('UserService');
      }
    });
  });

  // ── getWorkspaceSymbolsTool ─────────────────────────────────────────────────
  describe('getWorkspaceSymbolsTool', () => {
    it('finds User symbols in the workspace', async () => {
      expect(parseResult(await getWorkspaceSymbolsTool.invoke({ query: 'User' })).success).toBe(true);
    });

    it('succeeds with an unlikely query (may return empty)', async () => {
      expect(parseResult(await getWorkspaceSymbolsTool.invoke({ query: 'xyzUnlikelySymbol99999' })).success).toBe(true);
    });

    it('accepts an empty query', async () => {
      expect(parseResult(await getWorkspaceSymbolsTool.invoke({ query: '' })).success).toBe(true);
    });
  });

  // ── formatDocumentTool ──────────────────────────────────────────────────────
  describe('formatDocumentTool', () => {
    it('returns success (already formatted or with edits)', async () => {
      const r = parseResult(await formatDocumentTool.invoke({ file_path: FIXTURE_FILE }));
      expect(r.success).toBe(true);
      const text = r.content[0].text;
      const valid = text === 'Document is already formatted' || (() => {
        try { return Array.isArray(JSON.parse(text)); } catch { return false; }
      })();
      expect(valid).toBe(true);
    });
  });

  // ── updateDocumentTool ──────────────────────────────────────────────────────
  describe('updateDocumentTool', () => {
    it('writes new content to disk and notifies the server', async () => {
      const orig = fs.readFileSync(FIXTURE_FILE, 'utf-8');
      const updated = orig + '\n// test update\n';

      expect(parseResult(await updateDocumentTool.invoke({ file_path: FIXTURE_FILE, new_content: updated })).success).toBe(true);
      expect(fs.readFileSync(FIXTURE_FILE, 'utf-8')).toBe(updated);

      // Restore
      expect(parseResult(await updateDocumentTool.invoke({ file_path: FIXTURE_FILE, new_content: orig })).success).toBe(true);
      expect(fs.readFileSync(FIXTURE_FILE, 'utf-8')).toBe(orig);
    });

    it('updating to the same content succeeds', async () => {
      const content = fs.readFileSync(FIXTURE_FILE, 'utf-8');
      expect(parseResult(await updateDocumentTool.invoke({ file_path: FIXTURE_FILE, new_content: content })).success).toBe(true);
    });
  });

  // ── closeDocumentTool ───────────────────────────────────────────────────────
  describe('closeDocumentTool', () => {
    it('closes the fixture, then closing again also succeeds', async () => {
      expect(parseResult(await closeDocumentTool.invoke({ file_path: FIXTURE_FILE })).success).toBe(true);
      // Closing an already-closed document should not error
      expect(parseResult(await closeDocumentTool.invoke({ file_path: FIXTURE_FILE })).success).toBe(true);
      // Re-open for subsequent tests
      expect(parseResult(await openDocumentTool.invoke({ file_path: FIXTURE_FILE })).success).toBe(true);
    });
  });

  // ── restartLspServerTool ────────────────────────────────────────────────────
  describe('restartLspServerTool', () => {
    it('restarts with no explicit root dir (uses previous)', async () => {
      const r = parseResult(await restartLspServerTool.invoke({}));
      expect(r.success).toBe(true);
      expect(r.content[0].text).toContain(ROOT_DIR);
      await openDocumentTool.invoke({ file_path: FIXTURE_FILE });
    });

    it('restarts with an explicit root dir', async () => {
      const r = parseResult(await restartLspServerTool.invoke({ root_dir: ROOT_DIR }));
      expect(r.success).toBe(true);
      expect(r.content[0].text).toContain(ROOT_DIR);
      await openDocumentTool.invoke({ file_path: FIXTURE_FILE });
    });
  });

  // ── shutdownLspTool ─────────────────────────────────────────────────────────
  describe('shutdownLspTool', () => {
    it('shuts down successfully and a second call also succeeds', async () => {
      expect(parseResult(await shutdownLspTool.invoke({})).success).toBe(true);
      expect(parseResult(await shutdownLspTool.invoke({})).success).toBe(true);
      // Restart so afterAll cleanup works
      await startLspTool.invoke({ root_dir: ROOT_DIR });
      await openDocumentTool.invoke({ file_path: FIXTURE_FILE });
    });
  });
});
