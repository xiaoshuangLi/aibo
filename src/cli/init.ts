import fs from 'fs';
import path from 'path';

/**
 * CLI init command module for aibo.
 *
 * `aibo init` copies the bundled `.env.example` to `.env` in the current
 * working directory and prints configuration instructions to the console.
 * It also creates a `.aibo` symbolic link pointing to the globally-installed
 * aibo package directory.
 *
 * @module cli/init
 */

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
 * Copies the `.env.example` file from `srcPath` to `destPath`.
 * Any existing file at `destPath` is overwritten.
 *
 * @param srcPath - Absolute path to the source `.env.example` file
 * @param destPath - Absolute path where the `.env` file should be written
 */
export function copyEnvExample(srcPath: string, destPath: string): void {
  fs.copyFileSync(srcPath, destPath);
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
 * Copies `.env.example` from the package to `.env` in the current working
 * directory, prints instructions on how to configure it, and creates the
 * `.aibo` symbolic link.
 */
export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  const packageDir = resolvePackageDir();
  const examplePath = path.join(packageDir, '.env.example');
  const envPath = path.join(cwd, '.env');

  console.log('\nWelcome to aibo init! 🎉\n');

  // Copy .env.example → .env
  try {
    copyEnvExample(examplePath, envPath);
    console.log(`✅  Created ${envPath}`);
  } catch (error: any) {
    console.error(`⚠️   Failed to create .env: ${error.message}`);
  }

  // Create .aibo symlink
  try {
    createAiboSymlink(cwd, packageDir);
    console.log(`✅  Created .aibo → ${packageDir}`);
  } catch (error: any) {
    console.error(`⚠️   Failed to create .aibo symlink: ${error.message}`);
  }

  console.log(`
📝  Next step: edit the .env file to configure your environment:
    ${envPath}

    Key variables to set:
      AIBO_API_KEY      — your model provider API key
      AIBO_MODEL_NAME   — model to use (e.g. gpt-4o, claude-3-5-sonnet-20241022, llama3)
      AIBO_MODEL_PROVIDER — provider: openai | anthropic | google | mistral | groq | ollama | azure
                           (leave blank to auto-detect from model name)

    See the comments inside .env for the full list of options and examples.

🎉  Done! Edit .env then run "aibo" to start.
`);
}

