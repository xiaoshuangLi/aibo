import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { processImageTool } from '../../src/tools/process-image';

describe('processImageTool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aibo-process-image-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Create a small valid PNG via sharp */
  async function createTestPng(name: string, width = 64, height = 64): Promise<string> {
    const filePath = path.join(tmpDir, name);
    await sharp({
      create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .png()
      .toFile(filePath);
    return filePath;
  }

  it('should have correct tool name and schema', () => {
    expect(processImageTool.name).toBe('process_image');
    expect(processImageTool.description).toContain('sharp');
    const schema = processImageTool.schema;
    expect(schema.shape.file_path).toBeDefined();
    expect(schema.shape.operations).toBeDefined();
    expect(schema.shape.metadata_only).toBeDefined();
  });

  it('should return error for non-existent image', async () => {
    const result = await processImageTool.invoke({
      file_path: '/nonexistent/image.png',
      metadata_only: true,
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/not found/i);
  });

  it('should return metadata when metadata_only is true', async () => {
    const imgPath = await createTestPng('meta.png', 64, 32);
    const result = await processImageTool.invoke({
      file_path: imgPath,
      metadata_only: true,
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.metadata.format).toBe('png');
    expect(parsed.metadata.width).toBe(64);
    expect(parsed.metadata.height).toBe(32);
  });

  it('should resize image', async () => {
    const imgPath = await createTestPng('orig.png', 64, 64);
    const outPath = path.join(tmpDir, 'resized.png');
    const result = await processImageTool.invoke({
      file_path: imgPath,
      output_path: outPath,
      operations: [{ type: 'resize', width: 32, height: 32, fit: 'fill' }],
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.info.width).toBe(32);
    expect(parsed.info.height).toBe(32);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('should convert image format', async () => {
    const imgPath = await createTestPng('source.png', 32, 32);
    const outPath = path.join(tmpDir, 'output.jpeg');
    const result = await processImageTool.invoke({
      file_path: imgPath,
      output_path: outPath,
      operations: [{ type: 'format', format: 'jpeg', quality: 80 }],
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.info.format).toBe('jpeg');
  });

  it('should apply grayscale', async () => {
    const imgPath = await createTestPng('color.png', 32, 32);
    const outPath = path.join(tmpDir, 'gray.png');
    const result = await processImageTool.invoke({
      file_path: imgPath,
      output_path: outPath,
      operations: [{ type: 'grayscale' }],
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('should rotate image 90 degrees (width/height swap)', async () => {
    const imgPath = await createTestPng('rotate.png', 64, 32);
    const outPath = path.join(tmpDir, 'rotated.png');
    const result = await processImageTool.invoke({
      file_path: imgPath,
      output_path: outPath,
      operations: [{ type: 'rotate', angle: 90 }],
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.info.width).toBe(32);
    expect(parsed.info.height).toBe(64);
  });

  it('should apply multiple operations in sequence', async () => {
    const imgPath = await createTestPng('multi.png', 128, 128);
    const outPath = path.join(tmpDir, 'multi-out.webp');
    const result = await processImageTool.invoke({
      file_path: imgPath,
      output_path: outPath,
      operations: [
        { type: 'resize', width: 64, height: 64, fit: 'fill' },
        { type: 'grayscale' },
        { type: 'format', format: 'webp', quality: 75 },
      ],
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.info.format).toBe('webp');
    expect(parsed.info.width).toBe(64);
  });

  it('should crop image', async () => {
    const imgPath = await createTestPng('crop.png', 64, 64);
    const outPath = path.join(tmpDir, 'cropped.png');
    const result = await processImageTool.invoke({
      file_path: imgPath,
      output_path: outPath,
      operations: [{ type: 'crop', left: 0, top: 0, width: 32, height: 32 }],
    });
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(true);
    expect(parsed.info.width).toBe(32);
    expect(parsed.info.height).toBe(32);
  });
});
