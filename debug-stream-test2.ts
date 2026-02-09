import { handleUserInput } from './src/utils/interactive-utils';
import { createConsoleThreadId } from './src/interactive-logic';

// Simple mock for process.stdout.write
const originalStdoutWrite = process.stdout.write;
const writeCalls: string[] = [];
(process.stdout.write as any) = (data: string) => {
  writeCalls.push(data);
  return true;
};

async function debugTest() {
  const mockAgent = {
    stream: async () => {
      return [
        {
          model_request: {
            messages: [{
              content: 'Hello world',
              tool_calls: [],
              tool_call_id: null
            }]
          }
        }
      ];
    }
  };

  const rl = {
    question: () => {}
  };

  const session = {
    threadId: createConsoleThreadId(),
    isRunning: false,
    abortController: null,
    rl: rl
  };

  console.log('Before handleUserInput');
  await handleUserInput('hello', session, mockAgent, rl);
  console.log('After handleUserInput');
  
  console.log('Write calls:', writeCalls);
  console.log('Total calls:', writeCalls.length);
  
  // Restore original
  (process.stdout.write as any) = originalStdoutWrite;
}

debugTest().catch(console.error);