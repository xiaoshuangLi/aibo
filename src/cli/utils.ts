import { Command } from 'commander';

/**
 * Shared CLI utility helpers for aibo.
 *
 * Kept in a separate module so that low-level config loading (`config.ts`)
 * can import these utilities without introducing a circular dependency through
 * `program.ts`.
 *
 * @module cli/utils
 */

/**
 * Parses the `aibo interact --mode` subcommand option from process.argv.
 *
 * Returns the resolved mode when the user runs
 * `aibo interact [--mode console|lark]`, or null in all other cases
 * (caller falls back to environment-variable detection).
 *
 * A fresh, minimal Command instance is created on every call so that
 * module reloads during tests always start from a clean state.
 *
 * @returns {'console' | 'lark' | null} The interaction mode, or null if not
 *   invoked via the `interact` subcommand.
 */
export function parseInteractionModeFromArgs(): 'console' | 'lark' | null {
  if (process.argv[2] !== 'interact') {
    return null;
  }

  const subCmd = new Command();
  subCmd
    .option('--mode <mode>', 'Set interaction mode (console|lark)')
    .allowUnknownOption();
  subCmd.parse(['node', 'interact', ...process.argv.slice(3)]);
  const opts = subCmd.opts();

  if (opts.mode === 'lark') {
    return 'lark';
  }
  return 'console';
}
