import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Think tool — internal reasoning scratchpad (Claude Code parity).
 *
 * Use this tool to reason through a problem step-by-step BEFORE acting.
 * It has NO side effects (no file writes, no network calls, no tool calls).
 * The content is your private scratchpad — it helps you structure complex
 * reasoning before committing to an approach.
 *
 * When to use:
 * - Before implementing a non-trivial algorithm or architecture decision
 * - When analyzing error messages with multiple possible root causes
 * - When weighing trade-offs between 2+ approaches
 * - When a task has implicit constraints that need to be surfaced first
 * - Before making any irreversible change (file delete, schema migration, etc.)
 *
 * Pattern:
 *   1. Call think() with your reasoning
 *   2. The reasoning is returned as-is (visible in the conversation)
 *   3. Proceed with the approach you decided on
 */
export const thinkTool = tool(
  async ({ reasoning }) => {
    // Pure scratchpad — returns the reasoning as-is, no side effects
    return JSON.stringify({
      type: "thinking",
      reasoning,
      note: "This is internal reasoning. No actions have been taken yet.",
    }, null, 2);
  },
  {
    name: "think",
    description: `Use this tool to reason through a complex problem step-by-step BEFORE taking action.
This is a pure scratchpad — it has NO side effects (no files written, no network calls).
Use it when you need to:
- Work through multi-step logic before committing to an approach
- Analyze error messages to identify the true root cause
- Weigh trade-offs between 2+ implementation options
- Surface implicit constraints before making irreversible changes
- Plan a sequence of tool calls before executing them
The reasoning is returned as-is so your thinking is visible in the conversation.`,
    schema: z.object({
      reasoning: z.string().min(1).describe(
        "Your step-by-step reasoning. Think out loud: state what you know, what you're uncertain about, what options exist, and what you'll do and why."
      ),
    }),
  }
);

export default async function getThinkTools() {
  return [thinkTool];
}
