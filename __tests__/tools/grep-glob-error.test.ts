/**
 * Tests for grep and glob tool error paths using glob package mock.
 */

// Mock the glob package to simulate failures
const globMock = jest.fn();
jest.mock('glob', () => ({ glob: globMock }));

describe('grepFilesTool - outer catch (line 84)', () => {
  it('returns error JSON when glob throws', async () => {
    globMock.mockRejectedValueOnce(new Error('glob failed'));
    const { grepFilesTool } = require('../../src/tools/grep');

    const result = await grepFilesTool.invoke({ pattern: 'test', directory: '/tmp' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.pattern).toBe('test');
  });
});

describe('globFilesTool - outer catch (line 39)', () => {
  it('returns error JSON when glob throws', async () => {
    globMock.mockRejectedValueOnce(new Error('glob failed'));
    const { globFilesTool } = require('../../src/tools/glob');

    const result = await globFilesTool.invoke({ pattern: '**/*.ts' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.pattern).toBe('**/*.ts');
  });
});
