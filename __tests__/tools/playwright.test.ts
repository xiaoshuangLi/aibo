import getPlaywrightTools, {
  browserNavigateTool,
  browserScreenshotTool,
  browserGetContentTool,
  browserClickTool,
  browserTypeTool,
  browserPressTool,
  browserSelectOptionTool,
  browserHoverTool,
  browserWaitLoadTool,
  browserWaitSelectorTool,
  browserSnapshotTool,
  browserEvaluateTool,
} from '@/tools/playwright';
const mockKeyboard = { press: jest.fn().mockResolvedValue(undefined) };

const mockLocator = {
  click: jest.fn().mockResolvedValue(undefined),
  fill: jest.fn().mockResolvedValue(undefined),
  hover: jest.fn().mockResolvedValue(undefined),
  selectOption: jest.fn().mockResolvedValue(undefined),
  ariaSnapshot: jest.fn().mockResolvedValue('- heading "Test Page"\n- button "Submit"'),
};

const mockPage = {
  goto: jest.fn().mockResolvedValue(undefined),
  title: jest.fn().mockResolvedValue('Test Page'),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('png-data')),
  content: jest.fn().mockResolvedValue('<html><body>Hello</body></html>'),
  textContent: jest.fn().mockResolvedValue('Hello'),
  locator: jest.fn().mockReturnValue(mockLocator),
  keyboard: mockKeyboard,
  waitForLoadState: jest.fn().mockResolvedValue(undefined),
  waitForSelector: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue('result'),
  isClosed: jest.fn().mockReturnValue(false),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  isConnected: jest.fn().mockReturnValue(true),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockImplementation(() => Promise.resolve(mockBrowser)),
  },
}));

describe('getPlaywrightTools', () => {
  test('returns 12 tools', async () => {
    const tools = await getPlaywrightTools();
    expect(tools).toHaveLength(12);
  });
});

describe('browserNavigateTool', () => {
  test('has correct name and schema', () => {
    expect(browserNavigateTool.name).toBe('browser_navigate');
    expect(browserNavigateTool.description).toContain('Navigate');
    expect(browserNavigateTool.schema.shape.url).toBeDefined();
    expect(browserNavigateTool.schema.shape.wait_until).toBeDefined();
    expect(browserNavigateTool.schema.shape.headless).toBeDefined();
  });

  test('returns success on navigation', async () => {
    const result = await browserNavigateTool.invoke({ url: 'https://example.com' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.title).toBe('Test Page');
  });

  test('passes headless=false to chromium.launch when headless state changes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright');
    chromium.launch.mockClear();
    mockBrowser.close.mockClear();
    mockBrowser.isConnected.mockReturnValueOnce(false);
    await browserNavigateTool.invoke({ url: 'https://example.com', headless: false });
    expect(mockBrowser.close).toHaveBeenCalled();
    expect(chromium.launch).toHaveBeenCalledWith(expect.objectContaining({ headless: false }));
  });

  test('returns error on failure', async () => {
    
    mockPage.goto.mockRejectedValueOnce(new Error('net::ERR_NAME_NOT_RESOLVED'));
    const result = await browserNavigateTool.invoke({ url: 'https://bad-domain.invalid' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('ERR_NAME_NOT_RESOLVED');
  });
});

describe('browserScreenshotTool', () => {
  test('has correct name and schema', () => {
    expect(browserScreenshotTool.name).toBe('browser_screenshot');
    expect(browserScreenshotTool.schema.shape.full_page).toBeDefined();
    expect(browserScreenshotTool.schema.shape.headless).toBeDefined();
  });

  test('returns base64 PNG on success', async () => {
    const result = await browserScreenshotTool.invoke({ full_page: false });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.format).toBe('png');
    expect(typeof parsed.base64).toBe('string');
  });

  test('returns error on failure', async () => {
    
    mockPage.screenshot.mockRejectedValueOnce(new Error('Screenshot failed'));
    const result = await browserScreenshotTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Screenshot failed');
  });
});

describe('browserGetContentTool', () => {
  test('has correct name and schema', () => {
    expect(browserGetContentTool.name).toBe('browser_get_content');
    expect(browserGetContentTool.schema.shape.type).toBeDefined();
    expect(browserGetContentTool.schema.shape.max_length).toBeDefined();
    expect(browserGetContentTool.schema.shape.headless).toBeDefined();
  });

  test('returns plain text content by default', async () => {
    const result = await browserGetContentTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.type).toBe('text');
    expect(parsed.content).toBe('Hello');
    expect(parsed.content).not.toContain('<html>');
  });

  test('returns sanitized HTML content when type="html"', async () => {
    mockPage.content.mockResolvedValueOnce(
      '<html><head><style>body{color:red}</style><script>alert(1)</script></head><body><h1>Title</h1></body></html>'
    );
    const result = await browserGetContentTool.invoke({ type: 'html' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.type).toBe('html');
    expect(parsed.content).toContain('<h1>Title</h1>');
    expect(parsed.content).not.toContain('<script>');
    expect(parsed.content).not.toContain('<style>');
    expect(parsed.content).not.toContain('alert(1)');
    expect(parsed.content).not.toContain('color:red');
  });

  test('strips HTML comments when type="html"', async () => {
    mockPage.content.mockResolvedValueOnce('<html><body><!-- hidden secret --><p>Visible</p></body></html>');
    const result = await browserGetContentTool.invoke({ type: 'html' });
    const parsed = JSON.parse(result);
    expect(parsed.content).not.toContain('<!-- hidden secret -->');
    expect(parsed.content).toContain('<p>Visible</p>');
  });

  test('strips inline style attributes when type="html"', async () => {
    mockPage.content.mockResolvedValueOnce('<html><body><p style="color:red">Text</p></body></html>');
    const result = await browserGetContentTool.invoke({ type: 'html' });
    const parsed = JSON.parse(result);
    expect(parsed.content).not.toContain('style=');
    expect(parsed.content).toContain('<p>Text</p>');
  });

  test('truncates very long HTML when type="html"', async () => {
    const bigHtml = '<html><body>' + 'a'.repeat(60000) + '</body></html>';
    mockPage.content.mockResolvedValueOnce(bigHtml);
    const result = await browserGetContentTool.invoke({ type: 'html' });
    const parsed = JSON.parse(result);
    expect(parsed.content.length).toBeLessThanOrEqual(50000);
    expect(parsed.content).toContain('[truncated]');
  });

  test('respects custom max_length for html', async () => {
    mockPage.content.mockResolvedValueOnce('<html><body>' + 'x'.repeat(5000) + '</body></html>');
    const result = await browserGetContentTool.invoke({ type: 'html', max_length: 1000 });
    const parsed = JSON.parse(result);
    expect(parsed.content.length).toBeLessThanOrEqual(1000);
    expect(parsed.content).toContain('[truncated]');
  });

  test('truncates plain text when it exceeds max_length', async () => {
    mockPage.textContent.mockResolvedValueOnce('z'.repeat(60000));
    const result = await browserGetContentTool.invoke({ type: 'text', max_length: 1000 });
    const parsed = JSON.parse(result);
    expect(parsed.content.length).toBeLessThanOrEqual(1000);
    expect(parsed.content).toContain('[truncated]');
  });

  test('returns error on failure', async () => {
    mockPage.textContent.mockRejectedValueOnce(new Error('Page closed'));
    const result = await browserGetContentTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

describe('browserSnapshotTool', () => {
  test('has correct name and schema', () => {
    expect(browserSnapshotTool.name).toBe('browser_snapshot');
    expect(browserSnapshotTool.description).toContain('ARIA');
    expect(browserSnapshotTool.schema.shape.max_length).toBeDefined();
    expect(browserSnapshotTool.schema.shape.headless).toBeDefined();
  });

  test('returns ARIA snapshot on success', async () => {
    const result = await browserSnapshotTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.snapshot).toContain('heading');
  });

  test('truncates very long snapshot to 20000 chars by default', async () => {
    mockLocator.ariaSnapshot.mockResolvedValueOnce('x'.repeat(25000));
    const result = await browserSnapshotTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.snapshot.length).toBeLessThanOrEqual(20000);
    expect(parsed.snapshot).toContain('[snapshot truncated]');
  });

  test('respects custom max_length for snapshot', async () => {
    mockLocator.ariaSnapshot.mockResolvedValueOnce('y'.repeat(5000));
    const result = await browserSnapshotTool.invoke({ max_length: 1000 });
    const parsed = JSON.parse(result);
    expect(parsed.snapshot.length).toBeLessThanOrEqual(1000);
    expect(parsed.snapshot).toContain('[snapshot truncated]');
  });

  test('does not truncate short snapshot', async () => {
    const short = '- heading "Hello"\n- button "Submit"';
    mockLocator.ariaSnapshot.mockResolvedValueOnce(short);
    const result = await browserSnapshotTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.snapshot).toBe(short);
  });

  test('returns error on failure', async () => {
    mockLocator.ariaSnapshot.mockRejectedValueOnce(new Error('Snapshot failed'));
    const result = await browserSnapshotTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Snapshot failed');
  });
});

describe('browserClickTool', () => {
  test('has correct name and schema', () => {
    expect(browserClickTool.name).toBe('browser_click');
    expect(browserClickTool.schema.shape.selector).toBeDefined();
    expect(browserClickTool.schema.shape.headless).toBeDefined();
  });

  test('returns success on click', async () => {
    const result = await browserClickTool.invoke({ selector: 'role=button[name="Submit"]' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.selector).toBe('role=button[name="Submit"]');
  });

  test('returns error when element not found', async () => {
    
    mockLocator.click.mockRejectedValueOnce(new Error('ElementNotFound: No element matches'));
    const result = await browserClickTool.invoke({ selector: '#missing' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('ElementNotFound');
  });
});

describe('browserTypeTool', () => {
  test('has correct name and schema', () => {
    expect(browserTypeTool.name).toBe('browser_type');
    expect(browserTypeTool.schema.shape.selector).toBeDefined();
    expect(browserTypeTool.schema.shape.text).toBeDefined();
    expect(browserTypeTool.schema.shape.headless).toBeDefined();
  });

  test('returns success on type', async () => {
    const result = await browserTypeTool.invoke({ selector: '#search', text: 'hello' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.text).toBe('hello');
  });

  test('returns error on failure', async () => {
    
    mockLocator.fill.mockRejectedValueOnce(new Error('ElementNotFound'));
    const result = await browserTypeTool.invoke({ selector: '#missing', text: 'test' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

describe('browserPressTool', () => {
  test('has correct name and schema', () => {
    expect(browserPressTool.name).toBe('browser_press');
    expect(browserPressTool.schema.shape.key).toBeDefined();
    expect(browserPressTool.schema.shape.headless).toBeDefined();
  });

  test('returns success on key press', async () => {
    const result = await browserPressTool.invoke({ key: 'Enter' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.key).toBe('Enter');
  });

  test('returns error on failure', async () => {
    
    mockPage.keyboard.press.mockRejectedValueOnce(new Error('Keyboard error'));
    const result = await browserPressTool.invoke({ key: 'Enter' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

describe('browserSelectOptionTool', () => {
  test('has correct name and schema', () => {
    expect(browserSelectOptionTool.name).toBe('browser_select_option');
    expect(browserSelectOptionTool.schema.shape.selector).toBeDefined();
    expect(browserSelectOptionTool.schema.shape.value).toBeDefined();
    expect(browserSelectOptionTool.schema.shape.headless).toBeDefined();
  });

  test('returns success on select', async () => {
    const result = await browserSelectOptionTool.invoke({ selector: '#dropdown', value: 'option1' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.value).toBe('option1');
  });

  test('returns error on failure', async () => {
    
    mockLocator.selectOption.mockRejectedValueOnce(new Error('ElementNotFound'));
    const result = await browserSelectOptionTool.invoke({ selector: '#missing', value: 'val' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

describe('browserHoverTool', () => {
  test('has correct name and schema', () => {
    expect(browserHoverTool.name).toBe('browser_hover');
    expect(browserHoverTool.schema.shape.selector).toBeDefined();
    expect(browserHoverTool.schema.shape.headless).toBeDefined();
  });

  test('returns success on hover', async () => {
    const result = await browserHoverTool.invoke({ selector: '.menu-item' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.selector).toBe('.menu-item');
  });

  test('returns error on failure', async () => {
    
    mockLocator.hover.mockRejectedValueOnce(new Error('ElementNotFound'));
    const result = await browserHoverTool.invoke({ selector: '#gone' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

describe('browserWaitLoadTool', () => {
  test('has correct name and schema', () => {
    expect(browserWaitLoadTool.name).toBe('browser_wait_load');
    expect(browserWaitLoadTool.schema.shape.state).toBeDefined();
    expect(browserWaitLoadTool.schema.shape.headless).toBeDefined();
  });

  test('returns success with default state', async () => {
    const result = await browserWaitLoadTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.state).toBe('networkidle');
  });

  test('returns error on timeout', async () => {
    
    mockPage.waitForLoadState.mockRejectedValueOnce(new Error('Timeout exceeded'));
    const result = await browserWaitLoadTool.invoke({ state: 'networkidle' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});

describe('browserWaitSelectorTool', () => {
  test('has correct name and schema', () => {
    expect(browserWaitSelectorTool.name).toBe('browser_wait_selector');
    expect(browserWaitSelectorTool.schema.shape.selector).toBeDefined();
    expect(browserWaitSelectorTool.schema.shape.state).toBeDefined();
    expect(browserWaitSelectorTool.schema.shape.headless).toBeDefined();
  });

  test('returns success when element appears', async () => {
    const result = await browserWaitSelectorTool.invoke({ selector: '#content' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.state).toBe('visible');
  });

  test('returns error on timeout', async () => {
    
    mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout: #missing not found'));
    const result = await browserWaitSelectorTool.invoke({ selector: '#missing' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('#missing');
  });
});

describe('browserEvaluateTool', () => {
  test('has correct name and schema', () => {
    expect(browserEvaluateTool.name).toBe('browser_evaluate');
    expect(browserEvaluateTool.schema.shape.script).toBeDefined();
    expect(browserEvaluateTool.schema.shape.headless).toBeDefined();
  });

  test('returns evaluated result for safe scripts', async () => {
    const result = await browserEvaluateTool.invoke({ script: 'document.title' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.result).toBe('result');
  });

  test('blocks scripts with eval()', async () => {
    const result = await browserEvaluateTool.invoke({ script: 'eval("1+1")' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('blocked by safety policy');
  });

  test('blocks scripts accessing document.cookie', async () => {
    const result = await browserEvaluateTool.invoke({ script: 'document.cookie' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('blocked by safety policy');
  });

  test('blocks scripts using fetch()', async () => {
    const result = await browserEvaluateTool.invoke({ script: 'fetch("https://attacker.com")' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test('blocks localStorage.getItem', async () => {
    const result = await browserEvaluateTool.invoke({ script: 'localStorage.getItem("token")' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test('blocks Function() constructor', async () => {
    const result = await browserEvaluateTool.invoke({ script: 'new Function("return 1")()' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  test('returns error when page.evaluate throws', async () => {
    
    mockPage.evaluate.mockRejectedValueOnce(new Error('ReferenceError: undeclaredVar'));
    const result = await browserEvaluateTool.invoke({ script: 'undeclaredVar' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });
});
