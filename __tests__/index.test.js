import { createAIAgent, main } from '../src/index';
describe('AI Agent', () => {
    it('should create AI agent successfully', () => {
        const agent = createAIAgent();
        expect(agent).toBeDefined();
        // Add more specific assertions based on DeepAgent API
    });
    it('should initialize main function without errors', async () => {
        const agent = await main();
        expect(agent).toBeDefined();
    });
});
//# sourceMappingURL=index.test.js.map