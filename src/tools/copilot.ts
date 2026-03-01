import { Session } from "@/core/agent";
import { createCliExecuteTool, isCliCommandAvailable } from "@/shared/utils";

function createCopilotExecuteTool(session?: Session) {
  return createCliExecuteTool(
    {
      command: "copilot",
      toolName: "copilot_execute",
      description: `Execute a task or prompt using the GitHub Copilot CLI (copilot command).
Sends the prompt to GitHub Copilot running locally and returns the result.
Use this to leverage Copilot's AI coding capabilities: writing code, editing files, running shell commands, searching the codebase, debugging, and more.
Requires the 'copilot' command to be installed locally (https://github.com/github/copilot-cli).`,
      promptFlag: "-i",
      extraArgs: ["--yolo"],
    },
    session,
  );
}

export default async function getCopilotTools(session?: Session) {
  if (!isCliCommandAvailable("copilot")) {
    return [];
  }
  return [createCopilotExecuteTool(session)];
}
