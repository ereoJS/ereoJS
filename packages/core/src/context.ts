/**
 * @ereo/core - Request Context
 *
 * Web Standards-based request context that travels through the request lifecycle.
 * Provides cache control, key-value storage, and response header management.
 */

import type { AppContext, CacheControl, CacheOptions } from './types';

/**
 * Create a new request context for handling a request.
 * Each request gets its own isolated context.
 */
export function createContext(request: Request): RequestContext {
  return new RequestContext(request);
}

/**
 * Request-scoped context that provides:
 * - Cache control configuration
 * - Key-value storage for passing data between middleware/loaders
 * - Response headers management
 */
export class RequestContext implements AppContext {
  readonly url: URL;
  readonly env: Record<string, string | undefined>;
  readonly responseHeaders: Headers;

  private store = new Map<string, unknown>();
  private cacheOptions: CacheOptions | undefined;
  private cacheTags: string[] = [];

  constructor(request: Request) {
    this.url = new URL(request.url);
    this.env = typeof process !== 'undefined' ? process.env : {};
    this.responseHeaders = new Headers();
  }

  /**
   * Cache control for the current request.
   * Allows setting explicit caching with tags for invalidation.
   */
  readonly cache: CacheControl = {
    set: (options: CacheOptions) => {
      this.cacheOptions = options;
      if (options.tags) {
        this.cacheTags = [...new Set([...this.cacheTags, ...options.tags])];
      }
    },
    get: () => this.cacheOptions,
    getTags: () => this.cacheTags,
    addTags: (tags: string[]) => {
      this.cacheTags = [...new Set([...this.cacheTags, ...tags])];
    },
  };

  /**
   * Get a value from the context store.
   * Useful for sharing data between middleware and loaders.
   */
  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /**
   * Set a value in the context store.
   * Values are scoped to the current request only.
   */
  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  /**
   * Check if a key exists in the context store.
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Delete a key from the context store.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Build Cache-Control header value from options.
   */
  buildCacheControlHeader(): string | null {
    if (!this.cacheOptions) return null;

    const parts: string[] = [];
    const { maxAge, staleWhileRevalidate, private: isPrivate } = this.cacheOptions;

    if (isPrivate) {
      parts.push('private');
    } else {
      parts.push('public');
    }

    if (maxAge !== undefined) {
      parts.push(`max-age=${maxAge}`);
    }

    if (staleWhileRevalidate !== undefined) {
      parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Apply cache control and other context headers to a response.
   */
  applyToResponse(response: Response): Response {
    const headers = new Headers(response.headers);

    // Merge response headers from context
    this.responseHeaders.forEach((value, key) => {
      headers.set(key, value);
    });

    // Apply cache control
    const cacheControl = this.buildCacheControlHeader();
    if (cacheControl && !headers.has('Cache-Control')) {
      headers.set('Cache-Control', cacheControl);
    }

    // Add cache tags header for CDN invalidation
    if (this.cacheTags.length > 0 && !headers.has('X-Cache-Tags')) {
      headers.set('X-Cache-Tags', this.cacheTags.join(','));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

/**
 * Type guard to check if a value is a RequestContext.
 */
export function isRequestContext(value: unknown): value is RequestContext {
  return value instanceof RequestContext;
}

/**
 * Extract context from a request if it was previously attached.
 * This is used internally by the framework.
 */
const contextSymbol = Symbol.for('ereo.context');

export function attachContext(request: Request, context: RequestContext): void {
  (request as any)[contextSymbol] = context;
}

export function getContext(request: Request): RequestContext | undefined {
  return (request as any)[contextSymbol];
}
