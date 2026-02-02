/**
 * @areo/plugin-images - Sharp-based Image Processor
 *
 * Core image processing using the Sharp library.
 */

import sharp from 'sharp';
import type { ProcessedImage, ImageOptimizationParams } from '../components/types';
import { FORMAT_MIME_TYPES, DEFAULT_QUALITY, MAX_DIMENSION } from '../config/defaults';

/**
 * Sharp processor options.
 */
export interface SharpProcessorOptions {
  /** Default quality (1-100) */
  quality?: number;
  /** Maximum dimension */
  maxDimension?: number;
  /** Enable caching */
  cache?: boolean;
}

/**
 * Image metadata from Sharp.
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  space?: string;
  channels?: number;
  depth?: string;
  density?: number;
  hasAlpha?: boolean;
  orientation?: number;
}

/**
 * Sharp-based image processor.
 */
export class SharpProcessor {
  private readonly quality: number;
  private readonly maxDimension: number;

  constructor(options: SharpProcessorOptions = {}) {
    this.quality = options.quality ?? DEFAULT_QUALITY;
    this.maxDimension = options.maxDimension ?? MAX_DIMENSION;

    // Configure sharp
    if (options.cache === false) {
      sharp.cache(false);
    }
  }

  /**
   * Process an image with the given parameters.
   */
  async process(
    input: Buffer | string,
    params: ImageOptimizationParams
  ): Promise<ProcessedImage> {
    const { width, height, quality = this.quality, format = 'auto' } = params;

    // Validate dimensions
    if (width > this.maxDimension) {
      throw new Error(`Width ${width} exceeds maximum dimension ${this.maxDimension}`);
    }
    if (height && height > this.maxDimension) {
      throw new Error(`Height ${height} exceeds maximum dimension ${this.maxDimension}`);
    }

    // Create sharp instance
    let image = sharp(input);

    // Get metadata
    const metadata = await image.metadata();

    // Resize
    const resizeOptions: sharp.ResizeOptions = {
      width,
      height: height || undefined,
      fit: 'inside',
      withoutEnlargement: true,
    };

    image = image.resize(resizeOptions);

    // Determine output format
    let outputFormat: keyof sharp.FormatEnum;
    if (format === 'auto') {
      // Use WebP as default, fallback to original format
      outputFormat = 'webp';
    } else {
      outputFormat = format as keyof sharp.FormatEnum;
    }

    // Apply format-specific options
    switch (outputFormat) {
      case 'webp':
        image = image.webp({
          quality,
          effort: 4, // Balance speed vs compression
          smartSubsample: true,
        });
        break;

      case 'avif':
        image = image.avif({
          quality,
          effort: 4,
          chromaSubsampling: '4:2:0',
        });
        break;

      case 'jpeg':
        image = image.jpeg({
          quality,
          progressive: true,
          mozjpeg: true,
        });
        break;

      case 'png':
        image = image.png({
          compressionLevel: 9,
          progressive: true,
        });
        break;

      default:
        // Fallback to original format or WebP
        image = image.webp({ quality });
        outputFormat = 'webp';
    }

    // Process the image
    const { data: buffer, info } = await image.toBuffer({ resolveWithObject: true });

    return {
      buffer,
      contentType: FORMAT_MIME_TYPES[outputFormat] || FORMAT_MIME_TYPES.webp,
      width: info.width,
      height: info.height,
      format: outputFormat,
    };
  }

  /**
   * Get image metadata without processing.
   */
  async getMetadata(input: Buffer | string): Promise<ImageMetadata> {
    const metadata = await sharp(input).metadata();

    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new Error('Unable to read image metadata');
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
    };
  }

  /**
   * Resize an image to specific dimensions.
   */
  async resize(
    input: Buffer | string,
    width: number,
    height?: number,
    options: Partial<sharp.ResizeOptions> = {}
  ): Promise<Buffer> {
    return sharp(input)
      .resize({
        width,
        height,
        fit: options.fit ?? 'inside',
        withoutEnlargement: options.withoutEnlargement ?? true,
        ...options,
      })
      .toBuffer();
  }

  /**
   * Convert image to a specific format.
   */
  async toFormat(
    input: Buffer | string,
    format: 'webp' | 'avif' | 'jpeg' | 'png',
    quality: number = this.quality
  ): Promise<Buffer> {
    let image = sharp(input);

    switch (format) {
      case 'webp':
        image = image.webp({ quality });
        break;
      case 'avif':
        image = image.avif({ quality });
        break;
      case 'jpeg':
        image = image.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        image = image.png({ compressionLevel: 9 });
        break;
    }

    return image.toBuffer();
  }

  /**
   * Check if an image has transparency.
   */
  async hasTransparency(input: Buffer | string): Promise<boolean> {
    const metadata = await sharp(input).metadata();
    return metadata.hasAlpha === true;
  }

  /**
   * Rotate image based on EXIF orientation and optionally strip metadata.
   */
  async normalize(input: Buffer | string): Promise<Buffer> {
    return sharp(input).rotate().toBuffer();
  }

  /**
   * Get dominant colors from an image.
   * This is a simple implementation - color.ts has a more sophisticated version.
   */
  async getDominantColor(input: Buffer | string): Promise<string> {
    const { dominant } = await sharp(input).stats();
    const r = Math.round(dominant.r);
    const g = Math.round(dominant.g);
    const b = Math.round(dominant.b);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Create a new Sharp processor instance.
 */
export function createSharpProcessor(options?: SharpProcessorOptions): SharpProcessor {
  return new SharpProcessor(options);
}
