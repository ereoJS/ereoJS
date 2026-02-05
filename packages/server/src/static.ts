/**
 * @ereo/server - Static File Serving
 *
 * Efficient static file serving with caching support.
 */

import { stat } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';

/**
 * MIME types for common file extensions.
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/**
 * Get MIME type for a file extension.
 */
export function getMimeType(filepath: string): string {
  const ext = extname(filepath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Static file serving options.
 */
export interface StaticOptions {
  /** Root directory for static files */
  root: string;
  /** URL prefix (default: '/') */
  prefix?: string;
  /** Max age for cache-control (seconds, default: 0 in dev, 31536000 in prod) */
  maxAge?: number;
  /** Enable immutable caching for fingerprinted files */
  immutable?: boolean;
  /** Index file (default: 'index.html') */
  index?: string;
  /** Enable directory listing (default: false) */
  listing?: boolean;
  /** Fallback file for SPA routing */
  fallback?: string;
  /** Enable format negotiation for images based on Accept header */
  negotiateImageFormat?: boolean;
}

/**
 * Image extensions that support format negotiation.
 */
const NEGOTIABLE_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * Check if browser supports a format based on Accept header.
 */
function supportsFormat(accept: string | null, format: string): boolean {
  if (!accept) return false;
  return accept.includes(`image/${format}`);
}

/**
 * Try to find an optimized variant of an image file.
 */
async function findOptimizedVariant(
  filepath: string,
  accept: string | null
): Promise<{ path: string; mime: string } | null> {
  const ext = extname(filepath).toLowerCase();

  // Only negotiate for specific image types
  if (!NEGOTIABLE_IMAGE_EXTENSIONS.includes(ext)) {
    return null;
  }

  const basePath = filepath.slice(0, -ext.length);

  // Try AVIF first (best compression)
  if (supportsFormat(accept, 'avif')) {
    const avifPath = `${basePath}.avif`;
    try {
      await stat(avifPath);
      return { path: avifPath, mime: 'image/avif' };
    } catch {
      // AVIF variant doesn't exist
    }
  }

  // Try WebP
  if (supportsFormat(accept, 'webp')) {
    const webpPath = `${basePath}.webp`;
    try {
      await stat(webpPath);
      return { path: webpPath, mime: 'image/webp' };
    } catch {
      // WebP variant doesn't exist
    }
  }

  return null;
}

/**
 * Create a static file handler.
 */
export function serveStatic(options: StaticOptions): (request: Request) => Promise<Response | null> {
  const {
    root,
    prefix = '/',
    maxAge = process.env.NODE_ENV === 'production' ? 31536000 : 0,
    immutable = true,
    index = 'index.html',
    listing = false,
    fallback,
    negotiateImageFormat = true,
  } = options;

  return async (request: Request): Promise<Response | null> => {
    // Only handle GET and HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return null;
    }

    const url = new URL(request.url);
    let pathname = url.pathname;

    // Check prefix
    if (prefix !== '/' && !pathname.startsWith(prefix)) {
      return null;
    }

    // Remove prefix
    if (prefix !== '/') {
      pathname = pathname.slice(prefix.length) || '/';
    }

    // Prevent directory traversal
    if (pathname.includes('..')) {
      return new Response('Forbidden', { status: 403 });
    }

    // Build file path with additional traversal protection
    const resolvedRoot = resolve(root);
    let filepath = resolve(root, normalize(pathname.replace(/^\//, '')));

    if (!filepath.startsWith(resolvedRoot)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      let stats = await stat(filepath);

      // Try format negotiation for images
      if (negotiateImageFormat && stats.isFile()) {
        const accept = request.headers.get('Accept');
        const optimized = await findOptimizedVariant(filepath, accept);
        if (optimized) {
          filepath = optimized.path;
          stats = await stat(filepath);
        }
      }

      // Handle directory
      if (stats.isDirectory()) {
        // Try index file
        const indexPath = join(filepath, index);
        try {
          stats = await stat(indexPath);
          filepath = indexPath;
        } catch {
          if (listing) {
            return createDirectoryListing(filepath, pathname);
          }
          return null;
        }
      }

      // Build response
      const file = Bun.file(filepath);
      const headers = new Headers();

      // Content type
      headers.set('Content-Type', getMimeType(filepath));

      // Content length
      headers.set('Content-Length', stats.size.toString());

      // ETag
      const etag = `"${stats.mtimeMs.toString(16)}-${stats.size.toString(16)}"`;
      headers.set('ETag', etag);

      // Last-Modified
      headers.set('Last-Modified', new Date(stats.mtimeMs).toUTCString());

      // Cache-Control
      const isFingerprinted = /\.[a-f0-9]{8,}\./.test(filepath);
      if (isFingerprinted && immutable) {
        headers.set('Cache-Control', `public, max-age=${maxAge}, immutable`);
      } else if (maxAge > 0) {
        headers.set('Cache-Control', `public, max-age=${maxAge}`);
      }

      // Add Vary header for images when format negotiation is enabled
      const ext = extname(filepath).toLowerCase();
      if (negotiateImageFormat && NEGOTIABLE_IMAGE_EXTENSIONS.includes(ext)) {
        headers.set('Vary', 'Accept');
      }

      // Handle conditional requests
      const ifNoneMatch = request.headers.get('If-None-Match');
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers });
      }

      const ifModifiedSince = request.headers.get('If-Modified-Since');
      if (ifModifiedSince) {
        const ifModifiedDate = new Date(ifModifiedSince);
        if (stats.mtimeMs <= ifModifiedDate.getTime()) {
          return new Response(null, { status: 304, headers });
        }
      }

      // Return file
      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      return new Response(file, { status: 200, headers });
    } catch (error) {
      // File not found
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Try fallback for SPA routing
        if (fallback) {
          const fallbackPath = join(root, fallback);
          try {
            const file = Bun.file(fallbackPath);
            return new Response(file, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
              },
            });
          } catch {
            // Fallback also not found
          }
        }
        return null;
      }
      throw error;
    }
  };
}

/**
 * Create a directory listing response.
 */
async function createDirectoryListing(dirpath: string, pathname: string): Promise<Response> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dirpath, { withFileTypes: true });

  const items = entries.map((entry) => {
    const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
    const href = join(pathname, entry.name);
    return `<li><a href="${href}">${name}</a></li>`;
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Index of ${pathname}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.25rem 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Index of ${pathname}</h1>
  <ul>
    ${pathname !== '/' ? '<li><a href="..">..</a></li>' : ''}
    ${items.join('\n    ')}
  </ul>
</body>
</html>
  `.trim();

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Middleware version of static file serving.
 */
export function staticMiddleware(options: StaticOptions) {
  const handler = serveStatic(options);

  return async (request: Request, context: any, next: () => Promise<Response>) => {
    const response = await handler(request);
    if (response) return response;
    return next();
  };
}
