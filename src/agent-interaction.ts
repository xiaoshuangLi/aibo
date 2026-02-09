/**
 * Agent interaction utilities for handling AI agent calls and responses.
 */

/**
 * Invokes the AI agent with user input and thread context.
 * 
 * @param agent - The AI agent instance
 * @param input - User input string
 * @param threadId - Thread ID for conversation context
 * @returns Promise resolving to agent response
 */
export async function invokeAgent(agent: any, input: string, threadId: string): Promise<any> {
  if (!agent || typeof agent.invoke !== 'function') {
    throw new Error('Invalid agent provided');
  }
  
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('Input must be a non-empty string');
  }
  
  if (typeof threadId !== 'string' || threadId.trim() === '') {
    throw new Error('Thread ID must be a non-empty string');
  }
  
  return await agent.invoke(
    { messages: [{ role: "user", content: input }] },
    { 
      configurable: { thread_id: threadId },
      recursionLimit: Infinity,
    },
  );
}

/**
 * Handles agent response and formats it for display.
 * 
 * @param response - Raw response from the agent
 * @returns Formatted response string
 */
export function handleAgentResponse(response: any): string {
  if (typeof response === 'string') {
    return response;
  } else if (response && typeof response === 'object') {
    return JSON.stringify(response, null, 2);
  } else {
    return String(response);
  }
}

/**
 * Handles errors that occur during agent interaction.
 * 
 * @param error - Error object
 * @param context - Additional context information
 * @returns Formatted error message
 */
export function handleAgentError(error: any, context: { component: string; [key: string]: any } = { component: 'agent' }): string {
  const errorMessage = error?.message || 'Unknown error occurred';
  console.error(`[${context.component}] Agent interaction error:`, errorMessage);
  
  // Log detailed error info in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error stack:', error?.stack);
    console.error('Error context:', context);
  }
  
  return `发生错误: ${errorMessage}`;
}