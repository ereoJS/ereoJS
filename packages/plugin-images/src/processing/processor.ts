/**
 * @ereo/plugin-images - Image Processing Orchestrator
 *
 * Coordinates image processing operations using the Sharp processor.
 */

import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type {
  ImagePluginConfig,
  ProcessedImage,
  ImageOptimizationParams,
  StaticImageData,
} from '../components/types';
import { createSharpProcessor, type SharpProcessor, type ImageMetadata } from './sharp-processor';
import { generateBlurPlaceholder, type BlurPlaceholderResult } from './blur';
import { extractDominantColor, type ColorExtractionResult } from './color';
import { validateConfig } from '../config/schema';
import { SUPPORTED_INPUT_FORMATS, FORMAT_EXTENSIONS, getAllSizes } from '../config/defaults';

/**
 * Image processing result with metadata.
 */
export interface ImageProcessingResult {
  /** Processed image data */
  processed: ProcessedImage;
  /** Original metadata */
  metadata: ImageMetadata;
  /** Blur placeholder (if generated) */
  blur?: BlurPlaceholderResult;
  /** Color extraction result (if generated) */
  colors?: ColorExtractionResult;
}

/**
 * Full image data including all variants.
 */
export interface FullImageData {
  /** Static image data for component consumption */
  staticData: StaticImageData;
  /** Original file path */
  path: string;
  /** All generated variants */
  variants: Array<{
    width: number;
    height: number;
    format: string;
    path: string;
    buffer: Buffer;
  }>;
}

/**
 * Image processor orchestrator.
 */
export class ImageProcessor {
  private readonly config: Required<ImagePluginConfig>;
  private readonly sharp: SharpProcessor;
  private readonly cache = new Map<string, ProcessedImage>();

  constructor(config: ImagePluginConfig = {}) {
    this.config = validateConfig(config);
    this.sharp = createSharpProcessor({
      quality: this.config.quality,
      maxDimension: this.config.maxDimension,
    });
  }

  /**
   * Process a single image with given parameters.
   */
  async process(
    input: Buffer | string,
    params: ImageOptimizationParams
  ): Promise<ProcessedImage> {
    // Create cache key
    const cacheKey = this.getCacheKey(input, params);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Process image
    const result = await this.sharp.process(input, params);

    // Cache result
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Process an image and generate all metadata.
   */
  async processWithMetadata(
    input: Buffer | string,
    params: ImageOptimizationParams
  ): Promise<ImageProcessingResult> {
    // Get original metadata
    const metadata = await this.sharp.getMetadata(input);

    // Process the image
    const processed = await this.process(input, params);

    // Generate blur placeholder if enabled
    let blur: BlurPlaceholderResult | undefined;
    if (this.config.generateBlurPlaceholder) {
      try {
        blur = await generateBlurPlaceholder(input);
      } catch (error) {
        console.warn('Failed to generate blur placeholder:', error);
      }
    }

    // Extract dominant color if enabled
    let colors: ColorExtractionResult | undefined;
    if (this.config.extractDominantColor) {
      try {
        colors = await extractDominantColor(input);
      } catch (error) {
        console.warn('Failed to extract dominant color:', error);
      }
    }

    return {
      processed,
      metadata,
      blur,
      colors,
    };
  }

  /**
   * Process a local image file and generate all variants.
   */
  async processFile(filePath: string): Promise<FullImageData> {
    // Read the file
    const buffer = await readFile(filePath);

    // Get metadata
    const metadata = await this.sharp.getMetadata(buffer);

    // Generate blur and color data
    let blurDataURL: string | undefined;
    let dominantColor: string | undefined;

    if (this.config.generateBlurPlaceholder) {
      try {
        const blur = await generateBlurPlaceholder(buffer);
        blurDataURL = blur.dataURL;
      } catch (error) {
        console.warn(`Failed to generate blur placeholder for ${filePath}:`, error);
      }
    }

    if (this.config.extractDominantColor) {
      try {
        const colors = await extractDominantColor(buffer);
        dominantColor = colors.dominant;
      } catch (error) {
        console.warn(`Failed to extract dominant color for ${filePath}:`, error);
      }
    }

    // Determine which variants to generate
    const allSizes = getAllSizes(this.config);
    const formats = this.getEnabledFormats(metadata.hasAlpha);
    const variants: FullImageData['variants'] = [];

    // Generate variants for each size that's smaller than original
    for (const width of allSizes) {
      if (width >= metadata.width) {
        continue; // Don't upscale
      }

      for (const format of formats) {
        try {
          const processed = await this.process(buffer, {
            src: filePath,
            width,
            quality: this.config.quality,
            format,
          });

          const ext = FORMAT_EXTENSIONS[format] || `.${format}`;
          const variantPath = this.getVariantPath(filePath, width, format);

          variants.push({
            width: processed.width,
            height: processed.height,
            format,
            path: variantPath,
            buffer: processed.buffer,
          });
        } catch (error) {
          console.warn(`Failed to generate ${width}px ${format} variant:`, error);
        }
      }
    }

    // Also include original size in enabled formats
    for (const format of formats) {
      if (format !== metadata.format) {
        try {
          const processed = await this.process(buffer, {
            src: filePath,
            width: metadata.width,
            quality: this.config.quality,
            format,
          });

          const variantPath = this.getVariantPath(filePath, metadata.width, format);

          variants.push({
            width: processed.width,
            height: processed.height,
            format,
            path: variantPath,
            buffer: processed.buffer,
          });
        } catch (error) {
          console.warn(`Failed to generate original ${format} variant:`, error);
        }
      }
    }

    return {
      staticData: {
        src: filePath,
        width: metadata.width,
        height: metadata.height,
        blurDataURL,
        dominantColor,
        type: `image/${metadata.format}`,
      },
      path: filePath,
      variants,
    };
  }

  /**
   * Get image metadata without processing.
   */
  async getMetadata(input: Buffer | string): Promise<ImageMetadata> {
    return this.sharp.getMetadata(input);
  }

  /**
   * Generate blur placeholder for an image.
   */
  async generateBlur(input: Buffer | string): Promise<BlurPlaceholderResult> {
    return generateBlurPlaceholder(input);
  }

  /**
   * Extract dominant color from an image.
   */
  async extractColor(input: Buffer | string): Promise<ColorExtractionResult> {
    return extractDominantColor(input);
  }

  /**
   * Check if a file is a supported image format.
   */
  isSupported(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase().slice(1);
    return SUPPORTED_INPUT_FORMATS.includes(ext);
  }

  /**
   * Clear the processing cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get enabled output formats based on config and image type.
   */
  private getEnabledFormats(hasAlpha?: boolean): Array<'webp' | 'avif' | 'jpeg' | 'png'> {
    const formats: Array<'webp' | 'avif' | 'jpeg' | 'png'> = [];

    if (this.config.formats?.webp) {
      formats.push('webp');
    }
    if (this.config.formats?.avif) {
      formats.push('avif');
    }

    // For images with transparency, prefer PNG
    if (hasAlpha) {
      if (this.config.formats?.png) {
        formats.push('png');
      }
    } else {
      if (this.config.formats?.jpeg) {
        formats.push('jpeg');
      }
    }

    // Fallback to WebP if nothing enabled
    if (formats.length === 0) {
      formats.push('webp');
    }

    return formats;
  }

  /**
   * Generate a path for a variant file.
   */
  private getVariantPath(originalPath: string, width: number, format: string): string {
    const ext = extname(originalPath);
    const base = originalPath.slice(0, -ext.length);
    const newExt = FORMAT_EXTENSIONS[format] || `.${format}`;
    return `${base}-${width}w${newExt}`;
  }

  /**
   * Generate a cache key for a processing operation.
   */
  private getCacheKey(
    input: Buffer | string,
    params: ImageOptimizationParams
  ): string {
    const src = typeof input === 'string' ? input : 'buffer';
    const inputHash = typeof input === 'string' ? input : this.hashBuffer(input);
    return `${inputHash}:${params.width}:${params.height || ''}:${params.quality || ''}:${params.format || ''}`;
  }

  /**
   * Simple hash for buffer content.
   */
  private hashBuffer(buffer: Buffer): string {
    let hash = 0;
    for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
      hash = ((hash << 5) - hash + buffer[i]) | 0;
    }
    return hash.toString(36);
  }
}

/**
 * Create a new image processor instance.
 */
export function createImageProcessor(config?: ImagePluginConfig): ImageProcessor {
  return new ImageProcessor(config);
}
