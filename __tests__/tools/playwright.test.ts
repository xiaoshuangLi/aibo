import getPlaywrightTools, {
  browserNavigateTool,
  browserScreenshotTool,
  browserClickTool,
  browserTypeTool,
  browserPressKeyTool,
  browserSelectOptionTool,
  browserScrollTool,
  browserSnapshotTool,
  browserEvaluateTool,
  browserCloseTool,
} from '@/tools/playwright';
const mockKeyboard = { press: jest.fn().mockResolvedValue(undefined) };

const mockLocator = {
  click: jest.fn().mockResolvedValue(undefined),
  fill: jest.fn().mockResolvedValue(undefined),
  hover: jest.fn().mockResolvedValue(undefined),
  selectOption: jest.fn().mockResolvedValue(undefined),
  scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
  ariaSnapshot: jest.fn().mockResolvedValue('- heading "Test Page"\n- button "Submit"'),
};

const mockPage = {
  goto: jest.fn().mockResolvedValue(undefined),
  title: jest.fn().mockResolvedValue('Test Page'),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('png-data')),
  locator: jest.fn().mockReturnValue(mockLocator),
  keyboard: mockKeyboard,
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
  test('returns 10 tools', async () => {
    const tools = await getPlaywrightTools();
    expect(tools).toHaveLength(10);
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

  test('returns image content block on success', async () => {
    const result = await browserScreenshotTool.invoke({ full_page: false });
    expect(Array.isArray(result)).toBe(true);
    const block = (result as Array<{ type: string; image_url: { url: string } }>)[0];
    expect(block.type).toBe('image_url');
    expect(typeof block.image_url?.url).toBe('string');
  });

  test('uses jpeg format with quality 60', async () => {
    mockPage.screenshot.mockClear();
    await browserScreenshotTool.invoke({ full_page: false });
    expect(mockPage.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'jpeg', quality: 60 })
    );
  });

  test('returns error on failure', async () => {
    mockPage.screenshot.mockRejectedValueOnce(new Error('Screenshot failed'));
    const result = await browserScreenshotTool.invoke({});
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Screenshot failed');
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

describe('browserPressKeyTool', () => {
  test('has correct name and schema', () => {
    expect(browserPressKeyTool.name).toBe('browser_press_key');
    expect(browserPressKeyTool.schema.shape.key).toBeDefined();
    expect(browserPressKeyTool.schema.shape.headless).toBeDefined();
  });

  test('returns success on key press', async () => {
    const result = await browserPressKeyTool.invoke({ key: 'Enter' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.key).toBe('Enter');
  });

  test('returns error on failure', async () => {
    
    mockPage.keyboard.press.mockRejectedValueOnce(new Error('Keyboard error'));
    const result = await browserPressKeyTool.invoke({ key: 'Enter' });
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

describe('browserScrollTool', () => {
  test('has correct name and schema', () => {
    expect(browserScrollTool.name).toBe('browser_scroll');
    expect(browserScrollTool.schema.shape.direction).toBeDefined();
    expect(browserScrollTool.schema.shape.amount).toBeDefined();
    expect(browserScrollTool.schema.shape.selector).toBeDefined();
    expect(browserScrollTool.schema.shape.headless).toBeDefined();
  });

  test('scrolls down by default using window.scrollBy', async () => {
    mockPage.evaluate.mockResolvedValueOnce(undefined);
    const result = await browserScrollTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.direction).toBe('down');
    expect(parsed.amount).toBe(500);
    expect(mockPage.evaluate).toHaveBeenCalled();
  });

  test('scrolls up when direction is up', async () => {
    mockPage.evaluate.mockResolvedValueOnce(undefined);
    const result = await browserScrollTool.invoke({ direction: 'up', amount: 300 });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    // evaluate called with function + args { x: 0, y: -300 }
    const callArgs = mockPage.evaluate.mock.calls[mockPage.evaluate.mock.calls.length - 1];
    expect(callArgs[1]).toEqual({ x: 0, y: -300 });
  });

  test('scrolls element into view when selector provided', async () => {
    const result = await browserScrollTool.invoke({ selector: '#footer' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
  });

  test('returns error on failure', async () => {
    mockPage.evaluate.mockRejectedValueOnce(new Error('Scroll failed'));
    const result = await browserScrollTool.invoke({ direction: 'down' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Scroll failed');
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

describe('browserCloseTool', () => {
  test('has correct name', () => {
    expect(browserCloseTool.name).toBe('browser_close');
    expect(browserCloseTool.description).toContain('Close the browser');
  });

  test('closes the browser and returns success', async () => {
    mockBrowser.close.mockClear();
    const result = await browserCloseTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  test('returns success even when browser is already closed', async () => {
    // After close, browser is null, so second close should still succeed
    const result = await browserCloseTool.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });
});
