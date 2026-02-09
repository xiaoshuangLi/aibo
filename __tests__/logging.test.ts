import { structuredLog } from '../src/utils/logging';

// Mock console.log to capture output
const originalConsoleLog = console.log;
let capturedLogs: string[] = [];

beforeEach(() => {
  capturedLogs = [];
  console.log = (message: string) => {
    capturedLogs.push(message);
  };
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('Logging Utilities', () => {
  describe('structuredLog', () => {
    test('should log info messages with correct format', () => {
      structuredLog('info', 'Test message');
      
      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0];
      expect(log).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test message/);
    });

    test('should log warn messages with correct format', () => {
      structuredLog('warn', 'Warning message');
      
      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0];
      expect(log).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] Warning message/);
    });

    test('should log error messages with correct format', () => {
      structuredLog('error', 'Error message');
      
      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0];
      expect(log).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Error message/);
    });

    test('should include context when provided', () => {
      structuredLog('info', 'Message with context', { userId: '123', action: 'login' });
      
      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0];
      expect(log).toContain('Message with context {"userId":"123","action":"login"}');
    });

    test('should handle empty context', () => {
      structuredLog('info', 'Message without context', {});
      
      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0];
      expect(log).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Message without context/);
    });

    test('should handle complex context objects', () => {
      const complexContext = {
        user: { id: '123', name: 'John' },
        timestamp: new Date('2023-01-01T00:00:00Z'),
        metadata: { ip: '192.168.1.1', userAgent: 'test-agent' }
      };
      
      structuredLog('info', 'Complex context', complexContext);
      
      expect(capturedLogs.length).toBe(1);
      const log = capturedLogs[0];
      expect(log).toContain('Complex context');
      expect(log).toContain('"user":{"id":"123","name":"John"}');
    });
  });
});