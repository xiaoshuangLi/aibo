import { 
  isValidApiKey, 
  isValidUrl, 
  isValidModelName, 
  isValidPositiveInteger 
} from '@/shared/utils/validators';

describe('Validation Utilities', () => {
  describe('isValidApiKey', () => {
    test('should return true for valid OpenAI API key format', () => {
      expect(isValidApiKey('sk-12345678901234567890123456789012')).toBe(true);
      expect(isValidApiKey('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
      expect(isValidApiKey('sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456')).toBe(true);
      expect(isValidApiKey('sk-1234567890123456789012345678901234567890')).toBe(true); // longer key
    });

    test('should return false for invalid API key formats', () => {
      expect(isValidApiKey('')).toBe(false);
      expect(isValidApiKey('   ')).toBe(false);
      expect(isValidApiKey('sk-')).toBe(false);
      expect(isValidApiKey('sk-123')).toBe(false); // too short (less than 20 chars after sk-)
      expect(isValidApiKey('sk-1234567890123456789')).toBe(false); // 19 chars after sk- (still too short)
      expect(isValidApiKey('sk-12345678901234567890!')).toBe(false); // contains special char
      expect(isValidApiKey('sk_12345678901234567890123456789012')).toBe(false); // wrong prefix
      expect(isValidApiKey('12345678901234567890123456789012')).toBe(false); // no prefix
      expect(isValidApiKey(null as any)).toBe(false);
      expect(isValidApiKey(undefined as any)).toBe(false);
      expect(isValidApiKey(123 as any)).toBe(false);
    });

    test('should handle whitespace trimming correctly', () => {
      expect(isValidApiKey('  sk-12345678901234567890123456789012  ')).toBe(true);
      expect(isValidApiKey('  sk-123  ')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    test('should return true for valid URLs', () => {
      expect(isValidUrl('https://api.openai.com/v1')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    test('should return false for invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('   ')).toBe(false);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl(null as any)).toBe(false);
      expect(isValidUrl(undefined as any)).toBe(false);
      expect(isValidUrl(123 as any)).toBe(false);
    });

    test('should handle whitespace trimming correctly', () => {
      expect(isValidUrl('  https://api.openai.com/v1  ')).toBe(true);
      expect(isValidUrl('  not-a-url  ')).toBe(false);
    });
  });

  describe('isValidModelName', () => {
    test('should return true for valid model names', () => {
      expect(isValidModelName('gpt-4o')).toBe(true);
      expect(isValidModelName('gpt-4-turbo')).toBe(true);
      expect(isValidModelName('claude-3-opus-20240229')).toBe(true);
      expect(isValidModelName('llama3')).toBe(true);
      expect(isValidModelName('mistral-large-latest')).toBe(true);
      expect(isValidModelName('gpt-4.0-preview')).toBe(true);
      expect(isValidModelName('model_name_with_underscores')).toBe(true);
      expect(isValidModelName('qwen3-max-2026-01-23')).toBe(true); // actual model from .env
    });

    test('should return false for invalid model names', () => {
      expect(isValidModelName('')).toBe(false);
      expect(isValidModelName('   ')).toBe(false);
      expect(isValidModelName('gpt 4o')).toBe(false); // contains space
      expect(isValidModelName('gpt/4o')).toBe(false); // contains slash
      expect(isValidModelName('gpt@4o')).toBe(false); // contains @
      expect(isValidModelName(null as any)).toBe(false);
      expect(isValidModelName(undefined as any)).toBe(false);
      expect(isValidModelName(123 as any)).toBe(false);
    });

    test('should handle whitespace trimming correctly', () => {
      expect(isValidModelName('  gpt-4o  ')).toBe(true);
      expect(isValidModelName('  gpt 4o  ')).toBe(false);
    });
  });

  describe('isValidPositiveInteger', () => {
    test('should return true for valid positive integers', () => {
      expect(isValidPositiveInteger(1)).toBe(true);
      expect(isValidPositiveInteger(100)).toBe(true);
      expect(isValidPositiveInteger(1000)).toBe(true);
    });

    test('should return false for invalid values', () => {
      expect(isValidPositiveInteger(0)).toBe(false);
      expect(isValidPositiveInteger(-1)).toBe(false);
      expect(isValidPositiveInteger(-100)).toBe(false);
      expect(isValidPositiveInteger(1.5)).toBe(false);
      expect(isValidPositiveInteger(0.5)).toBe(false);
      expect(isValidPositiveInteger(NaN)).toBe(false);
      expect(isValidPositiveInteger(Infinity)).toBe(false);
      expect(isValidPositiveInteger(-Infinity)).toBe(false);
    });
  });
});