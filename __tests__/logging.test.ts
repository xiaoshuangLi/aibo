import { structuredLog } from '../src/utils/logging';

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

describe('Structured Logging', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

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

  it('should handle empty context', () => {
    structuredLog('info', 'Test message', {});
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message {}$/)
    );
  });
});