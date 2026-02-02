/**
 * @areo/data - Explicit Caching
 *
 * A transparent caching system with tags for invalidation.
 * No hidden magic - you see exactly what's being cached.
 */

import type { CacheOptions } from '@areo/core';

/**
 * Cache entry with metadata.
 */
export interface CacheEntry<T = unknown> {
  value: T;
  timestamp: number;
  maxAge: number;
  staleWhileRevalidate?: number;
  tags: string[];
}

/**
 * Cache storage interface.
 */
export interface CacheStorage {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByTag(tag: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * In-memory cache implementation.
 */
export class MemoryCache implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    const age = Date.now() - entry.timestamp;
    const isStale = age > entry.maxAge * 1000;
    const isExpired = isStale && (!entry.staleWhileRevalidate ||
      age > (entry.maxAge + entry.staleWhileRevalidate) * 1000);

    if (isExpired) {
      await this.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.cache.set(key, entry as CacheEntry);

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      // Remove from tag index
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
      this.cache.delete(key);
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; tags: number } {
    return {
      size: this.cache.size,
      tags: this.tagIndex.size,
    };
  }
}

/**
 * Global cache instance (singleton).
 */
let globalCache: CacheStorage | null = null;

/**
 * Get or create the global cache instance.
 */
export function getCache(): CacheStorage {
  if (!globalCache) {
    globalCache = new MemoryCache();
  }
  return globalCache;
}

/**
 * Set a custom cache storage.
 */
export function setCache(storage: CacheStorage): void {
  globalCache = storage;
}

/**
 * Cache function result with explicit options.
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const cache = getCache();

  // Check for cached value
  const entry = await cache.get<T>(key);

  if (entry) {
    const age = Date.now() - entry.timestamp;
    const isStale = age > entry.maxAge * 1000;

    if (!isStale) {
      return entry.value;
    }

    // Stale-while-revalidate: return stale and refresh in background
    if (entry.staleWhileRevalidate) {
      // Fire and forget revalidation
      revalidate(key, fn, options);
      return entry.value;
    }
  }

  // Fetch fresh data
  const value = await fn();

  // Store in cache
  await cache.set(key, {
    value,
    timestamp: Date.now(),
    maxAge: options.maxAge ?? 60,
    staleWhileRevalidate: options.staleWhileRevalidate,
    tags: options.tags ?? [],
  });

  return value;
}

/**
 * Revalidate a cache entry.
 */
async function revalidate<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions
): Promise<void> {
  try {
    const value = await fn();
    const cache = getCache();

    await cache.set(key, {
      value,
      timestamp: Date.now(),
      maxAge: options.maxAge ?? 60,
      staleWhileRevalidate: options.staleWhileRevalidate,
      tags: options.tags ?? [],
    });
  } catch (error) {
    console.error(`Failed to revalidate cache key: ${key}`, error);
  }
}

/**
 * Generate a cache key from request.
 */
export function generateCacheKey(request: Request): string {
  const url = new URL(request.url);
  return `${request.method}:${url.pathname}${url.search}`;
}

/**
 * Generate a cache key with custom prefix.
 */
export function cacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Build Cache-Control header from options.
 */
export function buildCacheControl(options: CacheOptions): string {
  const parts: string[] = [];

  if (options.private) {
    parts.push('private');
  } else {
    parts.push('public');
  }

  if (options.maxAge !== undefined) {
    parts.push(`max-age=${options.maxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  return parts.join(', ');
}

/**
 * Parse Cache-Control header to options.
 */
export function parseCacheControl(header: string): CacheOptions {
  const options: CacheOptions = {};
  const directives = header.split(',').map((d) => d.trim().toLowerCase());

  for (const directive of directives) {
    if (directive === 'private') {
      options.private = true;
    } else if (directive.startsWith('max-age=')) {
      options.maxAge = parseInt(directive.slice(8), 10);
    } else if (directive.startsWith('stale-while-revalidate=')) {
      options.staleWhileRevalidate = parseInt(directive.slice(23), 10);
    }
  }

  return options;
}

/**
 * Decorator for caching method results.
 */
export function Cached(options: CacheOptions) {
  return function <T extends (...args: any[]) => Promise<any>>(
    _target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: unknown, ...args: any[]) {
      const key = cacheKey(propertyKey, JSON.stringify(args));
      return cached(key, () => originalMethod.apply(this, args), options);
    } as T;

    return descriptor;
  };
}
