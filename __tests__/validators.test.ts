import { 
  isValidApiKey, 
  isValidUrl, 
  isValidModelName, 
  isValidPositiveInteger 
} from '../src/validators';

describe('Configuration Validators', () => {
  describe('isValidApiKey', () => {
    test('should validate valid OpenAI API key', () => {
      expect(isValidApiKey('sk-abcdefghijklmnopqrstuvwxyz123456789012')).toBe(true);
      expect(isValidApiKey('sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789012')).toBe(true);
      expect(isValidApiKey('sk-abc123DEF456ghi789JKL012mno345PQR678STU')).toBe(true);
    });

    test('should reject invalid API keys', () => {
      expect(isValidApiKey('')).toBe(false);
      expect(isValidApiKey('sk-')).toBe(false);
      expect(isValidApiKey('sk-abc')).toBe(false);
      expect(isValidApiKey('invalid-key')).toBe(false);
      expect(isValidApiKey('sk-invalid!@#')).toBe(false);
      expect(isValidApiKey(null as any)).toBe(false);
      expect(isValidApiKey(undefined as any)).toBe(false);
    });

    test('should handle whitespace', () => {
      expect(isValidApiKey(' sk-abcdefghijklmnopqrstuvwxyz123456789012 ')).toBe(true);
      expect(isValidApiKey(' sk- ')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    test('should validate valid URLs', () => {
      expect(isValidUrl('https://api.openai.com/v1')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl(null as any)).toBe(false);
      expect(isValidUrl(undefined as any)).toBe(false);
    });

    test('should handle whitespace', () => {
      expect(isValidUrl(' https://api.openai.com/v1 ')).toBe(true);
      expect(isValidUrl(' http:// ')).toBe(false);
    });
  });

  describe('isValidModelName', () => {
    test('should validate valid model names', () => {
      expect(isValidModelName('gpt-4o')).toBe(true);
      expect(isValidModelName('gpt-3.5-turbo')).toBe(true);
      expect(isValidModelName('claude-3-opus-20240229')).toBe(true);
      expect(isValidModelName('llama2_70b')).toBe(true);
    });

    test('should reject invalid model names', () => {
      expect(isValidModelName('')).toBe(false);
      expect(isValidModelName('model with spaces')).toBe(false);
      expect(isValidModelName('model!@#')).toBe(false);
      expect(isValidModelName('model/name')).toBe(false);
      expect(isValidModelName(null as any)).toBe(false);
      expect(isValidModelName(undefined as any)).toBe(false);
    });

    test('should handle whitespace', () => {
      expect(isValidModelName(' gpt-4o ')).toBe(true);
      expect(isValidModelName(' invalid model ')).toBe(false);
    });
  });

  describe('isValidPositiveInteger', () => {
    test('should validate positive integers', () => {
      expect(isValidPositiveInteger(1)).toBe(true);
      expect(isValidPositiveInteger(100)).toBe(true);
      expect(isValidPositiveInteger(1000)).toBe(true);
    });

    test('should reject invalid values', () => {
      expect(isValidPositiveInteger(0)).toBe(false);
      expect(isValidPositiveInteger(-1)).toBe(false);
      expect(isValidPositiveInteger(1.5)).toBe(false);
      expect(isValidPositiveInteger(NaN)).toBe(false);
      expect(isValidPositiveInteger(Infinity)).toBe(false);
    });
  });
});