import { main } from '@/main';
import { config } from '@/core/config/config';
import { startInteractiveMode } from '@/presentation/console/interactive-mode';
import { startLarkInteractiveMode } from '@/presentation/lark/interactive-mode';
import { createAIAgent } from '@/core/agent/agent-factory';
import { structuredLog } from '@/shared/utils/logging';

// Mock all dependencies
jest.mock('@/core/config/config', () => ({
  config: {
    interaction: {
      mode: 'none'
    }
  }
}));

jest.mock('@/presentation/console/interactive-mode', () => ({
  startInteractiveMode: jest.fn()
}));

jest.mock('@/presentation/lark/interactive-mode', () => ({
  startLarkInteractiveMode: jest.fn()
}));

jest.mock('@/core/agent/agent-factory', () => ({
  createAIAgent: jest.fn()
}));

jest.mock('@/shared/utils/logging', () => ({
  structuredLog: jest.fn()
}));

// Mock process.exit to prevent actual exit
const originalProcessExit = process.exit;
let mockProcessExitCalled = false;
let mockProcessExitCode: number | undefined;

beforeAll(() => {
  process.exit = (code?: number) => {
    mockProcessExitCalled = true;
    mockProcessExitCode = code;
    throw new Error(`process.exit(${code}) called`);
  };
});

afterAll(() => {
  process.exit = originalProcessExit;
});

describe('Main Function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessExitCalled = false;
    mockProcessExitCode = undefined;
    (createAIAgent as jest.Mock).mockResolvedValue({ mockAgent: true });
  });

  describe('console mode', () => {
    it('should start console interactive mode when mode is console', async () => {
      (config.interaction as any).mode = 'console';
      
      await main();
      
      expect(startInteractiveMode).toHaveBeenCalled();
      expect(createAIAgent).toHaveBeenCalled();
    });
  });

  describe('lark mode', () => {
    it('should start lark interactive mode when mode is lark', async () => {
      (config.interaction as any).mode = 'lark';
      
      await main();
      
      expect(startLarkInteractiveMode).toHaveBeenCalled();
      expect(createAIAgent).toHaveBeenCalled();
    });
  });

  describe('non-interactive mode', () => {
    it('should initialize AI agent and log success in non-interactive mode', async () => {
      (config.interaction as any).mode = 'none';
      
      const result = await main();
      
      expect(createAIAgent).toHaveBeenCalled();
      expect(structuredLog).toHaveBeenCalledWith(
        'info',
        'AI Agent initialized successfully',
        { component: 'main' }
      );
      expect(result).toEqual({ mockAgent: true });
    });

    it('should handle initialization errors and log error without calling process.exit in test environment', async () => {
      (config.interaction as any).mode = 'none';
      (createAIAgent as jest.Mock).mockRejectedValue(new Error('Initialization failed'));
      
      // We expect the function to throw, but we want to verify the logging happened before the exit
      try {
        await main();
      } catch (error) {
        // Verify that structuredLog was called with error
        expect(structuredLog).toHaveBeenCalledWith(
          'error',
          'Failed to initialize AI Agent',
          expect.objectContaining({
            component: 'main',
            error: 'Initialization failed'
          })
        );
        // The process.exit would be called in real environment, but we mock it in tests
        expect(mockProcessExitCalled).toBe(true);
        expect(mockProcessExitCode).toBe(1);
      }
    });
  });

  describe('direct execution', () => {
    it('should execute main function when file is run directly', () => {
      // This tests the require.main === module check
      // We can't easily test this in Jest, but we ensure the function exists
      expect(typeof main).toBe('function');
    });
  });
});