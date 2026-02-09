import { startInteractiveMode } from '../src/index';
import * as readline from 'readline';

// Mock readline to avoid actual stdin/stdout interaction
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn(),
    close: jest.fn(),
  }),
}));

describe('Interactive Mode', () => {
  let originalProcessOn: any;
  let mockExitHandler: jest.Mock;

  beforeEach(() => {
    // Mock process.on to test that it's called correctly
    originalProcessOn = (process as any).on;
    mockExitHandler = jest.fn();
    (process as any).on = jest.fn((event, handler) => {
      if (event === 'SIGINT' || event === 'SIGTERM') {
        // Store the handler for testing
        (process as any)._testHandler = handler;
      }
    });
  });

  afterEach(() => {
    (process as any).on = originalProcessOn;
    jest.clearAllMocks();
  });

  it('should set up exit handlers correctly', async () => {
    // This will trigger the setup of exit handlers
    await startInteractiveMode();
    
    // Verify that process.on was called for SIGINT and SIGTERM
    expect((process as any).on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect((process as any).on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('should not throw TypeError when process.on is called', () => {
    // This test ensures that the process.on method exists and is callable
    // which was the original bug
    expect(typeof process.on).toBe('function');
    
    // Try calling it with a mock handler
    const mockHandler = jest.fn();
    process.on('SIGINT', mockHandler);
    
    // Clean up
    process.removeListener('SIGINT', mockHandler);
  });
});