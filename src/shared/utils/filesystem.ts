import * as path from 'path';
import { BLOCKED_EXTENSIONS } from '@/shared/constants/filesystem';

/**
 * Shared filesystem filter utilities.
 *
 * Used by the glob/grep search tools and the SafeFilesystemBackend to filter
 * files that should be excluded from search results and filesystem access.
 */

/**
 * Returns `true` when the given file path has a blocked (binary/non-text)
 * extension that should be excluded from search results.
 *
 * @param filePath - File path to check (only the basename is inspected)
 */
export function hasBlockedExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BLOCKED_EXTENSIONS.has(ext);
}
