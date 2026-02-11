import tools from '../../src/tools/index';

describe('tools/index', () => {
  test('should export all tool arrays', () => {
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });
});