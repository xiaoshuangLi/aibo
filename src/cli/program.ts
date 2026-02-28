import { Command } from 'commander';
import { runInit, isAiboInitRequired, printInitRequired } from '@/cli/init';
import { runInteract } from '@/cli/interact';

/**
 * Central Commander.js module for the aibo CLI.
 *
 * Exports `createProgram()` which returns the fully-wired root Command used
 * by `main.ts` to dispatch subcommands (e.g. `aibo init`, `aibo interact`).
 *
 * @module cli/program
 */

/**
 * Creates the root aibo Commander program.
 *
 * Registers all first-class subcommands (`init`, `interact`) with their
 * respective handler functions, so that `--help` shows complete documentation
 * and callers can simply invoke `createProgram().parseAsync(process.argv)`
 * to dispatch.
 *
 * When no subcommand is given, `runInteract` is started using the interaction
 * mode resolved from environment variables (or `interact --mode` when the
 * `interact` subcommand is used).
 *
 * @returns Configured Commander {@link Command} instance
 */
export function createProgram(): Command {
  const program = new Command('aibo');

  program
    .description('AI bot with DeepAgents')
    .allowUnknownOption();

  program.action(async () => {
    if (isAiboInitRequired()) {
      printInitRequired();
      process.exit(1);
    }
    await runInteract();
  });

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
    .option('--type <type>', 'Set lark interaction type (user_chat|group_chat), only effective when --mode=lark', 'user_chat')
    .action(async () => {
      await runInteract();
    });

  return program;
}
