import { createAIAgent } from '@/core/agent/agent-factory';
import { startInteractiveMode } from '@/presentation/console/interactive-mode';
import { startLarkInteractiveMode } from '@/presentation/lark/interactive-mode';
import { isAiboInitRequired, printInitRequired } from '@/cli/init';

/**
 * CLI interact command handler for aibo.
 *
 * `aibo interact [--mode console|lark]` starts the interactive mode.
 * Defaults to console mode when --mode is omitted.
 *
 * @module cli/interact
 */

/**
 * Runs the interactive mode for the given mode string.
 *
 * @param mode - Interaction mode: 'console' or 'lark' (defaults to 'console')
 */
export async function runInteract(mode: string = 'console'): Promise<void> {
  if (isAiboInitRequired()) {
    printInitRequired();
    process.exit(1);
  }

  if (mode === 'lark') {
    await startLarkInteractiveMode();
  } else {
    await startInteractiveMode();
  }

  await createAIAgent();
}
