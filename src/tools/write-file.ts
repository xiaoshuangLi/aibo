import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

/**
 * Write full content to a file — creates the file if it does not exist,
 * or overwrites it entirely if it does.
 *
 * This is the complement to edit_file:
 * - Use edit_file for targeted, surgical changes to EXISTING files (replace a specific block)
 * - Use write_file when creating a NEW file or doing a full rewrite of an existing one
 *
 * Equivalent to Claude Code's Write tool.
 */
export const writeFileTool = tool(
  async ({ file_path, content }) => {
    try {
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.join(process.cwd(), file_path);

      const existed = fs.existsSync(absolutePath);

      // Ensure parent directories exist
      const dir = path.dirname(absolutePath);
      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(absolutePath, content, "utf-8");

      const lines = content ? content.split("\n").length - (content.endsWith("\n") ? 1 : 0) : 0;

      return JSON.stringify({
        success: true,
        action: existed ? "overwritten" : "created",
        file_path: absolutePath,
        lines_written: lines,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        file_path,
      }, null, 2);
    }
  },
  {
    name: "write_file",
    description: `Write full content to a file. Creates the file (and any missing parent directories) if it does not exist, or completely overwrites it if it does.

Use this tool when:
- Creating a new file with its full initial content
- Completely rewriting a file (major restructuring where edit_file would require too many edits)

Use edit_file instead when:
- Making targeted changes to an existing file (replacing a specific function, block, or line)

Always prefer edit_file for existing files when the change is localized — it is safer and more precise.`,
    schema: z.object({
      file_path: z.string().describe("Path to the file to write (absolute or relative to cwd). Parent directories are created automatically."),
      content: z.string().describe("The full content to write to the file. This replaces ALL existing content."),
    }),
  }
);

export default async function getWriteFileTools() {
  return [writeFileTool];
}
