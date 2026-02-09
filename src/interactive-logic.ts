/**
 * Interactive mode logic utilities that can be easily tested.
 */

/**
 * Determines if user input should exit the interactive mode.
 * 
 * @param input - User input string
 * @returns true if input is 'exit' or 'quit' (case-insensitive), false otherwise
 */
export function shouldExitInteractiveMode(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  return trimmed === 'exit' || trimmed === 'quit';
}

/**
 * Determines if user input is empty (whitespace only).
 * 
 * @param input - User input string
 * @returns true if input is empty or whitespace only, false otherwise
 */
export function isEmptyInput(input: string): boolean {
  return input.trim() === '';
}

/**
 * Processes agent response and returns formatted output.
 * 
 * @param response - Raw response from the agent
 * @returns Formatted string response for display
 */
export function formatAgentResponse(response: any): string {
  if (typeof response === 'string') {
    return response;
  } else if (response && typeof response === 'object') {
    return JSON.stringify(response, null, 2);
  } else {
    return String(response);
  }
}

/**
 * Validates if a thread ID is valid.
 * 
 * @param threadId - Thread ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidThreadId(threadId: string): boolean {
  return typeof threadId === 'string' && threadId.length > 0;
}

/**
 * Creates a default thread ID for console sessions.
 * 
 * @returns Generated thread ID string
 */
export function createConsoleThreadId(): string {
  return "console-session-" + Date.now();
}