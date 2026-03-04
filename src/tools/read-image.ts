import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Detect image MIME type from buffer magic bytes.
 * Falls back to 'image/png' if format cannot be determined.
 */
export function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return "image/png";
}

/**
 * Read a local image file and return it as base64-encoded data in image_url format.
 */
export const readImageTool = tool(
  async ({ file_path }) => {
    try {
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.join(process.cwd(), file_path);

      if (!fs.existsSync(absolutePath)) {
        return JSON.stringify({
          success: false,
          error: "FILE_NOT_FOUND",
          message: `File not found: ${absolutePath}`,
        });
      }

      const stat = fs.statSync(absolutePath);
      if (stat.size > MAX_IMAGE_SIZE_BYTES) {
        return JSON.stringify({
          success: false,
          error: "FILE_TOO_LARGE",
          message: `Image file is ${(stat.size / 1024 / 1024).toFixed(1)} MB — exceeds 10 MB limit.`,
        });
      }

      const buffer = fs.readFileSync(absolutePath);
      const base64 = buffer.toString("base64");
      const mimeType = detectMimeType(buffer);

      return [{ type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${base64}` } }];
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        file_path,
      });
    }
  },
  {
    name: "read_image",
    description: `Read a local image file and return its contents as base64-encoded data.
Supports JPEG, PNG, GIF, and WebP formats. Automatically detects the image format.
Returns the image in image_url format for use with vision-capable models.
Use this to analyze or describe local image files.`,
    schema: z.object({
      file_path: z.string().describe("Path to the image file (absolute or relative to cwd)"),
    }),
  }
);

/**
 * Returns the read_image tool.
 */
export default async function getReadImageTools() {
  return [readImageTool];
}
