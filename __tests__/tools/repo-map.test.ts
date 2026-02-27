import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { repoMapTool } from "../../src/tools/repo-map";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("repoMapTool", () => {
  describe("tool metadata", () => {
    test("should have correct name", () => {
      expect(repoMapTool.name).toBe("repo_map");
    });

    test("should have a descriptive description", () => {
      expect(repoMapTool.description).toContain("structural overview");
      expect(repoMapTool.description).toContain("token-efficient");
    });

    test("should have correct schema with optional fields", () => {
      const schema = repoMapTool.schema;
      expect(schema).toBeDefined();

      // All fields are optional
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
    });

    test("should reject invalid maxDepth (out of range)", () => {
      const schema = repoMapTool.schema;
      expect(schema.safeParse({ maxDepth: 0 }).success).toBe(false);
      expect(schema.safeParse({ maxDepth: 11 }).success).toBe(false);
    });

    test("should reject invalid maxFiles (out of range)", () => {
      const schema = repoMapTool.schema;
      expect(schema.safeParse({ maxFiles: 5 }).success).toBe(false);
      expect(schema.safeParse({ maxFiles: 1001 }).success).toBe(false);
    });

    test("should accept valid parameters", () => {
      const schema = repoMapTool.schema;
      expect(schema.safeParse({ maxDepth: 3, maxFiles: 100 }).success).toBe(true);
      expect(schema.safeParse({ rootDir: "/tmp", maxDepth: 1 }).success).toBe(true);
    });
  });

  describe("repo mapping on actual repo", () => {
    test("should return success=true for valid directory", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rootDir).toBe(REPO_ROOT);
    });

    test("should include a directory tree string", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT });
      const parsed = JSON.parse(result);

      expect(typeof parsed.tree).toBe("string");
      expect(parsed.tree.length).toBeGreaterThan(0);
    });

    test("should detect entry points (main.ts, index.ts)", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT, maxFiles: 1000 });
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed.entryPoints)).toBe(true);
      // This repo has src/main.ts and src/index.ts
      const hasMainOrIndex = parsed.entryPoints.some(
        (f: string) => f.includes("main.ts") || f.includes("index.ts")
      );
      expect(hasMainOrIndex).toBe(true);
    });

    test("should detect config files (package.json, tsconfig.json)", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT });
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed.configFiles)).toBe(true);
      expect(parsed.configFiles).toContain("package.json");
      expect(parsed.configFiles).toContain("tsconfig.json");
    });

    test("should include stats with totalFiles and byExtension", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT });
      const parsed = JSON.parse(result);

      expect(parsed.stats).toBeDefined();
      expect(typeof parsed.stats.totalFiles).toBe("number");
      expect(parsed.stats.totalFiles).toBeGreaterThan(0);
      expect(typeof parsed.stats.sourceFiles).toBe("number");
      expect(parsed.stats.byExtension).toBeDefined();
      // This is a TypeScript project
      expect(parsed.stats.byExtension[".ts"]).toBeGreaterThan(0);
    });

    test("should include topModules with name and files", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT });
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed.stats.topModules)).toBe(true);
      if (parsed.stats.topModules.length > 0) {
        const mod = parsed.stats.topModules[0];
        expect(typeof mod.name).toBe("string");
        expect(typeof mod.files).toBe("number");
        expect(mod.files).toBeGreaterThan(0);
      }
    });

    test("should include truncated flag", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT });
      const parsed = JSON.parse(result);

      expect(typeof parsed.truncated).toBe("boolean");
    });

    test("should respect maxDepth=1 (only show top-level)", async () => {
      const result = await repoMapTool.invoke({
        rootDir: REPO_ROOT,
        maxDepth: 1,
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);

      // With maxDepth=1, the tree should not have deeply nested entries
      // Count indentation levels — at depth 1, max indent is 2 spaces
      const lines = parsed.tree.split("\n").filter(Boolean);
      const deepLines = lines.filter((l: string) => l.startsWith("    ")); // 4+ spaces = depth 2+
      expect(deepLines.length).toBe(0);
    });

    test("should respect maxFiles limit and set truncated=true", async () => {
      const result = await repoMapTool.invoke({
        rootDir: REPO_ROOT,
        maxFiles: 10,
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.stats.totalFiles).toBeLessThanOrEqual(10);
      expect(parsed.truncated).toBe(true);
    });

    test("should exclude node_modules and .git from tree", async () => {
      const result = await repoMapTool.invoke({ rootDir: REPO_ROOT });
      const parsed = JSON.parse(result);

      expect(parsed.tree).not.toContain("node_modules");
      // The .git directory itself should not appear as a folder entry
      // (note: filenames like .gitignore are fine; only the directory 📁 .git/ is blocked)
      expect(parsed.tree).not.toContain("📁 .git/");
    });

    test("should use process.cwd() when rootDir is not provided", async () => {
      const result = await repoMapTool.invoke({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.rootDir).toBe(process.cwd());
    });
  });

  describe("error handling", () => {
    test("should return success=false for non-existent directory", async () => {
      const result = await repoMapTool.invoke({
        rootDir: "/this/path/does/not/exist/xyz123",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(typeof parsed.error).toBe("string");
    });

    test("should return success=false when path points to a file", async () => {
      const filePath = path.join(REPO_ROOT, "package.json");
      const result = await repoMapTool.invoke({ rootDir: filePath });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Not a directory");
    });
  });

  describe("temp directory mapping", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-map-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test("should map an empty directory", async () => {
      const result = await repoMapTool.invoke({ rootDir: tmpDir });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stats.totalFiles).toBe(0);
      expect(parsed.entryPoints).toEqual([]);
      expect(parsed.configFiles).toEqual([]);
      expect(parsed.truncated).toBe(false);
    });

    test("should detect index.ts as entry point", async () => {
      fs.writeFileSync(path.join(tmpDir, "index.ts"), "export const x = 1;");
      fs.writeFileSync(path.join(tmpDir, "utils.ts"), "export const y = 2;");

      const result = await repoMapTool.invoke({ rootDir: tmpDir });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.entryPoints).toContain("index.ts");
      expect(parsed.stats.totalFiles).toBe(2);
      expect(parsed.stats.byExtension[".ts"]).toBe(2);
      expect(parsed.stats.sourceFiles).toBe(2);
    });

    test("should detect package.json as config file", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        '{"name": "test", "version": "1.0.0"}'
      );

      const result = await repoMapTool.invoke({ rootDir: tmpDir });
      const parsed = JSON.parse(result);

      expect(parsed.configFiles).toContain("package.json");
    });

    test("should ignore node_modules directory", async () => {
      const nmDir = path.join(tmpDir, "node_modules");
      fs.mkdirSync(nmDir);
      fs.writeFileSync(path.join(nmDir, "some-package.js"), "module.exports = {};");

      const result = await repoMapTool.invoke({ rootDir: tmpDir });
      const parsed = JSON.parse(result);

      expect(parsed.tree).not.toContain("node_modules");
      expect(parsed.stats.totalFiles).toBe(0); // node_modules files not counted
    });

    test("should handle nested directories", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, "main.ts"), "console.log('hello');");
      fs.writeFileSync(path.join(srcDir, "utils.ts"), "export const add = (a: number, b: number) => a + b;");
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name": "test"}');

      const result = await repoMapTool.invoke({ rootDir: tmpDir });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.stats.totalFiles).toBe(3);
      // main.ts is in src/ — still detected as entry point
      expect(parsed.entryPoints.some((f: string) => f.includes("main.ts"))).toBe(true);
      expect(parsed.tree).toContain("src/");
    });
  });

  describe("getRepoMapTools export", () => {
    test("should return an array containing repoMapTool", async () => {
      const getRepoMapTools = (await import("../../src/tools/repo-map")).default;
      const tools = await getRepoMapTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("repo_map");
    });
  });
});
