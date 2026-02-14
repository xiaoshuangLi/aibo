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
 * Create LangChain tool retry middleware with default configuration
 * 
 * This middleware automatically retries failed tool calls with configurable backoff.
 * It supports retrying on specific exceptions and exponential backoff.
 * 
 * Default configuration:
 * - maxRetries: 3 (retry up to 3 times)
 * - onFailure: "continue" (return error message to agent instead of throwing exception)
 * - Exponential backoff with jitter for distributed systems
 * 
 * @returns AgentMiddleware instance configured for tool retry
 */
export function createLangChainToolRetryMiddleware() {
  return toolRetryMiddleware({
    maxRetries: 3,
    onFailure: "continue",
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