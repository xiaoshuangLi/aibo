import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

/**
 * Make a targeted string replacement in a file.
 * Equivalent to Claude Code's Edit tool — the primary way to make precise file edits.
 * Fails fast if old_string is not found or is ambiguous (found multiple times).
 */
export const editFileTool = tool(
  async ({ file_path, old_string, new_string, create_if_missing }) => {
    try {
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.join(process.cwd(), file_path);

      // Handle file creation case
      if (!fs.existsSync(absolutePath)) {
        if (create_if_missing && old_string === "") {
          const dir = path.dirname(absolutePath);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(absolutePath, new_string, "utf-8");
          return JSON.stringify({
            success: true,
            action: "created",
            file_path: absolutePath,
            lines_written: new_string.split("\n").length,
          }, null, 2);
        }
        return JSON.stringify({
          success: false,
          error: "FILE_NOT_FOUND",
          message: `File not found: ${absolutePath}. Use create_if_missing=true with old_string="" to create a new file.`,
        }, null, 2);
      }

      const content = fs.readFileSync(absolutePath, "utf-8");

      // Count occurrences to detect ambiguity
      if (old_string === "") {
        // Empty old_string with existing file means append or full replace (use new_string as full content)
        return JSON.stringify({
          success: false,
          error: "EMPTY_OLD_STR",
          message: "old_string is empty but the file already exists. Provide the exact text to replace.",
        }, null, 2);
      }

      const occurrences = content.split(old_string).length - 1;

      if (occurrences === 0) {
        return JSON.stringify({
          success: false,
          error: "NOT_FOUND",
          message: `old_string not found in file. The text to replace must match exactly (including whitespace and newlines).`,
          file_path: absolutePath,
        }, null, 2);
      }

      if (occurrences > 1) {
        return JSON.stringify({
          success: false,
          error: "AMBIGUOUS",
          message: `old_string found ${occurrences} times in file. Provide more context (surrounding lines) to make it unique.`,
          occurrences,
          file_path: absolutePath,
        }, null, 2);
      }

      const newContent = content.replace(old_string, new_string);
      fs.writeFileSync(absolutePath, newContent, "utf-8");

      const oldLines = old_string.split("\n").length;
      const newLines = new_string.split("\n").length;

      return JSON.stringify({
        success: true,
        action: "edited",
        file_path: absolutePath,
        lines_removed: oldLines,
        lines_added: newLines,
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
    name: "edit_file",
    description: `Make a targeted string replacement in a file.
old_string must match EXACTLY ONE occurrence in the file (including whitespace/newlines).
If old_string appears multiple times, add more surrounding context to make it unique.
To create a new file: set create_if_missing=true and old_string="".
ALWAYS read the file with view_file first to get the exact text before editing.`,
    schema: z.object({
      file_path: z.string().describe("Path to the file to edit (absolute or relative to cwd)"),
      old_string: z.string().describe("The exact string to find and replace. Must match exactly once in the file."),
      new_string: z.string().describe("The replacement string. Use empty string to delete old_string."),
      create_if_missing: z.boolean().optional().default(false).describe("If true and file does not exist, create it with new_string as content (old_string must be empty string)."),
    }),
  }
);

/**
 * Returns the edit_file tool.
 */
export default async function getEditFileTools() {
  return [editFileTool];
}
