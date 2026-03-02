import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { chromium, Browser, Page } from "playwright";

type LoadState = "load" | "domcontentloaded" | "networkidle";

// -----------------------------------------------------------------------
// Singleton browser / page state for the lifetime of the agent process.
// -----------------------------------------------------------------------
let browser: Browser | null = null;
let page: Page | null = null;
let currentHeadless = true;

async function getPage(requestedHeadless?: boolean): Promise<Page> {
  if (requestedHeadless !== undefined && requestedHeadless !== currentHeadless) {
    if (browser) {
      // Ignore close errors – the old browser is being replaced regardless
      await browser.close().catch(() => {});
    }
    browser = null;
    page = null;
    currentHeadless = requestedHeadless;
  }
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: currentHeadless });
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage();
  }
  return page;
}

/** Shared error formatter – keeps LLM-facing messages consistent */
function formatError(toolName: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ success: false, tool: toolName, error: message }, null, 2);
}

const HTML_MAX_LENGTH = 50_000;
const TRUNCATION_MARKER = "\n<!-- [truncated] -->";
const SNAPSHOT_MAX_LENGTH = 20_000;
const SNAPSHOT_TRUNCATION_MARKER = "\n... [snapshot truncated]";

/**
 * Strip heavyweight noise from raw HTML before returning it to the LLM:
 *   – <script> and <style> blocks (often the biggest offenders)
 *   – <link rel="stylesheet"> / <link rel="preload" as="style"> tags
 *   – HTML comments
 *   – inline style="…" attributes
 *   – class="…" / class='…' attributes (CSS class names add no semantic value)
 * Then truncate to HTML_MAX_LENGTH characters so a dense page never blows
 * the context window.
 */
function sanitizeHtml(html: string, maxLength: number = HTML_MAX_LENGTH): string {
  let result = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\/?>/gi, "")
    .replace(/<link\b[^>]*\bas\s*=\s*["']style["'][^>]*\/?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+style="[^"]*"/gi, "")
    .replace(/\s+style='[^']*'/gi, "")
    .replace(/\s+class="[^"]*"/gi, "")
    .replace(/\s+class='[^']*'/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (result.length > maxLength) {
    result = result.slice(0, maxLength - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;
  }
  return result;
}

/**
 * Truncate an ARIA snapshot to stay within token budget.
 * Unlike HTML, the snapshot is plain text so we just slice at maxLength.
 */
function truncateSnapshot(snapshot: string, maxLength: number): string {
  if (snapshot.length <= maxLength) return snapshot;
  return snapshot.slice(0, maxLength - SNAPSHOT_TRUNCATION_MARKER.length) + SNAPSHOT_TRUNCATION_MARKER;
}

// -----------------------------------------------------------------------
// 1. browser_navigate
// -----------------------------------------------------------------------
export const browserNavigateTool = tool(
  async ({ url, wait_until = "networkidle", headless }) => {
    try {
      const p = await getPage(headless);
      await p.goto(url, { waitUntil: wait_until as LoadState, timeout: 30000 });
      return JSON.stringify({ success: true, url, title: await p.title() }, null, 2);
    } catch (e) {
      return formatError("browser_navigate", e);
    }
  },
  {
    name: "browser_navigate",
    description: "Navigate the browser to a URL. Waits for the network to be idle by default.",
    schema: z.object({
      url: z.string().describe("The URL to navigate to (must include http:// or https://)"),
      wait_until: z
        .enum(["load", "domcontentloaded", "networkidle", "commit"])
        .optional()
        .describe("When to consider navigation complete (default: networkidle)"),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 2. browser_screenshot
// -----------------------------------------------------------------------
export const browserScreenshotTool = tool(
  async ({ full_page = false, headless }) => {
    try {
      const p = await getPage(headless);
      const buffer = await p.screenshot({ fullPage: full_page, type: "jpeg", quality: 60 });
      const base64 = buffer.toString("base64");
      return [{ type: "image" as const, mimeType: "image/jpeg", data: base64 }];
    } catch (e) {
      return formatError("browser_screenshot", e);
    }
  },
  {
    name: "browser_screenshot",
    description:
      "Take a screenshot of the current browser page. Returns an image for visual inspection of elements.",
    schema: z.object({
      full_page: z
        .boolean()
        .optional()
        .describe("Capture the full scrollable page (default: false, captures viewport only)"),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 3. browser_get_content
// -----------------------------------------------------------------------
export const browserGetContentTool = tool(
  async ({ type = "text", max_length, headless }) => {
    try {
      const p = await getPage(headless);
      let content: string;
      if (type === "html") {
        const limit = max_length ?? HTML_MAX_LENGTH;
        content = sanitizeHtml(await p.content(), limit);
      } else {
        const raw = (await p.innerText("body")) ?? "";
        const limit = max_length ?? HTML_MAX_LENGTH;
        content = raw.length > limit ? raw.slice(0, limit - TRUNCATION_MARKER.length) + TRUNCATION_MARKER : raw;
      }
      return JSON.stringify({ success: true, type, content }, null, 2);
    } catch (e) {
      return formatError("browser_get_content", e);
    }
  },
  {
    name: "browser_get_content",
    description:
      "Get the content of the current page. Returns visible plain text by default (most compact; script and style content excluded). Use type='html' to get a sanitized HTML snapshot (script tags, style tags, stylesheet <link> tags, inline style attributes, and class attributes are all stripped, capped at 50 000 chars). For exploring interactive structure, prefer browser_snapshot instead.",
    schema: z.object({
      type: z
        .enum(["text", "html"])
        .optional()
        .describe(
          "Content type to retrieve: 'text' (default, visible plain text only – script/style content excluded) or 'html' (sanitized HTML – script/style/link tags, inline style and class attributes removed)"
        ),
      max_length: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum character length of the returned content (default: 50000). Lower values reduce token usage."),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 4. browser_click
// -----------------------------------------------------------------------
export const browserClickTool = tool(
  async ({ selector, headless }) => {
    try {
      const p = await getPage(headless);
      await p.locator(selector).click({ timeout: 10000 });
      return JSON.stringify({ success: true, selector }, null, 2);
    } catch (e) {
      return formatError("browser_click", e);
    }
  },
  {
    name: "browser_click",
    description:
      "Click an element on the page using a CSS or semantic selector. Supports role selectors (e.g. role=button[name='Submit']) and text selectors (e.g. text=Submit).",
    schema: z.object({
      selector: z
        .string()
        .describe(
          "CSS selector, role selector (role=button[name='Submit']), or text selector (text=Submit) identifying the element to click"
        ),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 5. browser_type
// -----------------------------------------------------------------------
export const browserTypeTool = tool(
  async ({ selector, text, headless }) => {
    try {
      const p = await getPage(headless);
      const locator = p.locator(selector);
      await locator.fill(text, { timeout: 10000 });
      return JSON.stringify({ success: true, selector, text }, null, 2);
    } catch (e) {
      return formatError("browser_type", e);
    }
  },
  {
    name: "browser_type",
    description:
      "Type text into an input element. Automatically clears any existing value before typing. Use for text inputs, textareas, and other editable fields.",
    schema: z.object({
      selector: z.string().describe("CSS or semantic selector identifying the input element"),
      text: z.string().describe("Text to type into the element"),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 6. browser_press
// -----------------------------------------------------------------------
export const browserPressTool = tool(
  async ({ key, headless }) => {
    try {
      const p = await getPage(headless);
      await p.keyboard.press(key);
      return JSON.stringify({ success: true, key }, null, 2);
    } catch (e) {
      return formatError("browser_press", e);
    }
  },
  {
    name: "browser_press",
    description:
      "Press a keyboard key globally (e.g. Enter, Tab, Escape, ArrowDown). Useful for form submission and keyboard navigation.",
    schema: z.object({
      key: z
        .string()
        .describe(
          "Key name to press (e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown', 'Control+a')"
        ),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 7. browser_select_option
// -----------------------------------------------------------------------
export const browserSelectOptionTool = tool(
  async ({ selector, value, headless }) => {
    try {
      const p = await getPage(headless);
      await p.locator(selector).selectOption(value, { timeout: 10000 });
      return JSON.stringify({ success: true, selector, value }, null, 2);
    } catch (e) {
      return formatError("browser_select_option", e);
    }
  },
  {
    name: "browser_select_option",
    description:
      "Select an option in a <select> dropdown element. More reliable than clicking for native dropdowns.",
    schema: z.object({
      selector: z.string().describe("CSS or semantic selector identifying the <select> element"),
      value: z.string().describe("The option value or visible text to select"),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 8. browser_hover
// -----------------------------------------------------------------------
export const browserHoverTool = tool(
  async ({ selector, headless }) => {
    try {
      const p = await getPage(headless);
      await p.locator(selector).hover({ timeout: 10000 });
      return JSON.stringify({ success: true, selector }, null, 2);
    } catch (e) {
      return formatError("browser_hover", e);
    }
  },
  {
    name: "browser_hover",
    description:
      "Hover the mouse over an element. Useful for triggering CSS hover menus, tooltips, or revealing hidden controls.",
    schema: z.object({
      selector: z.string().describe("CSS or semantic selector identifying the element to hover"),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 9. browser_wait_load
// -----------------------------------------------------------------------
export const browserWaitLoadTool = tool(
  async ({ state = "networkidle", headless }) => {
    try {
      const p = await getPage(headless);
      await p.waitForLoadState(state as LoadState, { timeout: 30000 });
      return JSON.stringify({ success: true, state }, null, 2);
    } catch (e) {
      return formatError("browser_wait_load", e);
    }
  },
  {
    name: "browser_wait_load",
    description:
      "Wait for the page to reach a specific load state. Use after navigation or actions that trigger page loads to ensure the page is fully ready.",
    schema: z.object({
      state: z
        .enum(["load", "domcontentloaded", "networkidle"])
        .optional()
        .describe("Target load state to wait for (default: networkidle)"),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 10. browser_wait_selector
// -----------------------------------------------------------------------
export const browserWaitSelectorTool = tool(
  async ({ selector, state = "visible", headless }) => {
    try {
      const p = await getPage(headless);
      await p.waitForSelector(selector, { state: state as "attached" | "detached" | "visible" | "hidden", timeout: 30000 });
      return JSON.stringify({ success: true, selector, state }, null, 2);
    } catch (e) {
      return formatError("browser_wait_selector", e);
    }
  },
  {
    name: "browser_wait_selector",
    description:
      "Wait for an element matching the selector to reach a specific state (visible, hidden, attached, or detached). Prevents TimeoutErrors by ensuring elements exist before interacting with them.",
    schema: z.object({
      selector: z.string().describe("CSS or semantic selector to wait for"),
      state: z
        .enum(["attached", "detached", "visible", "hidden"])
        .optional()
        .describe("Target element state (default: visible)"),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 11. browser_snapshot
// -----------------------------------------------------------------------
export const browserSnapshotTool = tool(
  async ({ max_length = SNAPSHOT_MAX_LENGTH, headless }) => {
    try {
      const p = await getPage(headless);
      const raw = await p.locator("body").ariaSnapshot();
      const snapshot = truncateSnapshot(raw, max_length);
      return JSON.stringify({ success: true, snapshot }, null, 2);
    } catch (e) {
      return formatError("browser_snapshot", e);
    }
  },
  {
    name: "browser_snapshot",
    description:
      "Get a compact ARIA accessibility snapshot of the current page. Returns a structured text representation of all semantic and interactive elements — far smaller than raw HTML. Prefer this over browser_get_content when you need to understand page structure or locate elements. Output is capped at 20,000 characters by default.",
    schema: z.object({
      max_length: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum character length of the returned snapshot (default: 20000). Lower values reduce token usage."),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// 12. browser_evaluate
// -----------------------------------------------------------------------

/**
 * Simple safety check: block patterns that indicate attempts to exfiltrate
 * cookies, access localStorage secrets, or execute arbitrary remote code.
 */
function isSafeScript(script: string): boolean {
  const blocked = [
    /document\.cookie/i,
    /localStorage\s*\.\s*getItem/i,
    /sessionStorage\s*\.\s*getItem/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /import\s*\(/i,
  ];
  return !blocked.some((re) => re.test(script));
}

export const browserEvaluateTool = tool(
  async ({ script, headless }) => {
    if (!isSafeScript(script)) {
      return JSON.stringify(
        {
          success: false,
          tool: "browser_evaluate",
          error:
            "Script blocked by safety policy: disallowed patterns detected (eval, fetch, cookie access, etc.)",
        },
        null,
        2
      );
    }
    try {
      const p = await getPage(headless);
      const EVAL_TIMEOUT_MS = 10000;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Script evaluation exceeded ${EVAL_TIMEOUT_MS}ms timeout`)), EVAL_TIMEOUT_MS)
      );
      const result = await Promise.race([p.evaluate(script), timeout]);
      return JSON.stringify({ success: true, result }, null, 2);
    } catch (e) {
      return formatError("browser_evaluate", e);
    }
  },
  {
    name: "browser_evaluate",
    description:
      "Execute a JavaScript expression in the page context and return the result. Use to extract complex data (e.g. all product prices) that is hard to obtain via DOM selectors. Blocked patterns: eval(), fetch(), cookie/localStorage access.",
    schema: z.object({
      script: z
        .string()
        .describe(
          "JavaScript expression or function body to evaluate in the page context (e.g. 'document.title' or '() => Array.from(document.querySelectorAll(\".price\")).map(el => el.textContent)')"
        ),
      headless: z
        .boolean()
        .optional()
        .describe("Run browser in headless mode (default: true). Set to false to show the browser window."),
    }),
  }
);

// -----------------------------------------------------------------------
// Export aggregator
// -----------------------------------------------------------------------
export default async function getPlaywrightTools() {
  return [
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
  ];
}
