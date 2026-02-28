jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('@/cli/init', () => ({
  runInit: jest.fn(),
  isAiboInitRequired: jest.fn().mockReturnValue(false),
  printInitRequired: jest.fn(),
}));

jest.mock('@/cli/interact', () => ({
  runInteract: jest.fn().mockResolvedValue(undefined),
}));

import { createProgram } from '@/cli/program';
import { runInit, isAiboInitRequired, printInitRequired } from '@/cli/init';
import { runInteract } from '@/cli/interact';

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('createProgram', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isAiboInitRequired as jest.Mock).mockReturnValue(false);
  });

  afterAll(() => {
    mockProcessExit.mockRestore();
  });

  it('returns a Command named "aibo"', () => {
    const program = createProgram();
    expect(program.name()).toBe('aibo');
  });

  it('registers init and interact subcommands', () => {
    const program = createProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('init');
    expect(names).toContain('interact');
  });

  it('interact command has --mode option with default "console"', () => {
    const program = createProgram();
    const interact = program.commands.find((c) => c.name() === 'interact')!;
    expect(interact).toBeDefined();
    // Verify the interact command has the --mode option via its help text
    const helpInfo = interact.helpInformation();
    expect(helpInfo).toContain('--mode');
    expect(helpInfo).toContain('console|lark');
  });

  it('interact command has --type option', () => {
    const program = createProgram();
    const interact = program.commands.find((c) => c.name() === 'interact')!;
    expect(interact).toBeDefined();
    const helpInfo = interact.helpInformation();
    expect(helpInfo).toContain('--type');
    expect(helpInfo).toContain('user|chat');
  });

  it('always registers a default action handler', () => {
    const program = createProgram();
    expect((program as any)._actionHandler).toBeDefined();
  });

  it('calls runInteract when no subcommand is given', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'aibo']);
    expect(runInteract).toHaveBeenCalled();
  });

  it('calls printInitRequired and exits when default action fires and init is required', async () => {
    (isAiboInitRequired as jest.Mock).mockReturnValue(true);
    const program = createProgram();
    await expect(program.parseAsync(['node', 'aibo'])).rejects.toThrow('process.exit called');
    expect(printInitRequired).toHaveBeenCalled();
    expect(mockProcessExit).toHaveBeenCalledWith(1);
    expect(runInteract).not.toHaveBeenCalled();
  });

  it('calls runInit when init subcommand is invoked', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'aibo', 'init']);
    expect(runInit).toHaveBeenCalled();
  });
});
