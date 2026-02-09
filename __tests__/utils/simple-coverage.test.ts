// Simple coverage test for the remaining lines in interactive-utils.ts
import { handleToolResult } from '../../src/utils/interactive-utils';

// Mock dependencies
jest.mock('../../src/config', () => ({
  config: {
    output: {
      verbose: false,
    },
  },
}));

describe('simple coverage tests', () => {
  test('handleToolResult covers line 113 with valid JSON', () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    
    // Create a valid StreamState
    const state = {
      fullResponse: '',
      lastToolCall: { name: 'testTool' },
      hasDisplayedThinking: false,
      abortSignal: new AbortController().signal,
    };
    
    // Call handleToolResult with a message that has tool_call_id and valid JSON content
    const msg = {
      tool_call_id: 'test-id',
      content: '{"success": true, "command": "ls", "stdout": "file1.txt\\nfile2.txt"}'
    };
    
    handleToolResult(msg, state);
    
    // Should have logged the tool result (from the try block, line 113)
    expect(mockConsoleLog).toHaveBeenCalled();
    
    mockConsoleLog.mockRestore();
  });

  test('handleToolResult covers line 120 with JSON parse error', () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    
    // Create a valid StreamState
    const state = {
      fullResponse: '',
      lastToolCall: { name: 'testTool' },
      hasDisplayedThinking: false,
      abortSignal: new AbortController().signal,
    };
    
    // Mock JSON.parse to throw an error
    const originalJSONParse = JSON.parse;
    JSON.parse = jest.fn(() => {
      throw new Error('Invalid JSON');
    });
    
    try {
      // Call handleToolResult with a message that has tool_call_id and invalid JSON content
      const msg = {
        tool_call_id: 'test-id',
        content: '{"invalid": "json"'
      };
      
      handleToolResult(msg, state);
      
      // Should have logged the tool result (from the catch block, line 120)
      expect(mockConsoleLog).toHaveBeenCalled();
    } finally {
      JSON.parse = originalJSONParse;
      mockConsoleLog.mockRestore();
    }
  });
});