jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('@/core/agent/agent-factory', () => ({
  createAIAgent: jest.fn().mockResolvedValue({ mockAgent: true }),
}));

jest.mock('@/presentation/console/interactive-mode', () => ({
  startInteractiveMode: jest.fn(),
}));

jest.mock('@/presentation/lark/interactive-mode', () => ({
  startLarkInteractiveMode: jest.fn(),
}));

jest.mock('@/cli/init', () => ({
  isAiboInitRequired: jest.fn().mockReturnValue(false),
  printInitRequired: jest.fn(),
}));

import { runInteract } from '@/cli/interact';
import { isAiboInitRequired, printInitRequired } from '@/cli/init';
import { startInteractiveMode } from '@/presentation/console/interactive-mode';
import { startLarkInteractiveMode } from '@/presentation/lark/interactive-mode';
import { createAIAgent } from '@/core/agent/agent-factory';

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('runInteract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isAiboInitRequired as jest.Mock).mockReturnValue(false);
  });

  afterAll(() => {
    mockProcessExit.mockRestore();
  });

  it('starts console interactive mode by default', async () => {
    await runInteract();
    expect(startInteractiveMode).toHaveBeenCalled();
    expect(startLarkInteractiveMode).not.toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
  });

  it('starts console interactive mode when mode is "console"', async () => {
    await runInteract('console');
    expect(startInteractiveMode).toHaveBeenCalled();
    expect(startLarkInteractiveMode).not.toHaveBeenCalled();
  });

  it('starts lark interactive mode when mode is "lark"', async () => {
    await runInteract('lark');
    expect(startLarkInteractiveMode).toHaveBeenCalled();
    expect(startInteractiveMode).not.toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
  });

  it('calls printInitRequired and process.exit when init is required', async () => {
    (isAiboInitRequired as jest.Mock).mockReturnValue(true);
    await expect(runInteract()).rejects.toThrow('process.exit called');
    expect(printInitRequired).toHaveBeenCalled();
    expect(mockProcessExit).toHaveBeenCalledWith(1);
    expect(startInteractiveMode).not.toHaveBeenCalled();
  });
});
