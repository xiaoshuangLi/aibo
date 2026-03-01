import { Session } from "@/core/agent";
import { createCliExecuteTool, isCliCommandAvailable } from "@/shared/utils";

function createClaudeExecuteTool(session?: Session) {
  return createCliExecuteTool(
    {
      command: "claude",
      toolName: "claude_execute",
      description: `Execute a task or prompt using the Claude Code CLI (claude command).
Sends the prompt to Claude Code running locally and returns the result.
Use this to leverage Claude's autonomous coding capabilities: writing code, debugging, refactoring, explaining code, and more.
Requires the 'claude' command to be installed locally.`,
      promptFlag: "-p",
      extraArgs: ["--yolo"],
    },
    session,
  );
}

export default async function getClaudeTools(session?: Session) {
  if (!isCliCommandAvailable("claude")) {
    return [];
  }
  return [createClaudeExecuteTool(session)];
}
