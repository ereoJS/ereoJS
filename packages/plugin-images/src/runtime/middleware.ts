/**
 * @ereo/plugin-images - On-Demand Transform Middleware
 *
 * HTTP middleware for runtime image optimization.
 */

import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { AppContext, MiddlewareHandler } from '@ereo/core';
import type { ImagePluginConfig, ImageOptimizationParams } from '../components/types';
import { createImageProcessor, type ImageProcessor } from '../processing/processor';
import { TwoTierCache, generateCacheKey } from './cache';
import { validateConfig, matchesRemotePattern } from '../config/schema';
import {
  IMAGE_PATH_PREFIX,
  CACHE_DIR,
  MAX_DIMENSION,
  DEFAULT_QUALITY,
  FORMAT_MIME_TYPES,
  SUPPORTED_OUTPUT_FORMATS,
} from '../config/defaults';

/**
 * Middleware options.
 */
export interface ImageMiddlewareOptions {
  /** Project root directory */
  root: string;
  /** Plugin configuration */
  config?: ImagePluginConfig;
  /** Enable caching */
  cache?: boolean;
  /** Cache directory */
  cacheDir?: string;
}

/**
 * Parse and validate query parameters.
 */
function parseQueryParams(url: URL): ImageOptimizationParams | null {
  const src = url.searchParams.get('src');
  const width = url.searchParams.get('w');
  const height = url.searchParams.get('h');
  const quality = url.searchParams.get('q');
  const format = url.searchParams.get('f');

  // src and width are required
  if (!src || !width) {
    return null;
  }

  const w = parseInt(width, 10);
  if (isNaN(w) || w <= 0 || w > MAX_DIMENSION) {
    return null;
  }

  const params: ImageOptimizationParams = {
    src,
    width: w,
  };

  if (height) {
    const h = parseInt(height, 10);
    if (!isNaN(h) && h > 0 && h <= MAX_DIMENSION) {
      params.height = h;
    }
  }

  if (quality) {
    const q = parseInt(quality, 10);
    if (!isNaN(q) && q >= 1 && q <= 100) {
      params.quality = q;
    }
  }

  if (format) {
    const f = format.toLowerCase();
    if (f === 'auto' || SUPPORTED_OUTPUT_FORMATS.includes(f as any)) {
      params.format = f as ImageOptimizationParams['format'];
    }
  }

  return params;
}

/**
 * Determine best output format based on Accept header.
 */
function getBestFormat(
  accept: string | null,
  params: ImageOptimizationParams,
  config: Required<ImagePluginConfig>
): 'webp' | 'avif' | 'jpeg' | 'png' {
  // If format is explicitly requested (not auto), use it
  if (params.format && params.format !== 'auto') {
    return params.format;
  }

  // Check Accept header for format support
  if (accept) {
    // Prefer AVIF if supported and enabled
    if (config.formats?.avif && accept.includes('image/avif')) {
      return 'avif';
    }
    // Then WebP
    if (config.formats?.webp !== false && accept.includes('image/webp')) {
      return 'webp';
    }
  }

  // Default to WebP or JPEG
  return config.formats?.webp !== false ? 'webp' : 'jpeg';
}

/**
 * Check if a source is allowed.
 */
function isSourceAllowed(
  src: string,
  config: Required<ImagePluginConfig>
): boolean {
  // Local paths are always allowed
  if (src.startsWith('/') || src.startsWith('./')) {
    return true;
  }

  // Check if it's a URL
  try {
    const url = new URL(src);

    // Allow all remote if configured
    if (config.dangerouslyAllowAllRemote) {
      return true;
    }

    // Check against patterns
    return matchesRemotePattern(url, config.remotePatterns, config.domains);
  } catch {
    // Not a valid URL, treat as local path
    return true;
  }
}

/**
 * Create the image optimization middleware.
 */
export function createImageMiddleware(options: ImageMiddlewareOptions) {
  const config = validateConfig(options.config);
  const processor = createImageProcessor(options.config);
  const pathPrefix = config.path || IMAGE_PATH_PREFIX;

  // Set up cache if enabled
  let cache: TwoTierCache | null = null;
  if (options.cache !== false) {
    cache = new TwoTierCache({
      memory: {
        maxItems: 100,
        maxSize: 50 * 1024 * 1024, // 50MB memory cache
      },
      disk: {
        dir: join(options.root, options.cacheDir || CACHE_DIR, 'runtime'),
        maxSize: 500 * 1024 * 1024, // 500MB disk cache
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    });
  }

  return async (
    request: Request,
    context: AppContext,
    next: () => Promise<Response>
  ): Promise<Response> => {
    const url = new URL(request.url);

    // Only handle our path prefix
    if (!url.pathname.startsWith(pathPrefix)) {
      return next();
    }

    // Only handle GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse query parameters
    const params = parseQueryParams(url);
    if (!params) {
      return new Response('Invalid parameters. Required: src, w', { status: 400 });
    }

    // Check if source is allowed
    if (!isSourceAllowed(params.src, config)) {
      return new Response('Source not allowed', { status: 403 });
    }

    // Determine output format
    const accept = request.headers.get('Accept');
    const format = getBestFormat(accept, params, config);
    params.format = format;

    // Generate cache key
    const cacheKey = generateCacheKey(params);

    // Check cache
    if (cache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return createImageResponse(cached, format, true);
      }
    }

    try {
      // Get the source image
      let sourceBuffer: Buffer;

      if (params.src.startsWith('http://') || params.src.startsWith('https://')) {
        // Fetch remote image
        const response = await fetch(params.src);
        if (!response.ok) {
          return new Response('Failed to fetch source image', { status: 502 });
        }
        sourceBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        // Load local file
        const localPath = params.src.startsWith('/')
          ? join(options.root, 'public', params.src)
          : join(options.root, params.src);

        try {
          sourceBuffer = await readFile(localPath);
        } catch (error) {
          return new Response('Source image not found', { status: 404 });
        }
      }

      // Process the image
      const processed = await processor.process(sourceBuffer, params);

      // Cache the result
      if (cache) {
        await cache.set(cacheKey, processed.buffer);
      }

      return createImageResponse(processed.buffer, format, false);
    } catch (error) {
      console.error('Image processing error:', error);
      return new Response('Image processing failed', { status: 500 });
    }
  };
}

/**
 * Create an HTTP response for an image.
 */
function createImageResponse(
  buffer: Buffer,
  format: string,
  cached: boolean
): Response {
  const contentType = FORMAT_MIME_TYPES[format] || 'application/octet-stream';

  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Length': buffer.length.toString(),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Vary': 'Accept',
  });

  if (cached) {
    headers.set('X-Cache', 'HIT');
  } else {
    headers.set('X-Cache', 'MISS');
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers,
  });
}

/**
 * Create a dev server middleware handler.
 */
export function imageMiddleware(options: ImageMiddlewareOptions): MiddlewareHandler {
  const handler = createImageMiddleware(options);

  return async (
    request: Request,
    context: AppContext,
    next: () => Promise<Response>
  ): Promise<Response> => {
    return handler(request, context, next);
  };
}
