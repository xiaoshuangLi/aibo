/**
 * LSP 日志系统
 */

export type LoggingLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

const LOG_LEVELS: Record<LoggingLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7
};

let currentLogLevel: LoggingLevel = 'info';

export function setLogLevel(level: LoggingLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LoggingLevel {
  return currentLogLevel;
}

function shouldLog(level: LoggingLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLogLevel];
}

export function log(level: LoggingLevel, message: string): void {
  if (shouldLog(level)) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

export function debug(message: string): void {
  log('debug', message);
}

export function info(message: string): void {
  log('info', message);
}

export function notice(message: string): void {
  log('notice', message);
}

export function warning(message: string): void {
  log('warning', message);
}

export function logError(message: string): void {
  log('error', message);
}