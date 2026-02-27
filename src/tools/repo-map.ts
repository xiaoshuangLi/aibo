import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

/**
 * Repository Map tool — compact structural overview of a codebase.
 *
 * Inspired by Aider's repo map: instead of reading every file individually,
 * this tool generates a compact, token-efficient overview of the repository
 * structure, helping the AI understand the codebase at a glance.
 *
 * Key features:
 * - Recursive directory tree (with configurable depth and file limits)
 * - Entry point detection (main.ts, index.ts, app.ts, etc.)
 * - Key configuration files summary (package.json, tsconfig.json, etc.)
 * - Module statistics (file counts by type/directory)
 * - Top-level module descriptions
 *
 * When to use:
 * - At the start of a new task to orient yourself in an unfamiliar codebase
 * - Before resolving a GitHub Issue to locate relevant code quickly
 * - When planning a refactoring to understand overall project structure
 * - To reduce token overhead versus reading all files individually
 */

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "target",
  "coverage", ".nyc_output", ".cache", ".next", ".nuxt",
  "__pycache__", ".venv", "venv", ".idea", ".vscode", ".vs",
  "tmp", "temp", ".tmp", "logs",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".php",
]);

const CONFIG_FILES = [
  "package.json", "tsconfig.json", "pyproject.toml", "Cargo.toml",
  "go.mod", "pom.xml", "build.gradle", "Makefile", "Dockerfile",
  ".env.example", "jest.config.ts", "jest.config.js", "vite.config.ts",
  "webpack.config.js", "tailwind.config.js", ".eslintrc.json",
  "README.md", "CONTRIBUTING.md",
];

const ENTRY_POINT_NAMES = new Set([
  "main.ts", "main.js", "index.ts", "index.js",
  "app.ts", "app.js", "server.ts", "server.js",
  "cli.ts", "cli.js", "start.ts", "start.js",
]);

interface DirStats {
  files: number;
  byExt: Record<string, number>;
}

interface RepoMapResult {
  rootDir: string;
  tree: string;
  entryPoints: string[];
  configFiles: string[];
  stats: {
    totalFiles: number;
    sourceFiles: number;
    byExtension: Record<string, number>;
    topModules: Array<{ name: string; files: number }>;
  };
  truncated: boolean;
}

/**
 * Recursively build a directory tree string.
 */
function buildTree(
  dir: string,
  rootDir: string,
  maxDepth: number,
  maxFiles: number,
  currentDepth: number,
  fileCounter: { count: number },
  entryPoints: string[],
  allStats: DirStats,
): string {
  if (currentDepth > maxDepth || fileCounter.count >= maxFiles) {
    return "";
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return "";
  }

  // Sort: directories first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  const indent = "  ".repeat(currentDepth);

  for (const entry of entries) {
    if (fileCounter.count >= maxFiles) {
      break;
    }

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      lines.push(`${indent}📁 ${entry.name}/`);
      const subtree = buildTree(
        path.join(dir, entry.name),
        rootDir,
        maxDepth,
        maxFiles,
        currentDepth + 1,
        fileCounter,
        entryPoints,
        allStats,
      );
      if (subtree) lines.push(subtree);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      fileCounter.count++;
      allStats.files++;
      if (ext) {
        allStats.byExt[ext] = (allStats.byExt[ext] || 0) + 1;
      }

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath);

      if (ENTRY_POINT_NAMES.has(entry.name)) {
        entryPoints.push(relPath);
      }

      const icon = SOURCE_EXTENSIONS.has(ext) ? "📄" : "📋";
      lines.push(`${indent}${icon} ${entry.name}`);
    }
  }

  return lines.join("\n");
}

/**
 * Find config files that actually exist in the root directory.
 */
function findConfigFiles(rootDir: string): string[] {
  return CONFIG_FILES.filter((f) => {
    try {
      return fs.existsSync(path.join(rootDir, f));
    } catch {
      return false;
    }
  });
}

/**
 * Extract top-level module names and their direct file counts.
 */
function getTopModules(rootDir: string): Array<{ name: string; files: number }> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const modules: Array<{ name: string; files: number }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
    const dirPath = path.join(rootDir, entry.name);
    try {
      const children = fs.readdirSync(dirPath, { withFileTypes: true });
      const fileCount = children.filter((c) => c.isFile()).length;
      if (fileCount > 0) {
        modules.push({ name: entry.name, files: fileCount });
      }
    } catch {
      // skip unreadable dirs
    }
  }

  return modules.sort((a, b) => b.files - a.files).slice(0, 10);
}

export const repoMapTool = tool(
  async ({ rootDir, maxDepth = 4, maxFiles = 500 }) => {
    const resolvedRoot = path.resolve(rootDir || process.cwd());

    // Verify directory exists
    try {
      const stat = fs.statSync(resolvedRoot);
      if (!stat.isDirectory()) {
        return JSON.stringify({
          success: false,
          error: `Not a directory: ${resolvedRoot}`,
        });
      }
    } catch {
      return JSON.stringify({
        success: false,
        error: `Cannot access directory: ${resolvedRoot}`,
      });
    }

    const entryPoints: string[] = [];
    const allStats: DirStats = { files: 0, byExt: {} };
    const fileCounter = { count: 0 };

    const tree = buildTree(
      resolvedRoot,
      resolvedRoot,
      maxDepth,
      maxFiles,
      0,
      fileCounter,
      entryPoints,
      allStats,
    );

    const configFiles = findConfigFiles(resolvedRoot);
    const topModules = getTopModules(resolvedRoot);

    const sourceFileCount = Object.entries(allStats.byExt)
      .filter(([ext]) => SOURCE_EXTENSIONS.has(ext))
      .reduce((sum, [, count]) => sum + count, 0);

    const isTruncated = fileCounter.count >= maxFiles;
    const treeWithFooter = isTruncated
      ? tree + `\n\n⚠️  Showing ${fileCounter.count} of ${fileCounter.count}+ files (limit reached). Use maxFiles parameter to increase the limit.`
      : tree;

    const result: RepoMapResult = {
      rootDir: resolvedRoot,
      tree: treeWithFooter,
      entryPoints,
      configFiles,
      stats: {
        totalFiles: allStats.files,
        sourceFiles: sourceFileCount,
        byExtension: allStats.byExt,
        topModules,
      },
      truncated: isTruncated,
    };

    return JSON.stringify({ success: true, ...result }, null, 2);
  },
  {
    name: "repo_map",
    description: `Generate a compact structural overview of a code repository.
Use this at the start of a new task to orient yourself in an unfamiliar codebase.
Returns: directory tree, entry points (main/index files), config files present,
file statistics by type, and top-level module breakdown.
Much more token-efficient than reading individual files when you need a high-level view.
Ideal before resolving GitHub Issues, planning refactors, or exploring a new project.`,
    schema: z.object({
      rootDir: z.string().optional().describe(
        "Root directory to map (default: current working directory)"
      ),
      maxDepth: z.number().int().min(1).max(10).optional().describe(
        "Maximum directory depth to traverse (default: 4)"
      ),
      maxFiles: z.number().int().min(10).max(1000).optional().describe(
        "Maximum number of files to include in the tree (default: 500)"
      ),
    }),
  }
);

export default async function getRepoMapTools() {
  return [repoMapTool];
}
