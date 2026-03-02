import {
  browserNavigateTool,
  browserSnapshotTool,
  browserScreenshotTool,
  browserClickTool,
  browserTypeTool,
  browserCloseTool,
  resetPlaywrightSingleton,
} from '../../src/tools/playwright';
import getPlaywrightTools from '../../src/tools/playwright';

// ─── Mock playwright ──────────────────────────────────────────────────────────

const mockScreenshot = jest.fn();
const mockTitle = jest.fn();
const mockUrl = jest.fn();
const mockGoto = jest.fn();
const mockClick = jest.fn();
const mockFill = jest.fn();
const mockType = jest.fn();
const mockIsClosed = jest.fn();
const mockPageClose = jest.fn();
const mockAriaSnapshot = jest.fn();
const mockNewPage = jest.fn();
const mockBrowserClose = jest.fn();

const mockBodyLocator = { ariaSnapshot: mockAriaSnapshot };

const mockPage = {
  goto: mockGoto,
  title: mockTitle,
  url: mockUrl,
  screenshot: mockScreenshot,
  click: mockClick,
  fill: mockFill,
  type: mockType,
  isClosed: mockIsClosed,
  close: mockPageClose,
  locator: jest.fn().mockReturnValue(mockBodyLocator),
};

const mockBrowser = {
  newPage: mockNewPage,
  close: mockBrowserClose,
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetPlaywrightSingleton();

  mockNewPage.mockResolvedValue(mockPage);
  mockIsClosed.mockReturnValue(false);
  mockUrl.mockReturnValue('https://example.com');
  mockTitle.mockResolvedValue('Example Domain');
  mockGoto.mockResolvedValue(null);
  mockScreenshot.mockResolvedValue(Buffer.from('fake-png'));
  mockClick.mockResolvedValue(null);
  mockFill.mockResolvedValue(null);
  mockType.mockResolvedValue(null);
  mockAriaSnapshot.mockResolvedValue('- heading "Example Domain" [level=1]');
  mockPageClose.mockResolvedValue(null);
  mockBrowserClose.mockResolvedValue(null);
});

// ─── Tool schema tests ────────────────────────────────────────────────────────

describe('Playwright tool schemas', () => {
  test('browserNavigateTool has correct name and schema', () => {
    expect(browserNavigateTool.name).toBe('browser_navigate');
    expect(browserNavigateTool.description).toContain('Navigate');
    expect(browserNavigateTool.schema.shape.url).toBeDefined();
    expect(browserNavigateTool.schema.shape.timeout).toBeDefined();
  });

  test('browserSnapshotTool has correct name', () => {
    expect(browserSnapshotTool.name).toBe('browser_snapshot');
    expect(browserSnapshotTool.description).toContain('accessibility');
  });

  test('browserScreenshotTool has correct name and schema', () => {
    expect(browserScreenshotTool.name).toBe('browser_screenshot');
    expect(browserScreenshotTool.schema.shape.output_path).toBeDefined();
    expect(browserScreenshotTool.schema.shape.full_page).toBeDefined();
  });

  test('browserClickTool has correct name and schema', () => {
    expect(browserClickTool.name).toBe('browser_click');
    expect(browserClickTool.schema.shape.selector).toBeDefined();
    expect(browserClickTool.schema.shape.timeout).toBeDefined();
  });

  test('browserTypeTool has correct name and schema', () => {
    expect(browserTypeTool.name).toBe('browser_type');
    expect(browserTypeTool.schema.shape.selector).toBeDefined();
    expect(browserTypeTool.schema.shape.text).toBeDefined();
    expect(browserTypeTool.schema.shape.delay).toBeDefined();
  });

  test('browserCloseTool has correct name', () => {
    expect(browserCloseTool.name).toBe('browser_close');
    expect(browserCloseTool.description).toContain('Close');
  });
});

// ─── browser_navigate ─────────────────────────────────────────────────────────

describe('browserNavigateTool', () => {
  test('navigates and returns url and title', async () => {
    const result = await browserNavigateTool.invoke({ url: 'https://example.com' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.title).toBe('Example Domain');
    expect(mockGoto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ timeout: 30000 }));
  });

  test('uses custom timeout', async () => {
    await browserNavigateTool.invoke({ url: 'https://example.com', timeout: 5000 });
    expect(mockGoto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ timeout: 5000 }));
  });

  test('returns error on navigation failure', async () => {
    mockGoto.mockRejectedValueOnce(Object.assign(new Error('net::ERR_NAME_NOT_RESOLVED'), { code: 'ERR_NAME_NOT_RESOLVED' }));
    const result = await browserNavigateTool.invoke({ url: 'https://bad-domain.invalid' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('ERR_NAME_NOT_RESOLVED');
  });
});

// ─── browser_snapshot ────────────────────────────────────────────────────────

describe('browserSnapshotTool', () => {
  test('returns accessibility snapshot', async () => {
    const result = await browserSnapshotTool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.snapshot).toBeDefined();
    expect(mockAriaSnapshot).toHaveBeenCalled();
  });

  test('returns error when snapshot fails', async () => {
    mockAriaSnapshot.mockRejectedValueOnce(new Error('Snapshot failed'));
    const result = await browserSnapshotTool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('Snapshot failed');
  });
});

// ─── browser_screenshot ──────────────────────────────────────────────────────

describe('browserScreenshotTool', () => {
  test('returns base64 when no output_path given', async () => {
    const result = await browserScreenshotTool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.base64).toBeDefined();
    expect(parsed.saved_path).toBeUndefined();
  });

  test('returns error when screenshot fails', async () => {
    mockScreenshot.mockRejectedValueOnce(new Error('Screenshot error'));
    const result = await browserScreenshotTool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('Screenshot error');
  });

  test('passes full_page option', async () => {
    await browserScreenshotTool.invoke({ full_page: true });
    expect(mockScreenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: true }));
  });
});

// ─── browser_click ───────────────────────────────────────────────────────────

describe('browserClickTool', () => {
  test('clicks element and returns success', async () => {
    const result = await browserClickTool.invoke({ selector: 'button' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.selector).toBe('button');
    expect(mockClick).toHaveBeenCalledWith('button', expect.objectContaining({ timeout: 10000 }));
  });

  test('returns error when click fails', async () => {
    mockClick.mockRejectedValueOnce(new Error('Element not found'));
    const result = await browserClickTool.invoke({ selector: '#missing' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('Element not found');
  });
});

// ─── browser_type ────────────────────────────────────────────────────────────

describe('browserTypeTool', () => {
  test('fills input and returns success', async () => {
    const result = await browserTypeTool.invoke({ selector: '#email', text: 'test@example.com' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.selector).toBe('#email');
    expect(parsed.text).toBe('test@example.com');
    expect(mockFill).toHaveBeenCalledWith('#email', 'test@example.com', expect.objectContaining({ timeout: 10000 }));
  });

  test('returns error when fill fails', async () => {
    mockFill.mockRejectedValueOnce(new Error('Input not found'));
    const result = await browserTypeTool.invoke({ selector: '#missing', text: 'hello' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('Input not found');
  });
});

// ─── browser_close ───────────────────────────────────────────────────────────

describe('browserCloseTool', () => {
  test('closes browser and returns success', async () => {
    // First, trigger browser/page creation
    await browserNavigateTool.invoke({ url: 'https://example.com' });

    const result = await browserCloseTool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockBrowserClose).toHaveBeenCalled();
  });

  test('succeeds gracefully when nothing is open', async () => {
    const result = await browserCloseTool.invoke({});
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
  });
});

// ─── getPlaywrightTools ──────────────────────────────────────────────────────

describe('getPlaywrightTools', () => {
  test('returns array of tools when playwright is available', async () => {
    const tools = await getPlaywrightTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('browser_navigate');
    expect(names).toContain('browser_snapshot');
    expect(names).toContain('browser_screenshot');
    expect(names).toContain('browser_click');
    expect(names).toContain('browser_type');
    expect(names).toContain('browser_close');
  });
});
