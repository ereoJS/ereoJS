/**
 * @ereo/plugin-images - Image Manifest Generation
 *
 * Track processed images and their variants.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { ImageManifestEntry, ImageVariant } from '../components/types';

/**
 * Image manifest for tracking all processed images.
 */
export interface ImageManifest {
  /** Manifest version */
  version: number;
  /** Build timestamp */
  buildTime: number;
  /** Map of source paths to image entries */
  images: Record<string, ImageManifestEntry>;
}

/**
 * Default manifest structure.
 */
const DEFAULT_MANIFEST: ImageManifest = {
  version: 1,
  buildTime: 0,
  images: {},
};

/**
 * Image manifest manager.
 */
export class ImageManifestManager {
  private manifest: ImageManifest = { ...DEFAULT_MANIFEST };
  private readonly manifestPath: string;
  private dirty = false;

  constructor(outDir: string) {
    this.manifestPath = join(outDir, 'images-manifest.json');
  }

  /**
   * Load the manifest from disk.
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(content);
    } catch (error) {
      // Manifest doesn't exist yet, use default
      this.manifest = { ...DEFAULT_MANIFEST };
    }
  }

  /**
   * Save the manifest to disk.
   */
  async save(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    this.manifest.buildTime = Date.now();

    await mkdir(dirname(this.manifestPath), { recursive: true });
    await writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2));

    this.dirty = false;
  }

  /**
   * Add or update an image entry.
   * @param fileHash - Optional content hash of the source file. When provided,
   *   `needsReprocessing()` can detect file changes accurately. Falls back to
   *   metadata-based hash when omitted.
   */
  addImage(
    sourcePath: string,
    data: Omit<ImageManifestEntry, 'hash'>,
    fileHash?: string
  ): void {
    const hash = fileHash ?? this.generateHash(sourcePath, data);

    this.manifest.images[sourcePath] = {
      ...data,
      hash,
    };

    this.dirty = true;
  }

  /**
   * Get an image entry by source path.
   */
  getImage(sourcePath: string): ImageManifestEntry | undefined {
    return this.manifest.images[sourcePath];
  }

  /**
   * Check if an image needs reprocessing.
   */
  needsReprocessing(sourcePath: string, fileHash: string): boolean {
    const entry = this.manifest.images[sourcePath];
    if (!entry) {
      return true;
    }
    return entry.hash !== fileHash;
  }

  /**
   * Remove an image entry.
   */
  removeImage(sourcePath: string): void {
    delete this.manifest.images[sourcePath];
    this.dirty = true;
  }

  /**
   * Get all image entries.
   */
  getAllImages(): Record<string, ImageManifestEntry> {
    return this.manifest.images;
  }

  /**
   * Get total number of images.
   */
  getImageCount(): number {
    return Object.keys(this.manifest.images).length;
  }

  /**
   * Get total number of variants.
   */
  getVariantCount(): number {
    return Object.values(this.manifest.images).reduce(
      (count, entry) => count + entry.variants.length,
      0
    );
  }

  /**
   * Get total size of all variants.
   */
  getTotalSize(): number {
    return Object.values(this.manifest.images).reduce(
      (size, entry) =>
        size + entry.variants.reduce((vSize, v) => vSize + v.size, 0),
      0
    );
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.manifest = { ...DEFAULT_MANIFEST };
    this.dirty = true;
  }

  /**
   * Generate a hash for an image entry.
   */
  private generateHash(sourcePath: string, data: Omit<ImageManifestEntry, 'hash'>): string {
    const content = JSON.stringify({
      sourcePath,
      width: data.width,
      height: data.height,
      variants: data.variants.map((v) => `${v.width}x${v.height}-${v.format}`),
    });

    return createHash('md5').update(content).digest('hex').slice(0, 8);
  }
}

/**
 * Generate a virtual module for image metadata.
 *
 * This creates a JavaScript module that exports the image metadata
 * for use by the Image component at runtime.
 */
export function generateImageModule(
  entry: ImageManifestEntry,
  publicPath: string
): string {
  const data = {
    src: join(publicPath, entry.src),
    width: entry.width,
    height: entry.height,
    blurDataURL: entry.blurDataURL,
    dominantColor: entry.dominantColor,
  };

  return `export default ${JSON.stringify(data, null, 2)};`;
}

/**
 * Generate a srcset string from image variants.
 */
export function generateSrcset(
  variants: ImageVariant[],
  publicPath: string,
  format?: string
): string {
  return variants
    .filter((v) => !format || v.format === format)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${join(publicPath, v.path)} ${v.width}w`)
    .join(', ');
}

/**
 * Get the best variant for a given width and format.
 */
export function getBestVariant(
  variants: ImageVariant[],
  width: number,
  format?: string
): ImageVariant | undefined {
  const filtered = variants.filter((v) => !format || v.format === format);
  const sorted = filtered.sort((a, b) => a.width - b.width);

  // Find the smallest variant that's >= requested width
  const exact = sorted.find((v) => v.width >= width);
  if (exact) {
    return exact;
  }

  // Fall back to largest available
  return sorted[sorted.length - 1];
}

/**
 * Create a new manifest manager.
 */
export function createManifestManager(outDir: string): ImageManifestManager {
  return new ImageManifestManager(outDir);
}
