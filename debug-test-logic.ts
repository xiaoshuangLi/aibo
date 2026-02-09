// Debug test for the streaming logic
const state = { fullResponse: '' };
const msg = { content: 'Hello world' };

const newContent = String(msg.content).replace(state.fullResponse, "");
console.log('newContent:', JSON.stringify(newContent));
console.log('newContent length:', newContent.length);
console.log('Characters:');
for (let i = 0; i < newContent.length; i++) {
  console.log(`  ${i}: "${newContent[i]}"`);
}

// Simulate the write loop
const mockWrites: string[] = [];
for (const char of newContent) {
  mockWrites.push(char);
  console.log('Writing:', JSON.stringify(char));
}

console.log('Total writes:', mockWrites.length);
console.log('Mock writes:', mockWrites);