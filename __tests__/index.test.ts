import { createAIAgent, main } from '../src/index';

describe('AI Agent', () => {
  it('should create AI agent successfully', () => {
    const agent = createAIAgent();
    expect(agent).toBeDefined();
    // For now, just check that it's not null/undefined
  });

  it('should initialize main function without errors', async () => {
    const agent = await main();
    expect(agent).toBeDefined();
  });
});