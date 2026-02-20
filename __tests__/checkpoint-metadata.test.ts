import { CheckpointMetadata } from '@langchain/langgraph-checkpoint';

describe('CheckpointMetadata Structure', () => {
  test('should have correct input metadata structure', () => {
    const metadata: CheckpointMetadata = {
      source: 'input',
      step: -1,
      parents: {}
    };
    
    expect(metadata.source).toBe('input');
    expect(metadata.step).toBe(-1);
    expect(metadata.parents).toEqual({});
  });

  test('should have correct loop metadata structure', () => {
    const metadata: CheckpointMetadata = {
      source: 'loop',
      step: 0,
      parents: { '': 'parent-id-123' }
    };
    
    expect(metadata.source).toBe('loop');
    expect(metadata.step).toBe(0);
    expect(metadata.parents).toEqual({ '': 'parent-id-123' });
  });

  test('should have correct update metadata structure', () => {
    const metadata: CheckpointMetadata = {
      source: 'update',
      step: 1,
      parents: { '': 'previous-id-456' }
    };
    
    expect(metadata.source).toBe('update');
    expect(metadata.step).toBe(1);
    expect(metadata.parents).toEqual({ '': 'previous-id-456' });
  });

  test('should have correct fork metadata structure', () => {
    const metadata: CheckpointMetadata = {
      source: 'fork',
      step: 2,
      parents: {
        '': 'original-id-789',
        'subgraph': 'subgraph-id-123'
      }
    };
    
    expect(metadata.source).toBe('fork');
    expect(metadata.step).toBe(2);
    expect(metadata.parents).toEqual({
      '': 'original-id-789',
      'subgraph': 'subgraph-id-123'
    });
  });

  test('should support extended properties', () => {
    const metadata: CheckpointMetadata<{ customField: string }> = {
      source: 'loop',
      step: 1,
      parents: { '': 'parent-id' },
      customField: 'custom-value'
    };
    
    expect(metadata.source).toBe('loop');
    expect(metadata.step).toBe(1);
    expect(metadata.parents).toEqual({ '': 'parent-id' });
    expect(metadata.customField).toBe('custom-value');
  });

  test('should validate required fields', () => {
    // TypeScript compilation will catch missing fields
    // This test ensures the structure is correct at runtime
    const metadata: CheckpointMetadata = {
      source: 'input',
      step: -1,
      parents: {}
    };
    
    expect(typeof metadata.source).toBe('string');
    expect(typeof metadata.step).toBe('number');
    expect(typeof metadata.parents).toBe('object');
    expect(metadata.parents).not.toBeNull();
  });

  test('should have valid source values only', () => {
    const validSources = ['input', 'loop', 'update', 'fork'] as const;
    
    validSources.forEach(source => {
      const metadata: CheckpointMetadata = {
        source,
        step: source === 'input' ? -1 : 0,
        parents: {}
      };
      
      expect(validSources).toContain(metadata.source);
    });
  });
});