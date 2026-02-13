import { LspMessageParser } from '../../../src/infrastructure/code-analysis/lsp-message-parser';

describe('LspMessageParser', () => {
  let parser: LspMessageParser;

  beforeEach(() => {
    parser = new LspMessageParser();
  });

  afterEach(() => {
    parser.removeAllListeners();
  });

  describe('parseContentLength', () => {
    test('should parse valid Content-Length header', () => {
      const header = 'Content-Length: 123\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8';
      const result = (parser as any).parseContentLength(header);
      expect(result).toBe(123);
    });

    test('should return null for invalid Content-Length header with NaN', () => {
      const header = 'Content-Length: abc';
      const result = (parser as any).parseContentLength(header);
      expect(result).toBeNull();
    });

    test('should return null for invalid Content-Length header with negative number', () => {
      const header = 'Content-Length: -123';
      const result = (parser as any).parseContentLength(header);
      expect(result).toBeNull();
    });

    test('should return null when Content-Length header is missing', () => {
      const header = 'Content-Type: application/vscode-jsonrpc; charset=utf-8';
      const result = (parser as any).parseContentLength(header);
      expect(result).toBeNull();
    });

    test('should handle Content-Length with extra whitespace', () => {
      const header = 'Content-Length:   456   ';
      const result = (parser as any).parseContentLength(header);
      expect(result).toBe(456);
    });
  });

  describe('parseJsonContent', () => {
    test('should parse valid JSON content', () => {
      const content = Buffer.from('{"jsonrpc":"2.0","id":1,"result":{}}');
      const result = (parser as any).parseJsonContent(content);
      expect(result).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    });

    test('should throw error for invalid JSON content', () => {
      const content = Buffer.from('invalid json');
      expect(() => (parser as any).parseJsonContent(content)).toThrow('Failed to parse JSON content');
    });

    test('should handle empty JSON content', () => {
      const content = Buffer.from('');
      expect(() => (parser as any).parseJsonContent(content)).toThrow('Failed to parse JSON content');
    });
  });

  describe('receiveData', () => {
    test('should emit message event for complete LSP message', (done) => {
      const message = '{"jsonrpc":"2.0","id":1,"result":{}}';
      const header = `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n`;
      const fullMessage = header + message;
      
      parser.on('message', (parsedMessage) => {
        expect(parsedMessage).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
        done();
      });

      parser.receiveData(Buffer.from(fullMessage, 'utf8'));
    });

    test('should handle chunked data correctly', (done) => {
      const message = '{"jsonrpc":"2.0","id":1,"result":{"capabilities":{}}}';
      const header = `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n`;
      const fullMessage = header + message;
      
      // Split into multiple chunks
      const chunk1 = Buffer.from(fullMessage.substring(0, 20), 'utf8');
      const chunk2 = Buffer.from(fullMessage.substring(20, 40), 'utf8');
      const chunk3 = Buffer.from(fullMessage.substring(40), 'utf8');

      let messageCount = 0;
      parser.on('message', (parsedMessage) => {
        messageCount++;
        expect(parsedMessage).toEqual({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } });
        if (messageCount === 1) {
          done();
        }
      });

      parser.receiveData(chunk1);
      parser.receiveData(chunk2);
      parser.receiveData(chunk3);
    });

    test('should handle multiple messages in single buffer', (done) => {
      const message1 = '{"jsonrpc":"2.0","id":1,"result":{}}';
      const message2 = '{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{}}';
      
      const header1 = `Content-Length: ${Buffer.byteLength(message1, 'utf8')}\r\n\r\n`;
      const header2 = `Content-Length: ${Buffer.byteLength(message2, 'utf8')}\r\n\r\n`;
      
      const fullMessage = header1 + message1 + header2 + message2;
      
      const messages: any[] = [];
      parser.on('message', (parsedMessage) => {
        messages.push(parsedMessage);
        if (messages.length === 2) {
          expect(messages[0]).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
          expect(messages[1]).toEqual({ 
            jsonrpc: "2.0", 
            method: "textDocument/publishDiagnostics", 
            params: {} 
          });
          done();
        }
      });

      parser.receiveData(Buffer.from(fullMessage, 'utf8'));
    });

    test('should emit error event for invalid Content-Length header', (done) => {
      const invalidMessage = 'Content-Length: invalid\r\n\r\n{}';
      
      parser.on('error', (error) => {
        expect(error.message).toContain('Invalid Content-Length header');
        done();
      });

      parser.receiveData(Buffer.from(invalidMessage, 'utf8'));
    });

    test('should emit error event for message too large', (done) => {
      // Create a message larger than maxMessageSize (10MB)
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const header = `Content-Length: ${Buffer.byteLength(largeContent, 'utf8')}\r\n\r\n`;
      const fullMessage = header + largeContent;
      
      parser.on('error', (error) => {
        expect(error.message).toContain('Message too large');
        done();
      });

      parser.receiveData(Buffer.from(fullMessage, 'utf8'));
    });

    test('should emit error event for invalid JSON content', (done) => {
      const invalidJson = '{"jsonrpc":"2.0","id":1,"result":}';
      const header = `Content-Length: ${Buffer.byteLength(invalidJson, 'utf8')}\r\n\r\n`;
      const fullMessage = header + invalidJson;
      
      parser.on('error', (error) => {
        expect(error.message).toContain('Failed to parse JSON content');
        done();
      });

      parser.receiveData(Buffer.from(fullMessage, 'utf8'));
    });
  });

  describe('clear', () => {
    test('should clear buffer and contentLength', () => {
      // Simulate partial message processing
      const partialHeader = 'Content-Length: 100\r\n';
      parser.receiveData(Buffer.from(partialHeader, 'utf8'));
      
      // Verify internal state before clear
      expect((parser as any).buffer.length).toBeGreaterThan(0);
      expect((parser as any).contentLength).toBeNull();
      
      parser.clear();
      
      expect((parser as any).buffer.length).toBe(0);
      expect((parser as any).contentLength).toBeNull();
    });
  });

  describe('processBuffer edge cases', () => {
    test('should handle incomplete header gracefully', () => {
      const incompleteHeader = 'Content-Length: 100\r\n';
      parser.receiveData(Buffer.from(incompleteHeader, 'utf8'));
      
      // Should not throw and should keep data in buffer
      expect((parser as any).buffer.length).toBeGreaterThan(0);
      expect((parser as any).contentLength).toBeNull();
    });

    test('should handle incomplete content gracefully', () => {
      const header = 'Content-Length: 100\r\n\r\n';
      const partialContent = 'partial content';
      
      parser.receiveData(Buffer.from(header + partialContent, 'utf8'));
      
      // Should not throw and should keep data in buffer
      expect((parser as any).buffer.length).toBeGreaterThan(0);
      expect((parser as any).contentLength).toBe(100);
    });

    test('should handle empty buffer', () => {
      // Should not throw
      (parser as any).processBuffer();
      expect(true).toBe(true);
    });
  });
});