import { 
  shouldExitInteractiveMode, 
  isEmptyInput, 
  formatAgentResponse 
} from '@/core/utils/interactive-logic';

describe('Interactive Logic Utils', () => {
  describe('shouldExitInteractiveMode', () => {
    it('should return true for "exit"', () => {
      expect(shouldExitInteractiveMode('exit')).toBe(true);
      expect(shouldExitInteractiveMode('EXIT')).toBe(true);
      expect(shouldExitInteractiveMode(' Exit ')).toBe(true);
    });

    it('should return true for "quit"', () => {
      expect(shouldExitInteractiveMode('quit')).toBe(true);
      expect(shouldExitInteractiveMode('QUIT')).toBe(true);
      expect(shouldExitInteractiveMode(' Quit ')).toBe(true);
    });

    it('should return false for other inputs', () => {
      expect(shouldExitInteractiveMode('help')).toBe(false);
      expect(shouldExitInteractiveMode('test')).toBe(false);
      expect(shouldExitInteractiveMode('')).toBe(false);
    });
  });

  describe('isEmptyInput', () => {
    it('should return true for empty string', () => {
      expect(isEmptyInput('')).toBe(true);
    });

    it('should return true for whitespace only', () => {
      expect(isEmptyInput('   ')).toBe(true);
      expect(isEmptyInput('\t\n\r')).toBe(true);
    });

    it('should return false for non-empty input', () => {
      expect(isEmptyInput('hello')).toBe(false);
      expect(isEmptyInput(' hello ')).toBe(false);
    });
  });

  describe('formatAgentResponse', () => {
    it('should return string as-is', () => {
      expect(formatAgentResponse('hello')).toBe('hello');
    });

    it('should format object as JSON', () => {
      const obj = { result: 'success' };
      const expected = JSON.stringify(obj, null, 2);
      expect(formatAgentResponse(obj)).toBe(expected);
    });

    it('should handle null', () => {
      expect(formatAgentResponse(null)).toBe('null');
    });

    it('should handle undefined', () => {
      expect(formatAgentResponse(undefined)).toBe('undefined');
    });

    it('should handle primitive types', () => {
      expect(formatAgentResponse(42)).toBe('42');
      expect(formatAgentResponse(true)).toBe('true');
      expect(formatAgentResponse(false)).toBe('false');
    });
  });
});