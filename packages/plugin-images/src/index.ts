/**
 * @ereo/plugin-images
 *
 * Complete image optimization system for Ereo.
 * Provides automatic image optimization, blur placeholders,
 * responsive srcset generation, and art direction support.
 *
 * @example
 * // ereo.config.ts
 * import images from '@ereo/plugin-images';
 *
 * export default defineConfig({
 *   plugins: [
 *     images({
 *       formats: { webp: true, avif: true },
 *       quality: 80,
 *     }),
 *   ],
 * });
 *
 * @example
 * // In your components
 * import { Image, Picture } from '@ereo/plugin-images/components';
 * import heroImg from './hero.jpg';
 *
 * function Hero() {
 *   return (
 *     <Image
 *       src={heroImg}
 *       alt="Hero image"
 *       placeholder="blur"
 *       priority
 *     />
 *   );
 * }
 */

// Plugin export (default)
export { imagesPlugin as default, imagesPlugin } from './plugin';

// Component exports
export { Image, Picture } from './components/index';

// Type exports
export type {
  ImageProps,
  PictureProps,
  PictureSource,
  StaticImageData,
  PlaceholderType,
  ObjectFit,
  ObjectPosition,
  ImageLoading,
  ImageDecoding,
  ImageLoader,
  ImageLoaderParams,
  ImagePluginConfig,
  RemotePattern,
  ImageManifestEntry,
  ImageVariant,
  ImageOptimizationParams,
  ProcessedImage,
} from './components/types';

// Processing utilities (for advanced use cases)
export { createImageProcessor, ImageProcessor } from './processing/processor';
export { createSharpProcessor, SharpProcessor } from './processing/sharp-processor';
export {
  generateBlurPlaceholder,
  generateShimmerSVG,
  generateShimmerDataURL,
} from './processing/blur';
export {
  extractDominantColor,
  rgbToHex,
  hexToRgb,
  getContrastColor,
} from './processing/color';

// Build utilities
export { createBuildOptimizer, optimizeImages, BuildOptimizer } from './build/optimizer';
export { createManifestManager, ImageManifestManager } from './build/manifest';

// Runtime utilities
export { createImageMiddleware, imageMiddleware } from './runtime/middleware';
export { MemoryCache, DiskCache, TwoTierCache, generateCacheKey } from './runtime/cache';

// Configuration utilities
export { validateConfig, matchesRemotePattern, ConfigValidationError } from './config/schema';
export {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  DEFAULT_QUALITY,
  MAX_DIMENSION,
  IMAGE_PATH_PREFIX,
  SUPPORTED_INPUT_FORMATS,
  SUPPORTED_OUTPUT_FORMATS,
  FORMAT_MIME_TYPES,
  getAllSizes,
  getSizesForWidth,
} from './config/defaults';
