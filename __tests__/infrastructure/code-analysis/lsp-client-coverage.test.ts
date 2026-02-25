import { LspClient, LspClientManager } from '@/infrastructure/code-analysis/lsp-client';
import * as fs from 'fs';
import * as path from 'path';

// 增加 Jest 超时时间
jest.setTimeout(20000);

// 创建临时测试文件的工具函数
const createTempTestFile = (content: string, extension: string = '.ts'): string => {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const fileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${extension}`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
};

// 清理临时文件
const cleanupTempFiles = () => {
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      try {
        fs.unlinkSync(path.join(tempDir, file));
      } catch (error) {
        // 忽略清理错误
      }
    });
    try {
      fs.rmdirSync(tempDir);
    } catch (error) {
      // 忽略清理错误
    }
  }
};

describe('LSP Client Coverage Tests', () => {
  let testFilePath: string;
  let client: LspClient;

  beforeAll(() => {
    // 确保 TypeScript Language Server 可用
    expect(fs.existsSync(path.join(__dirname, '../../../node_modules/typescript-language-server'))).toBe(true);
  });

  beforeEach(async () => {
    // 创建简单的测试文件
    const testContent = `
      interface TestInterface {
        name: string;
      }

      class TestClass implements TestInterface {
        name: string = 'test';
      }

      const instance = new TestClass();
    `;
    testFilePath = createTempTestFile(testContent);

    // 配置 LSP 客户端
    const config = {
      serverCommand: 'npx',
      serverArgs: ['typescript-language-server', '--stdio'],
      workingDirectory: path.dirname(testFilePath),
      timeout: 15000,
      maxBufferSize: 5 * 1024 * 1024
    };

    client = new LspClient(config);
    await client.initialize();
  });

  afterEach(async () => {
    if (client) {
      try {
        await client.shutdown();
      } catch (error) {
        // 忽略关闭错误
      }
    }
    cleanupTempFiles();
  });

  afterAll(async () => {
    try {
      await LspClientManager.shutdownAll();
    } catch (error) {
      // 忽略清理错误
    }
  });

  // 测试基本功能以提高覆盖率
  it('should cover basic LSP client functionality', async () => {
    // 测试 isRunning
    expect(client.isRunning()).toBe(true);

    // 测试 openDocument 和 closeDocument
    await client.openDocument(testFilePath);
    expect(client.isDocumentOpen(`file://${testFilePath}`)).toBe(true);
    
    await client.closeDocument(testFilePath);
    expect(client.isDocumentOpen(`file://${testFilePath}`)).toBe(false);

    // 测试重新打开文档
    await client.openDocument(testFilePath);

    // 测试 getDiagnostics
    const diagnostics = await client.getDiagnostics(testFilePath);
    expect(Array.isArray(diagnostics)).toBe(true);

    // 测试 getAllDiagnostics
    const allDiagnostics = client.getAllDiagnostics();
    expect(allDiagnostics instanceof Map).toBe(true);

    // 测试 getDocumentDiagnostics
    const docDiagnostics = client.getDocumentDiagnostics(`file://${testFilePath}`);
    expect(Array.isArray(docDiagnostics) || docDiagnostics === undefined).toBe(true);

    // 测试 restart
    await client.restart();
    expect(client.isRunning()).toBe(true);

    // 测试 exit
    client.exit();

    // 测试 LspClientManager
    const config = {
      serverCommand: 'npx',
      serverArgs: ['typescript-language-server', '--stdio'],
      workingDirectory: path.dirname(testFilePath),
      timeout: 15000
    };

    const managerClient = await LspClientManager.getClient(path.dirname(testFilePath), config);
    expect(managerClient.isRunning()).toBe(true);

    const sameClient = await LspClientManager.getClient(path.dirname(testFilePath));
    expect(sameClient).toBe(managerClient);

    await LspClientManager.restartClient(path.dirname(testFilePath), config);
    const restartedClient = await LspClientManager.getClient(path.dirname(testFilePath));
    expect(restartedClient).not.toBe(managerClient);
  }, 20000);

  // 测试错误处理路径
  it('should handle error scenarios gracefully', async () => {
    // 测试未初始化时调用方法
    const uninitClient = new LspClient({
      serverCommand: 'npx',
      serverArgs: ['typescript-language-server', '--stdio'],
      workingDirectory: path.dirname(testFilePath)
    });

    await expect(uninitClient.getHover(testFilePath, { line: 0, character: 0 }))
      .rejects
      .toThrow('LSP client not initialized');

    await expect(uninitClient.getCompletion(testFilePath, { line: 0, character: 0 }))
      .rejects
      .toThrow('LSP client not initialized');

    await expect(uninitClient.getCodeActions(testFilePath, { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }))
      .rejects
      .toThrow('LSP client not initialized');

    await expect(uninitClient.openDocument(testFilePath))
      .rejects
      .toThrow('LSP client not initialized');

    await expect(uninitClient.closeDocument(testFilePath))
      .rejects
      .toThrow('LSP client not initialized');

    // 测试非存在文件
    await expect(client.openDocument('/non/existent/file.ts'))
      .rejects
      .toThrow();

    // 测试 sendRequest without process
    const noProcessClient = new LspClient({
      serverCommand: 'npx',
      serverArgs: ['typescript-language-server', '--stdio'],
      workingDirectory: path.dirname(testFilePath)
    });
    // @ts-ignore - accessing private property for testing
    noProcessClient.childProcess = null;
    
    await expect(noProcessClient.sendRequest('test/method'))
      .rejects
      .toThrow('LSP process not started');
  }, 15000);
});