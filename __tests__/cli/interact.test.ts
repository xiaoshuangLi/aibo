jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('@/core/agent/factory', () => ({
  createAIAgent: jest.fn().mockResolvedValue({ mockAgent: true }),
}));

jest.mock('@/presentation/console/interactive', () => ({
  startInteractiveMode: jest.fn(),
}));

jest.mock('@/presentation/lark/interactive', () => ({
  startLarkInteractiveMode: jest.fn(),
}));

jest.mock('@/cli/init', () => ({
  isAiboInitRequired: jest.fn().mockReturnValue(false),
  printInitRequired: jest.fn(),
}));

jest.mock('@/core/config', () => ({
  config: {
    interaction: { mode: 'console' },
    language: { code: 'en' },
    persona: { style: undefined },
  },
}));

import { runInteract } from '@/cli/interact';
import { isAiboInitRequired, printInitRequired } from '@/cli/init';
import { startInteractiveMode } from '@/presentation/console/interactive';
import { startLarkInteractiveMode } from '@/presentation/lark/interactive';
import { createAIAgent } from '@/core/agent/factory';
import { config } from '@/core/config';

const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('runInteract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isAiboInitRequired as jest.Mock).mockReturnValue(false);
    (config.interaction as any).mode = 'console';
  });

  afterAll(() => {
    mockProcessExit.mockRestore();
  });

  it('starts console interactive mode when config mode is "console"', async () => {
    (config.interaction as any).mode = 'console';
    await runInteract();
    expect(startInteractiveMode).toHaveBeenCalled();
    expect(startLarkInteractiveMode).not.toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
  });

  it('starts lark interactive mode when config mode is "lark"', async () => {
    (config.interaction as any).mode = 'lark';
    await runInteract();
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
