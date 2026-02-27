import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * View file contents with optional line range support.
 * Equivalent to Claude Code's View tool — the primary way to read files.
 */
export const viewFileTool = tool(
  async ({ file_path, start_line, end_line }) => {
    try {
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.join(process.cwd(), file_path);

      if (!fs.existsSync(absolutePath)) {
        return JSON.stringify({
          success: false,
          error: "FILE_NOT_FOUND",
          message: `File not found: ${absolutePath}`,
        }, null, 2);
      }

      const stat = fs.statSync(absolutePath);
      if (stat.size > MAX_FILE_SIZE_BYTES) {
        return JSON.stringify({
          success: false,
          error: "FILE_TOO_LARGE",
          message: `File is ${(stat.size / 1024 / 1024).toFixed(1)} MB — exceeds 10 MB limit. Use start_line/end_line to read a portion.`,
          size_bytes: stat.size,
        }, null, 2);
      }

      const content = fs.readFileSync(absolutePath, "utf-8");
      const lines = content.split("\n");
      const totalLines = lines.length;

      const start = start_line !== undefined ? Math.max(1, start_line) : 1;
      const end = end_line !== undefined ? Math.min(totalLines, end_line) : totalLines;

      const selectedLines = lines.slice(start - 1, end);

      // Build line-numbered content (like Claude Code's Read tool output)
      // Format: right-aligned line number, tab, content
      const lineNumWidth = String(end).length;
      const numberedContent = selectedLines
        .map((line, i) => {
          const lineNum = start + i;
          return `${String(lineNum).padStart(lineNumWidth)}\t${line}`;
        })
        .join("\n");

      return JSON.stringify({
        success: true,
        file_path: absolutePath,
        total_lines: totalLines,
        start_line: start,
        end_line: end,
        content: numberedContent,
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
    name: "view_file",
    description: `Read file contents with optional line range support.
Use start_line and end_line to read only a portion of large files.
Line numbers are 1-based. Content is returned with line numbers prefixed
(e.g. "  1\tconst x = 1;") so you can reference exact locations when editing.
Always prefer this over shell 'cat' commands for reading files.`,
    schema: z.object({
      file_path: z.string().describe("Path to the file to read (absolute or relative to cwd)"),
      start_line: z.number().optional().describe("First line to read (1-based, inclusive). Defaults to 1."),
      end_line: z.number().optional().describe("Last line to read (1-based, inclusive). Defaults to end of file."),
    }),
  }
);

/**
 * Returns the view_file tool.
 */
export default async function getViewFileTools() {
  return [viewFileTool];
}
