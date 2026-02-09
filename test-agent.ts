import { createAIAgent } from './src/index';

async function testAgent() {
  try {
    const agent = createAIAgent();
    console.log('Agent created successfully');
    
    // Test a simple invoke call
    const response = await (agent as any).invoke('Hello', { 
      threadId: 'test-thread-123',
      state: { todos: [] }
    });
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

testAgent();