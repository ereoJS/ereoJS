/**
 * @ereo/plugin-images - Picture Component
 *
 * Art direction component for responsive images with different sources.
 */

'use client';

import React, { forwardRef, useState, useMemo } from 'react';
import type { PictureProps, PictureSource, StaticImageData, ImageLoaderParams } from './types';

/**
 * Default image loader for the EreoJS image endpoint.
 */
const defaultLoader = ({ src, width, quality }: ImageLoaderParams): string => {
  const params = new URLSearchParams({
    src,
    w: width.toString(),
  });

  if (quality) {
    params.set('q', quality.toString());
  }

  return `/_ereo/image?${params.toString()}`;
};

/**
 * Default device sizes for srcset generation.
 */
const DEFAULT_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/**
 * Generate srcset for a source.
 */
function generateSrcset(
  src: string,
  loader: (params: ImageLoaderParams) => string,
  width: number | undefined,
  quality: number | undefined
): string {
  let widths: number[];

  if (width) {
    const maxWidth = width * 2;
    widths = DEFAULT_DEVICE_SIZES.filter((w) => w <= maxWidth);
    if (!widths.includes(width)) {
      widths.push(width);
      widths.sort((a, b) => a - b);
    }
  } else {
    widths = DEFAULT_DEVICE_SIZES;
  }

  return widths
    .map((w) => `${loader({ src, width: w, quality })} ${w}w`)
    .join(', ');
}

/**
 * Get source string from StaticImageData or string.
 */
function getSrc(source: string | StaticImageData): string {
  return typeof source === 'object' ? source.src : source;
}

/**
 * Get dimensions from StaticImageData.
 */
function getDimensions(
  source: string | StaticImageData,
  propWidth?: number,
  propHeight?: number
): { width?: number; height?: number } {
  if (typeof source === 'object') {
    return {
      width: propWidth ?? source.width,
      height: propHeight ?? source.height,
    };
  }
  return { width: propWidth, height: propHeight };
}

/**
 * Get blur data URL from StaticImageData.
 */
function getBlurDataURL(source: string | StaticImageData): string | undefined {
  return typeof source === 'object' ? source.blurDataURL : undefined;
}

/**
 * EreoJS Picture Component
 *
 * Provides art direction for responsive images, allowing different images
 * to be served at different breakpoints.
 *
 * @example
 * // Art direction with different images for mobile/desktop
 * <Picture
 *   alt="Hero image"
 *   sources={[
 *     { src: heroMobile, media: '(max-width: 640px)' },
 *     { src: heroDesktop, media: '(min-width: 641px)' },
 *   ]}
 * />
 *
 * // With format-based sources
 * <Picture
 *   alt="Product photo"
 *   sources={[
 *     { src: '/product.avif', type: 'image/avif' },
 *     { src: '/product.webp', type: 'image/webp' },
 *     { src: '/product.jpg' },
 *   ]}
 * />
 */
export const Picture = forwardRef<HTMLImageElement, PictureProps>(function Picture(
  {
    sources,
    fallback,
    alt,
    width: propWidth,
    height: propHeight,
    fill = false,
    objectFit = 'cover',
    objectPosition = 'center',
    aspectRatio,
    sizes,
    placeholder = 'empty',
    blurDataURL: propBlurDataURL,
    quality = 80,
    priority = false,
    loading: propLoading,
    decoding = 'async',
    loader = defaultLoader,
    unoptimized = false,
    onLoad,
    onError,
    className,
    style,
    ...rest
  },
  ref
) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Get fallback source (last source or explicit fallback)
  const fallbackSource = fallback ?? sources[sources.length - 1]?.src;
  const fallbackSrc = fallbackSource ? getSrc(fallbackSource) : '';
  const { width: fallbackWidth, height: fallbackHeight } = getDimensions(
    fallbackSource || '',
    propWidth,
    propHeight
  );

  // Get blur data URL
  const blurDataURL =
    propBlurDataURL ??
    (fallbackSource ? getBlurDataURL(fallbackSource) : undefined);

  // Loading strategy
  const loading = propLoading ?? (priority ? 'eager' : 'lazy');

  // Generate source elements
  const sourceElements = useMemo(() => {
    return sources.map((source, index) => {
      const srcString = getSrc(source.src);
      const { width: sourceWidth } = getDimensions(
        source.src,
        source.width,
        source.height
      );

      const srcSet = unoptimized
        ? srcString
        : generateSrcset(srcString, loader, sourceWidth, quality);

      return (
        <source
          key={index}
          srcSet={srcSet}
          media={source.media}
          type={source.type}
          sizes={source.sizes ?? sizes}
        />
      );
    });
  }, [sources, loader, quality, sizes, unoptimized]);

  // Generate fallback srcset
  const fallbackSrcSet = useMemo(() => {
    if (unoptimized || !fallbackSrc) {
      return undefined;
    }
    return generateSrcset(fallbackSrc, loader, fallbackWidth, quality);
  }, [fallbackSrc, loader, fallbackWidth, quality, unoptimized]);

  // Generate optimized fallback src
  const optimizedFallbackSrc = useMemo(() => {
    if (unoptimized || !fallbackSrc) {
      return fallbackSrc;
    }
    const targetWidth = fallbackWidth || 1200;
    return loader({ src: fallbackSrc, width: targetWidth, quality });
  }, [fallbackSrc, fallbackWidth, quality, loader, unoptimized]);

  // Handle events
  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    onLoad?.(event);
  };

  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError?.(event);
  };

  // Container style for fill mode
  const containerStyle: React.CSSProperties = fill
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
      }
    : {};

  // Image style
  const imageStyle: React.CSSProperties = {
    ...style,
    ...(fill
      ? {
          objectFit,
          objectPosition,
          width: '100%',
          height: '100%',
        }
      : {}),
    ...(aspectRatio && !fill
      ? {
          aspectRatio,
          width: fallbackWidth || '100%',
          height: 'auto',
        }
      : {}),
  };

  // Placeholder style
  const getPlaceholderStyle = (): React.CSSProperties => {
    if (placeholder === 'blur' && blurDataURL) {
      return {
        backgroundImage: `url("${blurDataURL}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(20px)',
        transform: 'scale(1.1)',
      };
    }
    if (placeholder === 'shimmer') {
      return {
        background: `linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)`,
        backgroundSize: '200% 100%',
        animation: 'ereo-shimmer 1.5s infinite',
      };
    }
    return {};
  };

  const showPlaceholder = placeholder !== 'empty' && !isLoaded && !hasError;

  return (
    <span
      style={{
        display: fill ? 'block' : 'inline-block',
        position: fill ? 'absolute' : 'relative',
        overflow: 'hidden',
        ...containerStyle,
        ...(aspectRatio && !fill
          ? { aspectRatio, width: fallbackWidth || '100%' }
          : {}),
      }}
    >
      {/* Placeholder layer */}
      {showPlaceholder && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...getPlaceholderStyle(),
            transition: 'opacity 0.3s ease-out',
            opacity: isLoaded ? 0 : 1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* Picture element */}
      <picture>
        {sourceElements}
        <img
          ref={ref}
          src={optimizedFallbackSrc}
          srcSet={fallbackSrcSet}
          sizes={sizes}
          alt={alt}
          width={fill ? undefined : fallbackWidth}
          height={fill ? undefined : fallbackHeight}
          loading={loading}
          decoding={decoding}
          onLoad={handleLoad}
          onError={handleError}
          className={className}
          style={{
            ...imageStyle,
            transition: placeholder !== 'empty' ? 'opacity 0.3s ease-out' : undefined,
            opacity: showPlaceholder && !isLoaded ? 0 : 1,
          }}
          {...rest}
        />
      </picture>

      {/* Shimmer animation styles */}
      {placeholder === 'shimmer' && (
        <style>{`
          @keyframes ereo-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      )}
    </span>
  );
});

Picture.displayName = 'Picture';

export default Picture;
