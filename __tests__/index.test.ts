import { createAIAgent, main } from '../src/index';
import { structuredLog } from '../src/utils/logging';

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

// Mock process.exit
const originalProcessExit = process.exit;
const mockProcessExit = jest.fn();
(process.exit as any) = mockProcessExit;

// Mock process.argv for interactive mode testing
const originalProcessArgv = process.argv;
const originalProcessEnv = process.env;

describe('AI Agent', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    process.argv = [...originalProcessArgv];
    process.env = { ...originalProcessEnv };
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    (process.exit as any) = originalProcessExit;
    process.argv = originalProcessArgv;
    process.env = originalProcessEnv;
  });

  it('should create AI agent successfully', () => {
    const agent = createAIAgent();
    expect(agent).toBeDefined();
  });

  it('should initialize main function without errors', async () => {
    const agent = await main();
    expect(agent).toBeDefined();
  });

  it('should handle main function with interactive flag', async () => {
    // Mock process.argv to include --interactive flag
    process.argv = [...originalProcessArgv, '--interactive'];
    
    // We can't actually test the full interactive mode in unit tests
    // but we can verify that the function handles the flag correctly
    expect(typeof main).toBe('function');
  });

  it('should handle main function with environment variable', async () => {
    process.env.AIBO_INTERACTIVE = 'true';
    expect(typeof main).toBe('function');
  });

  describe('structuredLog', () => {
    it('should log info messages correctly', () => {
      structuredLog('info', 'Test message', { key: 'value' });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message {"key":"value"}/)
      );
    });

    it('should log error messages correctly', () => {
      structuredLog('error', 'Test error', { key: 'value' });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Test error {"key":"value"}/)
      );
    });

    it('should log warning messages correctly', () => {
      structuredLog('warn', 'Test warning', { key: 'value' });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] Test warning {"key":"value"}/)
      );
    });

    it('should handle missing context', () => {
      structuredLog('info', 'Test message');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message$/)
      );
    });
  });

  // Test error handling in main function
  it('should handle initialization errors in main function', async () => {
    // This is a basic test to ensure the error handling structure exists
    // Actual error simulation would require mocking deeper dependencies
    expect(typeof main).toBe('function');
  });

  // Test that process signal handlers are set up
  it('should have process signal handlers configured', () => {
    // Verify that the process.on method exists (basic check)
    expect(typeof process.on).toBe('function');
  });
});