import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

/**
 * Result of loading the aibo.md configuration file.
 */
export interface AiboMdConfig {
  /** Model name override (e.g. 'claude-3-5-sonnet-20241022', 'gpt-4o') */
  model?: string;
  /** Custom system prompt content (body of aibo.md after frontmatter) */
  systemPrompt?: string;
}

/**
 * Reads `aibo.md` from the given directory (defaults to `process.cwd()`).
 *
 * The file may optionally start with YAML frontmatter delimited by `---` lines.
 * Supported frontmatter keys:
 * - `model`: overrides the AI model used for this session
 *
 * The remainder of the file (after the frontmatter) is used as the system prompt.
 *
 * @param cwd - Directory to search for `aibo.md`. Defaults to `process.cwd()`.
 * @returns Parsed config, or an empty object if the file does not exist.
 */
export function loadAiboMd(cwd: string = process.cwd()): AiboMdConfig {
  const filePath = join(cwd, 'aibo.md');

  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    const { frontmatter, body } = parseFrontmatter(content);

    const result: AiboMdConfig = {};

    if (frontmatter.model && typeof frontmatter.model === 'string') {
      result.model = frontmatter.model.trim();
    }

    const trimmedBody = body.trim();
    if (trimmedBody) {
      result.systemPrompt = trimmedBody;
    }

    return result;
  } catch (error) {
    console.warn(`Failed to load aibo.md from ${filePath}: ${error}`);
    return {};
  }
}

/**
 * Parses optional YAML frontmatter from a Markdown string.
 *
 * @param content - Full file content
 * @returns Parsed frontmatter object and the remaining body text
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  try {
    const frontmatter = (yaml.load(match[1]) ?? {}) as Record<string, any>;
    return { frontmatter, body: match[2] };
  } catch (error) {
    throw new Error(`Failed to parse YAML frontmatter in aibo.md: ${error}`);
  }
}
