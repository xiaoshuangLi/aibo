import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { DEFAULT_IGNORE_PATTERNS } from "@/shared/constants/filesystem";
import { hasBlockedExtension } from "@/shared/utils/filesystem";

const MAX_RESULTS = 500;

/**
 * Search file contents using a regex pattern.
 * Equivalent to Claude Code's grep tool.
 */
export const grepFilesTool = tool(
  async ({ pattern, include, cwd, case_insensitive }) => {
    try {
      const workingDir = cwd || process.cwd();
      const globPattern = include || "**/*";
      const flags = case_insensitive ? "gi" : "g";

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags);
      } catch {
        return JSON.stringify({
          success: false,
          error: "INVALID_REGEX",
          message: `Invalid regular expression: ${pattern}`,
        }, null, 2);
      }

      const files = await glob(globPattern, {
        cwd: workingDir,
        ignore: DEFAULT_IGNORE_PATTERNS,
        absolute: false,
        dot: true,
        nodir: true,
      });

      const results: Array<{ file: string; line: number; content: string }> = [];

      for (const file of files) {
        if (results.length >= MAX_RESULTS) break;

        // Skip binary and non-text files
        if (hasBlockedExtension(file)) continue;

        const absolutePath = path.join(workingDir, file);
        let content: string;
        try {
          content = fs.readFileSync(absolutePath, "utf-8");
        } catch {
          continue; // skip unreadable files
        }

        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= MAX_RESULTS) break;
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            results.push({
              file,
              line: i + 1,
              content: lines[i],
            });
          }
        }
      }

      return JSON.stringify({
        success: true,
        pattern,
        include: globPattern,
        cwd: workingDir,
        count: results.length,
        truncated: results.length >= MAX_RESULTS,
        results,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        pattern,
      }, null, 2);
    }
  },
  {
    name: "grep_files",
    description: `Search file contents using a regular expression pattern.
Returns matching lines with file path and line number.
Use 'include' to limit search to specific file types (e.g. '**/*.ts').
Returns at most 500 matches to prevent overwhelming output.`,
    schema: z.object({
      pattern: z.string().describe("Regular expression pattern to search for in file contents"),
      include: z.string().optional().describe("Glob pattern to limit which files are searched (e.g. '**/*.ts', 'src/**/*.js')"),
      cwd: z.string().optional().describe("Working directory to search in (default: current process directory)"),
      case_insensitive: z.boolean().optional().default(false).describe("Perform case-insensitive search (default: false)"),
    }),
  }
);

/**
 * Returns the grep_files tool.
 */
export default async function getGrepTools() {
  return [grepFilesTool];
}
