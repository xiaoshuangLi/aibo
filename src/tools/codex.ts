import { Session } from "@/core/agent";
import { createCliExecuteTool, isCliCommandAvailable } from "@/shared/utils";

function createCodexExecuteTool(session?: Session) {
  return createCliExecuteTool(
    {
      command: "codex",
      toolName: "codex_execute",
      description: `Execute a task or prompt using the OpenAI Codex CLI (codex command).
Sends the prompt to Codex AI running locally and returns the result.
Best suited for: backend API development (REST/GraphQL), database design and queries, server-side business logic, CLI tools, and scripts.
Requires the 'codex' command to be installed locally (https://github.com/openai/codex).`,
      promptFlag: "",
      extraArgs: ["--yolo"],
      acpAgent: "codex",
    },
    session,
  );
}

export default async function getCodexTools(session?: Session) {
  if (!isCliCommandAvailable("codex")) {
    return [];
  }
  return [createCodexExecuteTool(session)];
}
