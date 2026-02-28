jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('parseInteractionModeFromArgs', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    jest.resetModules();
    process.argv = ['node', 'script.js'];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns null when no subcommand is passed', () => {
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBeNull();
  });

  it('returns null for unrelated subcommands', () => {
    process.argv = ['node', 'script.js', 'init'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBeNull();
  });

  it('returns "console" for interact subcommand without --mode', () => {
    process.argv = ['node', 'script.js', 'interact'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe('console');
  });

  it('returns "lark" for interact subcommand with --mode=lark', () => {
    process.argv = ['node', 'script.js', 'interact', '--mode=lark'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe('lark');
  });

  it('returns "console" for interact subcommand with --mode=console', () => {
    process.argv = ['node', 'script.js', 'interact', '--mode=console'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe('console');
  });

  it('returns "console" for interact subcommand with unknown --mode value', () => {
    process.argv = ['node', 'script.js', 'interact', '--mode=unknown'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe('console');
  });
});
