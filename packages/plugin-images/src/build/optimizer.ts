/**
 * @ereo/plugin-images - Build-time Image Optimizer
 *
 * Scans and processes images during the build phase.
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join, relative, dirname, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { ImagePluginConfig, ImageManifestEntry, ImageVariant } from '../components/types';
import { createImageProcessor, type ImageProcessor } from '../processing/processor';
import { createManifestManager, type ImageManifestManager } from './manifest';
import { validateConfig } from '../config/schema';
import { SUPPORTED_INPUT_FORMATS, getAllSizes } from '../config/defaults';

/**
 * Build optimizer options.
 */
export interface BuildOptimizerOptions {
  /** Project root directory */
  root: string;
  /** Output directory for optimized images */
  outDir: string;
  /** Plugin configuration */
  config?: ImagePluginConfig;
  /** Directories to scan for images */
  scanDirs?: string[];
  /** Whether to force reprocessing all images */
  force?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number, file: string) => void;
}

/**
 * Build result statistics.
 */
export interface BuildResult {
  /** Number of images processed */
  processed: number;
  /** Number of images skipped (unchanged) */
  skipped: number;
  /** Total variants generated */
  variants: number;
  /** Total output size in bytes */
  totalSize: number;
  /** Processing time in milliseconds */
  duration: number;
  /** Any errors encountered */
  errors: Array<{ file: string; error: string }>;
}

/**
 * Build-time image optimizer.
 */
export class BuildOptimizer {
  private readonly config: Required<ImagePluginConfig>;
  private readonly processor: ImageProcessor;
  private readonly manifest: ImageManifestManager;
  private readonly root: string;
  private readonly outDir: string;
  private readonly scanDirs: string[];
  private readonly force: boolean;
  private readonly onProgress?: (current: number, total: number, file: string) => void;

  constructor(options: BuildOptimizerOptions) {
    this.config = validateConfig(options.config);
    this.processor = createImageProcessor(options.config);
    this.manifest = createManifestManager(options.outDir);
    this.root = options.root;
    this.outDir = options.outDir;
    this.scanDirs = options.scanDirs || ['public', 'app/assets', 'assets'];
    this.force = options.force || false;
    this.onProgress = options.onProgress;
  }

  /**
   * Run the build optimization.
   */
  async run(): Promise<BuildResult> {
    const startTime = Date.now();
    const result: BuildResult = {
      processed: 0,
      skipped: 0,
      variants: 0,
      totalSize: 0,
      duration: 0,
      errors: [],
    };

    // Load existing manifest
    await this.manifest.load();

    // Scan for images
    const imageFiles = await this.scanForImages();
    const totalFiles = imageFiles.length;

    console.log(`Found ${totalFiles} images to process`);

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const relativePath = relative(this.root, file);

      this.onProgress?.(i + 1, totalFiles, relativePath);

      try {
        // Check if reprocessing is needed
        const fileBuffer = await readFile(file);
        const fileHash = this.hashBuffer(fileBuffer);

        if (!this.force && !this.manifest.needsReprocessing(relativePath, fileHash)) {
          result.skipped++;
          continue;
        }

        // Process the image
        const entry = await this.processImage(file, fileBuffer, relativePath);

        // Update manifest
        this.manifest.addImage(relativePath, {
          ...entry,
          src: relativePath,
        });

        result.processed++;
        result.variants += entry.variants.length;
        result.totalSize += entry.variants.reduce((sum, v) => sum + v.size, 0);
      } catch (error) {
        result.errors.push({
          file: relativePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Save manifest
    await this.manifest.save();

    result.duration = Date.now() - startTime;

    return result;
  }

  /**
   * Process a single image file.
   */
  private async processImage(
    filePath: string,
    buffer: Buffer,
    relativePath: string
  ): Promise<Omit<ImageManifestEntry, 'hash'>> {
    // Get metadata
    const metadata = await this.processor.getMetadata(buffer);

    // Generate blur placeholder
    let blurDataURL: string | undefined;
    if (this.config.generateBlurPlaceholder) {
      try {
        const blur = await this.processor.generateBlur(buffer);
        blurDataURL = blur.dataURL;
      } catch {
        // Ignore blur generation errors
      }
    }

    // Extract dominant color
    let dominantColor: string | undefined;
    if (this.config.extractDominantColor) {
      try {
        const colors = await this.processor.extractColor(buffer);
        dominantColor = colors.dominant;
      } catch {
        // Ignore color extraction errors
      }
    }

    // Determine output formats
    const hasAlpha = metadata.hasAlpha;
    const formats = this.getOutputFormats(hasAlpha);

    // Generate variants
    const variants: ImageVariant[] = [];
    const allSizes = getAllSizes(this.config);

    for (const width of allSizes) {
      // Skip sizes larger than original
      if (width > metadata.width) {
        continue;
      }

      // Calculate height maintaining aspect ratio
      const height = Math.round((width / metadata.width) * metadata.height);

      for (const format of formats) {
        try {
          const processed = await this.processor.process(buffer, {
            src: relativePath,
            width,
            quality: this.config.quality,
            format,
          });

          // Generate output path
          const variantPath = this.getVariantPath(relativePath, width, format);
          const fullPath = join(this.outDir, variantPath);

          // Ensure directory exists
          await mkdir(dirname(fullPath), { recursive: true });

          // Write the file
          await writeFile(fullPath, processed.buffer);

          variants.push({
            path: variantPath,
            width: processed.width,
            height: processed.height,
            format,
            size: processed.buffer.length,
          });
        } catch (error) {
          console.warn(`Failed to generate ${width}px ${format} variant for ${relativePath}`);
        }
      }
    }

    // Also generate original format variants if not already included
    const originalExt = extname(relativePath).slice(1).toLowerCase();
    if (!formats.includes(originalExt as any) && SUPPORTED_INPUT_FORMATS.includes(originalExt)) {
      // Copy original at full size
      const variantPath = this.getVariantPath(relativePath, metadata.width, originalExt);
      const fullPath = join(this.outDir, variantPath);

      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, buffer);

      variants.push({
        path: variantPath,
        width: metadata.width,
        height: metadata.height,
        format: originalExt as 'webp' | 'avif' | 'jpeg' | 'png',
        size: buffer.length,
      });
    }

    return {
      src: relativePath,
      width: metadata.width,
      height: metadata.height,
      variants,
      blurDataURL,
      dominantColor,
    };
  }

  /**
   * Scan directories for image files.
   */
  private async scanForImages(): Promise<string[]> {
    const images: string[] = [];

    for (const scanDir of this.scanDirs) {
      const fullDir = join(this.root, scanDir);

      try {
        await this.scanDirectory(fullDir, images);
      } catch {
        // Directory doesn't exist, skip
      }
    }

    return images;
  }

  /**
   * Recursively scan a directory for images.
   */
  private async scanDirectory(dir: string, images: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.scanDirectory(fullPath, images);
        }
      } else if (entry.isFile()) {
        // Check if it's a supported image
        const ext = extname(entry.name).slice(1).toLowerCase();
        if (SUPPORTED_INPUT_FORMATS.includes(ext)) {
          images.push(fullPath);
        }
      }
    }
  }

  /**
   * Get output formats based on config and image type.
   */
  private getOutputFormats(hasAlpha?: boolean): Array<'webp' | 'avif' | 'jpeg' | 'png'> {
    const formats: Array<'webp' | 'avif' | 'jpeg' | 'png'> = [];

    if (this.config.formats?.webp !== false) {
      formats.push('webp');
    }
    if (this.config.formats?.avif) {
      formats.push('avif');
    }

    // For images with transparency, include PNG
    if (hasAlpha && this.config.formats?.png !== false) {
      formats.push('png');
    } else if (!hasAlpha && this.config.formats?.jpeg !== false) {
      formats.push('jpeg');
    }

    return formats;
  }

  /**
   * Generate a variant file path.
   */
  private getVariantPath(originalPath: string, width: number, format: string): string {
    const dir = dirname(originalPath);
    const name = basename(originalPath, extname(originalPath));
    const ext = format === 'jpeg' ? 'jpg' : format;
    return join('images', dir, `${name}-${width}w.${ext}`);
  }

  /**
   * Hash a buffer for cache invalidation.
   */
  private hashBuffer(buffer: Buffer): string {
    return createHash('md5').update(buffer).digest('hex').slice(0, 8);
  }

  /**
   * Get the manifest manager.
   */
  getManifest(): ImageManifestManager {
    return this.manifest;
  }
}

/**
 * Create a build optimizer instance.
 */
export function createBuildOptimizer(options: BuildOptimizerOptions): BuildOptimizer {
  return new BuildOptimizer(options);
}

/**
 * Run a build optimization.
 */
export async function optimizeImages(options: BuildOptimizerOptions): Promise<BuildResult> {
  const optimizer = createBuildOptimizer(options);
  return optimizer.run();
}
