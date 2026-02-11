import * as utils from '../../src/utils/index';

describe('utils/index', () => {
  test('should export all utility functions', () => {
    expect(utils).toBeDefined();
    // Check that key exports exist
    expect(typeof utils.structuredLog).toBe('function');
    expect(typeof utils.styled).toBe('object');
    expect(typeof utils.createGracefulShutdown).toBe('function');
    expect(typeof utils.TencentASR).toBe('function');
  });
});