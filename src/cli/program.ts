import { Command } from 'commander';
import { runInit, isAiboInitRequired, printInitRequired } from '@/cli/init';
import { runInteract } from '@/cli/interact';

/**
 * Central Commander.js module for the aibo CLI.
 *
 * Exports `createProgram()` which returns the fully-wired root Command used
 * by `main.ts` to dispatch subcommands (e.g. `aibo init`, `aibo interact`).
 *
 * CLI argument parsing utilities (e.g. `parseInteractionModeFromArgs`) live in
 * `@/cli/utils` to avoid a circular dependency with `config.ts`.
 *
 * @module cli/program
 */

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
      await runInteract(options.mode);
    });

  return program;
}
