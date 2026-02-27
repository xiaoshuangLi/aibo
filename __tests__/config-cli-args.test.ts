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

  it('should return lark mode when AIBO_LARK_MODE=true is set', () => {
    process.argv = ['node', 'script.js'];
    process.env.AIBO_LARK_MODE = 'true';
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('lark');
  });

  it('should return lark mode when AIBO_INTERACTION=lark is set', () => {
    process.argv = ['node', 'script.js'];
    process.env.AIBO_INTERACTION = 'lark';
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('lark');
  });

  it('should return console mode as default when no interaction env/cli is set', () => {
    process.argv = ['node', 'script.js'];
    delete process.env.AIBO_INTERACTION;
    delete process.env.AIBO_LARK_MODE;
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('should fall through to env when invalid --interaction value is provided', () => {
    process.argv = ['node', 'script.js', '--interaction=invalid'];
    process.env.AIBO_INTERACTION = 'lark';
    const { config } = require('../src/core/config/config');
    // With invalid CLI mode, falls back to AIBO_INTERACTION env
    expect(config.interaction.mode).toBe('lark');
  });

  it('CLI --interactive takes precedence over AIBO_INTERACTION env', () => {
    process.argv = ['node', 'script.js', '--interactive'];
    process.env.AIBO_INTERACTION = 'lark';
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('console');
  });

  it('CLI --interaction=lark takes precedence over AIBO_LARK_MODE', () => {
    process.argv = ['node', 'script.js', '--interaction=lark'];
    process.env.AIBO_LARK_MODE = 'false';
    const { config } = require('../src/core/config/config');
    expect(config.interaction.mode).toBe('lark');
  });
});
