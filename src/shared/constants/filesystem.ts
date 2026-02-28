/**
 * Shared filesystem filter constants.
 *
 * Used by the glob/grep search tools and the SafeFilesystemBackend to decide
 * which files and directories should be excluded from search results and
 * filesystem access.
 */

/**
 * File extensions that should be blocked from search and read operations.
 * Covers binary files, media, archives, databases, fonts, and other
 * non-text content that would produce meaningless search results.
 */
export const BLOCKED_EXTENSIONS = new Set([
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
  // Virtual machine disk files
  '.vdi', '.vhd', '.vhdx', '.qcow2', '.raw',
  // Font files
  '.ttf', '.otf', '.woff', '.woff2', '.eot', '.fon', '.fnt', '.tsbuildinfo',
]);

/**
 * Directory names that should be skipped during filesystem traversal.
 * Used by SafeFilesystemBackend when walking directory trees.
 */
export const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'coverage',
  'autos',
  '.git',
  '.cache',
  'dist',
  'build',
  'out',
  '__pycache__',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'venv',
  '.venv',
  'env',
  '.env',
  '.data',
  '.aibo',
]);

/**
 * Glob ignore patterns derived from IGNORED_DIRECTORIES.
 * Used by the glob and grep tools to skip non-source directories.
 */
export const DEFAULT_IGNORE_PATTERNS: string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/out/**',
  '**/.cache/**',
  '**/.data/**',
  '**/.aibo/**',
  '**/__pycache__/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/venv/**',
  '**/.venv/**',
  '**/autos/**',
];
