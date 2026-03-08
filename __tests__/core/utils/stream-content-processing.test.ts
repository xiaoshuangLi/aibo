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

    it('should return empty string when no text blocks present (only thinking)', () => {
      const content = [{ type: 'thinking', thinking: 'Just thinking' }];
      // thinking-only response means no displayable text output
      expect(normalizeMessageContent(content)).toBe('');
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

// ─────────────────────────────────────────────────────────────────────────────
// Comprehensive per-provider normalizeMessageContent tests
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMessageContent - ChatOpenAI / AzureChatOpenAI', () => {
  it('simple string response (most common)', () => {
    expect(normalizeMessageContent('Hello, how can I help?')).toBe('Hello, how can I help?');
  });

  it('single text block array', () => {
    expect(normalizeMessageContent([{ type: 'text', text: 'Hello!' }])).toBe('Hello!');
  });

  it('reasoning block only (o1/o3-mini internal thought) → empty string', () => {
    const content = [{ type: 'reasoning', reasoning: 'Let me think step by step...' }];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('reasoning + text (o1/o3-mini) → only text is shown', () => {
    const content = [
      { type: 'reasoning', reasoning: 'Internal analysis...' },
      { type: 'text', text: 'The final answer is 42.' },
    ];
    expect(normalizeMessageContent(content)).toBe('The final answer is 42.');
  });

  it('text with legacy image_url block → text + [Image] placeholder', () => {
    const content = [
      { type: 'text', text: 'Look at this: ' },
      { type: 'image_url', image_url: { url: 'https://example.com/img.png', detail: 'auto' } },
    ];
    expect(normalizeMessageContent(content)).toBe('Look at this: [Image]');
  });

  it('image_url only → [Image]', () => {
    const content = [{ type: 'image_url', image_url: 'data:image/png;base64,abc' }];
    expect(normalizeMessageContent(content)).toBe('[Image]');
  });

  it('tool_call block in content → empty (handled elsewhere)', () => {
    const content = [
      { type: 'tool_call', name: 'get_weather', args: { city: 'Beijing' } },
    ];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('tool_call_chunk during streaming → empty', () => {
    const content = [
      { type: 'tool_call_chunk', name: 'get_weather', args: '{"city":', index: 0 },
    ];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('invalid_tool_call → empty', () => {
    const content = [
      { type: 'invalid_tool_call', name: 'bad_tool', error: 'Missing required arg' },
    ];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('text + tool_call_chunk (streaming partial response)', () => {
    const content = [
      { type: 'text', text: 'Calling a tool now.' },
      { type: 'tool_call_chunk', name: 'search', args: '' },
    ];
    expect(normalizeMessageContent(content)).toBe('Calling a tool now.');
  });
});

describe('normalizeMessageContent - ChatAnthropic', () => {
  it('single text block (most common response format)', () => {
    const content = [{ type: 'text', text: 'Hello from Claude!' }];
    expect(normalizeMessageContent(content)).toBe('Hello from Claude!');
  });

  it('multiple text blocks are concatenated', () => {
    const content = [
      { type: 'text', text: 'First part. ' },
      { type: 'text', text: 'Second part.' },
    ];
    expect(normalizeMessageContent(content)).toBe('First part. Second part.');
  });

  it('thinking block only (Claude 3.7+ extended thinking) → empty', () => {
    const content = [
      { type: 'thinking', thinking: 'Let me reason about this carefully...' },
    ];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('thinking + text → only text shown', () => {
    const content = [
      { type: 'thinking', thinking: 'Let me reason...', signature: 'EqA...' },
      { type: 'text', text: 'The answer is yes.' },
    ];
    expect(normalizeMessageContent(content)).toBe('The answer is yes.');
  });

  it('redacted_thinking + text → only text shown', () => {
    const content = [
      { type: 'redacted_thinking', data: 'REDACTED_CONTENT' },
      { type: 'text', text: 'My response.' },
    ];
    expect(normalizeMessageContent(content)).toBe('My response.');
  });

  it('tool_use block + text → only text shown', () => {
    const content = [
      { type: 'tool_use', id: 'toolu_01', name: 'calculator', input: { expr: '2+2' } },
      { type: 'text', text: 'Calling the calculator.' },
    ];
    expect(normalizeMessageContent(content)).toBe('Calling the calculator.');
  });

  it('tool_use only → empty (tool handled elsewhere)', () => {
    const content = [
      { type: 'tool_use', id: 'toolu_01', name: 'calculator', input: { expr: '2+2' } },
    ];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('server_tool_call (Anthropic computer use) → empty', () => {
    const content = [
      { type: 'server_tool_call', name: 'computer', args: { action: 'screenshot' } },
    ];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('server_tool_call_result → empty', () => {
    const content = [
      { type: 'server_tool_call_result', toolCallId: 'tc_1', status: 'success', output: {} },
    ];
    expect(normalizeMessageContent(content)).toBe('');
  });
});

describe('normalizeMessageContent - ChatGoogleGenerativeAI', () => {
  it('simple string response', () => {
    expect(normalizeMessageContent('Hello from Gemini!')).toBe('Hello from Gemini!');
  });

  it('text block array', () => {
    const content = [{ type: 'text', text: 'Hello from Gemini!' }];
    expect(normalizeMessageContent(content)).toBe('Hello from Gemini!');
  });

  it('text + image block (multimodal response)', () => {
    const content = [
      { type: 'text', text: 'Here is the result: ' },
      { type: 'image', url: 'https://example.com/generated.png', mimeType: 'image/png' },
    ];
    expect(normalizeMessageContent(content)).toBe('Here is the result: [Image]');
  });
});

describe('normalizeMessageContent - ChatMistralAI', () => {
  it('simple string response', () => {
    expect(normalizeMessageContent('Bonjour from Mistral!')).toBe('Bonjour from Mistral!');
  });

  it('text block array', () => {
    const content = [{ type: 'text', text: 'Bonjour!' }];
    expect(normalizeMessageContent(content)).toBe('Bonjour!');
  });
});

describe('normalizeMessageContent - ChatGroq', () => {
  it('simple string response', () => {
    expect(normalizeMessageContent('Fast response from Groq!')).toBe('Fast response from Groq!');
  });

  it('text block array', () => {
    const content = [{ type: 'text', text: 'Fast!' }];
    expect(normalizeMessageContent(content)).toBe('Fast!');
  });

  it('DeepSeek-R1 via Groq: reasoning + text → only text shown', () => {
    const content = [
      { type: 'reasoning', reasoning: '<think>Step by step analysis...</think>' },
      { type: 'text', text: 'Final concise answer.' },
    ];
    expect(normalizeMessageContent(content)).toBe('Final concise answer.');
  });
});

describe('normalizeMessageContent - ChatOllama', () => {
  it('simple string response (llama3, qwen2, mistral)', () => {
    expect(normalizeMessageContent('Local model response.')).toBe('Local model response.');
  });

  it('text block array', () => {
    const content = [{ type: 'text', text: 'Local response.' }];
    expect(normalizeMessageContent(content)).toBe('Local response.');
  });

  it('DeepSeek-R1 via Ollama: reasoning + text → only text shown', () => {
    const content = [
      { type: 'reasoning', reasoning: 'Let me think...' },
      { type: 'text', text: 'Here is my answer.' },
    ];
    expect(normalizeMessageContent(content)).toBe('Here is my answer.');
  });
});

describe('normalizeMessageContent - multimodal content blocks', () => {
  it('image block → [Image]', () => {
    expect(normalizeMessageContent([{ type: 'image', url: 'https://example.com/a.png' }])).toBe('[Image]');
  });

  it('video block → [Video]', () => {
    expect(normalizeMessageContent([{ type: 'video', url: 'https://example.com/v.mp4' }])).toBe('[Video]');
  });

  it('audio block → [Audio]', () => {
    expect(normalizeMessageContent([{ type: 'audio', url: 'https://example.com/a.mp3' }])).toBe('[Audio]');
  });

  it('file block → [File]', () => {
    expect(normalizeMessageContent([{ type: 'file', url: 'https://example.com/doc.pdf' }])).toBe('[File]');
  });

  it('text-plain block with text → extracts text', () => {
    expect(normalizeMessageContent([{ type: 'text-plain', text: 'Plain text content.' }])).toBe('Plain text content.');
  });

  it('text-plain block without text → [File]', () => {
    expect(normalizeMessageContent([{ type: 'text-plain', data: 'abc123' }])).toBe('[File]');
  });

  it('text + multiple media blocks', () => {
    const content = [
      { type: 'text', text: 'Here are your files: ' },
      { type: 'image', url: 'https://example.com/photo.png' },
      { type: 'audio', url: 'https://example.com/clip.mp3' },
      { type: 'file', url: 'https://example.com/report.pdf' },
    ];
    expect(normalizeMessageContent(content)).toBe('Here are your files: [Image][Audio][File]');
  });
});

describe('normalizeMessageContent - non_standard and unknown block types', () => {
  it('non_standard with value.text → extracts text', () => {
    const content = [{ type: 'non_standard', value: { text: 'Provider-specific text output.' } }];
    expect(normalizeMessageContent(content)).toBe('Provider-specific text output.');
  });

  it('non_standard without value.text → empty', () => {
    const content = [{ type: 'non_standard', value: { data: 'binary_blob' } }];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('non_standard with null value → empty', () => {
    const content = [{ type: 'non_standard', value: null }];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('unknown type with .text → extracts text (best-effort)', () => {
    const content = [{ type: 'future_block_type', text: 'Some future content.' }];
    expect(normalizeMessageContent(content)).toBe('Some future content.');
  });

  it('unknown type without .text → empty (skipped)', () => {
    const content = [{ type: 'future_block_type', data: 'opaque' }];
    expect(normalizeMessageContent(content)).toBe('');
  });

  it('mixed: unknown type + text block → text block extracted', () => {
    const content = [
      { type: 'future_block_type', data: 'opaque' },
      { type: 'text', text: 'The actual answer.' },
    ];
    expect(normalizeMessageContent(content)).toBe('The actual answer.');
  });
});