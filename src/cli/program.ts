import { Command } from 'commander';
import { runInit, isAiboInitRequired, printInitRequired } from '@/cli/init';

/**
 * Central Commander.js module for the aibo CLI.
 *
 * Responsibilities:
 *  - Exports `parseInteractionModeFromArgs()` so that `config.ts` can determine
 *    the interaction mode from CLI flags without duplicating Commander setup.
 *  - Exports `createProgram()` which returns the fully-wired root Command used
 *    by `main.ts` to dispatch subcommands (e.g. `aibo init`).
 *
 * @module cli/program
 */

/**
 * Parses CLI arguments using Commander.js to determine the interaction mode.
 *
 * Priority order:
 * 1. `aibo interact --mode=console|lark` subcommand (highest priority)
 * 2. `--interaction=console|lark` (legacy flag, kept for backward compatibility)
 * 3. `--interactive` or `-i` (equivalent to `--interaction=console`)
 * 4. Falls back to `null` (caller resolves via env vars)
 *
 * A fresh, minimal Command instance is created on every call so that:
 *  - Module reloads during tests start from a clean state.
 *  - Subcommand actions (e.g. `init`) are NOT registered here, preventing
 *    accidental side-effects when this function is invoked at config-load time
 *    (before the main entry point calls `createProgram().parseAsync()`).
 *
 * @returns {'console' | 'lark' | null} The interaction mode, or null if not
 *   specified via CLI arguments.
 */
export function parseInteractionModeFromArgs(): 'console' | 'lark' | null {
  // Check for 'interact' subcommand: aibo interact --mode=console|lark
  if (process.argv[2] === 'interact') {
    const subCmd = new Command();
    subCmd
      .option('--mode <mode>', 'Set interaction mode (console|lark)')
      .allowUnknownOption();
    subCmd.parse(['node', 'interact', ...process.argv.slice(3)]);
    const opts = subCmd.opts();
    if (opts.mode === 'console' || opts.mode === 'lark') {
      return opts.mode;
    }
    // Default to console for `aibo interact` without --mode
    return 'console';
  }

  const program = new Command();

  program
    .option('--interaction <mode>', 'Set interaction mode (console|lark)', 'console')
    .option('-i, --interactive', 'Enable interactive console mode')
    .allowUnknownOption(); // let unknown options (and subcommands) pass through

  program.parse(process.argv);
  const options = program.opts();

  // --interactive / -i takes highest precedence
  if (options.interactive) {
    return 'console';
  }

  // Use Commander's built-in source tracking to reliably detect whether the
  // option was explicitly provided via CLI (handles both --interaction=lark and
  // --interaction lark) versus being the programmatic default.
  if (program.getOptionValueSource('interaction') === 'cli') {
    const mode = options.interaction;
    if (mode === 'console' || mode === 'lark') {
      return mode;
    }
    // Invalid mode value — fall through so the caller can use env vars
  }

  return null;
}

/**
 * Creates the root aibo Commander program.
 *
 * Registers all first-class subcommands (`init`, `interact`) with their
 * respective handler functions, so that `--help` shows complete documentation
 * and callers can simply invoke `createProgram(main).parseAsync(process.argv)`
 * to dispatch.
 *
 * @param defaultAction - Optional async function to run when no subcommand is
 *   given (i.e. `aibo` with no arguments / only root-level flags).
 * @returns Configured Commander {@link Command} instance
 */
export function createProgram(defaultAction?: () => Promise<unknown>): Command {
  const program = new Command('aibo');

  program
    .description('AI bot with DeepAgents')
    .allowUnknownOption()
    .option('--interaction <mode>', 'Set interaction mode (console|lark)')
    .option('-i, --interactive', 'Enable interactive console mode');

  if (defaultAction) {
    program.action(async () => {
      if (isAiboInitRequired()) {
        printInitRequired();
        process.exit(1);
      }
      await defaultAction();
    });
  }

  program
    .command('init')
    .description('Create the .aibo symlink and display setup instructions')
    .action(async () => {
      await runInit();
    });

  program
    .command('interact')
    .description('Start interactive mode (console or lark)')
    .option('--mode <mode>', 'Set interaction mode (console|lark)', 'console')
    .action(async (options) => {
      const { runInteract } = await import('@/cli/interact');
      await runInteract(options.mode);
    });

  return program;
}
