import { createAIAgent } from '@/core/agent';
import { startInteractiveMode } from '@/presentation/console';
import { startLarkInteractiveMode } from '@/presentation/lark';
import { isAiboInitRequired, printInitRequired } from '@/cli/init';
import { config } from '@/core/config';

/**
 * CLI interact command handler for aibo.
 *
 * `aibo interact [--mode console|lark]` starts the interactive mode.
 * The mode is resolved from `config.interaction.mode`, which is populated
 * by `parseInteractionModeFromArgs` (for the `--mode` subcommand option)
 * and environment variables.
 *
 * @module cli/interact
 */

/**
 * Runs the interactive mode using the interaction mode from config.
 */
export async function runInteract(): Promise<void> {
  if (isAiboInitRequired()) {
    printInitRequired();
    process.exit(1);
  }

  if (config.interaction.mode === 'lark') {
    await startLarkInteractiveMode();
  } else {
    await startInteractiveMode();
  }

  await createAIAgent();
}
