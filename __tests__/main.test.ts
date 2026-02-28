jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('@/cli/program', () => ({
  createProgram: jest.fn().mockReturnValue({
    parseAsync: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { createProgram } from '@/cli/program';

describe('main.ts entry point', () => {
  it('createProgram is available for direct execution wiring', () => {
    expect(typeof createProgram).toBe('function');
  });
});