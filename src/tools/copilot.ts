import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { Session } from "@/core/agent";
import { isCliCommandAvailable, handleCliExecutionError } from "@/shared/utils";
import { setAcpSessionState, getAcpAgentDisplayName } from "@/shared/acp-session";

const execFileAsync = promisify(execFile);

const ACP_AGENT = "copilot";

const COPILOT_EXIT_REMINDER =
  "\n\nIMPORTANT: After fully completing all the tasks described above, you MUST exit immediately.";

function createCopilotExecuteTool(session?: Session) {
  return tool(
    async ({ prompt, continueSession = false, timeout = 6000000, cwd, args = [], session_name, start_passthrough = true }) => {
      // ── ACP mode (preferred when acpx is available) ──────────────────────────
      if (isCliCommandAvailable("acpx")) {
        const displayName = getAcpAgentDisplayName(ACP_AGENT);
        const execArgs: string[] = ["--approve-all", "--format", "text"];
        if (cwd) execArgs.push("--cwd", cwd);
        execArgs.push(ACP_AGENT);
        if (session_name) execArgs.push("-s", session_name);
        execArgs.push(prompt);
        if (args.length) execArgs.push(...args);

        try {
          const promise = execFileAsync("acpx", execArgs, {
            timeout,
            cwd: cwd || process.cwd(),
            env: process.env,
            signal: session?.abortController?.signal,
            killSignal: "SIGKILL",
          });

          (promise as any).child?.stdout?.on?.("data", (data: Buffer) => {
            session?.logToolProgress(`${displayName} 输出`, data.toString());
          });

          const { stdout, stderr } = await promise;

          if (start_passthrough) {
            setAcpSessionState({ agent: ACP_AGENT, sessionName: session_name, cwd });
          }

          return JSON.stringify(
            {
              success: true,
              stdout: stdout || "(empty)",
              stderr: stderr || "(empty)",
              prompt,
              agent: ACP_AGENT,
              passthrough_activated: start_passthrough,
            },
            null,
            2,
          );
        } catch (error) {
          return handleCliExecutionError(error, "acpx", prompt, timeout);
        }
      }

      // ── Fallback: direct CLI execution ────────────────────────────────────────
      const augmentedPrompt = `${prompt}${COPILOT_EXIT_REMINDER}`;
      const continueArgs = continueSession ? ["--continue"] : [];
      const execArgs = ["-i", augmentedPrompt, ...continueArgs, ...args, "--yolo"];

      try {
        const promise = execFileAsync("copilot", execArgs, {
          timeout,
          cwd: cwd || process.cwd(),
          env: process.env,
          signal: session?.abortController?.signal,
          killSignal: "SIGKILL",
        });

        (promise as any).child?.stdout?.on?.("data", (data: Buffer) => {
          session?.logToolProgress("copilot_execute", data.toString());
        });

        const { stdout, stderr } = await promise;

        return JSON.stringify(
          {
            success: true,
            stdout: stdout || "(empty)",
            stderr: stderr || "(empty)",
            prompt,
          },
          null,
          2,
        );
      } catch (error) {
        return handleCliExecutionError(error, "copilot", prompt, timeout);
      }
    },
    {
      name: "copilot_execute",
      description: `Execute a task or prompt using the GitHub Copilot CLI (copilot command).
Sends the prompt to GitHub Copilot running locally and returns the result.
Use this to leverage Copilot's AI coding capabilities: writing code, editing files, running shell commands, searching the codebase, debugging, and more.
Requires the 'copilot' command to be installed locally (https://github.com/github/copilot-cli).`,
      schema: z.object({
        prompt: z.string().describe("The task or prompt to send to the CLI tool."),
        continueSession: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to continue the previous Copilot session (adds --continue flag, fallback mode only)."),
        timeout: z
          .number()
          .optional()
          .default(6000000)
          .describe("Timeout in milliseconds (default: 6000000 = 100 minutes). Increase for complex tasks."),
        cwd: z.string().optional().describe("Working directory for command execution (default: current process directory)."),
        args: z.array(z.string()).optional().default([]).describe("Additional CLI arguments to pass to the command."),
        session_name: z.string().optional().describe(
          "Named ACP session (-s flag). Allows parallel workstreams in the same repo. Only used in ACP mode.",
        ),
        start_passthrough: z.boolean().optional().default(true).describe(
          "When true (default), activates Lark ACP passthrough mode after this call. Only used in ACP mode.",
        ),
      }),
    },
  );
}

export default async function getCopilotTools(session?: Session) {
  if (!isCliCommandAvailable("copilot")) {
    return [];
  }
  return [createCopilotExecuteTool(session)];
}
