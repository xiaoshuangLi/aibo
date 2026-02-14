import { main } from '@/main';
import { startInteractiveMode } from '@/presentation/console/interactive-mode';
import { createAIAgent } from '@/core/agent/agent-factory';

// Mock the dependencies
jest.mock('../src/presentation/console/interactive-mode');
jest.mock('../src/core/agent/agent-factory');
jest.mock('../src/shared/utils/logging');

describe('main function', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalArgv = process.argv;
    originalEnv = { ...process.env };
    (startInteractiveMode as jest.Mock).mockResolvedValue(undefined);
    (createAIAgent as jest.Mock).mockReturnValue({ mock: 'agent' });
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test('should start interactive mode when --interactive flag is provided', async () => {
    process.argv = ['node', 'main.js', '--interactive'];
    
    const result = await main();
    
    expect(startInteractiveMode).toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
    expect(result).toEqual({ mock: 'agent' });
  });

  test('should start interactive mode when -i flag is provided', async () => {
    process.argv = ['node', 'main.js', '-i'];
    
    const result = await main();
    
    expect(startInteractiveMode).toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
    expect(result).toEqual({ mock: 'agent' });
  });

  test('should start interactive mode when AIBO_INTERACTIVE environment variable is true', async () => {
    process.argv = ['node', 'main.js'];
    process.env.AIBO_INTERACTIVE = 'true';
    
    const result = await main();
    
    expect(startInteractiveMode).toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
    expect(result).toEqual({ mock: 'agent' });
  });

  test('should initialize AI agent in non-interactive mode', async () => {
    process.argv = ['node', 'main.js'];
    process.env.AIBO_INTERACTIVE = 'false';
    
    const result = await main();
    
    expect(startInteractiveMode).not.toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
    expect(result).toEqual({ mock: 'agent' });
  });

  test('should handle AI agent initialization failure', async () => {
    process.argv = ['node', 'main.js'];
    (createAIAgent as jest.Mock).mockImplementation(() => {
      throw new Error('Initialization failed');
    });
    
    // Mock process.exit to prevent actual exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`Process exited with code ${code}`);
    });
    
    await expect(main()).rejects.toThrow('Process exited with code 1');
    
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  test('should handle empty arguments gracefully', async () => {
    process.argv = ['node', 'main.js'];
    
    const result = await main();
    
    expect(startInteractiveMode).not.toHaveBeenCalled();
    expect(createAIAgent).toHaveBeenCalled();
    expect(result).toEqual({ mock: 'agent' });
  });
});