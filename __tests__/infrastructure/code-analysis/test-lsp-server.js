#!/usr/bin/env node

/**
 * 简单的LSP服务器实现，用于测试LSP客户端
 * 这个服务器实现了基本的LSP协议功能
 */

const readline = require('readline');
const process = require('process');

// LSP消息头格式
function createLSPMessage(content) {
  const contentStr = JSON.stringify(content);
  return `Content-Length: ${Buffer.byteLength(contentStr)}\r\n\r\n${contentStr}`;
}

// 处理LSP请求
function handleRequest(message) {
  console.error('Server received request:', JSON.stringify(message, null, 2));
  
  if (message.method === 'initialize') {
    // 初始化响应
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        capabilities: {
          textDocumentSync: 1,
          completionProvider: {},
          hoverProvider: true,
          definitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
          workspaceSymbolProvider: true,
          diagnosticProvider: {
            interFileDependencies: false,
            workspaceDiagnostics: false
          }
        }
      }
    };
  } else if (message.method === 'textDocument/didOpen') {
    // 文档打开通知 - 发送诊断信息
    const diagnostics = [{
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 5 }
      },
      severity: 1,
      message: 'Test diagnostic message'
    }];
    
    // 发送诊断通知
    process.stdout.write(createLSPMessage({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: message.params.textDocument.uri,
        diagnostics: diagnostics
      }
    }));
    
    return null; // 通知没有响应
  } else if (message.method === 'textDocument/completion') {
    // 补全请求
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        isIncomplete: false,
        items: [
          {
            label: 'testFunction',
            kind: 3,
            detail: 'Test function',
            documentation: 'This is a test function for LSP testing'
          },
          {
            label: 'testVariable', 
            kind: 6,
            detail: 'Test variable',
            documentation: 'This is a test variable for LSP testing'
          }
        ]
      }
    };
  } else if (message.method === 'textDocument/hover') {
    // 悬停请求
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        contents: 'This is hover content for testing'
      }
    };
  } else if (message.method === 'textDocument/definition') {
    // 定义请求
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        uri: message.params.textDocument.uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 12 }
        }
      }
    };
  } else if (message.method === 'textDocument/references') {
    // 引用请求
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: [
        {
          uri: message.params.textDocument.uri,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 12 }
          }
        }
      ]
    };
  } else if (message.method === 'textDocument/documentSymbol') {
    // 文档符号请求
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: [
        {
          name: 'testFunction',
          kind: 12,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 5, character: 1 }
          },
          selectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 12 }
          }
        }
      ]
    };
  } else if (message.method === 'workspace/symbol') {
    // 工作区符号请求
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: [
        {
          name: 'testFunction',
          kind: 12,
          location: {
            uri: 'file:///test.ts',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 }
            }
          }
        }
      ]
    };
  } else if (message.method === 'shutdown') {
    // 关闭请求
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: null
    };
  } else if (message.method === 'exit') {
    // 退出通知
    process.exit(0);
    return null;
  }
  
  // 未知请求 - 返回错误
  if (message.id !== undefined) {
    return {
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    };
  }
  
  return null;
}

// 设置标准输入读取
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let buffer = '';
let contentLength = 0;

rl.on('line', (line) => {
  buffer += line + '\n';
  
  // 检查是否包含完整的头部
  if (contentLength === 0) {
    const match = buffer.match(/^Content-Length: (\d+)\r?\n\r?\n/);
    if (match) {
      contentLength = parseInt(match[1], 10);
      buffer = buffer.substring(match[0].length);
    }
  }
  
  // 检查是否有完整的内容
  if (contentLength > 0 && buffer.length >= contentLength) {
    const content = buffer.substring(0, contentLength);
    buffer = buffer.substring(contentLength);
    
    try {
      const message = JSON.parse(content);
      const response = handleRequest(message);
      
      if (response) {
        process.stdout.write(createLSPMessage(response));
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
    
    contentLength = 0;
  }
});

// 处理原始数据（非行模式）
process.stdin.on('data', (chunk) => {
  // 在非行模式下处理原始数据
  if (!rl.closed) {
    // 这里我们保持行模式，因为LSP消息通常以换行符分隔
  }
});

console.error('Test LSP Server started');