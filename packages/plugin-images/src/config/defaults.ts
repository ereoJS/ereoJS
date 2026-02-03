/**
 * @ereo/plugin-images - Default Configuration
 *
 * Default values for the image optimization plugin.
 */

import type { ImagePluginConfig } from '../components/types';

/**
 * Default device sizes for responsive srcset generation.
 * These cover common device widths from mobile to 4K.
 */
export const DEFAULT_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/**
 * Default image sizes for smaller images (icons, avatars, etc.).
 */
export const DEFAULT_IMAGE_SIZES = [16, 32, 48, 64, 96, 128, 256, 384];

/**
 * All available widths for srcset (device sizes + image sizes, sorted).
 */
export const ALL_SIZES = [...DEFAULT_IMAGE_SIZES, ...DEFAULT_DEVICE_SIZES].sort(
  (a, b) => a - b
);

/**
 * Default image quality (1-100).
 */
export const DEFAULT_QUALITY = 80;

/**
 * Maximum allowed dimension (width or height).
 */
export const MAX_DIMENSION = 3840;

/**
 * Minimum cache TTL in seconds.
 */
export const MIN_CACHE_TTL = 60;

/**
 * Default cache TTL in seconds (1 year).
 */
export const DEFAULT_CACHE_TTL = 31536000;

/**
 * Blur placeholder width (for generating tiny blur images).
 */
export const BLUR_WIDTH = 8;

/**
 * URL path prefix for the image optimization endpoint.
 */
export const IMAGE_PATH_PREFIX = '/_ereo/image';

/**
 * Cache directory for optimized images.
 */
export const CACHE_DIR = '.ereo/images';

/**
 * Supported input formats for processing.
 */
export const SUPPORTED_INPUT_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'svg'];

/**
 * Supported output formats.
 */
export const SUPPORTED_OUTPUT_FORMATS = ['webp', 'avif', 'jpeg', 'png'] as const;

/**
 * MIME types for image formats.
 */
export const FORMAT_MIME_TYPES: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

/**
 * File extensions for image formats.
 */
export const FORMAT_EXTENSIONS: Record<string, string> = {
  webp: '.webp',
  avif: '.avif',
  jpeg: '.jpg',
  jpg: '.jpg',
  png: '.png',
};

/**
 * Default plugin configuration.
 */
export const DEFAULT_CONFIG: Required<ImagePluginConfig> = {
  remotePatterns: [],
  formats: {
    webp: true,
    avif: false, // AVIF is slower to encode
    jpeg: true,
    png: true,
  },
  quality: DEFAULT_QUALITY,
  sizes: {
    deviceSizes: DEFAULT_DEVICE_SIZES,
    imageSizes: DEFAULT_IMAGE_SIZES,
  },
  minimumCacheTTL: DEFAULT_CACHE_TTL,
  domains: [],
  cacheDir: CACHE_DIR,
  generateBlurPlaceholder: true,
  extractDominantColor: true,
  maxDimension: MAX_DIMENSION,
  path: IMAGE_PATH_PREFIX,
  dangerouslyAllowAllRemote: false,
};

/**
 * Get all available sizes for srcset generation.
 */
export function getAllSizes(config: ImagePluginConfig): number[] {
  const deviceSizes = config.sizes?.deviceSizes ?? DEFAULT_DEVICE_SIZES;
  const imageSizes = config.sizes?.imageSizes ?? DEFAULT_IMAGE_SIZES;
  return [...imageSizes, ...deviceSizes].sort((a, b) => a - b);
}

/**
 * Get sizes appropriate for a given target width.
 * Returns only sizes up to 2x the target width.
 */
export function getSizesForWidth(targetWidth: number, config: ImagePluginConfig): number[] {
  const allSizes = getAllSizes(config);
  const maxSize = targetWidth * 2;
  return allSizes.filter((size) => size <= maxSize);
}
