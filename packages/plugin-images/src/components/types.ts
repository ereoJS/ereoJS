/**
 * @ereo/plugin-images - Component Type Definitions
 *
 * TypeScript interfaces for the Image and Picture components.
 */

import type { CSSProperties, ImgHTMLAttributes } from 'react';

/**
 * Static image data from importing an image file.
 * This is the shape of the object returned when you import an image.
 *
 * @example
 * import heroImg from './hero.jpg';
 * // heroImg: StaticImageData
 */
export interface StaticImageData {
  /** Source URL of the image */
  src: string;
  /** Original width in pixels */
  width: number;
  /** Original height in pixels */
  height: number;
  /** Base64 encoded blur placeholder (if generated) */
  blurDataURL?: string;
  /** Dominant color (if extracted) */
  dominantColor?: string;
  /** MIME type of the original image */
  type?: string;
}

/**
 * Placeholder type for image loading states.
 */
export type PlaceholderType = 'blur' | 'color' | 'shimmer' | 'empty';

/**
 * Object fit values for fill mode.
 */
export type ObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

/**
 * Object position values for fill mode.
 */
export type ObjectPosition = CSSProperties['objectPosition'];

/**
 * Loading attribute values.
 */
export type ImageLoading = 'lazy' | 'eager';

/**
 * Decoding attribute values.
 */
export type ImageDecoding = 'async' | 'sync' | 'auto';

/**
 * Custom loader function for generating image URLs.
 */
export interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export type ImageLoader = (params: ImageLoaderParams) => string;

/**
 * Props for the Image component.
 */
export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height' | 'loading' | 'placeholder'> {
  /**
   * Image source - can be a URL string or imported StaticImageData.
   */
  src: string | StaticImageData;

  /**
   * Alt text for the image (required for accessibility).
   */
  alt: string;

  /**
   * Width of the image in pixels.
   * Not required if using `fill` or if src is StaticImageData.
   */
  width?: number;

  /**
   * Height of the image in pixels.
   * Not required if using `fill` or if src is StaticImageData.
   */
  height?: number;

  /**
   * Fill the parent container.
   * Parent must have position: relative, absolute, or fixed.
   */
  fill?: boolean;

  /**
   * Object-fit CSS property when using fill mode.
   * @default 'cover'
   */
  objectFit?: ObjectFit;

  /**
   * Object-position CSS property when using fill mode.
   * @default 'center'
   */
  objectPosition?: ObjectPosition;

  /**
   * Aspect ratio to maintain (e.g., '16/9', '4/3').
   * Can be used instead of explicit width/height.
   */
  aspectRatio?: string;

  /**
   * Sizes attribute for responsive images.
   * Describes how wide the image will be at various breakpoints.
   *
   * @example
   * sizes="(max-width: 768px) 100vw, 50vw"
   */
  sizes?: string;

  /**
   * Placeholder to show while loading.
   * - 'blur': Use blurDataURL or auto-generated blur
   * - 'color': Use dominant color as background
   * - 'shimmer': Animated shimmer effect
   * - 'empty': No placeholder (default)
   */
  placeholder?: PlaceholderType;

  /**
   * Custom blur data URL (base64).
   * Only used when placeholder='blur'.
   */
  blurDataURL?: string;

  /**
   * Quality of the optimized image (1-100).
   * @default 80
   */
  quality?: number;

  /**
   * Mark as high priority (preload).
   * Use for above-the-fold images.
   */
  priority?: boolean;

  /**
   * Loading strategy.
   * @default 'lazy' unless priority is true
   */
  loading?: ImageLoading;

  /**
   * Decoding strategy.
   * @default 'async'
   */
  decoding?: ImageDecoding;

  /**
   * Custom loader function for generating image URLs.
   * Useful for external image services (Cloudinary, Imgix, etc.).
   */
  loader?: ImageLoader;

  /**
   * Disable automatic optimization.
   * Use when you need the original image.
   */
  unoptimized?: boolean;

  /**
   * Callback when the image has loaded.
   */
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;

  /**
   * Callback when loading fails.
   */
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Art direction source for Picture component.
 */
export interface PictureSource {
  /**
   * Image source for this breakpoint.
   */
  src: string | StaticImageData;

  /**
   * Media query for when to use this source.
   * @example "(max-width: 640px)"
   */
  media?: string;

  /**
   * MIME type hint for the browser.
   */
  type?: string;

  /**
   * Width of this variant.
   */
  width?: number;

  /**
   * Height of this variant.
   */
  height?: number;

  /**
   * Sizes attribute for this source.
   */
  sizes?: string;
}

/**
 * Props for the Picture component (art direction).
 */
export interface PictureProps extends Omit<ImageProps, 'src' | 'width' | 'height'> {
  /**
   * Array of sources for different breakpoints/formats.
   * Listed in order of preference (first match wins).
   */
  sources: PictureSource[];

  /**
   * Fallback source (used when no source matches).
   * If not provided, the last source in the array is used.
   */
  fallback?: string | StaticImageData;

  /**
   * Fallback width.
   */
  width?: number;

  /**
   * Fallback height.
   */
  height?: number;
}

/**
 * Plugin configuration for image optimization.
 */
export interface ImagePluginConfig {
  /**
   * Allowed remote image patterns.
   * Images from other domains will only be optimized if they match.
   */
  remotePatterns?: RemotePattern[];

  /**
   * Output formats to generate.
   * @default { webp: true, avif: false }
   */
  formats?: {
    webp?: boolean;
    avif?: boolean;
    jpeg?: boolean;
    png?: boolean;
  };

  /**
   * Default quality for optimized images.
   * @default 80
   */
  quality?: number;

  /**
   * Device sizes for responsive images.
   */
  sizes?: {
    /**
     * Device widths for srcset generation.
     * @default [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
     */
    deviceSizes?: number[];

    /**
     * Image widths for srcset generation.
     * @default [16, 32, 48, 64, 96, 128, 256, 384]
     */
    imageSizes?: number[];
  };

  /**
   * Minimum size difference (%) to create a new variant.
   * @default 20
   */
  minimumCacheTTL?: number;

  /**
   * Domains allowed for remote images (legacy, use remotePatterns).
   * @deprecated Use remotePatterns instead
   */
  domains?: string[];

  /**
   * Directory for cached/optimized images.
   * @default '.ereo/images'
   */
  cacheDir?: string;

  /**
   * Generate blur placeholders at build time.
   * @default true
   */
  generateBlurPlaceholder?: boolean;

  /**
   * Extract dominant colors at build time.
   * @default true
   */
  extractDominantColor?: boolean;

  /**
   * Maximum image dimension (width or height).
   * @default 3840
   */
  maxDimension?: number;

  /**
   * Path prefix for optimized images.
   * @default '/_ereo/image'
   */
  path?: string;

  /**
   * Dangerously allow any remote image.
   * @default false
   */
  dangerouslyAllowAllRemote?: boolean;
}

/**
 * Remote image pattern for allowlisting.
 */
export interface RemotePattern {
  /**
   * Protocol (http or https).
   */
  protocol?: 'http' | 'https';

  /**
   * Hostname pattern (supports wildcards).
   * @example 'cdn.example.com' or '*.example.com'
   */
  hostname: string;

  /**
   * Port number.
   */
  port?: string;

  /**
   * Path prefix pattern.
   * @example '/images/*'
   */
  pathname?: string;
}

/**
 * Image manifest entry (stored at build time).
 */
export interface ImageManifestEntry {
  /** Original source path */
  src: string;
  /** Original width */
  width: number;
  /** Original height */
  height: number;
  /** Generated variants */
  variants: ImageVariant[];
  /** Blur placeholder data URL */
  blurDataURL?: string;
  /** Dominant color */
  dominantColor?: string;
  /** File hash for cache busting */
  hash: string;
}

/**
 * Generated image variant.
 */
export interface ImageVariant {
  /** Output path */
  path: string;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Format */
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  /** File size in bytes */
  size: number;
}

/**
 * Image optimization parameters (for runtime).
 */
export interface ImageOptimizationParams {
  /** Source image path or URL */
  src: string;
  /** Target width */
  width: number;
  /** Target height (optional, maintains aspect ratio if omitted) */
  height?: number;
  /** Quality (1-100) */
  quality?: number;
  /** Output format */
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
}

/**
 * Image processing result.
 */
export interface ProcessedImage {
  /** Processed image buffer */
  buffer: Buffer;
  /** MIME type */
  contentType: string;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Format */
  format: string;
}
