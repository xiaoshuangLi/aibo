import { extractMessagesAndTodos } from '@/core/utils/messages';

describe('Message Processor', () => {
  describe('extractMessagesAndTodos', () => {
    it('should handle array input', () => {
      const input = [{ role: 'user', content: 'hello' }];
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual(input);
      expect(result.todos).toEqual([]);
    });

    it('should handle non-object input', () => {
      const result1 = extractMessagesAndTodos('string');
      const result2 = extractMessagesAndTodos(123);
      const result3 = extractMessagesAndTodos(null);
      const result4 = extractMessagesAndTodos(undefined);
      
      expect(result1).toEqual({ messages: [], todos: [] });
      expect(result2).toEqual({ messages: [], todos: [] });
      expect(result3).toEqual({ messages: [], todos: [] });
      expect(result4).toEqual({ messages: [], todos: [] });
    });

    it('should extract from model_request format', () => {
      const input = {
        model_request: {
          messages: [{ role: 'user', content: 'test' }]
        }
      };
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual([{ role: 'user', content: 'test' }]);
      expect(result.todos).toEqual([]);
    });

    it('should extract from todoListMiddleware format', () => {
      const input = {
        'todoListMiddleware.after_model': {
          messages: [{ role: 'user', content: 'test' }],
          todos: [{ content: 'test todo' }]
        }
      };
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual([{ role: 'user', content: 'test' }]);
      expect(result.todos).toEqual([{ content: 'test todo' }]);
    });

    it('should extract from patchToolCallsMiddleware format', () => {
      const input = {
        'patchToolCallsMiddleware.before_agent': {
          messages: [{ role: 'user', content: 'test' }]
        }
      };
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual([{ role: 'user', content: 'test' }]);
      expect(result.todos).toEqual([]);
    });

    it('should extract from SummarizationMiddleware format', () => {
      const input = {
        'SummarizationMiddleware.before_model': {
          messages: [{ role: 'user', content: 'test' }]
        }
      };
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual([{ role: 'user', content: 'test' }]);
      expect(result.todos).toEqual([]);
    });

    it('should extract from direct messages format', () => {
      const input = {
        messages: [{ role: 'user', content: 'test' }],
        todos: [{ content: 'test todo' }]
      };
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual([{ role: 'user', content: 'test' }]);
      expect(result.todos).toEqual([{ content: 'test todo' }]);
    });

    it('should extract todos from messages when todos is empty', () => {
      const input = {
        messages: [{ role: 'user', content: 'test', todos: [{ content: 'message todo' }] }],
        todos: []
      };
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual([{ role: 'user', content: 'test', todos: [{ content: 'message todo' }] }]);
      expect(result.todos).toEqual([{ content: 'message todo' }]);
    });

    it('should return empty arrays when no format matches', () => {
      const input = { unknown: 'format' };
      const result = extractMessagesAndTodos(input);
      
      expect(result.messages).toEqual([]);
      expect(result.todos).toEqual([]);
    });
  });
});