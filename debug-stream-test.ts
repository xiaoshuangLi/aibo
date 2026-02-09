import { handleUserInput } from './src/utils/interactive-utils';
import { createConsoleThreadId } from './src/interactive-logic';

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog as any;

// Mock process.stdout.write
const originalStdoutWrite = process.stdout.write;
const mockStdoutWrite = jest.fn();
(process.stdout.write as any) = mockStdoutWrite;

async function debugTest() {
  const mockAgent = {
    stream: jest.fn().mockImplementation(async () => {
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
    })
  };

  const rl = {
    question: jest.fn()
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
  
  console.log('mockStdoutWrite calls:', mockStdoutWrite.mock.calls);
  console.log('Total calls:', mockStdoutWrite.mock.calls.length);
  
  // Restore originals
  console.log = originalConsoleLog;
  (process.stdout.write as any) = originalStdoutWrite;
}

debugTest().catch(console.error);