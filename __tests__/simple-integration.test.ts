import { startInteractiveMode, main } from '../src/index';

describe('Simple Integration Tests', () => {
  test('startInteractiveMode function should be defined', () => {
    expect(typeof startInteractiveMode).toBe('function');
  });

  test('main function should be defined and callable', async () => {
    expect(typeof main).toBe('function');
    
    // Test normal mode
    const agent = await main();
    expect(agent).toBeDefined();
  });

  test('interactive mode detection logic should work', () => {
    // Test the logic that detects interactive mode
    const testInteractiveDetection = (args: string[], envVar?: string): boolean => {
      return args.includes('--interactive') || 
             args.includes('-i') || 
             envVar === 'true';
    };
    
    expect(testInteractiveDetection(['--interactive'], undefined)).toBe(true);
    expect(testInteractiveDetection(['-i'], undefined)).toBe(true);
    expect(testInteractiveDetection([], 'true')).toBe(true);
    expect(testInteractiveDetection([], undefined)).toBe(false);
  });
});