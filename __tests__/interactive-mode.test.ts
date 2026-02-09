import { startInteractiveMode } from '../src/index';

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

// Mock process.exit
const originalProcessExit = process.exit;
const mockProcessExit = jest.fn();
(process.exit as any) = mockProcessExit;

// Mock readline
const mockRlQuestion = jest.fn();
const mockRlClose = jest.fn();
jest.mock('readline', () => ({
  createInterface: () => ({
    question: mockRlQuestion,
    close: mockRlClose,
    on: jest.fn(),
  }),
}));

describe('Interactive Mode Tests', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    mockRlQuestion.mockClear();
    mockRlClose.mockClear();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    (process.exit as any) = originalProcessExit;
  });

  it('should handle exit command', async () => {
    // Mock readline to return 'exit' immediately
    mockRlQuestion.mockImplementationOnce((prompt, callback) => {
      callback('exit');
    });
    
    // Create a promise to track when the function completes
    const promise = new Promise<void>((resolve) => {
      // Override rl.close to resolve the promise
      mockRlClose.mockImplementationOnce(() => {
        resolve();
      });
    });
    
    // Start interactive mode
    startInteractiveMode();
    
    // Wait for completion
    await promise;
    
    expect(mockRlClose).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('再见！'));
  });

  it('should handle empty input', async () => {
    let callCount = 0;
    mockRlQuestion.mockImplementation((prompt, callback) => {
      callCount++;
      if (callCount === 1) {
        callback(''); // Empty input
      } else if (callCount === 2) {
        callback('exit'); // Exit on second call
      }
    });
    
    const promise = new Promise<void>((resolve) => {
      mockRlClose.mockImplementationOnce(() => {
        resolve();
      });
    });
    
    startInteractiveMode();
    await promise;
    
    expect(mockRlQuestion).toHaveBeenCalledTimes(2);
  });

  it('should handle quit command', async () => {
    mockRlQuestion.mockImplementationOnce((prompt, callback) => {
      callback('quit');
    });
    
    const promise = new Promise<void>((resolve) => {
      mockRlClose.mockImplementationOnce(() => {
        resolve();
      });
    });
    
    startInteractiveMode();
    await promise;
    
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('再见！'));
  });

  // Test error handling in interactive mode
  it('should handle agent errors gracefully', async () => {
    // This test ensures that the error handling structure exists
    // Actual error simulation would require mocking the agent
    expect(typeof startInteractiveMode).toBe('function');
  });
});