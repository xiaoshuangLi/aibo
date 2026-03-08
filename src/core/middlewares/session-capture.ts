/**
 * Session Output Capture Middleware
 * 
 * This middleware captures all agent activities and outputs them through the provided session object.
 * It provides comprehensive logging and monitoring of agent behavior by calling appropriate
 * session methods for different types of events.
 * 
 * @module session-capture
 */

import { createMiddleware, ToolMessage } from 'langchain';
import { z } from 'zod';
import { Session } from '@/core/agent';
import { config } from '@/core/config';
import { normalizeMessageContent } from '@/core/utils/stream';

/**
 * Configuration options for the session output capture middleware
 */
interface SessionOutputCaptureMiddlewareOptions {
  /** The session object to use for output capture */
  session: Session;
}

/**
 * Creates a custom middleware that captures agent outputs and routes them through the session
 * 
 * This middleware intercepts various agent events and calls corresponding session methods:
 * - Tool calls are logged via session.logToolCall()
 * - Tool results are logged via session.logToolResult()
 * - Thinking process steps are logged via session.logThinkingProcess()
 * - System messages are logged via session.logSystemMessage()
 * - Error messages are logged via session.logErrorMessage()
 * - Raw text output is logged via session.logRawText()
 * 
 * The middleware uses LangChain's createMiddleware function with appropriate hooks:
 * - wrapToolCall: Captures tool call start and end events
 * - wrapModelCall: Captures model/LLM interactions
 * - beforeAgent/afterAgent: Captures agent lifecycle events
 * 
 * @param options - Configuration options including the session object
 * @returns AgentMiddleware instance configured for session-based output capture
 */
export function createSessionOutputCaptureMiddleware(
  options: SessionOutputCaptureMiddlewareOptions
) {
  const { session } = options;

  return createMiddleware({
    name: 'SessionOutputCaptureMiddleware',
    
    // Define the state schema (minimal since we're just capturing output)
    stateSchema: z.object({
      capturedOutputs: z.array(z.string()).default([]),
    }),
    
    // Wrap tool calls to capture both start and end events
    wrapToolCall: async (request, handler) => {
      // console.log('🔍 SessionOutputCaptureMiddleware: wrapToolCall called');
      // console.log('wrapToolCall', request, handler);

      const toolName = (request.tool?.name as string | undefined) ?? 'unknown_tool';

      try {
        // Log tool call start
        if (session && typeof session.logToolCall === 'function') {
          let argsStr: string = '{}';
          try {
            const args = request.toolCall.args ?? {};
            argsStr = JSON.stringify(args);
          } catch (e) {
            argsStr = String(request.toolCall.args ?? '');
          }
          session.logToolCall(toolName, argsStr);
        }
        
        // Execute the actual tool call
        const result = await handler(request);
        
        // Log tool call result
        if (session && typeof session.logToolResult === 'function') {
          const success = true; // If we get here, the tool call succeeded
          let preview: string = 'No output';
          // Check if result is a ToolMessage (has content property)
          if ('content' in result && result.content != null) {
            preview = normalizeMessageContent(result.content);
          }
          session.logToolResult(toolName, success, preview);
        }
        
        return result;
      } catch (error) {
        // Log tool call error
        if (session && typeof session.logToolResult === 'function') {
          const success = false;
          const errorMessage = (error as Error).message || 'Unknown error';
          const preview: string = String(errorMessage);
          session.logToolResult(toolName, success, preview);
        }
        
        if (session && typeof session.logErrorMessage === 'function') {
          const errorMessage = (error as Error).message || 'Unknown error';
          session.logErrorMessage(`Tool execution failed: ${errorMessage}`);
        }
        
        // Return an error ToolMessage instead of throwing to maintain flow
        return new ToolMessage({
          content: `Error: ${(error as Error).message}`,
          tool_call_id: request.toolCall.id || 'unknown_tool_call',
        });
      }
    },
    
    // Wrap model calls to capture AI thinking and response generation
    wrapModelCall: async (request, handler) => {
      // console.log('🔍 SessionOutputCaptureMiddleware: wrapModelCall called');
      // console.log('wrapModelCall', request, handler);

      try {
        // Execute the actual model call
        const response = await handler(request);
        
        // Log AI response completion
        if (session && typeof session.streamAIContent === 'function') {
          // Extract the main content from the response using unified normalizer
          const content = normalizeMessageContent(
            'content' in response ? response.content : undefined
          );
          await session.streamAIContent(content, false, true);
        }
        
        return response;
      } catch (error) {
        // Log model call error
        if (session && typeof session.logErrorMessage === 'function') {
          session.logErrorMessage(`AI model execution failed: ${(error as Error).message}`);
        }
        
        // Re-throw the error to maintain normal error handling flow
        throw error;
      }
    },
    
    // // Called before agent execution starts
    // beforeAgent: async (state, runtime) => {
    //   // console.log('🔍 SessionOutputCaptureMiddleware: beforeAgent called');
    //   // console.log('beforeAgent', state, runtime);

    //   if (session && typeof session.logSystemMessage === 'function') {
    //     session.logSystemMessage('Starting agent execution...');
    //   }
      
    //   // Return the state unchanged
    //   return state;
    // },
    
    // // Called after agent execution completes
    // afterAgent: async (state, runtime) => {
    //   // console.log('🔍 SessionOutputCaptureMiddleware: afterAgent called');
    //   // console.log('afterAgent', state, runtime);

    //   if (session && typeof session.logSystemMessage === 'function') {
    //     session.logSystemMessage('Agent execution completed.');
    //   }
      
    //   // Return the state unchanged
    //   return state;
    // }
  });
}