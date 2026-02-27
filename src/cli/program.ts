import { Command } from 'commander';
import { runInit } from '@/cli/init';

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
 * 1. `--interaction=console|lark` (highest priority)
 * 2. `--interactive` or `-i` (equivalent to `--interaction=console`)
 * 3. Falls back to `null` (caller resolves via env vars)
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
  const program = new Command();

  program
    .option('--interaction <mode>', 'Set interaction mode', 'console')
    .option('-i, --interactive', 'Enable interactive console mode')
    .allowUnknownOption(); // let unknown options (and subcommands) pass through

  program.parse(process.argv);
  const options = program.opts();

  // --interactive / -i takes highest precedence
  if (options.interactive) {
    return 'console';
  }

  // Check if --interaction=<mode> or --interaction <mode> was explicitly supplied
  // (not just the default), to distinguish "user passed it" from "Commander default".
  const rawArgs = process.argv.slice(2);
  const hasInteractionArg = rawArgs.some(
    arg => arg.startsWith('--interaction=') || arg === '--interaction',
  );

  if (hasInteractionArg) {
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
 * Registers all first-class subcommands (currently `init`) so that callers can
 * simply invoke `createProgram().parseAsync(process.argv)` to dispatch.
 *
 * @returns Configured Commander {@link Command} instance
 */
export function createProgram(): Command {
  const program = new Command('aibo');

  program
    .description('AI bot with DeepAgents')
    .allowUnknownOption()
    .option('--interaction <mode>', 'Set interaction mode (console|lark)')
    .option('-i, --interactive', 'Enable interactive console mode');

  program
    .command('init')
    .description('Configure environment variables and create the .aibo symlink')
    .action(async () => {
      await runInit();
    });

  return program;
}
