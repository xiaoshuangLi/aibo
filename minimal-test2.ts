// Minimal test for handleAIContent
import { handleAIContent } from './src/utils/interactive-utils';

const abortController = new AbortController();

const state = {
  fullResponse: '',
  lastToolCall: null,
  hasDisplayedThinking: false,
  abortSignal: abortController.signal
};

const msg = { content: 'Hello world', tool_call_id: null };

// Mock process.stdout.write
const originalWrite = process.stdout.write;
const calls: string[] = [];
(process.stdout.write as any) = (data: string) => {
  calls.push(data);
  console.log('WRITE:', JSON.stringify(data));
  return true;
};

async function test() {
  await handleAIContent(msg, state);
  console.log('Calls:', calls);
  console.log('State fullResponse:', state.fullResponse);
  
  // Restore
  (process.stdout.write as any) = originalWrite;
}

test().catch(console.error);