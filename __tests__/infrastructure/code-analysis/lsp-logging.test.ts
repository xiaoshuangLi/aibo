import {
  setLogLevel,
  getLogLevel,
  log,
  debug,
  info,
  notice,
  warning,
  logError,
} from '../../../src/infrastructure/code-analysis/lsp-logging';

describe('lsp-logging', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    // Reset to default log level
    setLogLevel('info');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    setLogLevel('info');
  });

  test('getLogLevel returns current level', () => {
    expect(getLogLevel()).toBe('info');
    setLogLevel('debug');
    expect(getLogLevel()).toBe('debug');
  });

  test('debug() logs when level is debug', () => {
    setLogLevel('debug');
    debug('debug message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('debug message'));
  });

  test('debug() does NOT log when level is info', () => {
    setLogLevel('info');
    debug('debug message');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test('info() logs at info level', () => {
    info('info message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
  });

  test('notice() logs at notice level', () => {
    notice('notice message');
    // notice level (5) <= info level (6), so it should log
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOTICE'));
  });

  test('warning() logs at warning level', () => {
    warning('warning message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
  });

  test('logError() logs at error level', () => {
    logError('error message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
  });

  test('log() does not output when message level is lower priority than current', () => {
    setLogLevel('warning');
    log('debug', 'should not appear');
    log('info', 'should not appear');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test('log() outputs when message level matches current', () => {
    setLogLevel('warning');
    log('warning', 'warning message');
    expect(consoleSpy).toHaveBeenCalled();
  });
});
