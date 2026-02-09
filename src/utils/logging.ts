/**
 * Logging utility functions for structured logging.
 */

/**
 * Structured logging function with timestamp, level, and context support.
 * 
 * @param level - Log level ('info', 'warn', 'error')
 * @param message - Log message
 * @param context - Optional context object for additional information
 */
export function structuredLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, any>
): void {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  console.log(`[${timestamp}] [${levelUpper}] ${message}${contextStr}`);
}