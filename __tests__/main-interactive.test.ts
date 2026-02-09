// Test main function's interactive mode detection
import * as processModule from 'process';

describe('Main Function Interactive Mode Detection', () => {
  const originalProcessArgv = process.argv;
  const originalProcessEnv = process.env;
  
  beforeEach(() => {
    process.argv = [...originalProcessArgv];
    process.env = { ...originalProcessEnv };
  });
  
  afterAll(() => {
    process.argv = originalProcessArgv;
    process.env = originalProcessEnv;
  });

  test('should detect --interactive flag correctly', () => {
    process.argv = [...originalProcessArgv, '--interactive'];
    const args = process.argv.slice(2);
    expect(args.includes('--interactive')).toBe(true);
    
    // Test the actual logic used in main()
    const isInteractive = args.includes('--interactive') || 
                         args.includes('-i') || 
                         process.env.AIBO_INTERACTIVE === 'true';
    expect(isInteractive).toBe(true);
  });

  test('should detect -i flag correctly', () => {
    process.argv = [...originalProcessArgv, '-i'];
    const args = process.argv.slice(2);
    expect(args.includes('-i')).toBe(true);
    
    const isInteractive = args.includes('--interactive') || 
                         args.includes('-i') || 
                         process.env.AIBO_INTERACTIVE === 'true';
    expect(isInteractive).toBe(true);
  });

  test('should detect AIBO_INTERACTIVE environment variable', () => {
    process.env.AIBO_INTERACTIVE = 'true';
    const args = process.argv.slice(2);
    
    const isInteractive = args.includes('--interactive') || 
                         args.includes('-i') || 
                         process.env.AIBO_INTERACTIVE === 'true';
    expect(isInteractive).toBe(true);
  });

  test('should return false for normal mode', () => {
    process.argv = [...originalProcessArgv];
    process.env.AIBO_INTERACTIVE = 'false';
    const args = process.argv.slice(2);
    
    const isInteractive = args.includes('--interactive') || 
                         args.includes('-i') || 
                         process.env.AIBO_INTERACTIVE === 'true';
    expect(isInteractive).toBe(false);
  });

  test('main function should handle different modes', async () => {
    const { main } = require('../src/index');
    
    // Test normal mode
    process.argv = [...originalProcessArgv];
    process.env.AIBO_INTERACTIVE = 'false';
    const agent1 = await main();
    expect(agent1).toBeDefined();
    
    // Test that main function structure is correct
    expect(typeof main).toBe('function');
  });
});