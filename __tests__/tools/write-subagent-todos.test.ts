import { writeSubagentTodosTool } from '../../src/tools/write-subagent-todos';

describe('writeSubagentTodosTool', () => {
  describe('成功路径测试', () => {
    test('应该正确处理有效的单个任务输入', async () => {
      const input = {
        todos: [
          {
            content: '测试任务',
            status: 'pending' as const,
            subagent_type: 'coder'
          }
        ]
      };

      const result = await writeSubagentTodosTool.invoke(input);
      // 确保结果是字符串
      expect(typeof result).toBe('string');
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Updated subagent todo list with 1 tasks');
      expect(parsedResult.todos).toHaveLength(1);
      expect(parsedResult.todos[0]).toEqual({
        content: '测试任务',
        status: 'pending',
        subagent_type: 'coder'
      });
    });

    test('应该正确处理多个任务输入', async () => {
      const input = {
        todos: [
          {
            content: '任务1',
            status: 'in_progress' as const,
            subagent_type: 'coder'
          },
          {
            content: '任务2',
            status: 'pending' as const,
            subagent_type: 'researcher'
          },
          {
            content: '任务3',
            status: 'completed' as const,
            subagent_type: 'validator'
          }
        ]
      };

      const result = await writeSubagentTodosTool.invoke(input);
      expect(typeof result).toBe('string');
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Updated subagent todo list with 3 tasks');
      expect(parsedResult.todos).toHaveLength(3);
      
      // 验证第一个任务
      expect(parsedResult.todos[0]).toEqual({
        content: '任务1',
        status: 'in_progress',
        subagent_type: 'coder'
      });
      
      // 验证第二个任务
      expect(parsedResult.todos[1]).toEqual({
        content: '任务2',
        status: 'pending',
        subagent_type: 'researcher'
      });
      
      // 验证第三个任务
      expect(parsedResult.todos[2]).toEqual({
        content: '任务3',
        status: 'completed',
        subagent_type: 'validator'
      });
    });

    test('应该正确处理空数组输入', async () => {
      const input = {
        todos: []
      };

      const result = await writeSubagentTodosTool.invoke(input);
      expect(typeof result).toBe('string');
      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Updated subagent todo list with 0 tasks');
      expect(parsedResult.todos).toHaveLength(0);
    });
  });

  describe('边界条件和特殊场景测试', () => {

    test('应该处理各种 subagent_type 值', async () => {
      const validSubagentTypes = [
        'coder', 'researcher', 'validator', 'testing', 
        'documentation', 'coordinator', 'innovator', 
        'custom-agent-type' // 自定义类型
      ];

      for (const subagentType of validSubagentTypes) {
        const input = {
          todos: [
            {
              content: `测试 ${subagentType} 任务`,
              status: 'pending' as const,
              subagent_type: subagentType
            }
          ]
        };

        const result = await writeSubagentTodosTool.invoke(input);
        expect(typeof result).toBe('string');
        const parsedResult = JSON.parse(result);

        expect(parsedResult.success).toBe(true);
        expect(parsedResult.todos[0].subagent_type).toBe(subagentType);
      }
    });

    test('应该处理各种 status 值', async () => {
      const validStatuses = ['pending', 'in_progress', 'completed'] as const;

      for (const status of validStatuses) {
        const input = {
          todos: [
            {
              content: `测试 ${status} 任务`,
              status: status,
              subagent_type: 'coder'
            }
          ]
        };

        const result = await writeSubagentTodosTool.invoke(input);
        expect(typeof result).toBe('string');
        const parsedResult = JSON.parse(result);

        expect(parsedResult.success).toBe(true);
        expect(parsedResult.todos[0].status).toBe(status);
      }
    });
  });

  // 测试直接调用函数以确保覆盖 return 语句
  test('直接调用函数应该返回正确的 JSON 字符串', async () => {
    const mockInput = {
      todos: [
        {
          content: '直接测试',
          status: 'pending' as const,
          subagent_type: 'coder'
        }
      ]
    };

    // 直接调用函数
    const toolFunction = (writeSubagentTodosTool as any).func;
    if (toolFunction) {
      const result = await toolFunction(mockInput);
      expect(typeof result).toBe('string');
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    }
  });

  // 测试错误处理路径
  test('应该正确处理内部验证错误', async () => {
    // 直接调用函数并传入无效数据
    const toolFunction = (writeSubagentTodosTool as any).func;
    if (toolFunction) {
      const invalidInput = {
        todos: [
          {
            // 缺少必需字段
            status: 'pending',
            subagent_type: 'coder'
          }
        ]
      };

      const result = await toolFunction(invalidInput);
      expect(typeof result).toBe('string');
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBe('Each todo must have content, status, and subagent_type');
    }
  });

  test('应该正确处理非 Error 类型的异常', async () => {
    const toolFunction = (writeSubagentTodosTool as any).func;
    if (toolFunction) {
      // 模拟一个非 Error 类型的异常
      const originalMap = Array.prototype.map;
      Array.prototype.map = function() {
        throw 'String error instead of Error object';
      };

      try {
        const input = {
          todos: [
            {
              content: '测试任务',
              status: 'pending' as const,
              subagent_type: 'coder'
            }
          ]
        };

        const result = await toolFunction(input);
        expect(typeof result).toBe('string');
        const parsedResult = JSON.parse(result);
        expect(parsedResult.success).toBe(false);
        expect(parsedResult.error).toBe('String error instead of Error object');
      } finally {
        Array.prototype.map = originalMap;
      }
    }
  });
});