import { styled, createGracefulShutdown, createAskQuestion, handleUserInput } from '../src/utils/interactive-utils';

// Mock console.log to avoid polluting test output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();
console.log = mockConsoleLog;

describe('Interactive Utils - Refactored', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  describe('styled', () => {
    it('should format all message types correctly', () => {
      expect(styled.assistant('test')).toBe('\n🤖 test');
      expect(styled.system('test')).toBe('\n⚙️  test');
      expect(styled.error('test')).toBe('\n❌ test');
      expect(styled.hint('test')).toBe('\n💡 test');
      expect(styled.toolResult('tool', true, 'output')).toBe('\n✅ 工具执行 tool: 成功\noutput');
      expect(styled.toolResult('tool', false, 'output')).toBe('\n❌ 工具执行 tool: 失败\noutput');
      
      const toolCallResult = styled.toolCall('tool', {a: 1});
      expect(toolCallResult).toContain('\n🔧 正在调用工具: tool');
      expect(toolCallResult).toContain('参数: {');
      
      expect(styled.truncated('short', 10)).toBe('short');
      expect(styled.truncated('very long string', 5)).toBe('very ... [已截断 11 字符]');
    });
  });

  describe('createGracefulShutdown', () => {
    it('should handle both running and non-running states', () => {
      const mockRl = { close: jest.fn() };
      const sessionRunning = { isRunning: true, rl: mockRl };
      const sessionNotRunning = { isRunning: false, rl: mockRl };
      
      const shutdownRunning = createGracefulShutdown(sessionRunning);
      const shutdownNotRunning = createGracefulShutdown(sessionNotRunning);
      
      // Test running state
      shutdownRunning('SIGINT');
      // We can't easily test structuredLog calls since it's imported, but we can verify state changes
      expect(sessionRunning.isRunning).toBe(false);
      
      // Test non-running state
      const originalExit = process.exit;
      const mockExit = jest.fn();
      (process.exit as any) = mockExit;
      
      shutdownNotRunning('SIGTERM');
      expect(mockRl.close).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
      
      (process.exit as any) = originalExit;
    });
  });

  describe('handleUserInput', () => {
    it('should handle successful agent response', async () => {
      const session = { threadId: 'test', isRunning: false, abortController: null };
      const mockAgent = { invoke: jest.fn().mockResolvedValue('Agent response') };
      const mockRl = { question: jest.fn() };
      
      await handleUserInput('Hello AI', session, mockAgent, mockRl);
      
      expect(session.isRunning).toBe(false); // Should be reset in finally block
      expect(mockAgent.invoke).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: "Hello AI" }] },
        expect.any(Object)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('正在思考...'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🤖 Agent response'));
      expect(mockRl.question).toHaveBeenCalled(); // Should ask next question
    });

    it('should handle agent error gracefully', async () => {
      const session = { threadId: 'test', isRunning: false, abortController: null };
      const mockAgent = { invoke: jest.fn().mockRejectedValue(new Error('Agent error')) };
      const mockRl = { question: jest.fn() };
      
      await handleUserInput('Hello AI', session, mockAgent, mockRl);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('发生错误: Agent error'));
      expect(mockRl.question).toHaveBeenCalled(); // Should still ask next question even after error
    });
  });

  describe('createAskQuestion', () => {
    it('should handle normal input flow', async () => {
      const mockRlQuestion = jest.fn();
      const mockRl = { question: mockRlQuestion };
      const session = { 
        threadId: 'test-thread', 
        isRunning: false, 
        abortController: null,
        rl: mockRl
      };
      const mockAgent = { invoke: jest.fn().mockResolvedValue('Response') };
      
      const askQuestion = createAskQuestion(mockRl, session, mockAgent);
      
      // Call askQuestion to trigger first rl.question
      askQuestion();
      expect(mockRlQuestion).toHaveBeenCalledTimes(1);
      
      // Simulate user input
      const callback = mockRlQuestion.mock.calls[0][1];
      await callback('Hello AI');
      
      expect(mockAgent.invoke).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: "Hello AI" }] },
        expect.any(Object)
      );
    });

    it('should handle empty input recursively', async () => {
      const mockRlQuestion = jest.fn();
      const mockRl = { question: mockRlQuestion };
      const session = { 
        threadId: 'test-thread', 
        isRunning: false, 
        abortController: null,
        rl: mockRl
      };
      const mockAgent = { invoke: jest.fn().mockResolvedValue('Response') };
      
      const askQuestion = createAskQuestion(mockRl, session, mockAgent);
      
      askQuestion();
      expect(mockRlQuestion).toHaveBeenCalledTimes(1);
      
      // First empty input
      const firstCallback = mockRlQuestion.mock.calls[0][1];
      await firstCallback('');
      expect(mockRlQuestion).toHaveBeenCalledTimes(2);
      
      // Valid input
      const secondCallback = mockRlQuestion.mock.calls[1][1];
      await secondCallback('Valid input');
      
      expect(mockAgent.invoke).toHaveBeenCalled();
    });
  });
});