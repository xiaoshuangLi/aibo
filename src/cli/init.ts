import fs from 'fs';
import path from 'path';

/**
 * CLI init command module for aibo.
 *
 * `aibo init` creates a `.aibo` directory in the current working directory
 * containing selective symbolic links to the subdirectories of the
 * globally-installed aibo package that are required at runtime (`agents` and
 * `skills`), then prints the GitHub README URL so the user can follow the
 * setup guide to configure their `.env`.
 *
 * @module cli/init
 */

/** GitHub README URL shown to the user after init. */
export const README_URL = 'https://github.com/xiaoshuangLi/aibo#readme';

/**
 * Resolves the root directory of the aibo npm package.
 *
 * When the package is installed globally the compiled file lives at
 * `<package-root>/dist/cli/init.js`, so the package root is two levels up from
 * `__dirname`.
 *
 * @returns Absolute path to the aibo package installation directory
 */
export function resolvePackageDir(): string {
  return path.resolve(__dirname, '..', '..');
}

/**
 * Subdirectories from the package that are linked into `.aibo`.
 * Only the directories actually consumed at runtime are included so that the
 * `.aibo` folder stays minimal and does not expose unrelated package internals
 * (e.g. `node_modules`, `dist`, `src`).
 */
export const AIBO_LINKED_SUBDIRS = ['agents', 'skills'] as const;

/**
 * Creates (or recreates) a `.aibo` directory inside `targetDir` that contains
 * selective symbolic links to the subdirectories of `packageDir` that are
 * required at runtime (`agents` and `skills`).
 *
 * Using a real directory with targeted sub-symlinks (rather than a single
 * directory symlink pointing at the entire package) avoids exposing
 * unrelated package internals through `.aibo`.
 *
 * @param targetDir - Directory in which `.aibo` should be created (usually cwd)
 * @param packageDir - Absolute path to the aibo package installation directory
 */
export function createAiboSymlink(targetDir: string, packageDir: string): void {
  const aiboPath = path.join(targetDir, '.aibo');

  try {
    const stat = fs.lstatSync(aiboPath);
    // Remove whatever is there (symlink, directory, or file) before recreating
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      fs.rmSync(aiboPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(aiboPath);
    }
  } catch {
    // Nothing to remove — that's fine
  }

  // Create .aibo as a real directory so that only the selected subdirectories
  // are accessible, rather than the entire package tree.
  fs.mkdirSync(aiboPath);

  for (const subdir of AIBO_LINKED_SUBDIRS) {
    const srcPath = path.join(packageDir, subdir);
    const destPath = path.join(aiboPath, subdir);
    try {
      fs.accessSync(srcPath);
      fs.symlinkSync(srcPath, destPath, 'dir');
    } catch {
      // Subdirectory doesn't exist in packageDir — skip silently
    }
  }
}

/**
 * Checks whether the current working directory requires `aibo init` to be run.
 *
 * Returns `true` when the user needs to run `aibo init` before other commands.
 * This is the case when:
 * 1. The cwd is NOT the aibo package directory (i.e., not running from inside the package)
 * 2. There is no `.aibo` folder/symlink in the cwd
 *
 * @returns `true` if `aibo init` is required, `false` otherwise
 */
export function isAiboInitRequired(): boolean {
  const cwd = process.cwd();
  const packageDir = resolvePackageDir();

  // Running from the package directory itself — no init required
  if (path.resolve(cwd) === path.resolve(packageDir)) {
    return false;
  }

  // Check for .aibo folder/symlink in current directory
  const aiboPath = path.join(cwd, '.aibo');
  try {
    fs.accessSync(aiboPath);
    return false;
  } catch {
    return true;
  }
}

/**
 * Prints a message telling the user they must run `aibo init` first.
 */
export function printInitRequired(): void {
  console.error('\n❌  No .aibo folder found in the current directory.');
  console.error('    Please run `aibo init` first to set up this directory.\n');
}

/**
 * Ensures that the given entries exist in the `.gitignore` file inside
 * `targetDir`.  If the file does not exist it is created.  Entries that are
 * already present are not duplicated.
 *
 * @param targetDir - Directory that contains (or should contain) `.gitignore`
 * @param entries   - Lines to add when they are not already present
 */
export function updateGitignore(targetDir: string, entries: string[]): void {
  const gitignorePath = path.join(targetDir, '.gitignore');

  let existing = '';
  try {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  } catch {
    // File doesn't exist yet — that's fine, we'll create it
  }

  const existingLines = new Set(existing.split('\n'));
  const toAdd = entries.filter(entry => !existingLines.has(entry));

  if (toAdd.length === 0) {
    return;
  }

  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, existing + separator + toAdd.join('\n') + '\n', 'utf-8');
}

/**
 * Entry point for `aibo init`.
 *
 * Creates the `.aibo` directory (containing selective sub-symlinks) in the
 * current working directory, adds `.data` and `.aibo` to the local
 * `.gitignore`, and prints the README URL so the user can follow the
 * configuration guide.
 */
export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  const packageDir = resolvePackageDir();

  console.log('\nWelcome to aibo init! 🎉\n');

  // Create .aibo directory with selective sub-symlinks
  try {
    createAiboSymlink(cwd, packageDir);
    console.log(`✅  Created .aibo with links to ${AIBO_LINKED_SUBDIRS.join(', ')} from ${packageDir}\n`);
  } catch (error: any) {
    console.error(`⚠️   Failed to create .aibo: ${error.message}\n`);
  }

  // Update .gitignore with .data and .aibo entries
  try {
    updateGitignore(cwd, ['.data', '.aibo']);
    console.log(`✅  Updated .gitignore with .data and .aibo entries\n`);
  } catch (error: any) {
    console.error(`⚠️   Failed to update .gitignore: ${error.message}\n`);
  }

  console.log(`📖  To configure aibo, create a .env file in this directory.`);
  console.log(`    See the README for all available options and examples:\n`);
  console.log(`    ${README_URL}\n`);
  console.log(`🎉  Done! Create .env then run "aibo" to start.\n`);
}

