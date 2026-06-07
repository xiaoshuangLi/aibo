import { execFile } from "child_process";
import { promisify } from "util";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createWorker } from "tesseract.js";

// Promisified execFile — used to run osascript for retrieving window information.
const execFileAsync = promisify(execFile);

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

// Memoised OpenCV handle – WASM init only runs once per process.
let _cvReady: Promise<any> | null = null;

async function loadOpenCV(): Promise<any> {
  if (!_cvReady) {
    _cvReady = (async () => {
      const mod = await import("@techstark/opencv-js");
      const cv = (mod.default ?? mod) as any;
      if (!cv.Mat) {
        await new Promise<void>((resolve) => {
          cv.onRuntimeInitialized = resolve;
        });
      }
      return cv;
    })();
  }
  return _cvReady;
}

// -----------------------------------------------------------------------
// Screenshot helpers
// -----------------------------------------------------------------------

/**
 * Result returned by compressImage, including the compressed buffer and the
 * source image dimensions.
 *
 * The image dimensions are preserved (no resize) — only JPEG quality is
 * reduced, so image coordinates map 1:1 to the captured pixel coordinates.
 */
interface CompressResult {
  compressed: Buffer;
  /** Width of the source image in pixels */
  srcWidth: number;
  /** Height of the source image in pixels */
  srcHeight: number;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function compressImage(
  buffer: Buffer,
  region?: { x: number; y: number; width: number; height: number }
): Promise<CompressResult> {
  const sharp = await loadSharp();

  // Step 1: crop to region if requested
  let source: Buffer = buffer;
  if (region) {
    source = await sharp(buffer)
      .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
      .toBuffer();
  }

  // Step 2: read source dimensions (preserved in output — no resize)
  const meta = await sharp(source).metadata();
  const srcWidth = meta.width ?? 0;
  const srcHeight = meta.height ?? 0;

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

  return { compressed: result, srcWidth, srcHeight };
}

/**
 * Composite a realistic arrow cursor indicator onto a JPEG image buffer.
 *
 * @param imageBuffer - JPEG image to overlay the cursor on
 * @param cx          - Cursor x position in image pixel coordinates (0 = left edge).
 *                      Values outside [0, imgWidth) are silently clamped to the edge.
 * @param cy          - Cursor y position in image pixel coordinates (0 = top edge).
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

/**
 * Capture a screenshot and return LangChain content blocks (text info +
 * image).  Handles HiDPI/Retina displays by resizing the raw screenshot from
 * physical pixel dimensions down to logical (point) dimensions so that image
 * pixel coordinates correspond 1:1 to the logical coordinates expected by all
 * mouse tools.
 *
 * @param region  - Optional crop region in **logical** screen pixels.
 */
async function captureScreenBlocks(
  region?: { x: number; y: number; width: number; height: number }
): Promise<ContentBlock[]> {
  const screenshot = await loadScreenshot();
  const raw = await screenshot({ format: "png" });
  const sharp = await loadSharp();

  // Determine the HiDPI pixel ratio and current cursor position.
  // On a 2x Retina display screenshot-desktop returns physical pixels but
  // nut-js reports logical (point) coordinates.  We resize the screenshot down
  // to logical dimensions so image pixel coordinates equal mouse coordinates.
  let cursorPos: { x: number; y: number } | null = null;
  let processedRaw = raw as Buffer;
  try {
    const nutjs = await loadNutjs();
    const [logicalWidth, pos] = await Promise.all([
      nutjs.screen.width(),
      nutjs.mouse.getPosition(),
    ]);
    const rawMeta = await sharp(raw as Buffer).metadata();
    const physicalWidth = rawMeta.width ?? 0;
    const physicalHeight = rawMeta.height ?? 0;
    if (logicalWidth > 0 && physicalWidth > 0) {
      const pixelRatio = physicalWidth / logicalWidth;
      if (pixelRatio !== 1 && physicalHeight > 0) {
        const logicalWidth = Math.round(physicalWidth / pixelRatio);
        const logicalHeight = Math.round(physicalHeight / pixelRatio);
        processedRaw = await sharp(raw as Buffer)
          .resize(logicalWidth, logicalHeight)
          .toBuffer();
      }
    }
    cursorPos = pos;
  } catch {
    // nut-js unavailable – fall back to original buffer, skip cursor overlay
  }

  // processedRaw is now at logical pixel dimensions; use the region as-is.
  const { compressed, srcWidth, srcHeight } = await compressImage(
    processedRaw,
    region
  );

  const imgWidth = srcWidth;
  const imgHeight = srcHeight;

  const coordNote =
    `[Image info] Screenshot size: ${imgWidth}×${imgHeight} px. ` +
    `Image pixel coordinates correspond directly to mouse tool coordinates.`;

  let finalImage = compressed;
  if (cursorPos !== null) {
    try {
      const originX = region ? region.x : 0;
      const originY = region ? region.y : 0;
      // processedRaw is at logical dimensions, so cursor logical coords map
      // directly to image pixel coordinates.
      const cursorImgX = Math.round(cursorPos.x - originX);
      const cursorImgY = Math.round(cursorPos.y - originY);
      if (
        cursorImgX >= 0 &&
        cursorImgX < imgWidth &&
        cursorImgY >= 0 &&
        cursorImgY < imgHeight
      ) {
        finalImage = await overlayMouseCursor(
          compressed,
          cursorImgX,
          cursorImgY,
          imgWidth,
          imgHeight
        );
      }
    } catch (cursorErr) {
      console.debug(
        "macos_screenshot: cursor overlay skipped:",
        cursorErr instanceof Error ? cursorErr.message : cursorErr
      );
    }
  }

  // OCR: automatically extract text from the screenshot using tesseract.js
  // Run on the pre-annotation image for cleaner recognition.
  let ocrNote = "";
  try {
    const worker = await createWorker("eng");
    try {
      const { data } = await worker.recognize(finalImage);
      const ocrText = data.text.trim();
      if (ocrText) {
        ocrNote = `[OCR text] ${ocrText}`;
      }
    } finally {
      await worker.terminate();
    }
  } catch {
    // OCR is best-effort; never block the screenshot result
  }

  // Annotation: overlay colour-coded window-bounds rectangles using osascript
  // and sharp's SVG compositing — a cross-platform image-processing pipeline.
  try {
    const windows = await getWindowsFromOsascript();
    if (windows.length > 0 && imgWidth > 0 && imgHeight > 0) {
      const svgOverlay = buildWindowAnnotationSVG(imgWidth, imgHeight, windows, region);
      let overlaid = await sharp(finalImage)
        .composite([{ input: svgOverlay, blend: "over" }])
        .jpeg({ quality: 85 })
        .toBuffer();
      // Re-compress if the overlay pushed the size over the target
      let q = 70;
      while (overlaid.length > TARGET_SIZE_BYTES && q > 20) {
        overlaid = await sharp(overlaid).jpeg({ quality: q }).toBuffer();
        q -= 10;
      }
      finalImage = overlaid;
    }
  } catch {
    // Annotation is best-effort; never block the screenshot result
  }

  const base64 = finalImage.toString("base64");

  const blocks: ContentBlock[] = [
    { type: "text", text: coordNote },
    { type: "image_url", image_url: { url: base64 } },
  ];
  if (ocrNote) {
    blocks.push({ type: "text", text: ocrNote });
  }
  return blocks;
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
// Annotate-screenshot helpers  (osascript-based window detection)
// -----------------------------------------------------------------------

interface WindowInfo {
  app: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Use osascript to retrieve the bounds of all visible windows on screen.
 * Returns an array of WindowInfo objects in screen-coordinate space.
 */
async function getWindowsFromOsascript(): Promise<WindowInfo[]> {
  const script = [
    'set output to ""',
    'tell application "System Events"',
    '  repeat with proc in (every process whose visible is true)',
    '    set appName to name of proc',
    '    try',
    '      repeat with win in (every window of proc)',
    '        set {posX, posY} to position of win',
    '        set {sizeW, sizeH} to size of win',
    '        set output to output & appName & tab & (name of win) & tab & posX & tab & posY & tab & sizeW & tab & sizeH & linefeed',
    '      end repeat',
    '    end try',
    '  end repeat',
    'end tell',
    'return output',
  ].join('\n');

  const { stdout } = await execFileAsync('osascript', ['-e', script], {});

  const windows: WindowInfo[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('\t');
    // Last 4 fields are always integers: x, y, width, height.
    // Treat everything between the first field and the last 4 as the title
    // so that tab characters inside a window title are handled gracefully.
    if (parts.length < 6) continue;
    const app = parts[0];
    const hStr = parts[parts.length - 1];
    const wStr = parts[parts.length - 2];
    const yStr = parts[parts.length - 3];
    const xStr = parts[parts.length - 4];
    const title = parts.slice(1, parts.length - 4).join('\t');
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);
    const width = parseInt(wStr, 10);
    const height = parseInt(hStr, 10);
    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) continue;
    windows.push({ app, title, x, y, width, height });
  }

  return windows;
}

// -----------------------------------------------------------------------
// Shape detection helpers (OpenCV.js-based, pure Node.js)
// -----------------------------------------------------------------------

interface ShapeInfo {
  type: 'rectangle' | 'rounded-rectangle' | 'circle' | 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detect geometric shapes (rectangles, rounded rectangles, circles, ellipses)
 * in an image buffer using OpenCV.js.  Returns at most 40 shapes, sorted by
 * descending area so the most prominent ones appear first.
 *
 * @param imageBuffer - JPEG/PNG image buffer at the final display resolution.
 * @param imgWidth    - Image width in pixels.
 * @param imgHeight   - Image height in pixels.
 */
async function detectShapes(
  imageBuffer: Buffer,
  imgWidth: number,
  imgHeight: number,
): Promise<ShapeInfo[]> {
  const cv = await loadOpenCV();
  const sharp = await loadSharp();

  // Convert to raw RGBA so we can hand it to OpenCV
  const rawBuf = await sharp(imageBuffer).ensureAlpha().raw().toBuffer();

  const src = cv.matFromImageData({
    data: new Uint8ClampedArray(rawBuf),
    width: imgWidth,
    height: imgHeight,
  });
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  const shapes: ShapeInfo[] = [];

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.findContours(
      edges, contours, hierarchy,
      cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE,
    );

    // Ignore shapes smaller than 0.05 % or larger than 90 % of the screen area.
    const screenArea = imgWidth * imgHeight;
    const minArea = Math.max(400, screenArea * 0.0005);
    const maxArea = screenArea * 0.9;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      try {
        const area = cv.contourArea(contour);
        if (area < minArea || area > maxArea) continue;

        const peri = cv.arcLength(contour, true);
        if (peri === 0) continue;

        const approx = new cv.Mat();
        try {
          cv.approxPolyDP(contour, approx, 0.04 * peri, true);
          const vertices = approx.rows;
          const rect = cv.boundingRect(contour);
          const circularity = (4 * Math.PI * area) / (peri * peri);

          let shapeType: ShapeInfo['type'];
          if (circularity > 0.75) {
            // Near-circular contour → circle or ellipse
            const ar = rect.width / (rect.height || 1);
            shapeType = ar > 0.8 && ar < 1.25 ? 'circle' : 'ellipse';
          } else if (vertices === 4) {
            shapeType = 'rectangle';
          } else if (vertices > 4 && vertices <= 16) {
            shapeType = 'rounded-rectangle';
          } else {
            continue; // Skip triangles, complex polygons, etc.
          }

          shapes.push({ type: shapeType, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        } finally {
          approx.delete();
        }
      } finally {
        contour.delete();
      }
    }
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }

  // Largest shapes first; limit to 40 to keep the overlay readable
  shapes.sort((a, b) => b.width * b.height - a.width * a.height);
  return shapes.slice(0, 40);
}

/**
 * Build an SVG overlay that draws colour-coded outlines around detected
 * geometric shapes.
 */
function buildShapeAnnotationSVG(
  imgWidth: number,
  imgHeight: number,
  shapes: ShapeInfo[],
): Buffer {
  const COLOR: Record<ShapeInfo['type'], string> = {
    'rectangle': '#00bcd4',
    'rounded-rectangle': '#4caf50',
    'circle': '#ff9800',
    'ellipse': '#9c27b0',
  };

  let svgElements = '';
  for (const shape of shapes) {
    const color = COLOR[shape.type];
    if (shape.type === 'circle' || shape.type === 'ellipse') {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const rx = shape.width / 2;
      const ry = shape.height / 2;
      svgElements += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="2" opacity="0.85"/>`;
    } else if (shape.type === 'rounded-rectangle') {
      const r = Math.round(Math.min(shape.width, shape.height) * 0.15);
      svgElements += `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${r}" ry="${r}" fill="none" stroke="${color}" stroke-width="2" opacity="0.85"/>`;
    } else {
      svgElements += `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="none" stroke="${color}" stroke-width="2" opacity="0.85"/>`;
    }
  }

  const svg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
  return Buffer.from(svg);
}

/**
 * Build an SVG overlay that draws colour-coded rectangles around each window
 * with an app name / title label.
 *
 * Window coordinates are in screen space; `region` (if provided) defines the
 * crop offset so that window positions are translated into image-pixel space.
 */
function buildWindowAnnotationSVG(
  imgWidth: number,
  imgHeight: number,
  windows: WindowInfo[],
  region?: { x: number; y: number; width: number; height: number },
): Buffer {
  const PALETTE = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
  ];
  const FONT_SIZE = 12;
  const LABEL_PAD = 4;
  const LABEL_HEIGHT = FONT_SIZE + LABEL_PAD * 2;
  const CHAR_WIDTH = 7;
  const originX = region ? region.x : 0;
  const originY = region ? region.y : 0;

  const escXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let svgElements = '';

  for (let i = 0; i < windows.length; i++) {
    const win = windows[i];
    const color = PALETTE[i % PALETTE.length];

    // Translate screen coordinates to image-pixel coordinates
    const ix = win.x - originX;
    const iy = win.y - originY;
    const iw = win.width;
    const ih = win.height;

    // Skip windows entirely outside the image bounds
    if (ix + iw <= 0 || iy + ih <= 0 || ix >= imgWidth || iy >= imgHeight) continue;

    // Clamp rect to image bounds
    const cx = Math.max(0, ix);
    const cy = Math.max(0, iy);
    const cw = Math.min(iw, imgWidth - cx);
    const ch = Math.min(ih, imgHeight - cy);

    // Window outline
    svgElements += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="10,5" opacity="0.9"/>`;

    // Label: app name + window title
    const rawLabel = `[${i + 1}] ${win.app} — ${win.title}`;
    const maxChars = Math.floor((imgWidth - cx) / CHAR_WIDTH);
    const label = rawLabel.length > maxChars
      ? rawLabel.slice(0, Math.max(6, maxChars - 1)) + '…'
      : rawLabel;
    const labelW = label.length * CHAR_WIDTH + LABEL_PAD * 2;
    const labelAbove = cy >= LABEL_HEIGHT;
    const labelBgY = labelAbove ? cy - LABEL_HEIGHT : Math.min(cy + ch, imgHeight - LABEL_HEIGHT);
    const labelTxtY = labelBgY + FONT_SIZE + LABEL_PAD - 2;
    const labelX = Math.max(0, Math.min(cx, imgWidth - labelW));

    svgElements +=
      `<rect x="${labelX}" y="${labelBgY}" width="${labelW}" height="${LABEL_HEIGHT}" fill="${color}" opacity="0.85" rx="3"/>` +
      `<text x="${labelX + LABEL_PAD}" y="${labelTxtY}" font-family="monospace" font-size="${FONT_SIZE}" fill="white" font-weight="bold">${escXml(label)}</text>`;
  }

  const svg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
  return Buffer.from(svg);
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
  async ({ region }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      const blocks = await captureScreenBlocks(region);
      return blocks as unknown as string;
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "macos_screenshot",
    description: `Capture a screenshot of the macOS screen and return it as a compressed JPEG image (≤300 KB).
Supports full-screen capture or a specific region (x, y, width, height in **logical** screen pixels, matching the coordinate space used by all mouse tools).
Returns the image as base64-encoded data for visual analysis by the model. The current cursor position is overlaid as an arrow indicator.
Only works on macOS.`,
    schema: z.object({
      region: z
        .object({
          x: z.number().describe("Left edge of the capture region in screen pixels"),
          y: z.number().describe("Top edge of the capture region in screen pixels"),
          width: z.number().describe("Width of the capture region in screen pixels"),
          height: z.number().describe("Height of the capture region in screen pixels"),
        })
        .optional()
        .describe("Optional region to capture. Omit to capture the full screen."),
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
    description: "Get the current screen dimensions (width and height in pixels) on macOS. Use this before taking region screenshots or calculating click coordinates.",
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
      const actionResult = JSON.stringify({ success: true, x, y });
      const screenshotBlocks = await captureScreenBlocks();
      return [
        { type: "text" as const, text: actionResult },
        ...screenshotBlocks,
      ] as unknown as string;
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

      const actionResult = JSON.stringify({ success: true, x, y, button, double_click });
      const screenshotBlocks = await captureScreenBlocks();
      return [
        { type: "text" as const, text: actionResult },
        ...screenshotBlocks,
      ] as unknown as string;
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

      const actionResult = JSON.stringify({ success: true, x, y, direction, amount });
      const screenshotBlocks = await captureScreenBlocks();
      return [
        { type: "text" as const, text: actionResult },
        ...screenshotBlocks,
      ] as unknown as string;
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
      const actionResult = JSON.stringify({ success: true, typed: text });
      const screenshotBlocks = await captureScreenBlocks();
      return [
        { type: "text" as const, text: actionResult },
        ...screenshotBlocks,
      ] as unknown as string;
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

      const actionResult = JSON.stringify({ success: true, keys });
      const screenshotBlocks = await captureScreenBlocks();
      return [
        { type: "text" as const, text: actionResult },
        ...screenshotBlocks,
      ] as unknown as string;
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

/**
 * 8. macos_annotate_screenshot
 *
 * Takes a screenshot using the Node.js-based `screenshot-desktop` package,
 * then annotates the image with:
 *   • Colour-coded outlines of all visible windows (via osascript)
 *   • Geometric shape detection (rectangles, rounded rectangles, circles,
 *     ellipses) using OpenCV.js – a pure Node.js WASM build of OpenCV.
 */
export const macosAnnotateScreenshotTool = tool(
  async ({ region }) => {
    const platformError = requireMacos();
    if (platformError) return JSON.stringify({ success: false, error: platformError });

    try {
      // ── 1. Capture raw screenshot via Node.js (screenshot-desktop) ──────
      const screenshot = await loadScreenshot();
      const raw = await screenshot({ format: "png" });
      const sharp = await loadSharp();

      // HiDPI: resize to logical dimensions so coordinates match mouse tools
      let processedRaw = raw as Buffer;
      try {
        const nutjs = await loadNutjs();
        const logicalWidth = await nutjs.screen.width();
        const rawMeta = await sharp(raw as Buffer).metadata();
        const physicalWidth = rawMeta.width ?? 0;
        const physicalHeight = rawMeta.height ?? 0;
        if (logicalWidth > 0 && physicalWidth > 0) {
          const pixelRatio = physicalWidth / logicalWidth;
          if (pixelRatio !== 1 && physicalHeight > 0) {
            const lw = Math.round(physicalWidth / pixelRatio);
            const lh = Math.round(physicalHeight / pixelRatio);
            processedRaw = await sharp(raw as Buffer).resize(lw, lh).toBuffer();
          }
        }
      } catch {
        // nut-js unavailable – fall back to original buffer
      }

      const { compressed, srcWidth, srcHeight } = await compressImage(processedRaw, region);

      // ── 2. Detect geometric shapes via OpenCV.js (Node.js WASM) ─────────
      let shapes: ShapeInfo[] = [];
      try {
        shapes = await detectShapes(compressed, srcWidth, srcHeight);
      } catch {
        // Shape detection is best-effort; never block the screenshot result
      }

      // ── 3. Get window list from osascript ────────────────────────────────
      let windows: WindowInfo[] = [];
      try {
        windows = await getWindowsFromOsascript();
      } catch {
        // osascript failed – still return an unannotated image
      }

      // ── 4. Composite all annotation overlays onto the image ──────────────
      let finalImage = compressed;
      if (srcWidth > 0 && srcHeight > 0) {
        try {
          const compositeInputs: Parameters<ReturnType<typeof sharp>['composite']>[0] = [];

          if (windows.length > 0) {
            const windowSvg = buildWindowAnnotationSVG(srcWidth, srcHeight, windows, region);
            compositeInputs.push({ input: windowSvg, blend: "over" });
          }

          if (shapes.length > 0) {
            const shapeSvg = buildShapeAnnotationSVG(srcWidth, srcHeight, shapes);
            compositeInputs.push({ input: shapeSvg, blend: "over" });
          }

          if (compositeInputs.length > 0) {
            let overlaid = await sharp(compressed)
              .composite(compositeInputs)
              .jpeg({ quality: 85 })
              .toBuffer();
            // Re-compress if the overlay pushed the size over the target
            let q = 70;
            while (overlaid.length > TARGET_SIZE_BYTES && q > 20) {
              overlaid = await sharp(overlaid).jpeg({ quality: q }).toBuffer();
              q -= 10;
            }
            finalImage = overlaid;
          }
        } catch {
          // overlay failed – fall back to unmodified compressed image
        }
      }

      // ── 5. Build text summary ────────────────────────────────────────────
      const base64 = finalImage.toString("base64");

      const shapeSummary = shapes.length > 0
        ? `\nDetected ${shapes.length} geometric shape(s):\n` +
          shapes
            .map((s, i) => `  [Shape ${i + 1}] ${s.type} x=${s.x}, y=${s.y}, w=${s.width}, h=${s.height}`)
            .join("\n")
        : "";

      const coordNote =
        `[Annotated Screenshot] Size: ${srcWidth}×${srcHeight} px. ` +
        `Detected ${windows.length} window(s):\n` +
        windows
          .map((w, i) => `  [${i + 1}] ${w.app} — "${w.title}" x=${w.x}, y=${w.y}, w=${w.width}, h=${w.height}`)
          .join("\n") +
        shapeSummary;

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
    name: "macos_annotate_screenshot",
    description: `Capture a screenshot using a Node.js-based approach and annotate it with colour-coded outlines showing:
• All visible windows and their coordinates (via osascript)
• Detected geometric shapes — rectangles, rounded rectangles, circles, and ellipses (via OpenCV.js)
Use this to understand the current screen layout and identify UI elements before using mouse tool coordinates. Only works on macOS.`,
    schema: z.object({
      region: z
        .object({
          x: z.number().describe("Left edge of the capture region in screen pixels"),
          y: z.number().describe("Top edge of the capture region in screen pixels"),
          width: z.number().describe("Width of the capture region in screen pixels"),
          height: z.number().describe("Height of the capture region in screen pixels"),
        })
        .optional()
        .describe("Optional region to capture. Omit to capture the full screen."),
    }),
  }
);

export default async function getMacosControlTools() {
  return [
    macosAnnotateScreenshotTool,
    macosGetScreenSizeTool,
    macosMouseMoveTool,
    macosMouseClickTool,
    macosMouseScrollTool,
    macosKeyboardTypeTool,
    macosKeyPressTool,
  ];
}
