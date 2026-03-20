import { createFilterDuplicateToolsMiddleware } from '@/core/middlewares/filter-duplicate-tools';

describe('FilterDuplicateToolsMiddleware', () => {
  let middleware: any;
  let mockHandler: jest.Mock;

  beforeEach(() => {
    middleware = createFilterDuplicateToolsMiddleware();
    mockHandler = jest.fn();
  });

  it('should create middleware successfully', () => {
    expect(middleware).toBeDefined();
    expect(middleware.name).toBe('FilterDuplicateToolsMiddleware');
  });

  it('should pass through requests without tools', async () => {
    const request = { message: 'test', tools: [] };
    mockHandler.mockResolvedValue({ response: 'success' });

    const result = await middleware.wrapModelCall(request, mockHandler);

    expect(mockHandler).toHaveBeenCalledWith(request);
    expect(result).toEqual({ response: 'success' });
  });

  it('should pass through requests with no tools property', async () => {
    const request = { message: 'test' };
    mockHandler.mockResolvedValue({ response: 'success' });

    const result = await middleware.wrapModelCall(request, mockHandler);

    expect(mockHandler).toHaveBeenCalledWith(request);
    expect(result).toEqual({ response: 'success' });
  });

  it('should filter out duplicate tools by name', async () => {
    const request = {
      message: 'test',
      tools: [
        { name: 'tool1', description: 'First tool' },
        { name: 'tool2', description: 'Second tool' },
        { name: 'tool1', description: 'Duplicate tool' }, // 重复的工具
        { name: 'tool3', description: 'Third tool' },
        { name: 'tool2', description: 'Another duplicate' } // 另一个重复的工具
      ]
    };

    mockHandler.mockImplementation((req) => {
      return Promise.resolve({ 
        response: 'success',
        toolsCount: req.tools.length 
      });
    });

    const result = await middleware.wrapModelCall(request, mockHandler);

    // 验证传递给handler的请求只包含唯一的工具
    expect(mockHandler).toHaveBeenCalledWith({
      message: 'test',
      tools: [
        { name: 'tool1', description: 'First tool' },
        { name: 'tool2', description: 'Second tool' },
        { name: 'tool3', description: 'Third tool' }
      ]
    });

    expect(result.toolsCount).toBe(3); // 应该只有3个唯一工具
  });

  it('should preserve tools without names', async () => {
    const request = {
      message: 'test',
      tools: [
        { name: 'tool1', description: 'Named tool' },
        { description: 'Unnamed tool 1' }, // 没有name属性
        { name: 'tool1', description: 'Duplicate named tool' },
        { description: 'Unnamed tool 2' }, // 没有name属性
        { name: null, description: 'Null name tool' }, // name为null
        { name: '', description: 'Empty name tool' } // name为空字符串
      ]
    };

    mockHandler.mockImplementation((req) => {
      return Promise.resolve({ 
        response: 'success',
        tools: req.tools 
      });
    });

    const result = await middleware.wrapModelCall(request, mockHandler);

    // 验证结果：应该保留第一个tool1，所有没有name的工具，以及特殊name值的工具
    const expectedTools = [
      { name: 'tool1', description: 'Named tool' },
      { description: 'Unnamed tool 1' },
      { description: 'Unnamed tool 2' },
      { name: null, description: 'Null name tool' },
      { name: '', description: 'Empty name tool' }
    ];

    expect(result.tools).toEqual(expectedTools);
  });

  it('should handle empty tools array', async () => {
    const request = {
      message: 'test',
      tools: []
    };

    mockHandler.mockResolvedValue({ response: 'success' });

    const result = await middleware.wrapModelCall(request, mockHandler);

    expect(mockHandler).toHaveBeenCalledWith(request);
    expect(result).toEqual({ response: 'success' });
  });

  it('should preserve original request properties except tools', async () => {
    const request = {
      message: 'test message',
      temperature: 0.7,
      maxTokens: 1000,
      tools: [
        { name: 'tool1', description: 'First tool' },
        { name: 'tool1', description: 'Duplicate tool' }
      ],
      otherProperty: 'should be preserved'
    };

    mockHandler.mockImplementation((req) => {
      return Promise.resolve({ 
        response: 'success',
        receivedRequest: req 
      });
    });

    const result = await middleware.wrapModelCall(request, mockHandler);

    expect(result.receivedRequest).toEqual({
      message: 'test message',
      temperature: 0.7,
      maxTokens: 1000,
      tools: [
        { name: 'tool1', description: 'First tool' }
      ],
      otherProperty: 'should be preserved'
    });
  });

  it('should handle tools with complex structures', async () => {
    const request = {
      message: 'test',
      tools: [
        { 
          name: 'complexTool', 
          description: 'Complex tool',
          parameters: { type: 'object', properties: { param1: { type: 'string' } } },
          metadata: { version: '1.0' }
        },
        { 
          name: 'complexTool', 
          description: 'Duplicate complex tool',
          parameters: { type: 'object', properties: { param2: { type: 'number' } } },
          metadata: { version: '2.0' }
        },
        { 
          name: 'simpleTool', 
          description: 'Simple tool'
        }
      ]
    };

    mockHandler.mockImplementation((req) => {
      return Promise.resolve({ 
        response: 'success',
        tools: req.tools 
      });
    });

    const result = await middleware.wrapModelCall(request, mockHandler);

    // 应该只保留第一个complexTool和simpleTool
    expect(result.tools).toEqual([
      { 
        name: 'complexTool', 
        description: 'Complex tool',
        parameters: { type: 'object', properties: { param1: { type: 'string' } } },
        metadata: { version: '1.0' }
      },
      { 
        name: 'simpleTool', 
        description: 'Simple tool'
      }
    ]);
  });

  it('should handle handler errors gracefully', async () => {
    const request = {
      message: 'test',
      tools: [
        { name: 'tool1', description: 'First tool' }
      ]
    };

    const error = new Error('Handler error');
    mockHandler.mockRejectedValue(error);

    await expect(middleware.wrapModelCall(request, mockHandler)).rejects.toThrow('Handler error');
  });

  it('should maintain tool order for unique tools', async () => {
    const request = {
      message: 'test',
      tools: [
        { name: 'toolA', description: 'Tool A' },
        { name: 'toolB', description: 'Tool B' },
        { name: 'toolA', description: 'Duplicate Tool A' }, // 重复
        { name: 'toolC', description: 'Tool C' },
        { name: 'toolB', description: 'Duplicate Tool B' }, // 重复
        { name: 'toolD', description: 'Tool D' }
      ]
    };

    mockHandler.mockImplementation((req) => {
      return Promise.resolve({ 
        response: 'success',
        tools: req.tools 
      });
    });

    const result = await middleware.wrapModelCall(request, mockHandler);

    // 验证工具的顺序：应该保持第一次出现的顺序
    expect(result.tools.map((t: any) => t.name)).toEqual(['toolA', 'toolB', 'toolC', 'toolD']);
  });
});