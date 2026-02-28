import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { glob } from "glob";
import * as path from "path";

const BLOCKED_EXTENSIONS = new Set([
  // Binary/model files
  '.bin', '.dat', '.model', '.pth', '.pt', '.ckpt', '.h5', '.pb', '.onnx',
  '.tflite', '.safetensors', '.gguf', '.ggml', '.npy', '.npz',
  // System files
  '.dll', '.so', '.dylib', '.exe', '.app', '.dmg', '.pkg', '.msi',
  // Media files
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg',
  '.mp3', '.wav', '.ogg', '.flac', '.mp4', '.avi', '.mov', '.wmv', '.mkv',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.tar',
  '.gz', '.7z', '.rar', '.iso', '.img', '.vmdk', '.ova',
  // Cache and temporary files
  '.cache', '.tmp', '.temp', '.swp', '.swo', '.lock',
  // Database files
  '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dbf',
  // Font files
  '.ttf', '.otf', '.woff', '.woff2', '.eot', '.fon', '.fnt', '.tsbuildinfo',
]);

const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/out/**",
  "**/.cache/**",
  "**/.data/**",
  "**/.aibo/**",
  "**/__pycache__/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.svelte-kit/**",
  "**/venv/**",
  "**/.venv/**",
  "**/autos/**",
];

function hasBlockedExtension(filePath: string): boolean {
  const match = path.basename(filePath).match(/\.[^\.]+$/);
  const ext = match ? match[0].toLowerCase() : '';
  return BLOCKED_EXTENSIONS.has(ext);
}

/**
 * Glob file pattern matching tool - finds files matching a glob pattern.
 * Equivalent to Claude Code's glob tool for discovering files in a project.
 */
export const globFilesTool = tool(
  async ({ pattern, cwd, ignore }) => {
    try {
      const workingDir = cwd || process.cwd();
      const ignorePatterns = ignore || DEFAULT_IGNORE_PATTERNS;

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
