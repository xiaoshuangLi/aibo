import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Utility tools for common operations.
 */

/**
 * Sleep/delay tool that pauses execution for a specified duration.
 */
export const sleepTool = tool(
  async ({ duration }) => {
    if (duration < 0 || duration > 10000) {
      return JSON.stringify({
        success: false,
        error: "Duration must be between 0 and 10000 milliseconds"
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return JSON.stringify({
      success: true,
      message: `Slept for ${duration} milliseconds`
    });
  },
  {
    name: "sleep",
    description: "Pauses execution for the specified duration in milliseconds (0-10000).",
    schema: z.object({
      duration: z.number().int().min(0).max(10000).describe("Duration to sleep in milliseconds")
    })
  }
);

/**
 * Echo tool that returns the input string.
 */
export const echoTool = tool(
  async ({ message }) => {
    return JSON.stringify({
      success: true,
      echoed: message
    });
  },
  {
    name: "echo",
    description: "Returns the input message back to the caller.",
    schema: z.object({
      message: z.string().describe("Message to echo back")
    })
  }
);

export default [sleepTool, echoTool];