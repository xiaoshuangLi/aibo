import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  formatAgentResponse,
  isValidThreadId,
  createConsoleThreadId
} from '../src/interactive-logic';

describe('Interactive Logic Utilities', () => {
  describe('shouldExitInteractiveMode', () => {
    test('should return true for "exit"', () => {
      expect(shouldExitInteractiveMode('exit')).toBe(true);
      expect(shouldExitInteractiveMode('EXIT')).toBe(true);
      expect(shouldExitInteractiveMode(' Exit ')).toBe(true);
    });

    test('should return true for "quit"', () => {
      expect(shouldExitInteractiveMode('quit')).toBe(true);
      expect(shouldExitInteractiveMode('QUIT')).toBe(true);
      expect(shouldExitInteractiveMode(' Quit ')).toBe(true);
    });

    test('should return false for other inputs', () => {
      expect(shouldExitInteractiveMode('hello')).toBe(false);
      expect(shouldExitInteractiveMode('help')).toBe(false);
      expect(shouldExitInteractiveMode('')).toBe(false);
    });
  });

  describe('isEmptyInput', () => {
    test('should return true for empty or whitespace strings', () => {
      expect(isEmptyInput('')).toBe(true);
      expect(isEmptyInput(' ')).toBe(true);
      expect(isEmptyInput('   ')).toBe(true);
      expect(isEmptyInput('\t\n')).toBe(true);
    });

    test('should return false for non-empty strings', () => {
      expect(isEmptyInput('hello')).toBe(false);
      expect(isEmptyInput(' hello ')).toBe(false);
      expect(isEmptyInput('0')).toBe(false);
    });
  });

  describe('formatAgentResponse', () => {
    test('should return string as-is', () => {
      expect(formatAgentResponse('hello')).toBe('hello');
    });

    test('should stringify objects', () => {
      const obj = { message: 'test', value: 42 };
      const expected = JSON.stringify(obj, null, 2);
      expect(formatAgentResponse(obj)).toBe(expected);
    });

    test('should handle null and undefined', () => {
      expect(formatAgentResponse(null)).toBe('null');
      expect(formatAgentResponse(undefined)).toBe('undefined');
    });

    test('should handle numbers and booleans', () => {
      expect(formatAgentResponse(42)).toBe('42');
      expect(formatAgentResponse(true)).toBe('true');
      expect(formatAgentResponse(false)).toBe('false');
    });
  });

  describe('createConsoleThreadId', () => {
    test('should create valid thread ID with timestamp', () => {
      const threadId = createConsoleThreadId();
      expect(threadId).toMatch(/^console-session-\d+$/);
      
      // Extract timestamp and verify it's reasonable
      const timestamp = parseInt(threadId.split('-')[2]);
      const now = Date.now();
      expect(timestamp).toBeLessThanOrEqual(now);
      expect(timestamp).toBeGreaterThan(now - 10000); // Within last 10 seconds
    });
  });

  describe('isValidThreadId', () => {
    test('should validate thread IDs correctly', () => {
      expect(isValidThreadId('console-session-12345')).toBe(true);
      expect(isValidThreadId('test-thread')).toBe(true);
      expect(isValidThreadId('')).toBe(false);
      expect(isValidThreadId(null as any)).toBe(false);
      expect(isValidThreadId(undefined as any)).toBe(false);
      expect(isValidThreadId(123 as any)).toBe(false);
    });
  });
});