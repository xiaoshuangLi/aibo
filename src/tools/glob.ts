import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { glob } from "glob";
import { DEFAULT_IGNORE_PATTERNS } from "@/shared/constants/filesystem";
import { hasBlockedExtension } from "@/shared/utils/filesystem";

/**
 * Glob file pattern matching tool - finds files matching a glob pattern.
 * Equivalent to Claude Code's glob tool for discovering files in a project.
 */
export const globFilesTool = tool(
  async ({ pattern, cwd, ignore }) => {
    try {
      const workingDir = cwd || process.cwd();
      // Always preserve default ignore patterns, merge with user-provided ones
      const ignorePatterns = ignore?.length
        ? [...DEFAULT_IGNORE_PATTERNS, ...ignore]
        : DEFAULT_IGNORE_PATTERNS;

      const matches = await glob(pattern, {
        cwd: workingDir,
        ignore: ignorePatterns,
        absolute: false,
        dot: true,
      });

      const sorted = matches
        .filter(f => !hasBlockedExtension(f))
        .sort();

      return JSON.stringify({
        success: true,
        pattern,
        cwd: workingDir,
        count: sorted.length,
        files: sorted,
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
    name: "glob_files",
    description: `Find files matching a glob pattern within the working directory.
Use this to discover files by name patterns, e.g. '**/*.ts', 'src/**/*.test.ts', '*.json'.
Returns a sorted list of matching file paths relative to the working directory.
Default ignores: node_modules, .git, dist, build, coverage, .data, .aibo, and other non-source directories.
Binary and media files are always excluded from results.`,
    schema: z.object({
      pattern: z.string().describe("Glob pattern to match files against (e.g. '**/*.ts', 'src/**/*.test.ts')"),
      cwd: z.string().optional().describe("Working directory to search in (default: current process directory)"),
      ignore: z.array(z.string()).optional().describe("Additional glob patterns to ignore (default ignores node_modules, .git, dist, build, coverage, .data, .aibo and other non-source directories)"),
    }),
  }
);

/**
 * Returns the glob_files tool.
 */
export default async function getGlobTools() {
  return [globFilesTool];
}
