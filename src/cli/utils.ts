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

/**
 * Parses the `aibo interact --type` subcommand option from process.argv.
 *
 * Only meaningful when `--mode=lark`. Returns `'group_chat'` when the user
 * passes `--type=group_chat`, `'user_chat'` for `--type=user_chat` (or any
 * other value), and `null` when the `interact` subcommand is not present.
 *
 * @returns {'user_chat' | 'group_chat' | null} The lark interaction type, or
 *   null if not invoked via the `interact` subcommand.
 */
export function parseLarkTypeFromArgs(): 'user_chat' | 'group_chat' | null {
  if (process.argv[2] !== 'interact') {
    return null;
  }

  const subCmd = new Command();
  subCmd
    .option('--type <type>', 'Set lark interaction type (user_chat|group_chat)')
    .allowUnknownOption();
  subCmd.parse(['node', 'interact', ...process.argv.slice(3)]);
  const opts = subCmd.opts();

  if (opts.type === 'group_chat') {
    return 'group_chat';
  }
  return 'user_chat';
}
