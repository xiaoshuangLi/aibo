// Mock dotenv to prevent it from loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Config - Interaction Mode Coverage', () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = {};
    process.argv = ['node', 'script.js'];
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  it('should return console mode as default when no Lark vars are set', () => {
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('should return lark mode when all 4 Lark vars are configured', () => {
    process.env.AIBO_LARK_APP_ID = 'app-id';
    process.env.AIBO_LARK_APP_SECRET = 'app-secret';
    process.env.AIBO_LARK_RECEIVE_ID = 'receive-id';
    process.env.AIBO_LARK_INTERACTIVE_TEMPLATE_ID = 'template-id';
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('lark');
  });

  it('should return console mode when only some Lark vars are configured', () => {
    process.env.AIBO_LARK_APP_ID = 'app-id';
    process.env.AIBO_LARK_APP_SECRET = 'app-secret';
    // AIBO_LARK_RECEIVE_ID and AIBO_LARK_INTERACTIVE_TEMPLATE_ID intentionally missing
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('should return console mode when interact subcommand is used without --mode', () => {
    process.argv = ['node', 'script.js', 'interact'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('should return lark mode when interact --mode=lark is passed', () => {
    process.argv = ['node', 'script.js', 'interact', '--mode=lark'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('lark');
  });

  it('should return console mode when interact --mode=console is passed', () => {
    process.argv = ['node', 'script.js', 'interact', '--mode=console'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('interact --mode=lark takes precedence over all 4 Lark vars being absent', () => {
    process.argv = ['node', 'script.js', 'interact', '--mode=lark'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('lark');
  });
});
