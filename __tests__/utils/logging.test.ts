import { structuredLog } from '../../src/shared/utils/logging';

describe('utils/logging', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should log with info level', () => {
    structuredLog('info', 'test message');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] test message/)
    );
  });

  test('should log with error level', () => {
    structuredLog('error', 'test error');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] test error/)
    );
  });

  test('should include context when provided', () => {
    structuredLog('warn', 'test warning', { key: 'value' });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] test warning {"key":"value"}/)
    );
  });
});