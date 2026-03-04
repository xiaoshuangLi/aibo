import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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

      return [{ type: "image_url" as const, image_url: { url: base64 } }];
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
