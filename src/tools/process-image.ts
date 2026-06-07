import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

/**
 * 图像处理工具模块
 *
 * 使用 sharp — npm 上最受欢迎的高性能 Node.js 图像处理库，提供图像处理能力。
 * 图像文字识别（OCR）已集成到截图工具（macos_screenshot）中，截图后自动执行。
 */

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * 解析图像文件的绝对路径，并校验文件存在及大小。
 */
function resolveImagePath(file_path: string): {
  absolutePath: string;
  error?: string;
} {
  const absolutePath = path.isAbsolute(file_path)
    ? file_path
    : path.join(process.cwd(), file_path);

  if (!fs.existsSync(absolutePath)) {
    return { absolutePath, error: `File not found: ${absolutePath}` };
  }

  const stat = fs.statSync(absolutePath);
  if (stat.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      absolutePath,
      error: `Image file is ${(stat.size / 1024 / 1024).toFixed(1)} MB — exceeds 20 MB limit.`,
    };
  }

  return { absolutePath };
}

/**
 * 图像处理工具（基于 sharp）
 *
 * 预期行为：
 * - 对本地图像进行尺寸调整、裁剪、旋转、翻转、格式转换、压缩等操作
 * - 支持获取图像元数据（尺寸、格式、色彩空间等）
 * - 处理结果保存到指定输出路径，若未指定则覆盖原文件
 *
 * 行为分支：
 * 1. metadata_only=true：仅返回图像元数据，不做修改
 * 2. 指定操作：按 operations 列表依次应用处理
 * 3. 文件不存在：返回错误信息
 */
export const processImageTool = tool(
  async ({ file_path, output_path, operations, metadata_only }) => {
    try {
      const { absolutePath, error } = resolveImagePath(file_path);
      if (error) {
        return JSON.stringify({ success: false, error, file_path });
      }

      const img = sharp(absolutePath);
      const meta = await img.metadata();

      if (metadata_only) {
        return JSON.stringify({
          success: true,
          metadata: {
            format: meta.format,
            width: meta.width,
            height: meta.height,
            channels: meta.channels,
            space: meta.space,
            hasAlpha: meta.hasAlpha,
            size: fs.statSync(absolutePath).size,
          },
        });
      }

      let pipeline = sharp(absolutePath);

      for (const op of operations ?? []) {
        switch (op.type) {
          case "resize":
            pipeline = pipeline.resize({
              width: op.width,
              height: op.height,
              fit: (op.fit as keyof sharp.FitEnum) ?? "cover",
            });
            break;
          case "crop":
            pipeline = pipeline.extract({
              left: op.left ?? 0,
              top: op.top ?? 0,
              width: op.width ?? (meta.width ?? 0),
              height: op.height ?? (meta.height ?? 0),
            });
            break;
          case "rotate":
            pipeline = pipeline.rotate(op.angle ?? 0);
            break;
          case "flip":
            pipeline = pipeline.flip();
            break;
          case "flop":
            pipeline = pipeline.flop();
            break;
          case "grayscale":
            pipeline = pipeline.grayscale();
            break;
          case "blur":
            pipeline = pipeline.blur(op.sigma ?? 1);
            break;
          case "sharpen":
            pipeline = pipeline.sharpen();
            break;
          case "format":
            pipeline = pipeline.toFormat(
              op.format as keyof sharp.FormatEnum,
              op.quality !== undefined ? { quality: op.quality } : undefined
            );
            break;
        }
      }

      const destPath = output_path
        ? path.isAbsolute(output_path)
          ? output_path
          : path.join(process.cwd(), output_path)
        : absolutePath;

      const info = await pipeline.toFile(destPath);

      return JSON.stringify({
        success: true,
        output_path: destPath,
        info: {
          format: info.format,
          width: info.width,
          height: info.height,
          size: info.size,
        },
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        file_path,
      });
    }
  },
  {
    name: "process_image",
    description: `Process a local image using sharp — the most popular high-performance Node.js image processing library.
Supports resizing, cropping, rotating, flipping, grayscaling, blurring, sharpening, format conversion, and metadata inspection.
Use metadata_only:true to inspect image dimensions, format, and color space without modifying the file.
Set output_path to save the result to a new file; omit it to overwrite the source.`,
    schema: z.object({
      file_path: z
        .string()
        .describe("Path to the input image file (absolute or relative to cwd)"),
      output_path: z
        .string()
        .optional()
        .describe(
          "Path to save the output image. Defaults to overwriting the source file."
        ),
      metadata_only: z
        .boolean()
        .optional()
        .default(false)
        .describe("When true, returns image metadata without any processing."),
      operations: z
        .array(
          z.discriminatedUnion("type", [
            z.object({
              type: z.literal("resize"),
              width: z.number().int().positive().optional(),
              height: z.number().int().positive().optional(),
              fit: z
                .enum(["cover", "contain", "fill", "inside", "outside"])
                .optional(),
            }),
            z.object({
              type: z.literal("crop"),
              left: z.number().int().min(0).optional(),
              top: z.number().int().min(0).optional(),
              width: z.number().int().positive().optional(),
              height: z.number().int().positive().optional(),
            }),
            z.object({
              type: z.literal("rotate"),
              angle: z.number().optional(),
            }),
            z.object({ type: z.literal("flip") }),
            z.object({ type: z.literal("flop") }),
            z.object({ type: z.literal("grayscale") }),
            z.object({
              type: z.literal("blur"),
              sigma: z.number().min(0.3).max(1000).optional(),
            }),
            z.object({ type: z.literal("sharpen") }),
            z.object({
              type: z.literal("format"),
              format: z.enum(["jpeg", "png", "webp", "avif", "gif", "tiff"]),
              quality: z.number().int().min(1).max(100).optional(),
            }),
          ])
        )
        .optional()
        .describe("List of image operations to apply in sequence."),
    }),
  }
);

/**
 * 获取图像处理工具列表
 */
export default async function getProcessImageTools() {
  return [processImageTool];
}
