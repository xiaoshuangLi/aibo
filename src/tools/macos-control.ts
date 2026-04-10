import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------

const TARGET_SIZE_BYTES = 300 * 1024; // 300 KB
const JPEG_QUALITY_INITIAL = 75;
const JPEG_QUALITY_STEP = 10;
const JPEG_QUALITY_MIN = 20;

// -----------------------------------------------------------------------
// Platform guard
// -----------------------------------------------------------------------

function requireMacos(): string | null {
  if (process.platform !== "darwin") {
    return "This tool only works on macOS (darwin). Current platform: " + process.platform;
  }
  return null;
}

// -----------------------------------------------------------------------
// Lazy imports – avoid hard failures on non-macOS systems
// -----------------------------------------------------------------------

async function loadScreenshot(): Promise<(opts?: { format?: string }) => Promise<Buffer>> {
  const mod = await import("screenshot-desktop");
  return (mod.default ?? mod) as (opts?: { format?: string }) => Promise<Buffer>;
}

async function loadSharp() {
  const mod = await import("sharp");
  return mod.default as typeof import("sharp");
}

async function loadNutjs() {
  return import("@nut-tree-fork/nut-js");
}

// -----------------------------------------------------------------------
// Screenshot helpers
// -----------------------------------------------------------------------

/**
 * Result returned by compressImage, including the compressed buffer and the
 * final image dimensions after any optional resize.
 *
 * When targetWidth/targetHeight are provided the image is resized to those
 * dimensions so that image pixel coordinates map 1:1 to logical screen
 * coordinates — no scale factor is required by the caller.
 */
interface CompressResult {
  compressed: Buffer;
  /** Width of the output image in pixels */
  imgWidth: number;
  /** Height of the output image in pixels */
  imgHeight: number;
}

async function compressImage(
  buffer: Buffer,
  targetWidth?: number,
  targetHeight?: number,
): Promise<CompressResult> {
  const sharp = await loadSharp();

  // Step 1: resize to target dimensions if provided (e.g. logical screen size
  // on a Retina display so that image coords == logical screen coords).
  let source: Buffer = buffer;
  if (targetWidth && targetHeight) {
    source = await sharp(buffer)
      .resize(targetWidth, targetHeight, { fit: "fill" })
      .toBuffer();
  }

  // Step 2: read output dimensions
  const meta = await sharp(source).metadata();
  const imgWidth = meta.width ?? 0;
  const imgHeight = meta.height ?? 0;

  // Step 3: compress to JPEG, iterating quality until under TARGET_SIZE_BYTES
  let quality = JPEG_QUALITY_INITIAL;
  let result = await sharp(source)
    .jpeg({ quality })
    .toBuffer();

  while (result.length > TARGET_SIZE_BYTES && quality > JPEG_QUALITY_MIN) {
    quality -= JPEG_QUALITY_STEP;
    result = await sharp(source)
      .jpeg({ quality })
      .toBuffer();
  }

  return { compressed: result, imgWidth, imgHeight };
}

/**
 * Composite a realistic arrow cursor indicator onto a JPEG image buffer.
 *
 * @param imageBuffer - JPEG image to overlay the cursor on
 * @param cx          - Cursor x in image pixel coordinates (== logical screen_x
 *                      because the image is pre-resized to logical dimensions).
 *                      Values outside [0, imgWidth) are silently clamped.
 * @param cy          - Cursor y in image pixel coordinates. Same space as cx.
 * @param imgWidth    - Width of the image in pixels (used for bounds clamping)
 * @param imgHeight   - Height of the image in pixels (used for bounds clamping)
 * @returns New JPEG buffer with the cursor arrow drawn with its tip at (cx, cy)
 */
async function overlayMouseCursor(
  imageBuffer: Buffer,
  cx: number,
  cy: number,
  imgWidth: number,
  imgHeight: number,
): Promise<Buffer> {
  const sharp = await loadSharp();

  // Realistic macOS-style arrow cursor.
  // The tip of the arrow is at (2, 2) within the SVG, so we offset the SVG
  // placement by (-2, -2) so the tip lands exactly on (cx, cy) in the image.
  const svgWidth = 18;
  const svgHeight = 22;
  const tipX = 2;
  const tipY = 2;

  // Arrow path: tip at (2,2), body extends down-right, with a tail notch.
  //   Tip → left edge down → inner notch → tail bottom-right → tail top-right
  //   → inner upper notch → right shoulder → back to tip
  const svg = [
    `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`,
    `<path d="M 2 2 L 2 18 L 6 14 L 9 20.5 L 11.5 19.5 L 8.5 13 L 14 13 Z"`,
    `  fill="white" stroke="black" stroke-width="1.5"`,
    `  stroke-linejoin="round" stroke-linecap="round"/>`,
    `</svg>`,
  ].join('');

  const left = Math.max(0, Math.min(imgWidth - svgWidth, cx - tipX));
  const top = Math.max(0, Math.min(imgHeight - svgHeight, cy - tipY));

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: 'over', left, top }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

// -----------------------------------------------------------------------
// Coordinate coercion helpers
// -----------------------------------------------------------------------

/**
 * Preprocess tool input to fix the common LLM mistake of passing
 * `{ x: [xVal, yVal] }` instead of `{ x: xVal, y: yVal }`.
 *
 * Handles:
 *  - `{ x: [100, 200] }` → `{ x: 100, y: 200 }`  (y extracted from array)
 *  - `{ x: [100], y: [200] }` → `{ x: 100, y: 200 }` (both wrapped in array)
 *  - `{ x: 100, y: 200 }` → unchanged
 */
function coerceXY(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const obj = input as Record<string, unknown>;

  // Helper: convert a value to a number; returns undefined if the result is NaN
  const toNum = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Case 1: x is an array containing both coordinates, y is missing
  if (Array.isArray(obj.x) && obj.x.length >= 2 && (obj.y === undefined || obj.y === null)) {
    const nx = toNum(obj.x[0]);
    const ny = toNum(obj.x[1]);
    if (nx !== undefined && ny !== undefined) {
      return { ...obj, x: nx, y: ny };
    }
  }

  // Case 2: x and/or y are individually wrapped in arrays
  const result: Record<string, unknown> = { ...obj };
  if (Array.isArray(obj.x)) {
    const nx = toNum(obj.x[0]);
    if (nx !== undefined) result.x = nx;
  }
  if (Array.isArray(obj.y)) {
    const ny = toNum(obj.y[0]);
    if (ny !== undefined) result.y = ny;
  }
  return result;
}

// -----------------------------------------------------------------------
// Key name parser for nut-js
// -----------------------------------------------------------------------

/**
 * Parse a human-readable key string (e.g. "Command+C", "Shift+Enter") into
 * nut-js Key enum values.  Returns null if any key is unrecognised.
 */
async function parseKeys(keyString: string): Promise<number[] | null> {
  const { Key } = await loadNutjs();

  const aliases: Record<string, keyof typeof Key> = {
    // Modifiers
    command: "LeftSuper",
    cmd: "LeftSuper",
    ctrl: "LeftControl",
    control: "LeftControl",
    alt: "LeftAlt",
    option: "LeftAlt",
    shift: "LeftShift",
    win: "LeftSuper",
    super: "LeftSuper",
    // Special
    enter: "Return",
    return: "Return",
    space: "Space",
    tab: "Tab",
    backspace: "Backspace",
    delete: "Delete",
    escape: "Escape",
    esc: "Escape",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    left: "Left",
    right: "Right",
    up: "Up",
    down: "Down",
  };

  const parts = keyString
    .split("+")
    .map((k) => k.trim().toLowerCase());

  const result: number[] = [];

  for (const part of parts) {
    const alias = aliases[part];
    if (alias) {
      result.push(Key[alias] as unknown as number);
      continue;
    }

    // Function keys: f1-f24
    const fnMatch = part.match(/^f(\d+)$/);
    if (fnMatch) {
      const fnKey = `F${fnMatch[1]}` as keyof typeof Key;
      if (Key[fnKey] !== undefined) {
        result.push(Key[fnKey] as unknown as number);
        continue;
      }
    }

    // Single character: A-Z, 0-9
    const upper = part.toUpperCase();
    if (Key[upper as keyof typeof Key] !== undefined) {
      result.push(Key[upper as keyof typeof Key] as unknown as number);
      continue;
    }

    return null; // unrecognised key
  }

  return result;
}

// -----------------------------------------------------------------------
// Tools
// -----------------------------------------------------------------------

/**
 * 1. macos_screenshot
 */
export const macosScreenshotTool = tool(
  async ({ save_path }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const screenshot = await loadScreenshot();
      const raw = await screenshot({ format: "png" });

      // Retrieve logical screen dimensions from nut-js.
      // On a 2× Retina display screenshot-desktop captures at physical
      // resolution (e.g. 2880×1800) while nut-js uses logical pixels
      // (e.g. 1440×900).  By resizing the image to logical dimensions we
      // ensure image pixel coordinates equal logical screen coordinates
      // directly — no scale factor is needed.
      let logicalScreenWidth: number | undefined;
      let logicalScreenHeight: number | undefined;
      try {
        const { screen } = await loadNutjs();
        const lw = await screen.width();
        const lh = await screen.height();
        if (lw > 0 && lh > 0) {
          logicalScreenWidth = lw;
          logicalScreenHeight = lh;
        }
      } catch {
        // Ignore; will use physical dimensions
      }

      const { compressed, imgWidth, imgHeight } = await compressImage(
        raw as Buffer,
        logicalScreenWidth,
        logicalScreenHeight,
      );

      if (save_path) {
        const absPath = path.isAbsolute(save_path)
          ? save_path
          : path.join(process.cwd(), save_path);
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, compressed);
        return JSON.stringify({
          success: true,
          saved_to: absPath,
          size_kb: Math.round(compressed.length / 1024),
        });
      }

      // The image has been resized to logical screen dimensions, so every
      // pixel in the image corresponds directly to one logical screen pixel.
      // screen_x == image_x and screen_y == image_y — no scaling needed.
      const screenW = imgWidth;
      const screenH = imgHeight;

      const coordNote =
        `[Coordinate system] This is a full-screen screenshot resized to the logical screen resolution: ${screenW}×${screenH} px. ` +
        `IMPORTANT: image pixel coordinates map 1-to-1 to screen coordinates. ` +
        `screen_x = image_x, screen_y = image_y — do NOT apply any scale factor. ` +
        `The top-left corner of the screen is (0, 0). The bottom-right corner is (${screenW - 1}, ${screenH - 1}). ` +
        `To find the coordinates of a UI element, locate it visually in the image and read its pixel position directly.`;

      // Overlay the current mouse cursor position as a realistic arrow cursor
      // so that the LLM can use it as a visual reference when adjusting coordinates.
      let finalImage = compressed;
      try {
        const { mouse: nutMouse } = await loadNutjs();
        const cursorPos = await nutMouse.getPosition();
        // Image is at logical resolution, so cursor logical coords == image coords.
        const cursorImgX = Math.round(cursorPos.x);
        const cursorImgY = Math.round(cursorPos.y);
        if (cursorImgX >= 0 && cursorImgX < imgWidth && cursorImgY >= 0 && cursorImgY < imgHeight) {
          finalImage = await overlayMouseCursor(compressed, cursorImgX, cursorImgY, imgWidth, imgHeight);
        }
      } catch (cursorErr) {
        // If cursor position is unavailable (e.g. nut-js not installed), return
        // the plain screenshot without the overlay.
        console.debug('macos_screenshot: cursor overlay skipped:', cursorErr instanceof Error ? cursorErr.message : cursorErr);
      }

      const base64 = finalImage.toString("base64");

      return [
        { type: "text" as const, text: coordNote },
        { type: "image_url" as const, image_url: { url: base64 } },
      ] as unknown as string;
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_screenshot",
    description: `Capture a full-screen screenshot of the macOS display and return it as a compressed JPEG image (≤300 KB).
The image is automatically resized to match the logical screen resolution so that image pixel coordinates equal screen coordinates directly.
Optionally saves the screenshot to a file path.
Returns the image as base64-encoded data for visual analysis by the model.
Only works on macOS.`,
    schema: z.object({
      save_path: z
        .string()
        .optional()
        .describe("Optional file path to save the screenshot to (e.g. '/tmp/screen.jpg'). When provided, returns save location instead of image data."),
    }),
  }
);

/**
 * 2. macos_get_screen_size
 */
export const macosGetScreenSizeTool = tool(
  async () => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const { screen } = await loadNutjs();
      const width = await screen.width();
      const height = await screen.height();
      return JSON.stringify({ success: true, width, height });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_get_screen_size",
    description: "Get the current logical screen dimensions (width and height in pixels) on macOS. The screenshot image is resized to these dimensions, so image coordinates equal screen coordinates directly.",
    schema: z.object({}),
  }
);

/**
 * 3. macos_mouse_move
 */
export const macosMouseMoveTool = tool(
  async ({ x, y }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const { mouse, Point } = await loadNutjs();
      await mouse.setPosition(new Point(x, y));
      return JSON.stringify({ success: true, x, y });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_mouse_move",
    description: "Move the mouse cursor to the specified screen coordinates (x, y) on macOS. IMPORTANT: x and y must each be a plain number (e.g. x: 100, y: 200). Do NOT pass an array for x or y.",
    schema: z.preprocess(coerceXY, z.object({
      x: z.number().describe("Horizontal screen coordinate in pixels. Must be a single number, NOT an array."),
      y: z.number().describe("Vertical screen coordinate in pixels. Must be a single number, NOT an array."),
    })) as any,
  }
);

/**
 * 4. macos_mouse_click
 */
export const macosMouseClickTool = tool(
  async ({ x, y, button = "left", double_click = false }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const { mouse, Point, Button } = await loadNutjs();

      await mouse.setPosition(new Point(x, y));

      const btn =
        button === "right"
          ? Button.RIGHT
          : button === "middle"
          ? Button.MIDDLE
          : Button.LEFT;

      if (double_click) {
        await mouse.doubleClick(btn);
      } else {
        await mouse.click(btn);
      }

      return JSON.stringify({ success: true, x, y, button, double_click });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_mouse_click",
    description: "Simulate a mouse click at the specified screen coordinates on macOS. Supports left, right, and middle buttons, as well as double-click. IMPORTANT: x and y must each be a plain number (e.g. x: 100, y: 200). Do NOT pass an array for x or y.",
    schema: z.preprocess(coerceXY, z.object({
      x: z.number().describe("Horizontal screen coordinate in pixels. Must be a single number, NOT an array."),
      y: z.number().describe("Vertical screen coordinate in pixels. Must be a single number, NOT an array."),
      button: z
        .enum(["left", "right", "middle"])
        .optional()
        .describe("Mouse button to click (default: 'left')"),
      double_click: z
        .boolean()
        .optional()
        .describe("Whether to perform a double-click (default: false)"),
    })) as any,
  }
);

/**
 * 5. macos_mouse_scroll
 */
export const macosMouseScrollTool = tool(
  async ({ x, y, direction, amount = 3 }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const { mouse, Point } = await loadNutjs();

      await mouse.setPosition(new Point(x, y));

      if (direction === "down") {
        await mouse.scrollDown(amount);
      } else if (direction === "up") {
        await mouse.scrollUp(amount);
      } else if (direction === "left") {
        await mouse.scrollLeft(amount);
      } else {
        await mouse.scrollRight(amount);
      }

      return JSON.stringify({ success: true, x, y, direction, amount });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_mouse_scroll",
    description: "Simulate mouse wheel scrolling at the specified screen coordinates on macOS. IMPORTANT: x and y must each be a plain number (e.g. x: 100, y: 200). Do NOT pass an array for x or y.",
    schema: z.preprocess(coerceXY, z.object({
      x: z.number().describe("Horizontal screen coordinate in pixels. Must be a single number, NOT an array."),
      y: z.number().describe("Vertical screen coordinate in pixels. Must be a single number, NOT an array."),
      direction: z
        .enum(["up", "down", "left", "right"])
        .describe("Scroll direction"),
      amount: z
        .number()
        .optional()
        .describe("Number of scroll steps (default: 3)"),
    })) as any,
  }
);

/**
 * 6. macos_keyboard_type
 */
export const macosKeyboardTypeTool = tool(
  async ({ text }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const { keyboard } = await loadNutjs();
      await keyboard.type(text);
      return JSON.stringify({ success: true, typed: text });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_keyboard_type",
    description: "Type a string of text using the keyboard on macOS. Simulates real keystrokes character by character. Use this to fill text fields.",
    schema: z.object({
      text: z.string().describe("The text to type"),
    }),
  }
);

/**
 * 7. macos_key_press
 */
export const macosKeyPressTool = tool(
  async ({ keys }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const { keyboard } = await loadNutjs();
      const keyValues = await parseKeys(keys);

      if (!keyValues) {
        return JSON.stringify({
          success: false,
          error: `Unrecognised key in: "${keys}". Use names like Command, Shift, Ctrl, Alt, Enter, Space, Tab, Escape, A-Z, F1-F24, etc.`,
        });
      }

      await keyboard.pressKey(...(keyValues as [number, ...number[]]));
      await keyboard.releaseKey(...(keyValues as [number, ...number[]]));

      return JSON.stringify({ success: true, keys });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_key_press",
    description: `Simulate pressing a key or key combination on macOS.
Supported modifier names: Command (Cmd), Ctrl (Control), Alt (Option), Shift.
Supported special keys: Enter, Space, Tab, Backspace, Delete, Escape, Home, End, PageUp, PageDown, Left, Right, Up, Down, F1-F24.
Supported regular keys: A-Z, 0-9.
Use '+' to combine keys (e.g. "Command+C", "Shift+Enter", "Command+Shift+4").`,
    schema: z.object({
      keys: z
        .string()
        .describe("Key or key combination to press (e.g. 'Command+C', 'Enter', 'Shift+Tab', 'F5')"),
    }),
  }
);

// -----------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------

export default async function getMacosControlTools() {
  return [
    macosScreenshotTool,
    macosGetScreenSizeTool,
    macosMouseMoveTool,
    macosMouseClickTool,
    macosMouseScrollTool,
    macosKeyboardTypeTool,
    macosKeyPressTool,
  ];
}
