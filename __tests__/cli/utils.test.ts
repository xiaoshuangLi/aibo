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

describe('parseLarkTypeFromArgs', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    jest.resetModules();
    process.argv = ['node', 'script.js'];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns null when no subcommand is passed', () => {
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBeNull();
  });

  it('returns null for unrelated subcommands', () => {
    process.argv = ['node', 'script.js', 'init'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBeNull();
  });

  it('returns "user" for interact subcommand without --type', () => {
    process.argv = ['node', 'script.js', 'interact'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user');
  });

  it('returns "chat" for interact subcommand with --type=chat', () => {
    process.argv = ['node', 'script.js', 'interact', '--type=chat'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('chat');
  });

  it('returns "user" for interact subcommand with --type=user', () => {
    process.argv = ['node', 'script.js', 'interact', '--type=user'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user');
  });

  it('returns "user" for interact subcommand with unknown --type value', () => {
    process.argv = ['node', 'script.js', 'interact', '--type=unknown'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user');
  });
});
