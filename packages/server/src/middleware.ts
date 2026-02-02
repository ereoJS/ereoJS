/**
 * @oreo/server - Middleware Chain
 *
 * Hono-inspired middleware system for request processing.
 * Uses Web Standards throughout.
 */

import type { MiddlewareHandler, NextFunction, AppContext } from '@oreo/core';
import { createContext, RequestContext } from '@oreo/core';

/**
 * Middleware definition with optional path matching.
 */
export interface MiddlewareDefinition {
  path?: string | string[];
  handler: MiddlewareHandler;
}

/**
 * Middleware chain executor.
 */
export class MiddlewareChain {
  private middlewares: MiddlewareDefinition[] = [];

  /**
   * Add middleware to the chain.
   */
  use(handler: MiddlewareHandler): this;
  use(path: string, handler: MiddlewareHandler): this;
  use(pathOrHandler: string | MiddlewareHandler, maybeHandler?: MiddlewareHandler): this {
    if (typeof pathOrHandler === 'function') {
      this.middlewares.push({ handler: pathOrHandler });
    } else {
      this.middlewares.push({ path: pathOrHandler, handler: maybeHandler! });
    }
    return this;
  }

  /**
   * Execute middleware chain.
   */
  async execute(
    request: Request,
    context: RequestContext,
    final: () => Promise<Response>
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Filter applicable middleware
    const applicable = this.middlewares.filter((m) => {
      if (!m.path) return true;
      const paths = Array.isArray(m.path) ? m.path : [m.path];
      return paths.some((p) => this.matchPath(pathname, p));
    });

    let index = 0;

    const next: NextFunction = async () => {
      if (index < applicable.length) {
        const middleware = applicable[index++];
        return middleware.handler(request, context, next);
      }
      return final();
    };

    return next();
  }

  /**
   * Simple path matching (supports * wildcard).
   */
  private matchPath(pathname: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return pathname.startsWith(prefix);
    }
    return pathname === pattern;
  }
}

/**
 * Create a middleware chain.
 */
export function createMiddlewareChain(): MiddlewareChain {
  return new MiddlewareChain();
}

// ============================================================================
// Built-in Middleware
// ============================================================================

/**
 * Logging middleware.
 */
export function logger(): MiddlewareHandler {
  return async (request, context, next) => {
    const start = performance.now();
    const url = new URL(request.url);

    console.log(`→ ${request.method} ${url.pathname}`);

    const response = await next();

    const duration = (performance.now() - start).toFixed(2);
    console.log(`← ${request.method} ${url.pathname} ${response.status} ${duration}ms`);

    return response;
  };
}

/**
 * CORS middleware.
 */
export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(options: CorsOptions = {}): MiddlewareHandler {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400,
  } = options;

  return async (request, context, next) => {
    const requestOrigin = request.headers.get('Origin');

    // Determine allowed origin
    let allowedOrigin: string | null = null;
    if (typeof origin === 'string') {
      allowedOrigin = origin;
    } else if (Array.isArray(origin)) {
      allowedOrigin = requestOrigin && origin.includes(requestOrigin) ? requestOrigin : null;
    } else if (typeof origin === 'function') {
      allowedOrigin = requestOrigin && origin(requestOrigin) ? requestOrigin : null;
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin || '*',
          'Access-Control-Allow-Methods': methods.join(', '),
          'Access-Control-Allow-Headers': allowedHeaders.join(', '),
          'Access-Control-Max-Age': maxAge.toString(),
          ...(credentials && { 'Access-Control-Allow-Credentials': 'true' }),
        },
      });
    }

    // Add CORS headers to response
    const response = await next();
    const headers = new Headers(response.headers);

    if (allowedOrigin) {
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
    }
    if (exposedHeaders.length > 0) {
      headers.set('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }
    if (credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Security headers middleware.
 */
export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | false;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  xContentTypeOptions?: boolean;
  referrerPolicy?: string | false;
  permissionsPolicy?: string | false;
}

export function securityHeaders(options: SecurityHeadersOptions = {}): MiddlewareHandler {
  const {
    contentSecurityPolicy = "default-src 'self'",
    xFrameOptions = 'SAMEORIGIN',
    xContentTypeOptions = true,
    referrerPolicy = 'strict-origin-when-cross-origin',
    permissionsPolicy = false,
  } = options;

  return async (request, context, next) => {
    const response = await next();
    const headers = new Headers(response.headers);

    if (contentSecurityPolicy) {
      headers.set('Content-Security-Policy', contentSecurityPolicy);
    }
    if (xFrameOptions) {
      headers.set('X-Frame-Options', xFrameOptions);
    }
    if (xContentTypeOptions) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }
    if (referrerPolicy) {
      headers.set('Referrer-Policy', referrerPolicy);
    }
    if (permissionsPolicy) {
      headers.set('Permissions-Policy', permissionsPolicy);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Compression middleware (uses Bun's built-in compression).
 */
export function compress(): MiddlewareHandler {
  return async (request, context, next) => {
    const response = await next();

    // Check if client accepts compression
    const acceptEncoding = request.headers.get('Accept-Encoding') || '';
    const contentType = response.headers.get('Content-Type') || '';

    // Only compress text-based content
    const shouldCompress =
      (contentType.includes('text/') ||
        contentType.includes('application/json') ||
        contentType.includes('application/javascript')) &&
      acceptEncoding.includes('gzip');

    if (!shouldCompress) {
      return response;
    }

    // Bun handles compression automatically with Response body
    const headers = new Headers(response.headers);
    headers.set('Content-Encoding', 'gzip');

    return new Response(Bun.gzipSync(await response.arrayBuffer()), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Rate limiting middleware.
 */
export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (request: Request) => string;
}

export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
  const { windowMs = 60000, max = 100, keyGenerator } = options;

  const requests = new Map<string, { count: number; resetTime: number }>();

  const getKey = keyGenerator || ((request: Request) => {
    // Use IP or fallback
    const forwarded = request.headers.get('X-Forwarded-For');
    return forwarded?.split(',')[0].trim() || 'unknown';
  });

  return async (request, context, next) => {
    const key = getKey(request);
    const now = Date.now();

    let record = requests.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      requests.set(key, record);
    }

    record.count++;

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of requests) {
        if (now > v.resetTime) {
          requests.delete(k);
        }
      }
    }

    if (record.count > max) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
        },
      });
    }

    const response = await next();
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', max.toString());
    headers.set('X-RateLimit-Remaining', Math.max(0, max - record.count).toString());
    headers.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
