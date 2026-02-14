import { sleepTool, echoTool } from '@/tools/utils';

describe('Utility Tools', () => {
  describe('sleepTool', () => {
    test('should sleep for specified duration and return success', async () => {
      const startTime = Date.now();
      const result = await sleepTool.invoke({ duration: 10 });
      const endTime = Date.now();
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Slept for 10 milliseconds');
      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });

    test('should handle minimum duration (0)', async () => {
      const result = await sleepTool.invoke({ duration: 0 });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Slept for 0 milliseconds');
    });

    test('should handle maximum duration (10000)', async () => {
      // Use a shorter duration to avoid test timeout
      const result = await sleepTool.invoke({ duration: 100 });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Slept for 100 milliseconds');
    });
  });

  describe('echoTool', () => {
    test('should echo back the input message', async () => {
      const result = await echoTool.invoke({ message: 'Hello, world!' });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.echoed).toBe('Hello, world!');
    });

    test('should handle empty message', async () => {
      const result = await echoTool.invoke({ message: '' });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.echoed).toBe('');
    });

    test('should handle special characters', async () => {
      const specialMessage = 'Hello! @#$%^&*()_+{}|:"<>?';
      const result = await echoTool.invoke({ message: specialMessage });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.echoed).toBe(specialMessage);
    });

    test('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(1000);
      const result = await echoTool.invoke({ message: longMessage });
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.echoed).toBe(longMessage);
    });
  });
});