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

/** Known subcommands that are not the root command. */
const KNOWN_SUBCOMMANDS = ['init', 'interact'];

/**
 * Parses the `--mode` option from process.argv.
 *
 * Supports both:
 * - `aibo interact [--mode console|lark]` — interact subcommand
 * - `aibo [--mode console|lark]` — root command (default action)
 *
 * Returns the resolved mode, or null when invoked via a non-interact
 * subcommand or when `--mode` is absent from the root command
 * (caller falls back to environment-variable detection).
 *
 * A fresh, minimal Command instance is created on every call so that
 * module reloads during tests always start from a clean state.
 *
 * @returns {'console' | 'lark' | null} The interaction mode, or null if not
 *   determinable from CLI arguments.
 */
export function parseInteractionModeFromArgs(): 'console' | 'lark' | null {
  const subcommand = process.argv[2];

  if (subcommand === 'interact') {
    const subCmd = new Command();
    subCmd
      .option('--mode <mode>', 'Set interaction mode (console|lark)')
      .allowUnknownOption();
    subCmd.parse(['node', 'interact', ...process.argv.slice(3)]);
    const opts = subCmd.opts();
    return opts.mode === 'lark' ? 'lark' : 'console';
  }

  if (subcommand && KNOWN_SUBCOMMANDS.includes(subcommand)) {
    return null;
  }

  // Root command — parse options from argv[2] onward
  const rootCmd = new Command();
  rootCmd
    .option('--mode <mode>', 'Set interaction mode (console|lark)')
    .allowUnknownOption();
  rootCmd.parse(['node', 'aibo', ...process.argv.slice(2)]);
  const opts = rootCmd.opts();

  if (opts.mode === 'lark') return 'lark';
  if (opts.mode === 'console') return 'console';
  return null;
}

/**
 * Parses the `--type` option from process.argv.
 *
 * Supports both:
 * - `aibo interact [--type user_chat|group_chat]` — interact subcommand
 * - `aibo [--type user_chat|group_chat]` — root command (default action)
 *
 * Only meaningful when `--mode=lark`. Returns `'group_chat'` when the user
 * passes `--type=group_chat`, `'user_chat'` for `--type=user_chat` (or any
 * other value), and `null` when invoked via a non-interact subcommand or
 * when `--type` is absent from the root command.
 *
 * @returns {'user_chat' | 'group_chat' | null} The lark interaction type, or
 *   null if not determinable from CLI arguments.
 */
export function parseLarkTypeFromArgs(): 'user_chat' | 'group_chat' | null {
  const subcommand = process.argv[2];

  if (subcommand === 'interact') {
    const subCmd = new Command();
    subCmd
      .option('--type <type>', 'Set lark interaction type (user_chat|group_chat)')
      .allowUnknownOption();
    subCmd.parse(['node', 'interact', ...process.argv.slice(3)]);
    const opts = subCmd.opts();
    return opts.type === 'group_chat' ? 'group_chat' : 'user_chat';
  }

  if (subcommand && KNOWN_SUBCOMMANDS.includes(subcommand)) {
    return null;
  }

  // Root command — parse options from argv[2] onward
  const rootCmd = new Command();
  rootCmd
    .option('--type <type>', 'Set lark interaction type (user_chat|group_chat)')
    .allowUnknownOption();
  rootCmd.parse(['node', 'aibo', ...process.argv.slice(2)]);
  const opts = rootCmd.opts();

  if (opts.type === 'group_chat') return 'group_chat';
  if (opts.type === 'user_chat') return 'user_chat';
  return null;
}
