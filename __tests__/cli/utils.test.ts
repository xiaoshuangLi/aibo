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
    expect(parseInteractionModeFromArgs()).toBe(null);
  });

  it('returns null for unrelated subcommands', () => {
    process.argv = ['node', 'script.js', 'init'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBeNull();
  });

  it('returns "lark" for root command with --mode=lark', () => {
    process.argv = ['node', 'script.js', '--mode=lark'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe('lark');
  });

  it('returns "console" for root command with --mode=console', () => {
    process.argv = ['node', 'script.js', '--mode=console'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe('console');
  });

  it('returns null for root command without --mode', () => {
    process.argv = ['node', 'script.js', '--type=group_chat'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe(null);
  });

  it('returns "console" for interact subcommand without --mode', () => {
    process.argv = ['node', 'script.js', 'interact'];
    const { parseInteractionModeFromArgs } = require('../../src/cli/utils');
    expect(parseInteractionModeFromArgs()).toBe(null);
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
    expect(parseInteractionModeFromArgs()).toBe(null);
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
    expect(parseLarkTypeFromArgs()).toBe('user_chat');
  });

  it('returns null for unrelated subcommands', () => {
    process.argv = ['node', 'script.js', 'init'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBeNull();
  });

  it('returns "group_chat" for root command with --type=group_chat', () => {
    process.argv = ['node', 'script.js', '--type=group_chat'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('group_chat');
  });

  it('returns "user_chat" for root command with --type=user_chat', () => {
    process.argv = ['node', 'script.js', '--type=user_chat'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user_chat');
  });

  it('returns null for root command without --type', () => {
    process.argv = ['node', 'script.js', '--mode=lark'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user_chat');
  });

  it('returns "user_chat" for interact subcommand without --type', () => {
    process.argv = ['node', 'script.js', 'interact'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user_chat');
  });

  it('returns "group_chat" for interact subcommand with --type=group_chat', () => {
    process.argv = ['node', 'script.js', 'interact', '--type=group_chat'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('group_chat');
  });

  it('returns "user_chat" for interact subcommand with --type=user_chat', () => {
    process.argv = ['node', 'script.js', 'interact', '--type=user_chat'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user_chat');
  });

  it('returns "user_chat" for interact subcommand with unknown --type value', () => {
    process.argv = ['node', 'script.js', 'interact', '--type=unknown'];
    const { parseLarkTypeFromArgs } = require('../../src/cli/utils');
    expect(parseLarkTypeFromArgs()).toBe('user_chat');
  });
});
