// Test for structured logging and error handling functions
import { structuredLog } from '../src/utils/logging';

describe('Structured Logging Tests', () => {
  const originalConsoleLog = console.log;
  const mockConsoleLog = jest.fn();
  
  beforeEach(() => {
    console.log = mockConsoleLog;
    mockConsoleLog.mockClear();
  });
  
  afterAll(() => {
    console.log = originalConsoleLog;
  });
  
  it('should log with timestamp and level', () => {
    structuredLog('info', 'Test message');
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message/)
    );
  });
  
  it('should include context when provided', () => {
    structuredLog('error', 'Error message', { component: 'test', error: 'test error' });
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Error message {"component":"test","error":"test error"}/)
    );
  });
});