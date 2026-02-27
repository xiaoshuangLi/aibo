import { config } from '@/core/config/config';
import { SessionManager } from '@/infrastructure/session/session-manager';
import {
  handleHelpCommand,
  handleVerboseCommand,
  handleNewCommand,
  handleCompactCommand,
  handleAbortCommand,
  handleExitCommand,
  handleUnknownCommand,
  handleRebotCommand,
  handleShowFilesCommand,
  handleShowDiffCommand,
  handleDiffCommand,
  handleRevertCommand,
  handleStageCommand,
  createHandleInternalCommand
} from '@/presentation/lark/command-handlers';

// Mock console.log to prevent actual output during tests
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

// Mock process.exit to prevent actual process termination
const originalProcessExit = process.exit;
const mockProcessExit = jest.fn();
process.exit = mockProcessExit as any;

// Mock styled system
jest.mock('@/presentation/styling/output-styler', () => ({
  styled: {
    system: jest.fn((msg) => msg),
    error: jest.fn((msg) => msg)
  }
}));

// Mock SessionManager
jest.mock('@/infrastructure/session/session-manager', () => {
  return {
    SessionManager: {
      getInstance: jest.fn(() => ({
        clearCurrentSession: jest.fn(() => 'new-session-id'),
        getCurrentSessionMetadata: jest.fn(() => ({
          sessionId: 'test-session-id',
          startTime: new Date(),
          commandCount: 0,
          toolCalls: [],
          messages: []
        }))
      }))
    }
  };
});

// Mock executeBashTool
jest.mock('@/tools/bash', () => ({
  executeBashTool: {
    invoke: jest.fn()
  }
}));

// Mock FileDiffVisualizer
const mockFileDiffVisualizerInstance = {
  getChangedFiles: jest.fn(),
  getAllFilesDiff: jest.fn(),
  getFileDiff: jest.fn(),
  revertFile: jest.fn(),
  stageFile: jest.fn()
};

// Mock the dynamic import for file-diff-visualizer
jest.mock('@/presentation/lark/file-diff-visualizer', () => ({
  FileDiffVisualizer: jest.fn().mockImplementation(() => mockFileDiffVisualizerInstance)
}));

// Also mock the relative import used in command-handlers.ts
jest.mock('./file-diff-visualizer', () => ({
  FileDiffVisualizer: jest.fn().mockImplementation(() => mockFileDiffVisualizerInstance)
}), { virtual: true });

// Mock getRestartCommand
jest.mock('@/shared/utils/restart-helper', () => ({
  getRestartCommand: jest.fn()
}));

jest.mock('@/shared/utils/library', () => ({
  getAllKnowledge: jest.fn().mockReturnValue([]),
  addKnowledge: jest.fn(),
}));

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    unref: jest.fn()
  }))
}));

describe('Lark Command Handlers', () => {
  let originalConfig: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
    
    // Store original config
    originalConfig = { ...config.output };
    
    // Reset config to default state
    config.output.verbose = false;
  });
  
  afterEach(() => {
    // Restore original config
    config.output = originalConfig;
  });

  describe('handleHelpCommand', () => {
    it('should display help message and return true', async () => {
      // Create a mock session object
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };
      
      const result = await handleHelpCommand(mockSession);
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('AIBO 助手命令指南'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/help'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/exit'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/verbose'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/new'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/compact'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/abort'));
      
      // Verify that the message was emitted through ioChannel
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/help',
            result: expect.objectContaining({
              success: true
            })
          })
        })
      );
    });
  });

  describe('handleVerboseCommand', () => {
    it('should toggle verbose mode from false to true', async () => {
      // Initial state: verbose = false
      expect(config.output.verbose).toBe(false);
      
      const result = await handleVerboseCommand();
      
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('输出模式已切换'));
    });

    it('should toggle verbose mode from true to false', async () => {
      // Set initial state to true
      config.output.verbose = true;
      expect(config.output.verbose).toBe(true);
      
      const result = await handleVerboseCommand();
      
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('输出模式已切换'));
    });
  });

  describe('handleNewCommand', () => {
    it('should create new session and return true', async () => {
      const mockSession = {
        threadId: 'old-session-id',
        adapter: {
          emit: jest.fn()
        }
      };

      const result = await handleNewCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockSession.threadId).toBe('new-session-id');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('新会话已创建'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/new',
            result: expect.objectContaining({
              success: true,
              sessionId: 'new-session-id'
            })
          })
        })
      );
    });

    it('should replace the old threadId so the next message has no prior context', async () => {
      const mockSession = {
        threadId: 'old-session-id',
        adapter: { emit: jest.fn() }
      };

      await handleNewCommand(mockSession as any);

      // The threadId must change so LangGraph starts a fresh checkpoint
      expect(mockSession.threadId).not.toBe('old-session-id');
      expect(mockSession.threadId).toBe('new-session-id');
    });
  });

  describe('handleAbortCommand', () => {
    it('should abort current operation when abortController exists and is not aborted', async () => {
      const mockAbortController = {
        signal: { aborted: false },
        abort: jest.fn()
      };
      const mockSession = {
        abortController: mockAbortController,
        adapter: {
          emit: jest.fn()
        }
      };

      const result = await handleAbortCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockAbortController.abort).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('操作已中断'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/abort',
            result: expect.objectContaining({
              success: true,
              message: expect.stringContaining('操作已中断')
            })
          })
        })
      );
    });

    it('should show no operation message when no abortController exists', async () => {
      const mockSession = {
        abortController: null,
        adapter: {
          emit: jest.fn()
        }
      };

      const result = await handleAbortCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('无操作可中断'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/abort',
            result: expect.objectContaining({
              success: false,
              message: expect.stringContaining('无操作可中断')
            })
          })
        })
      );
    });

    it('should show no operation message when abortController is already aborted', async () => {
      const mockAbortController = {
        signal: { aborted: true },
        abort: jest.fn()
      };
      const mockSession = {
        abortController: mockAbortController,
        adapter: {
          emit: jest.fn()
        }
      };

      const result = await handleAbortCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockAbortController.abort).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('无操作可中断'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/abort',
            result: expect.objectContaining({
              success: false,
              message: expect.stringContaining('无操作可中断')
            })
          })
        })
      );
    });
  });

  describe('handleExitCommand', () => {
    it('should log exit message, end session, and call process.exit', async () => {
      const mockSession = {
        end: jest.fn()
      };

      // This should not actually return because process.exit is called
      await handleExitCommand(mockSession as any);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('正在安全退出'));
      expect(mockSession.end).toHaveBeenCalledWith();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('handleUnknownCommand', () => {
    it('should display unknown command error and return true', async () => {
      const unknownCommand = '/unknown';
      const result = await handleUnknownCommand(unknownCommand);
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('未知命令'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('请输入 `/help` 查看所有可用命令'));
    });
  });

  describe('handleRebotCommand', () => {
    // Mock the executeBashTool
    const originalExecuteBashTool = require('@/tools/bash').executeBashTool;
    const mockExecuteBashTool = {
      invoke: jest.fn()
    };
    
    // Mock the getRestartCommand
    const originalGetRestartCommand = require('@/shared/utils/restart-helper').getRestartCommand;
    const mockGetRestartCommand = jest.fn();
    
    // Mock spawn
    const mockSpawn = jest.fn(() => ({
      on: jest.fn(),
      unref: jest.fn()
    }));
    
    beforeEach(() => {
      // Mock the imports
      jest.mock('@/tools/bash', () => ({
        executeBashTool: mockExecuteBashTool
      }));
      
      jest.mock('@/shared/utils/restart-helper', () => ({
        getRestartCommand: mockGetRestartCommand
      }));
      
      // Mock child_process.spawn
      jest.mock('child_process', () => ({
        spawn: mockSpawn
      }));
    });
    
    afterEach(() => {
      jest.clearAllMocks();
    });
    
    it('should handle successful build and restart', async () => {
      // Mock successful build result
      (require('@/tools/bash').executeBashTool.invoke as jest.Mock).mockResolvedValue(
        JSON.stringify({ success: true, stdout: 'Build successful', stderr: '' })
      );
      
      // Mock restart command
      (require('@/shared/utils/restart-helper').getRestartCommand as jest.Mock).mockReturnValue({
        restartCommand: 'node',
        restartArgs: ['dist/index.js']
      });
      
      const mockSession = {
        adapter: {
          emit: jest.fn()
        },
        end: jest.fn()
      };
      
      const result = await handleRebotCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('正在执行项目构建'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('构建成功！'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/rebot',
            result: expect.objectContaining({
              success: true,
              message: expect.stringContaining('构建成功')
            })
          })
        })
      );
      expect(mockSession.end).toHaveBeenCalled();
      // 在测试环境中，spawn 会被调用但不会实际执行
      expect(require('child_process').spawn).toHaveBeenCalled();
    });
    
    it('should handle build failure gracefully', async () => {
      // Mock failed build result
      (require('@/tools/bash').executeBashTool.invoke as jest.Mock).mockResolvedValue(
        JSON.stringify({ 
          success: false, 
          error: 'Build error', 
          message: 'Compilation failed',
          stdout: '',
          stderr: 'Error details'
        })
      );
      
      const mockSession = {
        adapter: {
          emit: jest.fn()
        },
        end: jest.fn()
      };
      
      const result = await handleRebotCommand(mockSession as any);
      
      expect(result).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('正在执行项目构建'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('构建失败'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/rebot',
            result: expect.objectContaining({
              success: false,
              message: expect.stringContaining('构建失败')
            })
          })
        })
      );
      expect(mockSession.end).not.toHaveBeenCalled();
    });
    
    it('should handle execution errors gracefully', async () => {
      // Mock execution error
      (require('@/tools/bash').executeBashTool.invoke as jest.Mock).mockRejectedValue(new Error('Execution failed'));
      
      const mockSession = {
        adapter: {
          emit: jest.fn()
        },
        end: jest.fn()
      };
      
      const result = await handleRebotCommand(mockSession as any);
      
      expect(result).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('正在执行项目构建'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('执行构建时发生错误'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/rebot',
            result: expect.objectContaining({
              success: false,
              message: expect.stringContaining('重启失败')
            })
          })
        })
      );
      expect(mockSession.end).not.toHaveBeenCalled();
    });
  });

  describe('handleShowFilesCommand', () => {
    it('should show modified files successfully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };

      // Setup mock
      mockFileDiffVisualizerInstance.getChangedFiles.mockResolvedValue({
        success: true,
        files: [
          { path: 'file1.ts', status: 'modified', emoji: '📝' },
          { path: 'file2.ts', status: 'modified', emoji: '📝' }
        ],
        message: '📋 **当前工作区状态**\n\n- 📝 `file1.ts` (modified)\n\n- 📝 `file2.ts` (modified)\n\n💡 小贴士：使用 `/show-diff` 查看详细改动哦～'
      });

      const result = await handleShowFilesCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockFileDiffVisualizerInstance.getChangedFiles).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('当前工作区状态'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/show-files',
            result: expect.objectContaining({
              success: true
            })
          })
        })
      );
    });

    it('should handle empty working directory', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };

      // Setup mock for empty case
      mockFileDiffVisualizerInstance.getChangedFiles.mockResolvedValue({
        success: true,
        files: [],
        message: '📋 **当前工作区状态**\n\n✅ **工作区很干净，没有文件改动！**\n\n💡 小贴士：使用 `/show-diff` 查看详细改动哦～',
        isEmpty: true
      });

      const result = await handleShowFilesCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockFileDiffVisualizerInstance.getChangedFiles).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('工作区很干净'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/show-files',
            result: expect.objectContaining({
              success: true
            })
          })
        })
      );
    });

    it('should handle git status error gracefully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };

      // Setup mock to throw error
      mockFileDiffVisualizerInstance.getChangedFiles.mockRejectedValue(new Error('Git command failed'));

      const result = await handleShowFilesCommand(mockSession as any);
      
      expect(result).toBe(false);
      expect(mockFileDiffVisualizerInstance.getChangedFiles).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('获取文件列表失败'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/show-files',
            result: expect.objectContaining({
              success: false
            })
          })
        })
      );
    });
  });

  describe('handleShowDiffCommand', () => {
    it('should show diff of all files successfully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };

      // Setup mock
      mockFileDiffVisualizerInstance.getAllFilesDiff.mockResolvedValue({
        success: true,
        diffs: [
          {
            success: true,
            filePath: 'file1.ts',
            type: 'modified',
            additions: 5,
            deletions: 3,
            diff: 'diff content for file1',
            summary: '5 insertions(+), 3 deletions(-)'
          }
        ]
      });

      const result = await handleShowDiffCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockFileDiffVisualizerInstance.getAllFilesDiff).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Diff 概览'));
      expect(mockSession.adapter.emit).toHaveBeenCalledTimes(2); // Summary + file detail
    });

    it('should handle no file changes', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };

      // Setup mock for no changes
      mockFileDiffVisualizerInstance.getAllFilesDiff.mockResolvedValue({
        success: true,
        diffs: []
      });

      const result = await handleShowDiffCommand(mockSession as any);
      
      expect(result).toBe(true);
      expect(mockFileDiffVisualizerInstance.getAllFilesDiff).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('没有检测到文件改动'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/show-diff',
            result: expect.objectContaining({
              success: true
            })
          })
        })
      );
    });

    it('should handle git diff error gracefully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };

      // Setup mock to return error
      mockFileDiffVisualizerInstance.getAllFilesDiff.mockResolvedValue({
        success: false,
        error: 'Git diff failed'
      });

      const result = await handleShowDiffCommand(mockSession as any);
      
      expect(result).toBe(false);
      expect(mockFileDiffVisualizerInstance.getAllFilesDiff).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Git diff failed'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/show-diff',
            result: expect.objectContaining({
              success: false
            })
          })
        })
      );
    });
  });

  describe('handleDiffCommand', () => {
    it('should show diff for specific file successfully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };
      const filename = 'test.ts';

      // Setup mock
      mockFileDiffVisualizerInstance.getFileDiff.mockResolvedValue({
        success: true,
        filePath: filename,
        type: 'modified',
        additions: 10,
        deletions: 5,
        diff: 'diff content',
        summary: '10 insertions(+), 5 deletions(-)'
      });

      const result = await handleDiffCommand(mockSession as any, filename);
      
      expect(result).toBe(true);
      expect(mockFileDiffVisualizerInstance.getFileDiff).toHaveBeenCalledWith(filename);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`**路径**: \`${filename}\``));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: `/diff ${filename}`,
            result: expect.objectContaining({
              success: true
            })
          })
        })
      );
    });

    it('should handle git diff for specific file error gracefully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };
      const filename = 'nonexistent.ts';

      // Setup mock to return error
      mockFileDiffVisualizerInstance.getFileDiff.mockResolvedValue({
        success: false,
        error: 'File not found',
        filePath: filename
      });

      const result = await handleDiffCommand(mockSession as any, filename);
      
      expect(result).toBe(false);
      expect(mockFileDiffVisualizerInstance.getFileDiff).toHaveBeenCalledWith(filename);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('File not found'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: `/diff ${filename}`,
            result: expect.objectContaining({
              success: false
            })
          })
        })
      );
    });
  });

  describe('handleRevertCommand', () => {
    it('should revert specific file successfully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };
      const filename = 'test.ts';

      // Setup mock
      mockFileDiffVisualizerInstance.revertFile.mockResolvedValue({
        success: true,
        message: `✅ 文件 ${filename} 已成功撤销改动`
      });

      const result = await handleRevertCommand(mockSession as any, filename);
      
      expect(result).toBe(true);
      expect(mockFileDiffVisualizerInstance.revertFile).toHaveBeenCalledWith(filename);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`文件 ${filename} 已成功撤销改动`));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: `/revert ${filename}`,
            result: expect.objectContaining({
              success: true
            })
          })
        })
      );
    });

    it('should handle git checkout error gracefully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };
      const filename = 'nonexistent.ts';

      // Setup mock to return error
      mockFileDiffVisualizerInstance.revertFile.mockResolvedValue({
        success: false,
        error: '撤销文件失败: File not found',
        filePath: filename
      });

      const result = await handleRevertCommand(mockSession as any, filename);
      
      expect(result).toBe(false);
      expect(mockFileDiffVisualizerInstance.revertFile).toHaveBeenCalledWith(filename);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('撤销文件失败'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: `/revert ${filename}`,
            result: expect.objectContaining({
              success: false
            })
          })
        })
      );
    });
  });

  describe('handleStageCommand', () => {
    it('should stage specific file successfully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };
      const filename = 'test.ts';

      // Setup mock
      mockFileDiffVisualizerInstance.stageFile.mockResolvedValue({
        success: true,
        message: `✅ 文件 ${filename} 已成功暂存`
      });

      const result = await handleStageCommand(mockSession as any, filename);
      
      expect(result).toBe(true);
      expect(mockFileDiffVisualizerInstance.stageFile).toHaveBeenCalledWith(filename);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`文件 ${filename} 已成功暂存`));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: `/stage ${filename}`,
            result: expect.objectContaining({
              success: true
            })
          })
        })
      );
    });

    it('should handle git add error gracefully', async () => {
      const mockSession = {
        adapter: {
          emit: jest.fn()
        }
      };
      const filename = 'nonexistent.ts';

      // Setup mock to return error
      mockFileDiffVisualizerInstance.stageFile.mockResolvedValue({
        success: false,
        error: '暂存文件失败: File not found',
        filePath: filename
      });

      const result = await handleStageCommand(mockSession as any, filename);
      
      expect(result).toBe(false);
      expect(mockFileDiffVisualizerInstance.stageFile).toHaveBeenCalledWith(filename);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('暂存文件失败'));
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: `/stage ${filename}`,
            result: expect.objectContaining({
              success: false
            })
          })
        })
      );
    });
  });

  describe('handleCompactCommand', () => {
    let mockSession: any;

    beforeEach(() => {
      jest.clearAllMocks();
      const library = require('@/shared/utils/library');
      (library.getAllKnowledge as jest.Mock).mockReturnValue([]);
      mockSession = {
        threadId: 'old-session-id',
        adapter: { emit: jest.fn() }
      };
    });

    it('should return true', async () => {
      const result = await handleCompactCommand(mockSession);
      expect(result).toBe(true);
    });

    it('should update session threadId', async () => {
      await handleCompactCommand(mockSession);
      expect(mockSession.threadId).toBe('new-session-id');
    });

    it('should emit commandExecuted with success when knowledge base is empty', async () => {
      await handleCompactCommand(mockSession);
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commandExecuted',
          data: expect.objectContaining({
            command: '/compact',
            result: expect.objectContaining({ success: true })
          })
        })
      );
    });

    it('should emit guidance message when knowledge base is empty', async () => {
      await handleCompactCommand(mockSession);
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              message: expect.stringContaining('知识库为空')
            })
          })
        })
      );
    });

    it('should migrate knowledge items to new session', async () => {
      const library = require('@/shared/utils/library');
      (library.getAllKnowledge as jest.Mock).mockReturnValue([
        { content: 'Content A', title: 'Goal A', keywords: ['k1'] },
        { content: 'Content B', title: 'Goal B', keywords: ['k2'] },
      ]);

      await handleCompactCommand(mockSession);

      expect(library.addKnowledge).toHaveBeenCalledTimes(2);
      expect(library.addKnowledge).toHaveBeenCalledWith('Content A', 'Goal A', ['k1']);
      expect(library.addKnowledge).toHaveBeenCalledWith('Content B', 'Goal B', ['k2']);
    });

    it('should emit knowledge item titles when migration occurs', async () => {
      const library = require('@/shared/utils/library');
      (library.getAllKnowledge as jest.Mock).mockReturnValue([
        { content: 'Content A', title: 'My Project Goal', keywords: [] },
      ]);

      await handleCompactCommand(mockSession);

      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({
              message: expect.stringContaining('My Project Goal')
            })
          })
        })
      );
    });

    it('should return true even when getAllKnowledge throws', async () => {
      const library = require('@/shared/utils/library');
      (library.getAllKnowledge as jest.Mock).mockImplementation(() => {
        throw new Error('storage error');
      });

      const result = await handleCompactCommand(mockSession);
      expect(result).toBe(true);
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: expect.objectContaining({ success: false })
          })
        })
      );
    });
  });

  describe('createHandleInternalCommand', () => {
    let mockSession: any;
    let handleCommand: (command: string) => Promise<boolean>;

    beforeEach(() => {
      jest.clearAllMocks();
      // Ensure library mocks have clean default state
      const library = require('@/shared/utils/library');
      (library.getAllKnowledge as jest.Mock).mockReturnValue([]);
      // Ensure SessionManager mock returns predictable value
      const { SessionManager: SM } = require('@/infrastructure/session/session-manager');
      SM.getInstance.mockReturnValue({
        clearCurrentSession: jest.fn().mockReturnValue('new-session-id'),
        getCurrentSessionMetadata: jest.fn().mockReturnValue(null),
      });
      mockSession = {
        threadId: 'test-session-id',
        adapter: {
          emit: jest.fn()
        },
        end: jest.fn(),
        abortController: {
          signal: { aborted: false },
          abort: jest.fn()
        }
      };
      handleCommand = createHandleInternalCommand(mockSession);
    });

    it('should handle /help command', async () => {
      const result = await handleCommand('/help');
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('AIBO 助手命令指南'));
    });

    it('should handle /verbose command', async () => {
      const result = await handleCommand('/verbose');
      expect(result).toBe(true);
      expect(config.output.verbose).toBe(true);
    });

    it('should handle /new command', async () => {
      const result = await handleCommand('/new');
      expect(result).toBe(true);
      expect(mockSession.threadId).toBe('new-session-id');
    });

    it('should handle /compact command', async () => {
      const result = await handleCommand('/compact');
      expect(result).toBe(true);
      expect(mockSession.threadId).toBe('new-session-id');
    });

    it('should handle /abort command', async () => {
      const result = await handleCommand('/abort');
      expect(result).toBe(true);
      expect(mockSession.abortController.abort).toHaveBeenCalled();
    });

    it('should handle /exit command', async () => {
      await handleCommand('/exit');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle /quit command', async () => {
      await handleCommand('/quit');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle /q command', async () => {
      await handleCommand('/q');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle /stop command', async () => {
      await handleCommand('/stop');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle unknown command', async () => {
      const result = await handleCommand('/unknown');
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('未知命令'));
    });
  });

  // Restore original functions after all tests
  afterAll(() => {
    console.log = originalConsoleLog;
    process.exit = originalProcessExit;
  });
});