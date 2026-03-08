import { handleAIContent, normalizeMessageContent, StreamState } from '@/core/utils/stream';

// Mock dependencies
jest.mock('@/presentation/styling/styler', () => ({
  styled: {}
}));

jest.mock('@/shared/utils/logging', () => ({
  structuredLog: jest.fn()
}));

describe('handleAIContent - Content Processing Enhancement', () => {
  let mockSession: any;
  let mockState: StreamState;

  beforeEach(() => {
    mockSession = {
      adapter: {
        emit: jest.fn()
      }
    };
    
    mockState = {
      fullResponse: '',
      lastToolCall: null,
      hasDisplayedThinking: false,
      abortSignal: new AbortController().signal
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('content format handling', () => {
    it('should handle string content directly', async () => {
      const msg = { content: 'Simple string content' };
      
      await handleAIContent(msg, mockState, mockSession);
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: 'Simple string content'
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle content array with text property', async () => {
      const msg = {
        content: [
          { text: 'Content from array with text property' }
        ]
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: 'Content from array with text property'
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle content array without text property (fallback to content)', async () => {
      const msg = {
        content: [
          { message: 'Content without text property' }
        ]
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: `\`\`\`json\n${JSON.stringify([{ message: 'Content without text property' }], null, 2)}\n\`\`\``
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should format object content as JSON with code block', async () => {
      const objectContent = {
        type: 'response',
        data: { key: 'value', number: 42 },
        metadata: { timestamp: '2024-01-01' }
      };
      
      const msg = { content: objectContent };
      
      await handleAIContent(msg, mockState, mockSession);
      
      const expectedContent = `\`\`\`json\n${JSON.stringify(objectContent, null, 2)}\n\`\`\``;
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: expectedContent
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle nested object in content array', async () => {
      const nestedObject = {
        result: 'success',
        data: { items: [1, 2, 3], status: 'complete' }
      };
      
      const msg = {
        content: [nestedObject]
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      const expectedContent = `\`\`\`json\n${JSON.stringify([nestedObject], null, 2)}\n\`\`\``;
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: expectedContent
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle empty content array', async () => {
      const msg = { content: [] };
      
      await handleAIContent(msg, mockState, mockSession);
      
      const expectedContent = `\`\`\`json\n[]\n\`\`\``;
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: expectedContent
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle null content', async () => {
      const msg = { content: null };
      
      await handleAIContent(msg, mockState, mockSession);
      
      // null content should not trigger emit due to early return
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should handle undefined content', async () => {
      const msg = { content: undefined };
      
      await handleAIContent(msg, mockState, mockSession);
      
      // undefined content should not trigger emit due to early return
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should handle number content', async () => {
      const msg = { content: 42 };
      
      await handleAIContent(msg, mockState, mockSession);
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: '42'
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle boolean content', async () => {
      const msg = { content: true };
      
      await handleAIContent(msg, mockState, mockSession);
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: 'true'
          }),
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('content processing with existing fullResponse', () => {
    it('should handle object content with existing fullResponse', async () => {
      mockState.fullResponse = 'Previous content ';
      
      const objectContent = { status: 'processing', step: 1 };
      const msg = { content: objectContent };
      
      await handleAIContent(msg, mockState, mockSession);
      
      const expectedContent = `\`\`\`json\n${JSON.stringify(objectContent, null, 2)}\n\`\`\``;
      
      // Should reset fullResponse since object content doesn't start with previous content
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: expectedContent
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle array content with text that continues fullResponse', async () => {
      mockState.fullResponse = 'Hello ';
      
      const msg = {
        content: [
          { text: 'Hello World! This is a continuation.' }
        ]
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: 'World! This is a continuation.'
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should reset fullResponse when array content diverges', async () => {
      mockState.fullResponse = 'Previous content';
      
      const msg = {
        content: [
          { text: 'Completely different content' }
        ]
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: 'Completely different content'
          }),
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle content array with mixed types', async () => {
      const msg = {
        content: [
          { text: 'Text content' },
          { data: 'Other data' },
          'String item'
        ]
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      // Should use the first item's text property
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: 'Text content'
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle content array with no text property in first item', async () => {
      const msg = {
        content: [
          { data: 'No text property' },
          { text: 'Has text property' }
        ]
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      // Should fallback to formatting the entire content as JSON
      const expectedContent = `\`\`\`json\n${JSON.stringify(msg.content, null, 2)}\n\`\`\``;
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: expectedContent
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle deeply nested object content', async () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              data: 'deep value',
              array: [1, 2, { nested: true }]
            }
          }
        }
      };
      
      const msg = { content: deepObject };
      
      await handleAIContent(msg, mockState, mockSession);
      
      const expectedContent = `\`\`\`json\n${JSON.stringify(deepObject, null, 2)}\n\`\`\``;
      
      expect(mockSession.adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'aiResponse',
          data: expect.objectContaining({
            content: expectedContent
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle content with circular references gracefully', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      const msg = { content: circularObj };
      
      // Mock JSON.stringify to handle circular reference
      const originalStringify = JSON.stringify;
      jest.spyOn(JSON, 'stringify').mockImplementation((value, replacer, space) => {
        try {
          return originalStringify(value, replacer, space);
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('circular')) {
            return '[Circular Reference]';
          }
          throw error;
        }
      });
      
      // This should not throw an error, but handle the circular reference
      await expect(handleAIContent(msg, mockState, mockSession)).resolves.not.toThrow();
      
      // Restore original JSON.stringify
      (JSON.stringify as jest.Mock).mockRestore();
    });
  });

  describe('integration with existing logic', () => {
    it('should still respect tool_call_id check', async () => {
      const msg = {
        content: { data: 'test' },
        tool_call_id: 'some-id'
      };
      
      await handleAIContent(msg, mockState, mockSession);
      
      // Should not emit anything due to tool_call_id presence
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should still respect abort signal', async () => {
      const controller = new AbortController();
      controller.abort();
      
      mockState.abortSignal = controller.signal;
      
      const msg = { content: { data: 'test' } };
      
      await handleAIContent(msg, mockState, mockSession);
      
      // Should not emit anything due to aborted signal
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });

    it('should still handle empty content correctly', async () => {
      const msg = { content: '' };
      
      await handleAIContent(msg, mockState, mockSession);
      
      // Should not emit anything for empty content
      expect(mockSession.adapter.emit).not.toHaveBeenCalled();
    });
  });
});

describe('normalizeMessageContent - unified content normalizer', () => {
  describe('null / undefined', () => {
    it('should return empty string for null', () => {
      expect(normalizeMessageContent(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(normalizeMessageContent(undefined)).toBe('');
    });
  });

  describe('string content', () => {
    it('should return string as-is', () => {
      expect(normalizeMessageContent('hello')).toBe('hello');
    });

    it('should return empty string unchanged', () => {
      expect(normalizeMessageContent('')).toBe('');
    });
  });

  describe('Anthropic typed content blocks', () => {
    it('should extract text from a single text block', () => {
      const content = [{ type: 'text', text: 'Hello from Anthropic' }];
      expect(normalizeMessageContent(content)).toBe('Hello from Anthropic');
    });

    it('should concatenate multiple text blocks', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' World' },
      ];
      expect(normalizeMessageContent(content)).toBe('Hello World');
    });

    it('should skip thinking blocks and return only text', () => {
      const content = [
        { type: 'thinking', thinking: 'Internal reasoning...' },
        { type: 'text', text: 'Final response' },
      ];
      expect(normalizeMessageContent(content)).toBe('Final response');
    });

    it('should skip tool_use blocks and return only text', () => {
      const content = [
        { type: 'tool_use', id: 'tu_1', name: 'calculator', input: {} },
        { type: 'text', text: 'Calling calculator' },
      ];
      expect(normalizeMessageContent(content)).toBe('Calling calculator');
    });

    it('should return JSON code block when no text blocks present', () => {
      const content = [{ type: 'thinking', thinking: 'Just thinking' }];
      const expected = `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``;
      expect(normalizeMessageContent(content)).toBe(expected);
    });
  });

  describe('plain primitive arrays', () => {
    it('should join string array with spaces', () => {
      expect(normalizeMessageContent(['part1', 'part2', 'part3'])).toBe('part1 part2 part3');
    });

    it('should join number array with spaces', () => {
      expect(normalizeMessageContent([1, 2, 3])).toBe('1 2 3');
    });
  });

  describe('object arrays without type', () => {
    it('should return first item .text when present', () => {
      const content = [{ text: 'From text property' }];
      expect(normalizeMessageContent(content)).toBe('From text property');
    });

    it('should return JSON code block when first item has no .text', () => {
      const content = [{ message: 'No text property' }];
      const expected = `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``;
      expect(normalizeMessageContent(content)).toBe(expected);
    });
  });

  describe('empty array', () => {
    it('should return JSON code block for empty array', () => {
      expect(normalizeMessageContent([])).toBe('```json\n[]\n```');
    });
  });

  describe('plain objects', () => {
    it('should return JSON code block for plain object', () => {
      const obj = { key: 'value' };
      const expected = `\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\``;
      expect(normalizeMessageContent(obj)).toBe(expected);
    });
  });

  describe('primitive non-string values', () => {
    it('should convert number to string', () => {
      expect(normalizeMessageContent(42)).toBe('42');
    });

    it('should convert boolean to string', () => {
      expect(normalizeMessageContent(true)).toBe('true');
    });
  });
});

describe('handleAIContent - Anthropic content block compatibility', () => {
  let mockSession: any;
  let mockState: StreamState;

  beforeEach(() => {
    mockSession = {
      adapter: {
        emit: jest.fn()
      }
    };
    mockState = {
      fullResponse: '',
      lastToolCall: null,
      hasDisplayedThinking: false,
      abortSignal: new AbortController().signal
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should extract text from Anthropic [{type:"text", text:"..."}] blocks', async () => {
    const msg = {
      content: [{ type: 'text', text: 'Anthropic text response' }]
    };

    await handleAIContent(msg, mockState, mockSession);

    expect(mockSession.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'aiResponse',
        data: expect.objectContaining({ content: 'Anthropic text response' }),
        timestamp: expect.any(Number)
      })
    );
  });

  it('should extract only text blocks when thinking blocks precede them', async () => {
    const msg = {
      content: [
        { type: 'thinking', thinking: 'Let me reason...' },
        { type: 'text', text: 'Response after thinking' },
      ]
    };

    await handleAIContent(msg, mockState, mockSession);

    expect(mockSession.adapter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'aiResponse',
        data: expect.objectContaining({ content: 'Response after thinking' }),
        timestamp: expect.any(Number)
      })
    );
  });
});