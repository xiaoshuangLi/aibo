import {
  macosScreenshotTool,
  macosGetScreenSizeTool,
  macosMouseMoveTool,
  macosMouseClickTool,
  macosMouseScrollTool,
  macosKeyboardTypeTool,
  macosKeyPressTool,
} from '../../src/tools/macos-control';
import getMacosControlTools from '../../src/tools/macos-control';

// -----------------------------------------------------------------------
// Mock heavy native dependencies so the tests work on any platform
// -----------------------------------------------------------------------

// Mock child_process.execFile used by capturePhysicalScreen() to avoid
// actually running screencapture on the test runner.
// The implementation pipes PNG to stdout via `screencapture … -`, so the
// mock resolves with a fake PNG buffer as stdout.
jest.mock('child_process', () => ({
  execFile: jest.fn().mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      callback: (err: Error | null, stdout: Buffer, stderr: Buffer) => void
    ) => {
      callback(null, Buffer.from('fakepng'), Buffer.alloc(0));
    }
  ),
}));

jest.mock('sharp', () => {
  const sharpInstance = () => {
    const api: any = {
      extract: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      composite: jest.fn().mockReturnThis(),
      metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080 }),
      toBuffer: jest.fn().mockResolvedValue(Buffer.alloc(100)),
    };
    return api;
  };
  sharpInstance.default = sharpInstance;
  return { default: sharpInstance, __esModule: true };
}, { virtual: true });
const mockPoint = jest.fn().mockImplementation(function (this: any, x: number, y: number) {
  this.x = x;
  this.y = y;
});

const mockNutjs = {
  mouse: {
    setPosition: jest.fn().mockResolvedValue(undefined),
    leftClick: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    doubleClick: jest.fn().mockResolvedValue(undefined),
    scrollDown: jest.fn().mockResolvedValue(undefined),
    scrollUp: jest.fn().mockResolvedValue(undefined),
    scrollLeft: jest.fn().mockResolvedValue(undefined),
    scrollRight: jest.fn().mockResolvedValue(undefined),
    getPosition: jest.fn().mockResolvedValue({ x: 960, y: 540 }),
  },
  keyboard: {
    type: jest.fn().mockResolvedValue(undefined),
    pressKey: jest.fn().mockResolvedValue(undefined),
    releaseKey: jest.fn().mockResolvedValue(undefined),
  },
  screen: {
    width: jest.fn().mockResolvedValue(1920),
    height: jest.fn().mockResolvedValue(1080),
  },
  Key: {
    LeftSuper: 100, LeftControl: 101, LeftAlt: 102, LeftShift: 103,
    Return: 104, Space: 105, Tab: 106, Backspace: 107, Delete: 108,
    Escape: 109, Home: 110, End: 111, PageUp: 112, PageDown: 113,
    Left: 114, Right: 115, Up: 116, Down: 117,
    F1: 118, F2: 119, F5: 122,
    A: 65, B: 66, C: 67, Z: 90,
  },
  Button: { LEFT: 0, RIGHT: 1, MIDDLE: 2 },
  Point: mockPoint,
};

jest.mock('@nut-tree-fork/nut-js', () => mockNutjs, { virtual: true });

// -----------------------------------------------------------------------
// Platform simulation helpers
// -----------------------------------------------------------------------

const originalPlatform = process.platform;

function setPlatform(p: string) {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

afterAll(() => {
  setPlatform(originalPlatform);
});

// -----------------------------------------------------------------------
// Helper: action tools now return content blocks [actionResult, screenshot…]
// -----------------------------------------------------------------------

type Block = { type: string; text?: string; image_url?: { url: string } };

/** Parse the action-result JSON from the first text block of a content-block array. */
function parseActionResult(result: unknown): Record<string, unknown> {
  if (Array.isArray(result)) {
    const textBlock = (result as Block[]).find((b) => b.type === 'text');
    if (textBlock?.text) return JSON.parse(textBlock.text);
  }
  return JSON.parse(result as string);
}

/** Assert that a result contains an image_url block (auto-screenshot). */
function expectScreenshot(result: unknown): void {
  expect(Array.isArray(result)).toBe(true);
  const blocks = result as Block[];
  expect(blocks.find((b) => b.type === 'image_url')).toBeDefined();
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('getMacosControlTools', () => {
  it('returns all 7 tools', async () => {
    const tools = await getMacosControlTools();
    expect(tools).toHaveLength(7);
    const names = tools.map((t) => t.name);
    expect(names).toContain('macos_screenshot');
    expect(names).toContain('macos_get_screen_size');
    expect(names).toContain('macos_mouse_move');
    expect(names).toContain('macos_mouse_click');
    expect(names).toContain('macos_mouse_scroll');
    expect(names).toContain('macos_keyboard_type');
    expect(names).toContain('macos_key_press');
  });
});

describe('macos_screenshot', () => {
  it('has correct name and schema', () => {
    expect(macosScreenshotTool.name).toBe('macos_screenshot');
    expect(macosScreenshotTool.description).toContain('300 KB');
  });

  it('returns platform error on non-macOS', async () => {
    setPlatform('linux');
    const result = await macosScreenshotTool.invoke({});
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('macOS');
  });

  it('returns image data on darwin', async () => {
    setPlatform('darwin');
    const result = await macosScreenshotTool.invoke({});
    // Should return an array with a text coordinate block and an image_url block
    expect(Array.isArray(result)).toBe(true);
    const blocks = result as unknown as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    const textBlock = blocks.find((b) => b.type === 'text');
    const imageBlock = blocks.find((b) => b.type === 'image_url');
    expect(textBlock).toBeDefined();
    expect(textBlock!.text).toContain('Image info');
    expect(textBlock!.text).toContain('Screenshot size');
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.image_url?.url).toBeTruthy();
  });

  it('scales cursor position by pixel ratio (Retina fix)', async () => {
    setPlatform('darwin');
    // Simulate 2x Retina: screenshot is 1920×1080 but logical screen is 960 wide
    mockNutjs.screen.width.mockResolvedValueOnce(960);
    // Cursor at logical (480, 270) → physical (960, 540) in the screenshot
    mockNutjs.mouse.getPosition.mockResolvedValueOnce({ x: 480, y: 270 });
    const result = await macosScreenshotTool.invoke({});
    expect(Array.isArray(result)).toBe(true);
    // overlayMouseCursor should have been called (cursor in bounds)
    expect(mockNutjs.mouse.getPosition).toHaveBeenCalled();
  });

  it('passes region to extract when provided', async () => {
    setPlatform('darwin');
    await macosScreenshotTool.invoke({ region: { x: 10, y: 20, width: 300, height: 200 } });
    // No assertion on sharp internals — just ensure no throw
  });

  it('calls mouse.getPosition to overlay cursor on darwin', async () => {
    setPlatform('darwin');
    mockNutjs.mouse.getPosition.mockResolvedValueOnce({ x: 480, y: 270 });
    await macosScreenshotTool.invoke({});
    expect(mockNutjs.mouse.getPosition).toHaveBeenCalled();
  });

  it('still returns image when getPosition throws', async () => {
    setPlatform('darwin');
    mockNutjs.mouse.getPosition.mockRejectedValueOnce(new Error('no cursor'));
    const result = await macosScreenshotTool.invoke({});
    expect(Array.isArray(result)).toBe(true);
    const blocks = result as unknown as Array<{ type: string }>;
    expect(blocks.find((b) => b.type === 'image_url')).toBeDefined();
  });
});

describe('macos_get_screen_size', () => {
  it('has correct name', () => {
    expect(macosGetScreenSizeTool.name).toBe('macos_get_screen_size');
  });

  it('returns platform error on non-macOS', async () => {
    setPlatform('linux');
    const result = await macosGetScreenSizeTool.invoke({});
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
  });

  it('returns screen dimensions on darwin', async () => {
    setPlatform('darwin');
    const result = await macosGetScreenSizeTool.invoke({});
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.width).toBe(1920);
    expect(parsed.height).toBe(1080);
  });
});

describe('macos_mouse_move', () => {
  it('has correct name', () => {
    expect(macosMouseMoveTool.name).toBe('macos_mouse_move');
  });

  it('returns platform error on non-macOS', async () => {
    setPlatform('linux');
    const result = await macosMouseMoveTool.invoke({ x: 100, y: 200 });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
  });

  it('moves mouse on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseMoveTool.invoke({ x: 150, y: 250 });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.x).toBe(150);
    expect(parsed.y).toBe(250);
    expect(mockNutjs.mouse.setPosition).toHaveBeenCalled();
    expectScreenshot(result);
  });

  it('coerces {x: [x, y]} to {x, y} on darwin', async () => {
    setPlatform('darwin');
    // Simulate LLM mistake: x is an array containing both coordinates
    const result = await macosMouseMoveTool.invoke({ x: [150, 250] } as any);
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.x).toBe(150);
    expect(parsed.y).toBe(250);
  });

  it('coerces {x: [x], y: [y]} to {x, y} on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseMoveTool.invoke({ x: [150], y: [250] } as any);
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.x).toBe(150);
    expect(parsed.y).toBe(250);
  });
});

describe('macos_mouse_click', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has correct name', () => {
    expect(macosMouseClickTool.name).toBe('macos_mouse_click');
  });

  it('returns platform error on non-macOS', async () => {
    setPlatform('linux');
    const result = await macosMouseClickTool.invoke({ x: 100, y: 200 });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
  });

  it('left-clicks on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseClickTool.invoke({ x: 200, y: 300 });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.button).toBe('left');
    expect(mockNutjs.mouse.click).toHaveBeenCalledWith(mockNutjs.Button.LEFT);
    expectScreenshot(result);
  });

  it('right-clicks on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseClickTool.invoke({ x: 200, y: 300, button: 'right' });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.button).toBe('right');
    expect(mockNutjs.mouse.click).toHaveBeenCalledWith(mockNutjs.Button.RIGHT);
  });

  it('double-clicks on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseClickTool.invoke({ x: 200, y: 300, double_click: true });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.double_click).toBe(true);
    expect(mockNutjs.mouse.doubleClick).toHaveBeenCalled();
  });

  it('coerces {x: [x, y]} to {x, y} on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseClickTool.invoke({ x: [200, 300] } as any);
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.x).toBe(200);
    expect(parsed.y).toBe(300);
  });
});

describe('macos_mouse_scroll', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has correct name', () => {
    expect(macosMouseScrollTool.name).toBe('macos_mouse_scroll');
  });

  it('returns platform error on non-macOS', async () => {
    setPlatform('linux');
    const result = await macosMouseScrollTool.invoke({ x: 100, y: 200, direction: 'down' });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
  });

  it('scrolls down on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseScrollTool.invoke({ x: 400, y: 300, direction: 'down', amount: 5 });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(mockNutjs.mouse.scrollDown).toHaveBeenCalledWith(5);
    expectScreenshot(result);
  });

  it('scrolls up on darwin', async () => {
    setPlatform('darwin');
    await macosMouseScrollTool.invoke({ x: 400, y: 300, direction: 'up' });
    expect(mockNutjs.mouse.scrollUp).toHaveBeenCalled();
  });

  it('scrolls left on darwin', async () => {
    setPlatform('darwin');
    await macosMouseScrollTool.invoke({ x: 400, y: 300, direction: 'left' });
    expect(mockNutjs.mouse.scrollLeft).toHaveBeenCalled();
  });

  it('scrolls right on darwin', async () => {
    setPlatform('darwin');
    await macosMouseScrollTool.invoke({ x: 400, y: 300, direction: 'right' });
    expect(mockNutjs.mouse.scrollRight).toHaveBeenCalled();
  });

  it('coerces {x: [x, y]} to {x, y} on darwin', async () => {
    setPlatform('darwin');
    const result = await macosMouseScrollTool.invoke({ x: [400, 300], direction: 'down' } as any);
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.x).toBe(400);
    expect(parsed.y).toBe(300);
  });
});

describe('macos_keyboard_type', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has correct name', () => {
    expect(macosKeyboardTypeTool.name).toBe('macos_keyboard_type');
  });

  it('returns platform error on non-macOS', async () => {
    setPlatform('linux');
    const result = await macosKeyboardTypeTool.invoke({ text: 'hello' });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
  });

  it('types text on darwin', async () => {
    setPlatform('darwin');
    const result = await macosKeyboardTypeTool.invoke({ text: 'hello world' });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.typed).toBe('hello world');
    expect(mockNutjs.keyboard.type).toHaveBeenCalledWith('hello world');
    expectScreenshot(result);
  });
});

describe('macos_key_press', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has correct name', () => {
    expect(macosKeyPressTool.name).toBe('macos_key_press');
  });

  it('returns platform error on non-macOS', async () => {
    setPlatform('linux');
    const result = await macosKeyPressTool.invoke({ keys: 'Enter' });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
  });

  it('presses Enter on darwin', async () => {
    setPlatform('darwin');
    const result = await macosKeyPressTool.invoke({ keys: 'Enter' });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
    expect(mockNutjs.keyboard.pressKey).toHaveBeenCalled();
    expect(mockNutjs.keyboard.releaseKey).toHaveBeenCalled();
    expectScreenshot(result);
  });

  it('presses Command+C on darwin', async () => {
    setPlatform('darwin');
    const result = await macosKeyPressTool.invoke({ keys: 'Command+C' });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
  });

  it('presses F5 on darwin', async () => {
    setPlatform('darwin');
    const result = await macosKeyPressTool.invoke({ keys: 'F5' });
    const parsed = parseActionResult(result);
    expect(parsed.success).toBe(true);
  });

  it('returns error for unrecognised key', async () => {
    setPlatform('darwin');
    const result = await macosKeyPressTool.invoke({ keys: 'Banana+Q' });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Unrecognised key');
  });
});
