import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { gitOperationTool } from '../../src/tools/git';

const execAsync = promisify(exec);

/**
 * Initialise a temporary git repository for testing.
 * Returns the path to the repo root.
 */
async function initTmpRepo(): Promise<string> {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-git-test-'));
  await execAsync('git init', { cwd: repoDir });
  await execAsync('git config user.email "test@aibo.local"', { cwd: repoDir });
  await execAsync('git config user.name "Aibo Test"', { cwd: repoDir });
  return repoDir;
}

/** Remove the temporary directory after a test. */
function cleanupTmpRepo(repoDir: string) {
  fs.rmSync(repoDir, { recursive: true, force: true });
}

describe('gitOperationTool', () => {
  test('tool has correct name and schema', () => {
    expect(gitOperationTool.name).toBe('git_operation');
    expect(gitOperationTool.description).toContain('status');
    expect(gitOperationTool.description).toContain('diff');
    const schema = gitOperationTool.schema;
    expect(schema.shape.operation).toBeDefined();
    expect(schema.shape.args).toBeDefined();
    expect(schema.shape.cwd).toBeDefined();
    expect(schema.shape.timeout).toBeDefined();
  });

  describe('status', () => {
    let repoDir: string;

    beforeEach(async () => {
      repoDir = await initTmpRepo();
    });

    afterEach(() => cleanupTmpRepo(repoDir));

    test('returns success:true for a clean repo', async () => {
      const raw = await gitOperationTool.invoke({ operation: 'status', cwd: repoDir });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.operation).toBe('status');
      expect(typeof result.output).toBe('string');
    });

    test('lists untracked files', async () => {
      fs.writeFileSync(path.join(repoDir, 'hello.ts'), 'export const x = 1;\n', 'utf-8');
      const raw = await gitOperationTool.invoke({ operation: 'status', cwd: repoDir });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.output).toContain('hello.ts');
    });
  });

  describe('add and commit', () => {
    let repoDir: string;

    beforeEach(async () => {
      repoDir = await initTmpRepo();
    });

    afterEach(() => cleanupTmpRepo(repoDir));

    test('stages a file', async () => {
      const filePath = path.join(repoDir, 'readme.md');
      fs.writeFileSync(filePath, '# hello\n', 'utf-8');

      const addRaw = await gitOperationTool.invoke({
        operation: 'add',
        args: ['.'],
        cwd: repoDir,
      });
      const addResult = JSON.parse(addRaw);
      expect(addResult.success).toBe(true);

      // After add, status should show staged file
      const statusRaw = await gitOperationTool.invoke({ operation: 'status', cwd: repoDir });
      const statusResult = JSON.parse(statusRaw);
      expect(statusResult.output).toContain('readme.md');
    });

    test('creates a commit', async () => {
      const filePath = path.join(repoDir, 'index.ts');
      fs.writeFileSync(filePath, 'export {};\n', 'utf-8');
      await gitOperationTool.invoke({ operation: 'add', args: ['.'], cwd: repoDir });

      const commitRaw = await gitOperationTool.invoke({
        operation: 'commit',
        args: ['-m', 'test: initial commit'],
        cwd: repoDir,
      });
      const commitResult = JSON.parse(commitRaw);
      expect(commitResult.success).toBe(true);
    });
  });

  describe('log', () => {
    let repoDir: string;

    beforeEach(async () => {
      repoDir = await initTmpRepo();
      // create a commit to have a log to read
      fs.writeFileSync(path.join(repoDir, 'a.txt'), 'a\n', 'utf-8');
      await execAsync('git add .', { cwd: repoDir });
      await execAsync('git commit -m "initial"', { cwd: repoDir });
    });

    afterEach(() => cleanupTmpRepo(repoDir));

    test('returns commit log', async () => {
      const raw = await gitOperationTool.invoke({
        operation: 'log',
        args: ['-5', '--oneline'],
        cwd: repoDir,
      });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.output).toContain('initial');
    });
  });

  describe('diff', () => {
    let repoDir: string;

    beforeEach(async () => {
      repoDir = await initTmpRepo();
      fs.writeFileSync(path.join(repoDir, 'b.ts'), 'const x = 1;\n', 'utf-8');
      await execAsync('git add .', { cwd: repoDir });
      await execAsync('git commit -m "base"', { cwd: repoDir });
    });

    afterEach(() => cleanupTmpRepo(repoDir));

    test('shows unstaged diff', async () => {
      fs.writeFileSync(path.join(repoDir, 'b.ts'), 'const x = 42;\n', 'utf-8');
      const raw = await gitOperationTool.invoke({ operation: 'diff', cwd: repoDir });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.output).toContain('+const x = 42;');
    });

    test('shows staged diff', async () => {
      fs.writeFileSync(path.join(repoDir, 'b.ts'), 'const x = 99;\n', 'utf-8');
      await execAsync('git add .', { cwd: repoDir });
      const raw = await gitOperationTool.invoke({
        operation: 'diff',
        args: ['--staged'],
        cwd: repoDir,
      });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.output).toContain('+const x = 99;');
    });
  });

  describe('blame', () => {
    let repoDir: string;

    beforeEach(async () => {
      repoDir = await initTmpRepo();
      fs.writeFileSync(path.join(repoDir, 'c.ts'), 'const hello = "world";\n', 'utf-8');
      await execAsync('git add .', { cwd: repoDir });
      await execAsync('git commit -m "add c"', { cwd: repoDir });
    });

    afterEach(() => cleanupTmpRepo(repoDir));

    test('returns blame output for a committed file', async () => {
      const raw = await gitOperationTool.invoke({
        operation: 'blame',
        args: ['c.ts'],
        cwd: repoDir,
      });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.output).toContain('hello');
    });
  });

  describe('branch', () => {
    let repoDir: string;

    beforeEach(async () => {
      repoDir = await initTmpRepo();
      fs.writeFileSync(path.join(repoDir, 'd.txt'), 'd\n', 'utf-8');
      await execAsync('git add .', { cwd: repoDir });
      await execAsync('git commit -m "init"', { cwd: repoDir });
    });

    afterEach(() => cleanupTmpRepo(repoDir));

    test('lists branches', async () => {
      const raw = await gitOperationTool.invoke({ operation: 'branch', cwd: repoDir });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      // HEAD branch name (main or master depending on git config)
      expect(result.output).toMatch(/main|master/);
    });
  });

  describe('checkout', () => {
    let repoDir: string;

    beforeEach(async () => {
      repoDir = await initTmpRepo();
      fs.writeFileSync(path.join(repoDir, 'e.txt'), 'e\n', 'utf-8');
      await execAsync('git add .', { cwd: repoDir });
      await execAsync('git commit -m "init"', { cwd: repoDir });
    });

    afterEach(() => cleanupTmpRepo(repoDir));

    test('creates and switches to a new branch', async () => {
      const raw = await gitOperationTool.invoke({
        operation: 'checkout',
        args: ['-b', 'feature/test-branch'],
        cwd: repoDir,
      });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);

      const branchRaw = await gitOperationTool.invoke({ operation: 'branch', cwd: repoDir });
      const branchResult = JSON.parse(branchRaw);
      expect(branchResult.output).toContain('feature/test-branch');
    });
  });

  describe('error handling', () => {
    test('returns success:false when run outside a git repo', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-no-git-'));
      try {
        const raw = await gitOperationTool.invoke({ operation: 'status', cwd: tmpDir });
        const result = JSON.parse(raw);
        expect(result.success).toBe(false);
        expect(typeof result.error).toBe('string');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('rejects unsafe shell-injection arguments', async () => {
      // The tool should catch the unsafe arg and return success:false
      const raw = await gitOperationTool.invoke({
        operation: 'status',
        args: ['$(rm -rf /)'],
        cwd: process.cwd(),
      });
      const result = JSON.parse(raw);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsafe argument');
    });
  });
});
