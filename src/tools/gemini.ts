import { Session } from "@/core/agent";
import { createCliExecuteTool, isCliCommandAvailable } from "@/shared/utils";

function createGeminiExecuteTool(session?: Session) {
  return createCliExecuteTool(
    {
      command: "gemini",
      toolName: "gemini_execute",
      description: `Execute a task or prompt using the Google Gemini CLI (gemini command).
Sends the prompt to Gemini AI running locally and returns the result.
Best suited for: frontend UI development (React/Vue/HTML/CSS), algorithm implementation, multimodal tasks, and tasks requiring a large context window.
Requires the 'gemini' command to be installed locally (https://github.com/google-gemini/gemini-cli).`,
      promptFlag: "-p",
      extraArgs: ["--yolo"],
    },
    session,
  );
}

export default async function getGeminiTools(session?: Session) {
  if (!isCliCommandAvailable("gemini")) {
    return [];
  }
  return [createGeminiExecuteTool(session)];
}
