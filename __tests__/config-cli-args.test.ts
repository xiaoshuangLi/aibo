// Mock dotenv to prevent it from loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Config - CLI Args and Interaction Mode Coverage', () => {
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

  it('should return console mode when --interactive flag is passed', () => {
    process.argv = ['node', 'script.js', '--interactive'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('should return console mode when -i flag is passed', () => {
    process.argv = ['node', 'script.js', '-i'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('should return lark mode when --interaction=lark is passed', () => {
    process.argv = ['node', 'script.js', '--interaction=lark'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('lark');
  });

  it('should return console mode when --interaction=console is passed', () => {
    process.argv = ['node', 'script.js', '--interaction=console'];
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('should return console mode as default when no interaction env/cli is set', () => {
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

  it('CLI --interaction=console takes precedence over all 4 Lark vars', () => {
    process.argv = ['node', 'script.js', '--interaction=console'];
    process.env.AIBO_LARK_APP_ID = 'app-id';
    process.env.AIBO_LARK_APP_SECRET = 'app-secret';
    process.env.AIBO_LARK_RECEIVE_ID = 'receive-id';
    process.env.AIBO_LARK_INTERACTIVE_TEMPLATE_ID = 'template-id';
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });
});
