import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

/**
 * Playwright browser automation tools — following claude-code best practices.
 *
 * Provides a shared browser/page singleton so that sequential tool calls
 * (navigate → click → snapshot → screenshot) all operate on the same tab.
 *
 * The browser is launched lazily on first use and can be explicitly closed
 * with the `browser_close` tool.  It is headless by default but respects the
 * PLAYWRIGHT_HEADLESS=false env var for visual debugging.
 */

// ─── Lazy singleton ────────────────────────────────────────────────────────────

let _browser: import("playwright").Browser | null = null;
let _page: import("playwright").Page | null = null;

async function getBrowser(): Promise<import("playwright").Browser> {
  if (!_browser) {
    const { chromium } = await import("playwright");
    const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
    _browser = await chromium.launch({ headless });
  }
  return _browser;
}

async function getPage(): Promise<import("playwright").Page> {
  const browser = await getBrowser();
  if (!_page || _page.isClosed()) {
    _page = await browser.newPage();
  }
  return _page;
}

/** Reset module-level singletons (used by tests). */
export function resetPlaywrightSingleton(): void {
  _browser = null;
  _page = null;
}

// ─── browser_navigate ──────────────────────────────────────────────────────────

export const browserNavigateTool = tool(
  async ({ url, timeout = 30000 }) => {
    try {
      const page = await getPage();
      await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
      return JSON.stringify({
        success: true,
        url: page.url(),
        title: await page.title(),
      }, null, 2);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error?.code || "NAVIGATION_ERROR",
        message: error?.message || String(error),
        url,
      }, null, 2);
    }
  },
  {
    name: "browser_navigate",
    description: `Navigate the browser to a URL.
Launches a headless Chromium browser if one is not already running.
Returns the final URL and page title after navigation.
Use browser_snapshot or browser_screenshot to inspect the result.`,
    schema: z.object({
      url: z.string().describe("The URL to navigate to (must be a valid HTTP/HTTPS URL or file:// URL)."),
      timeout: z.number().optional().default(30000).describe("Navigation timeout in milliseconds (default: 30000)."),
    }),
  }
);

// ─── browser_snapshot ──────────────────────────────────────────────────────────

export const browserSnapshotTool = tool(
  async () => {
    try {
      const page = await getPage();
      // Build a compact ARIA snapshot — mirrors what claude-code emits
      const snapshot = await page.locator("body").ariaSnapshot();
      return JSON.stringify({
        success: true,
        url: page.url(),
        title: await page.title(),
        snapshot,
      }, null, 2);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error?.code || "SNAPSHOT_ERROR",
        message: error?.message || String(error),
      }, null, 2);
    }
  },
  {
    name: "browser_snapshot",
    description: `Capture an accessibility snapshot of the current browser page.
Returns a structured tree of all interactive and visible elements with their roles,
labels, and states. Use this to identify selectors before calling browser_click or
browser_type. Prefer this over browser_screenshot when you only need element info.`,
    schema: z.object({}),
  }
);

// ─── browser_screenshot ────────────────────────────────────────────────────────

export const browserScreenshotTool = tool(
  async ({ output_path, full_page = false }) => {
    try {
      const page = await getPage();

      const screenshotOptions: Parameters<typeof page.screenshot>[0] = {
        fullPage: full_page,
        type: "png",
      };

      let savedPath: string | undefined;
      let base64Data: string | undefined;

      if (output_path) {
        const abs = path.isAbsolute(output_path)
          ? output_path
          : path.join(process.cwd(), output_path);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        screenshotOptions.path = abs;
        await page.screenshot(screenshotOptions);
        savedPath = abs;
      } else {
        const buffer = await page.screenshot(screenshotOptions);
        base64Data = buffer.toString("base64");
      }

      return JSON.stringify({
        success: true,
        url: page.url(),
        ...(savedPath ? { saved_path: savedPath } : { base64: base64Data }),
      }, null, 2);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error?.code || "SCREENSHOT_ERROR",
        message: error?.message || String(error),
      }, null, 2);
    }
  },
  {
    name: "browser_screenshot",
    description: `Take a screenshot of the current browser page.
When output_path is omitted the PNG image is returned as a base64 string.
When output_path is provided the image is saved to that file path instead.
Set full_page=true to capture the full scrollable page.`,
    schema: z.object({
      output_path: z.string().optional().describe("File path to save the screenshot (optional). If omitted, returns base64."),
      full_page: z.boolean().optional().default(false).describe("Capture the full scrollable page (default: false)."),
    }),
  }
);

// ─── browser_click ─────────────────────────────────────────────────────────────

export const browserClickTool = tool(
  async ({ selector, timeout = 10000 }) => {
    try {
      const page = await getPage();
      await page.click(selector, { timeout });
      return JSON.stringify({
        success: true,
        selector,
        url: page.url(),
      }, null, 2);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error?.code || "CLICK_ERROR",
        message: error?.message || String(error),
        selector,
      }, null, 2);
    }
  },
  {
    name: "browser_click",
    description: `Click an element on the current browser page.
Accepts any Playwright-compatible selector: CSS, XPath, text=, role=, data-testid=, etc.
Waits up to timeout milliseconds for the element to be visible and enabled.`,
    schema: z.object({
      selector: z.string().describe("Playwright selector for the element to click (e.g. 'button', 'text=Submit', '[data-testid=btn]')."),
      timeout: z.number().optional().default(10000).describe("Timeout in milliseconds to wait for the element (default: 10000)."),
    }),
  }
);

// ─── browser_type ──────────────────────────────────────────────────────────────

export const browserTypeTool = tool(
  async ({ selector, text, delay = 0, timeout = 10000 }) => {
    try {
      const page = await getPage();
      if (delay) {
        // Per-character typing — useful to trigger debounce/onChange listeners.
        // Clear existing value first, then type character by character.
        await page.fill(selector, "", { timeout });
        await page.type(selector, text, { delay });
      } else {
        // Atomic fill — clears and sets the value in one operation.
        await page.fill(selector, text, { timeout });
      }
      return JSON.stringify({
        success: true,
        selector,
        text,
      }, null, 2);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error?.code || "TYPE_ERROR",
        message: error?.message || String(error),
        selector,
      }, null, 2);
    }
  },
  {
    name: "browser_type",
    description: `Fill an input field or textarea on the current browser page.
Clears any existing value and sets the new text atomically.
Set delay > 0 (milliseconds between keystrokes) to trigger debounce/onChange listeners.`,
    schema: z.object({
      selector: z.string().describe("Playwright selector for the input element (e.g. 'input[name=email]', '#search')."),
      text: z.string().describe("Text to type into the element."),
      delay: z.number().optional().default(0).describe("Delay between keystrokes in milliseconds (default: 0, instant fill)."),
      timeout: z.number().optional().default(10000).describe("Timeout in milliseconds to wait for the element (default: 10000)."),
    }),
  }
);

// ─── browser_close ─────────────────────────────────────────────────────────────

export const browserCloseTool = tool(
  async () => {
    try {
      if (_page && !_page.isClosed()) {
        await _page.close();
      }
      if (_browser) {
        await _browser.close();
      }
      _page = null;
      _browser = null;
      return JSON.stringify({ success: true, message: "Browser closed." }, null, 2);
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error?.code || "CLOSE_ERROR",
        message: error?.message || String(error),
      }, null, 2);
    }
  },
  {
    name: "browser_close",
    description: `Close the browser and release all associated resources.
Call this when browser automation is complete to free memory.
Subsequent calls to other browser_ tools will launch a fresh browser instance.`,
    schema: z.object({}),
  }
);

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * Returns all Playwright browser automation tools.
 * Returns an empty array when the `playwright` package is not installed,
 * so the rest of AIBO continues to work without it.
 */
export default async function getPlaywrightTools() {
  try {
    await import("playwright");
  } catch {
    return [];
  }
  return [
    browserNavigateTool,
    browserSnapshotTool,
    browserScreenshotTool,
    browserClickTool,
    browserTypeTool,
    browserCloseTool,
  ];
}
