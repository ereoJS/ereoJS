/**
 * @ereo/core - Request Context
 *
 * Web Standards-based request context that travels through the request lifecycle.
 * Provides cache control, key-value storage, and response header management.
 */

import type { AppContext, CacheControl, CacheOptions, CookieJar, CookieSetOptions } from './types';

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
  private cookieMap = new Map<string, string>();
  private setCookieHeaders: string[] = [];

  constructor(request: Request) {
    try {
      this.url = new URL(request.url);
    } catch {
      // Fallback for malformed URLs from misconfigured proxies
      this.url = new URL('http://localhost/');
    }
    this.env = typeof process !== 'undefined' ? process.env : {};
    this.responseHeaders = new Headers();

    // Parse Cookie header
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      for (const pair of cookieHeader.split(';')) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex === -1) continue;
        const name = pair.slice(0, eqIndex).trim();
        const value = pair.slice(eqIndex + 1).trim();
        if (name) {
          try {
            this.cookieMap.set(name, decodeURIComponent(value));
          } catch {
            // Malformed %-encoding; store raw value
            this.cookieMap.set(name, value);
          }
        }
      }
    }
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
   * Cookie jar for reading/writing cookies.
   */
  readonly cookies: CookieJar = {
    get: (name: string): string | undefined => {
      return this.cookieMap.get(name);
    },
    getAll: (): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const [name, value] of this.cookieMap) {
        result[name] = value;
      }
      return result;
    },
    set: (name: string, value: string, options: CookieSetOptions = {}): void => {
      this.cookieMap.set(name, value);
      const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
      if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
      if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
      parts.push(`Path=${options.path ?? '/'}`);
      if (options.domain) parts.push(`Domain=${options.domain}`);
      if (options.httpOnly !== false) parts.push('HttpOnly');
      if (options.secure) parts.push('Secure');
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
      this.setCookieHeaders.push(parts.join('; '));
    },
    delete: (name: string, options?: Pick<CookieSetOptions, 'path' | 'domain' | 'httpOnly'>): void => {
      this.cookieMap.delete(name);
      const parts = [`${encodeURIComponent(name)}=`, 'Max-Age=0'];
      parts.push(`Path=${options?.path ?? '/'}`);
      if (options?.domain) parts.push(`Domain=${options.domain}`);
      // Only add HttpOnly if not explicitly disabled — mirrors the set() behavior
      if (options?.httpOnly !== false) parts.push('HttpOnly');
      this.setCookieHeaders.push(parts.join('; '));
    },
    has: (name: string): boolean => {
      return this.cookieMap.has(name);
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

    // Append Set-Cookie headers
    for (const setCookie of this.setCookieHeaders) {
      headers.append('Set-Cookie', setCookie);
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
