import fs from 'fs';
import path from 'path';

/**
 * CLI init command module for aibo.
 *
 * `aibo init` creates a `.aibo` symbolic link in the current working directory
 * pointing to the globally-installed aibo package, then prints the GitHub
 * README URL so the user can follow the setup guide to configure their `.env`.
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
 * Creates (or recreates) a `.aibo` symbolic link inside `targetDir` that
 * points to `packageDir`.
 *
 * @param targetDir - Directory in which the symlink should be created (usually cwd)
 * @param packageDir - Absolute path the symlink should point to
 */
export function createAiboSymlink(targetDir: string, packageDir: string): void {
  const symlinkPath = path.join(targetDir, '.aibo');

  try {
    const stat = fs.lstatSync(symlinkPath);
    // Remove whatever is there (symlink, directory, or file) before recreating
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      fs.rmSync(symlinkPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(symlinkPath);
    }
  } catch {
    // Nothing to remove — that's fine
  }

  fs.symlinkSync(packageDir, symlinkPath, 'dir');
}

/**
 * Entry point for `aibo init`.
 *
 * Creates the `.aibo` symlink in the current working directory and prints
 * the README URL so the user can follow the configuration guide.
 */
export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  const packageDir = resolvePackageDir();

  console.log('\nWelcome to aibo init! 🎉\n');

  // Create .aibo symlink
  try {
    createAiboSymlink(cwd, packageDir);
    console.log(`✅  Created .aibo → ${packageDir}\n`);
  } catch (error: any) {
    console.error(`⚠️   Failed to create .aibo symlink: ${error.message}\n`);
  }

  console.log(`📖  To configure aibo, create a .env file in this directory.`);
  console.log(`    See the README for all available options and examples:\n`);
  console.log(`    ${README_URL}\n`);
  console.log(`🎉  Done! Create .env then run "aibo" to start.\n`);
}

