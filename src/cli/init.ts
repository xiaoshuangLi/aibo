import readline from 'readline';
import fs from 'fs';
import path from 'path';

/**
 * CLI init command module for aibo.
 *
 * Runs an interactive setup wizard that:
 *  1. Prompts the user to configure environment variables.
 *  2. Writes the configured values to a `.env` file in the current working directory.
 *  3. Creates a `.aibo` symbolic link in the current working directory that points
 *     to the directory where the aibo npm package is installed globally.
 *
 * @module cli/init
 */

/**
 * A single configurable environment variable definition used during `aibo init`.
 */
interface EnvPrompt {
  /** Environment variable name */
  key: string;
  /** Human-readable description shown as the prompt */
  description: string;
  /** Default value pre-filled for the user */
  defaultValue?: string;
}

/**
 * Ordered list of environment variables that the init wizard walks the user through.
 * Each entry is presented as an interactive prompt; pressing Enter accepts the default.
 */
const ENV_PROMPTS: EnvPrompt[] = [
  // ── Model Configuration ──────────────────────────────────────────────────────
  {
    key: 'AIBO_API_KEY',
    description: 'API key for the model provider (not required for Ollama)',
    defaultValue: '',
  },
  {
    key: 'AIBO_BASE_URL',
    description: 'Base URL for the model provider (leave blank for defaults)',
    defaultValue: '',
  },
  {
    key: 'AIBO_MODEL_NAME',
    description: 'Model name to use (e.g. gpt-4o, claude-3-5-sonnet-20241022, gemini-2.0-flash, llama3)',
    defaultValue: 'gpt-4o',
  },
  {
    key: 'AIBO_MODEL_PROVIDER',
    description: 'Explicit provider override: openai | anthropic | google | mistral | groq | ollama | azure (leave blank for auto-detect)',
    defaultValue: '',
  },
  {
    key: 'AIBO_AZURE_API_VERSION',
    description: 'Azure OpenAI API version (only needed for Azure provider)',
    defaultValue: '2024-02-15-preview',
  },
  // ── LangChain / Runtime ───────────────────────────────────────────────────────
  {
    key: 'AIBO_RECURSION_LIMIT',
    description: 'Maximum recursion depth for LangGraph',
    defaultValue: '1000',
  },
  {
    key: 'AIBO_CHECKPOINTER_TYPE',
    description: 'Checkpointing mechanism: memory | sqlite | filesystem',
    defaultValue: 'memory',
  },
  {
    key: 'AIBO_MEMORY_WINDOW_SIZE',
    description: 'Size of the conversation memory window',
    defaultValue: '5',
  },
  // ── Output / Language / Persona ───────────────────────────────────────────────
  {
    key: 'AIBO_VERBOSE_OUTPUT',
    description: 'Enable verbose output for debugging (true/false)',
    defaultValue: 'false',
  },
  {
    key: 'AIBO_LANGUAGE',
    description: "Language for prompts and responses: 'en' | 'zh'",
    defaultValue: 'en',
  },
  {
    key: 'AIBO_PERSONA',
    description: 'Persona / communication style for the AI',
    defaultValue: '你的交流风格是魅魔人设：妩媚迷人、温柔体贴、善于撒娇。用甜蜜亲切的语气与用户互动，偶尔使用"主人"等称呼，举止优雅而富有魅力。在保持专业技术能力的同时，让每次对话都充满温情与趣味。',
  },
  // ── Tencent Cloud ─────────────────────────────────────────────────────────────
  {
    key: 'AIBO_TENCENTCLOUD_APP_ID',
    description: 'Tencent Cloud App ID (required for voice input / web search)',
    defaultValue: '',
  },
  {
    key: 'AIBO_TENCENTCLOUD_SECRET_ID',
    description: 'Tencent Cloud Secret ID (required for voice input / web search)',
    defaultValue: '',
  },
  {
    key: 'AIBO_TENCENTCLOUD_SECRET_KEY',
    description: 'Tencent Cloud Secret Key (required for voice input / web search)',
    defaultValue: '',
  },
  {
    key: 'AIBO_TENCENTCLOUD_REGION',
    description: 'Tencent Cloud region',
    defaultValue: 'ap-guangzhou',
  },
  // ── Composio ──────────────────────────────────────────────────────────────────
  {
    key: 'AIBO_COMPOSIO_API_KEY',
    description: 'Composio API key',
    defaultValue: '',
  },
  {
    key: 'AIBO_COMPOSIO_EXTERNAL_USER_ID',
    description: 'Composio external user ID',
    defaultValue: '',
  },
  // ── Lark / Feishu ─────────────────────────────────────────────────────────────
  {
    key: 'AIBO_LARK_APP_ID',
    description: 'Lark / Feishu App ID (required for Lark integration)',
    defaultValue: '',
  },
  {
    key: 'AIBO_LARK_APP_SECRET',
    description: 'Lark / Feishu App Secret (required for Lark integration)',
    defaultValue: '',
  },
  {
    key: 'AIBO_LARK_RECEIVE_ID',
    description: 'Default Lark receive ID for messages',
    defaultValue: '',
  },
  {
    key: 'AIBO_LARK_INTERACTIVE_TEMPLATE_ID',
    description: 'Template ID for interactive Lark messages',
    defaultValue: '',
  },
  // ── Advanced / Misc ───────────────────────────────────────────────────────────
  {
    key: 'AIBO_MAX_CONCURRENT_SUBTASKS',
    description: 'Maximum number of concurrent subtasks (1-50)',
    defaultValue: '5',
  },
  {
    key: 'AIBO_SPECIAL_KEYWORD',
    description: 'Keyword that triggers special behavior in voice / terminal input',
    defaultValue: '干活',
  },
  {
    key: 'AIBO_INTERACTION',
    description: "Interaction mode: 'console' | 'lark'",
    defaultValue: 'console',
  },
];

/**
 * Asks the user a single question and returns the trimmed answer.
 * If the user presses Enter without typing anything, `defaultValue` is returned.
 * If `rlClosed` is already `true` or the readline interface closes before an
 * answer is provided (e.g. stdin reaches EOF), the promise resolves with
 * `defaultValue` so the wizard can still complete gracefully.
 *
 * @param rl - Active readline.Interface instance
 * @param rlClosed - Mutable flag indicating whether readline has already closed
 * @param prompt - The question to display
 * @param defaultValue - Value returned when the user provides no input
 * @returns The user's answer or the default value
 */
function ask(rl: readline.Interface, rlClosed: boolean, prompt: string, defaultValue = ''): Promise<string> {
  return new Promise((resolve) => {
    // If readline is already closed, resolve immediately with the default.
    if (rlClosed) {
      resolve(defaultValue);
      return;
    }
    const hint = defaultValue ? ` (default: ${defaultValue})` : '';
    const onClose = () => resolve(defaultValue);
    rl.once('close', onClose);
    try {
      rl.question(`${prompt}${hint}: `, (answer) => {
        rl.removeListener('close', onClose);
        resolve(answer.trim() || defaultValue);
      });
    } catch {
      // rl.question() throws ERR_USE_AFTER_CLOSE if readline closed between the
      // `rlClosed` check and the call itself (race condition).
      rl.removeListener('close', onClose);
      resolve(defaultValue);
    }
  });
}

/**
 * Resolves the root directory of the aibo npm package.
 *
 * When the package is installed globally the compiled file lives at
 * `<package-root>/dist/cli/init.js`, so the package root is two levels up from
 * `__dirname`.
 *
 * @returns Absolute path to the aibo package installation directory
 */
export function resolvePackageDir(): string {
  return path.resolve(__dirname, '..', '..');
}

/**
 * Writes the provided key/value pairs to a `.env` file at `targetPath`.
 * Existing file content is replaced.
 *
 * @param entries - Map of environment variable names to their values
 * @param targetPath - Absolute path to the `.env` file to write
 */
export function writeEnvFile(entries: Record<string, string>, targetPath: string): void {
  const lines = Object.entries(entries).map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(targetPath, lines.join('\n') + '\n', 'utf-8');
}

/**
 * Creates (or recreates) a `.aibo` symbolic link inside `targetDir` that
 * points to `packageDir`.
 *
 * @param targetDir - Directory in which the symlink should be created (usually cwd)
 * @param packageDir - Absolute path the symlink should point to
 */
export function createAiboSymlink(targetDir: string, packageDir: string): void {
  const symlinkPath = path.join(targetDir, '.aibo');

  try {
    const stat = fs.lstatSync(symlinkPath);
    // Remove whatever is there (symlink, directory, or file) before recreating
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      fs.rmSync(symlinkPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(symlinkPath);
    }
  } catch {
    // Nothing to remove — that's fine
  }

  fs.symlinkSync(packageDir, symlinkPath, 'dir');
}

/**
 * Entry point for `aibo init`.
 *
 * Walks the user through the interactive configuration wizard, writes `.env`,
 * and creates the `.aibo` symbolic link in the current working directory.
 */
export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  const packageDir = resolvePackageDir();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Track whether readline has been closed (e.g. stdin reached EOF).
  let rlClosed = false;
  rl.once('close', () => { rlClosed = true; });

  console.log('\nWelcome to aibo init! 🎉');
  console.log('Press Enter to accept the default value, or type a new value.\n');

  const values: Record<string, string> = {};

  for (const prompt of ENV_PROMPTS) {
    values[prompt.key] = await ask(rl, rlClosed, prompt.description + `\n  ${prompt.key}`, prompt.defaultValue);
  }

  rl.close();

  // Write .env
  const envPath = path.join(cwd, '.env');
  writeEnvFile(values, envPath);
  console.log(`\n✅  Configuration written to ${envPath}`);

  // Create .aibo symlink
  try {
    createAiboSymlink(cwd, packageDir);
    console.log(`✅  Created .aibo → ${packageDir}`);
  } catch (error: any) {
    console.error(`⚠️   Failed to create .aibo symlink: ${error.message}`);
  }

  console.log('\n🎉  aibo init complete! Run "aibo" to start.\n');
}
