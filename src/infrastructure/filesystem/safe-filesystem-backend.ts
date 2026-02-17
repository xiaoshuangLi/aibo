import { FilesystemBackend, GrepMatch } from 'deepagents';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Safe Filesystem Backend with restricted access and filtering
 * 
 * This backend provides a secure wrapper around the default FilesystemBackend
 * with the following safety features:
 * - Restricted root directory (only project directory and subdirectories)
 * - File type filtering (blocks binary files, model files, etc.)
 * - Size limits to prevent token overflow
 * - Depth limits to prevent excessive directory traversal
 * - Proper error handling for permission issues
 */
export class SafeFilesystemBackend extends FilesystemBackend {
  readonly allowedExtensions: Set<string>;
  readonly blockedExtensions: Set<string>;
  readonly ignoredDirectories: Set<string>;
  readonly maxDepth: number;
  readonly projectRoot: string;

  constructor(options: {
    rootDir: string;
    maxFileSizeMb?: number;
    maxDepth?: number;
  }) {
    // Set reasonable defaults
    const maxFileSizeMb = options.maxFileSizeMb ?? 10; // 10MB default instead of 1000MB
    const maxDepth = options.maxDepth ?? 5; // Limit directory depth
    
    super({
      rootDir: options.rootDir,
      maxFileSizeMb: maxFileSizeMb
    });

    this.projectRoot = path.resolve(options.rootDir);
    this.maxDepth = maxDepth;

    // Directories to ignore during grep operations
    this.ignoredDirectories = new Set([
      'node_modules',
      'coverage',
      'autos',
      '.git',
      '.cache',
      'dist',
      'build',
      'out',
      'coverage',
      '__pycache__',
      '.next',
      '.nuxt',
      '.svelte-kit',
      'venv',
      '.venv',
      'env',
      '.env'
    ]);

    // Allowed extensions for text-based files we want to read
    this.allowedExtensions = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yaml', '.yml',
      '.html', '.css', '.scss', '.sass', '.less', '.xml', '.csv', '.sql',
      '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.go', '.rs', '.rb',
      '.php', '.swift', '.kt', '.gradle', '.properties', '.env', '.gitignore',
      '.dockerfile', '.toml', '.ini', '.cfg', '.conf', '.log', '.example'
    ]);

    // Blocked extensions for binary files, models, and sensitive content
    this.blockedExtensions = new Set([
      // Binary/model files
      '.bin', '.dat', '.model', '.pth', '.pt', '.ckpt', '.h5', '.pb', '.onnx',
      '.tflite', '.safetensors', '.gguf', '.ggml', '.npy', '.npz',
      // System files
      '.dll', '.so', '.dylib', '.exe', '.app', '.dmg', '.pkg', '.msi',
      // Media files
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg',
      '.mp3', '.wav', '.ogg', '.flac', '.mp4', '.avi', '.mov', '.wmv', '.mkv',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.tar',
      '.gz', '.7z', '.rar', '.iso', '.dmg', '.img', '.vmdk', '.ova',
      // Cache and temporary files
      '.cache', '.tmp', '.temp', '.swp', '.swo', '.lock',
      // Database files
      '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dbf',
      // Virtual machine files
      '.vdi', '.vhd', '.vhdx', '.qcow2', '.raw',
      // Font files
      '.ttf', '.otf', '.woff', '.woff2', '.eot', '.fon', '.fnt'
    ]);
  }

  /**
   * Check if a file path is within the allowed project root
   */
  isWithinProjectRoot(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const normalizedProjectRoot = path.resolve(this.projectRoot);
    
    // Ensure both paths end with separator for proper comparison
    const normalizedResolvedPath = resolvedPath + (resolvedPath.endsWith(path.sep) ? '' : path.sep);
    const normalizedRootWithSep = normalizedProjectRoot + path.sep;
    
    return resolvedPath === normalizedProjectRoot || normalizedResolvedPath.startsWith(normalizedRootWithSep);
  }

  /**
   * Check if a file extension is allowed
   */
  isAllowedExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    
    // If it's in blocked extensions, reject immediately
    if (this.blockedExtensions.has(ext)) {
      return false;
    }
    
    // If it has no extension, allow it (could be README, Makefile, etc.)
    if (ext === '') {
      return true;
    }
    
    // Allow if it's in allowed extensions
    return this.allowedExtensions.has(ext);
  }

  /**
   * Check if the file depth is within limits
   */
  isWithinDepthLimit(filePath: string): boolean {
    const relativePath = path.relative(this.projectRoot, filePath);
    
    // If the path is the same as project root, depth is 0
    if (relativePath === '') {
      return true; // Root directory is always allowed
    }
    
    // Handle cases where relative path might start with '..' (outside project root)
    if (relativePath.startsWith('..')) {
      return false; // Already handled by isWithinProjectRoot, but extra safety
    }
    
    const depth = relativePath.split(path.sep).filter(part => part !== '').length;
    return depth <= this.maxDepth;
  }

  /**
   * Check if a directory path contains any ignored directories
   */
  shouldIgnoreDirectory(dirPath: string): boolean {
    const relativePath = path.relative(this.projectRoot, dirPath);
    
    // If it's the root directory, don't ignore
    if (relativePath === '' || relativePath === '.') {
      return false;
    }
    
    // Split the path and check each directory component
    const parts = relativePath.split(path.sep).filter(part => part !== '');
    return parts.some(part => this.ignoredDirectories.has(part));
  }

  /**
   * Enhanced read operation with safety checks
   */
  async read(filePath: string, offset?: number, limit?: number): Promise<string> {
    try {
      // Security checks
      if (!this.isWithinProjectRoot(filePath)) {
        throw new Error(`Access denied: ${filePath} is outside project root`);
      }

      if (!this.isWithinDepthLimit(filePath)) {
        throw new Error(`Access denied: ${filePath} exceeds maximum depth limit of ${this.maxDepth}`);
      }

      if (!this.isAllowedExtension(filePath)) {
        throw new Error(`Access denied: ${filePath} has a blocked file extension`);
      }

      // Call parent read method with offset and limit parameters
      // The parent class will handle the file size check internally
      return await super.read(filePath, offset, limit);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Access denied')) {
        throw error;
      }
      
      // Handle permission errors gracefully
      if (error instanceof Error && (error.message.includes('EACCES') || error.message.includes('EPERM'))) {
        throw new Error(`Permission denied: Cannot access ${filePath}`);
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Enhanced lsInfo operation with safety checks
   */
  async lsInfo(directoryPath: string = process.cwd()): Promise<import('deepagents').FileInfo[]> {
    try {
      // Security checks
      if (!this.isWithinProjectRoot(directoryPath)) {
        throw new Error(`Access denied: ${directoryPath} is outside project root`);
      }

      if (!this.isWithinDepthLimit(directoryPath)) {
        throw new Error(`Access denied: ${directoryPath} exceeds maximum depth limit of ${this.maxDepth}`);
      }

      // Get all files from parent
      const allFiles = await super.lsInfo(directoryPath);
      
      // Filter out blocked files
      return allFiles.filter((file: any) => {
        const fullPath = file.path;
        return this.isAllowedExtension(fullPath);
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Access denied')) {
        throw error;
      }
      
      // Handle permission errors gracefully
      if (error instanceof Error && (error.message.includes('EACCES') || error.message.includes('EPERM'))) {
        throw new Error(`Permission denied: Cannot access ${directoryPath}`);
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Enhanced grepRaw operation with directory filtering
   */
  async grepRaw(
    pattern: string,
    dirPath: string = process.cwd(),
    glob: string | null = null,
  ): Promise<GrepMatch[] | string> {
    try {
      // Security checks for the base directory
      if (!this.isWithinProjectRoot(dirPath)) {
        return `Access denied: ${dirPath} is outside project root`;
      }
      
      if (this.shouldIgnoreDirectory(dirPath)) {
        // If the base directory itself is ignored, return empty result
        return [];
      }

      // Get results from parent method
      const result = await super.grepRaw(pattern, dirPath, glob);
      
      // If result is a string (error), return it as-is
      if (typeof result === 'string') {
        return result;
      }
      
      // Filter out files that are in ignored directories
      const filteredMatches = result.filter((match: GrepMatch) => {
        const fileDir = path.dirname(match.path);
        return !this.shouldIgnoreDirectory(fileDir);
      });
      
      return filteredMatches;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Access denied')) {
        return error.message;
      }
      
      // Handle permission errors gracefully
      if (error instanceof Error && (error.message.includes('EACCES') || error.message.includes('EPERM'))) {
        return `Permission denied: Cannot access ${dirPath}`;
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Enhanced globInfo operation with safety checks and filtering
   */
  async globInfo(pattern: string, searchPath: string = process.cwd()): Promise<import('deepagents').FileInfo[]> {
    try {
      // Security checks for the base directory
      if (!this.isWithinProjectRoot(searchPath)) {
        throw new Error(`Access denied: ${searchPath} is outside project root`);
      }
      
      if (!this.isWithinDepthLimit(searchPath)) {
        throw new Error(`Access denied: ${searchPath} exceeds maximum depth limit of ${this.maxDepth}`);
      }

      // Get results from parent method
      const allFiles = await super.globInfo(pattern, searchPath);
      
      // Filter out files that are in ignored directories or have blocked extensions
      return allFiles.filter((file: any) => {
        const fullPath = file.path;
        
        // Check if file is in an ignored directory
        const fileDir = path.dirname(fullPath);
        if (this.shouldIgnoreDirectory(fileDir)) {
          return false;
        }
        
        // Check if file has allowed extension
        return this.isAllowedExtension(fullPath);
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Access denied')) {
        throw error;
      }
      
      // Handle permission errors gracefully
      if (error instanceof Error && (error.message.includes('EACCES') || error.message.includes('EPERM'))) {
        throw new Error(`Permission denied: Cannot access ${searchPath}`);
      }
      
      // Re-throw other errors
      throw error;
    }
  }
}