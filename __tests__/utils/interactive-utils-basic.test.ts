// Simple test to improve coverage of interactive-utils.ts
import { styled } from '../../src/utils/interactive-utils';

describe('Interactive Utils Basic Coverage', () => {
  test('styled functions should exist and be callable', () => {
    expect(typeof styled.assistant).toBe('function');
    expect(typeof styled.toolCall).toBe('function');
    expect(typeof styled.toolResult).toBe('function');
    expect(typeof styled.system).toBe('function');
    expect(typeof styled.error).toBe('function');
    expect(typeof styled.hint).toBe('function');
    
    // Call them to ensure they don't throw
    expect(() => styled.assistant('test')).not.toThrow();
    expect(() => styled.toolCall('test', {})).not.toThrow();
    expect(() => styled.toolResult('test', true, 'test')).not.toThrow();
    expect(() => styled.system('test')).not.toThrow();
    expect(() => styled.error('test')).not.toThrow();
    expect(() => styled.hint('test')).not.toThrow();
  });
});