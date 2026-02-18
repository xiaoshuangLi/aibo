/**
 * LangChain Tool Retry Middleware Integration
 * 
 * This module provides integration of LangChain's official toolRetryMiddleware
 * with the DeepAgents framework used in this project.
 * 
 * @module langchain-tool-retry-middleware
 */

import { toolRetryMiddleware } from 'langchain';

/**
 * Enhanced error handler that ensures detailed error information is preserved
 * and made available to the agent for proper error reporting.
 * 
 * @param error - The original Error object from tool execution
 * @returns A formatted error message with detailed context
 */
export function enhancedErrorHandler(error: Error): string {
  // Extract detailed error information
  const errorMessage = error.message || 'Unknown error';
  const errorName = error.name || 'Error';
  const stackTrace = error.stack || 'No stack trace available';
  
  // Check if this is a TOOL_EXECUTION_FAILED_AFTER_RETRIES error
  // This would be handled by the tool implementation itself, not by the middleware
  // The middleware receives the actual Error object from the tool
  
  // Handle general errors with full context
  return `Tool execution failed with ${errorName}:
Message: ${errorMessage}
Stack Trace: ${stackTrace}`;
}

/**
 * Create LangChain tool retry middleware with enhanced error handling
 * 
 * This middleware automatically retries failed tool calls with configurable backoff.
 * It supports retrying on specific exceptions and exponential backoff.
 * 
 * Key improvements over default configuration:
 * - Enhanced error handling that preserves and exposes detailed error context
 * - Better error message formatting for debugging
 * - Maintains error stack traces and original input data
 * 
 * Default configuration:
 * - maxRetries: 3 (retry up to 3 times)
 * - onFailure: Custom handler that formats detailed error messages
 * - Exponential backoff with jitter for distributed systems
 * 
 * @returns AgentMiddleware instance configured for tool retry with enhanced error reporting
 */
export function createLangChainToolRetryMiddleware() {
  return toolRetryMiddleware({
    maxRetries: 3,
    // Use custom error handler to preserve error details
    onFailure: enhancedErrorHandler,
    // Exponential backoff configuration
    backoffFactor: 2.0,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    jitter: true,
  });
}

/**
 * Create LangChain tool retry middleware with custom configuration
 * 
 * @param config - Custom configuration for the retry middleware
 * @returns AgentMiddleware instance with custom retry settings
 */
export function createCustomLangChainToolRetryMiddleware(
  config: Parameters<typeof toolRetryMiddleware>[0]
) {
  return toolRetryMiddleware(config);
}