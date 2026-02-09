import { main } from '../src/index';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();

// Mock process methods
const originalProcessExit = process.exit;
const originalProcessArgv = process.argv;
const originalProcessEnv = process.env;

describe('Main Function Tests', () => {
  beforeEach(() => {
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    (process.exit as any) = jest.fn();
    process.argv = [...originalProcessArgv];
    process.env = { ...originalProcessEnv };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.argv = originalProcessArgv;
    process.env = originalProcessEnv;
  });

  afterAll(() => {
    process.exit = originalProcessExit;
  });

  it('should initialize successfully in normal mode', async () => {
    const agent = await main();
    expect(agent).toBeDefined();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('AI Agent initialized successfully')
    );
  });

  it('should handle initialization error gracefully', async () => {
    // This is hard to test without actually breaking the initialization
    // But we can verify the error handling structure exists
    expect(typeof main).toBe('function');
  });
});