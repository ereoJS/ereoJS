/**
 * @ereo/plugin-images - Image Component
 *
 * Optimized image component with automatic srcset, placeholders, and lazy loading.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo, forwardRef } from 'react';
import type { ImageProps, StaticImageData, ImageLoaderParams } from './types';

/**
 * Default image loader that generates URLs for the Ereo image endpoint.
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
 * Generate srcset for an image.
 */
function generateSrcset(
  src: string,
  loader: (params: ImageLoaderParams) => string,
  width: number | undefined,
  quality: number | undefined,
  sizes: string | undefined
): string {
  // Determine which widths to include
  let widths: number[];

  if (width) {
    // Generate widths up to 2x the specified width
    const maxWidth = width * 2;
    widths = DEFAULT_DEVICE_SIZES.filter((w) => w <= maxWidth);

    // Always include the exact width
    if (!widths.includes(width)) {
      widths.push(width);
      widths.sort((a, b) => a - b);
    }
  } else {
    // Use all device sizes
    widths = DEFAULT_DEVICE_SIZES;
  }

  return widths
    .map((w) => `${loader({ src, width: w, quality })} ${w}w`)
    .join(', ');
}

/**
 * Generate CSS for blur placeholder.
 */
function getBlurStyle(
  blurDataURL: string | undefined,
  dominantColor: string | undefined,
  placeholder: ImageProps['placeholder']
): React.CSSProperties {
  if (placeholder === 'blur' && blurDataURL) {
    return {
      backgroundImage: `url("${blurDataURL}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(20px)',
      transform: 'scale(1.1)',
    };
  }

  if (placeholder === 'color' && dominantColor) {
    return {
      backgroundColor: dominantColor,
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
}

/**
 * Ereo Image Component
 *
 * A drop-in replacement for the HTML img element with automatic optimization.
 *
 * @example
 * // Basic usage
 * <Image src="/hero.jpg" alt="Hero image" width={800} height={600} />
 *
 * // With static import
 * import heroImg from './hero.jpg';
 * <Image src={heroImg} alt="Hero" placeholder="blur" />
 *
 * // Fill parent container
 * <div style={{ position: 'relative', width: '100%', height: 400 }}>
 *   <Image src="/bg.jpg" alt="Background" fill objectFit="cover" />
 * </div>
 */
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
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
  // State
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Extract data from StaticImageData if provided
  const isStaticImport = typeof src === 'object';
  const imgSrc = isStaticImport ? (src as StaticImageData).src : src;
  const imgWidth = propWidth ?? (isStaticImport ? (src as StaticImageData).width : undefined);
  const imgHeight = propHeight ?? (isStaticImport ? (src as StaticImageData).height : undefined);
  const blurDataURL = propBlurDataURL ?? (isStaticImport ? (src as StaticImageData).blurDataURL : undefined);
  const dominantColor = isStaticImport ? (src as StaticImageData).dominantColor : undefined;

  // Loading strategy
  const loading = propLoading ?? (priority ? 'eager' : 'lazy');

  // Generate optimized src and srcset
  const optimizedSrc = useMemo(() => {
    if (unoptimized) {
      return imgSrc;
    }
    // Use the loader to generate the primary src
    const targetWidth = imgWidth || 1200;
    return loader({ src: imgSrc, width: targetWidth, quality });
  }, [imgSrc, imgWidth, quality, loader, unoptimized]);

  const srcSet = useMemo(() => {
    if (unoptimized) {
      return undefined;
    }
    return generateSrcset(imgSrc, loader, imgWidth, quality, sizes);
  }, [imgSrc, loader, imgWidth, quality, sizes, unoptimized]);

  // Handle load event
  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    onLoad?.(event);
  };

  // Handle error event
  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError?.(event);
  };

  // Preload priority images
  useEffect(() => {
    if (priority && typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = optimizedSrc;
      if (srcSet) {
        link.setAttribute('imagesrcset', srcSet);
      }
      if (sizes) {
        link.setAttribute('imagesizes', sizes);
      }
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, optimizedSrc, srcSet, sizes]);

  // Combine refs
  const combinedRef = (node: HTMLImageElement | null) => {
    (imgRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  // Build container style for fill mode
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

  // Build image style
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
          width: imgWidth || '100%',
          height: 'auto',
        }
      : {}),
  };

  // Build placeholder style
  const placeholderStyle = getBlurStyle(blurDataURL, dominantColor, placeholder);
  const showPlaceholder = placeholder !== 'empty' && !isLoaded && !hasError;

  // Wrapper for placeholder support
  if (showPlaceholder || fill) {
    return (
      <span
        style={{
          display: fill ? 'block' : 'inline-block',
          position: fill ? 'absolute' : 'relative',
          overflow: 'hidden',
          ...containerStyle,
          ...(aspectRatio && !fill
            ? { aspectRatio, width: imgWidth || '100%' }
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
              ...placeholderStyle,
              transition: 'opacity 0.3s ease-out',
              opacity: isLoaded ? 0 : 1,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          />
        )}

        {/* Actual image */}
        <img
          ref={combinedRef}
          src={optimizedSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={fill ? undefined : imgWidth}
          height={fill ? undefined : imgHeight}
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
  }

  // Simple image without wrapper
  return (
    <img
      ref={combinedRef}
      src={optimizedSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={imgWidth}
      height={imgHeight}
      loading={loading}
      decoding={decoding}
      onLoad={handleLoad}
      onError={handleError}
      className={className}
      style={imageStyle}
      {...rest}
    />
  );
});

Image.displayName = 'Image';

export default Image;
