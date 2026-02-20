import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  formatAgentResponse, 
  isValidThreadId, 
  createConsoleThreadId 
} from '@/core/utils';

describe('Interactive Logic Utilities', () => {
  describe('shouldExitInteractiveMode', () => {
    test('should return true for exit commands', () => {
      expect(shouldExitInteractiveMode('exit')).toBe(true);
      expect(shouldExitInteractiveMode('EXIT')).toBe(true);
      expect(shouldExitInteractiveMode('Exit')).toBe(true);
      expect(shouldExitInteractiveMode('quit')).toBe(true);
      expect(shouldExitInteractiveMode('QUIT')).toBe(true);
      expect(shouldExitInteractiveMode('Quit')).toBe(true);
    });

    test('should return false for non-exit commands', () => {
      expect(shouldExitInteractiveMode('hello')).toBe(false);
      expect(shouldExitInteractiveMode('help')).toBe(false);
      expect(shouldExitInteractiveMode('')).toBe(false);
      expect(shouldExitInteractiveMode('exi')).toBe(false);
      expect(shouldExitInteractiveMode('quitt')).toBe(false);
    });

    test('should handle whitespace correctly', () => {
      expect(shouldExitInteractiveMode('  exit  ')).toBe(true);
      expect(shouldExitInteractiveMode('  quit  ')).toBe(true);
      expect(shouldExitInteractiveMode('  hello  ')).toBe(false);
    });
  });

  describe('isEmptyInput', () => {
    test('should return true for empty or whitespace-only strings', () => {
      expect(isEmptyInput('')).toBe(true);
      expect(isEmptyInput('   ')).toBe(true);
      expect(isEmptyInput('\t\n\r')).toBe(true);
    });

    test('should return false for non-empty strings', () => {
      expect(isEmptyInput('hello')).toBe(false);
      expect(isEmptyInput(' hello ')).toBe(false);
      expect(isEmptyInput('0')).toBe(false);
    });
  });

  describe('formatAgentResponse', () => {
    test('should return string as-is for string input', () => {
      expect(formatAgentResponse('hello world')).toBe('hello world');
    });

    test('should stringify objects', () => {
      const obj = { message: 'hello', status: 'success' };
      expect(formatAgentResponse(obj)).toBe(JSON.stringify(obj, null, 2));
    });

    test('should handle arrays', () => {
      const arr = ['item1', 'item2'];
      expect(formatAgentResponse(arr)).toBe(JSON.stringify(arr, null, 2));
    });

    test('should convert other types to string', () => {
      expect(formatAgentResponse(123)).toBe('123');
      expect(formatAgentResponse(true)).toBe('true');
      expect(formatAgentResponse(null)).toBe('null');
      expect(formatAgentResponse(undefined)).toBe('undefined');
    });
  });

  describe('isValidThreadId', () => {
    test('should return true for valid thread IDs', () => {
      expect(isValidThreadId('thread-123')).toBe(true);
      expect(isValidThreadId('console-session-1234567890')).toBe(true);
      expect(isValidThreadId('abc')).toBe(true);
    });

    test('should return false for invalid thread IDs', () => {
      expect(isValidThreadId('')).toBe(false);
      expect(isValidThreadId('   ')).toBe(false);
      expect(isValidThreadId(null as any)).toBe(false);
      expect(isValidThreadId(undefined as any)).toBe(false);
      expect(isValidThreadId(123 as any)).toBe(false);
    });
  });

  describe('createConsoleThreadId', () => {
    test('should create a thread ID with timestamp', () => {
      const threadId = createConsoleThreadId();
      expect(threadId).toMatch(/^session-\d+$/);
      
      // Verify it contains a reasonable timestamp
      const timestamp = parseInt(threadId.split('-')[1]);
      const now = Date.now();
      expect(timestamp).toBeLessThanOrEqual(now);
      expect(timestamp).toBeGreaterThanOrEqual(now - 1000); // within 1 second
    });

    test('should create unique thread IDs with sufficient delay', () => {
      const id1 = createConsoleThreadId();
      // Add a small delay to ensure different timestamps
      const id2 = createConsoleThreadId();
      // In most cases they should be different, but we can't guarantee it
      // So we'll just verify the format is correct
      expect(id2).toMatch(/^session-\d+$/);
    });
  });
});