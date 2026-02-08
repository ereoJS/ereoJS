/**
 * @ereo/data - Explicit Caching
 *
 * A transparent caching system with tags for invalidation.
 * No hidden magic - you see exactly what's being cached.
 */

import type {
  CacheOptions,
  CacheAdapter,
  TaggedCache,
  CacheSetOptions as CoreCacheSetOptions,
} from '@ereo/core';

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
 * This is the legacy interface used by @ereo/data.
 * For new implementations, consider using CacheAdapter from @ereo/core.
 */
export interface CacheStorage {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<boolean | void>;
  deleteByTag(tag: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Options for MemoryCache.
 */
export interface MemoryCacheOptions {
  /** Maximum number of entries (default: Infinity) */
  maxEntries?: number;
}

/**
 * In-memory cache implementation with optional LRU eviction.
 * Implements the CacheStorage interface with full entry metadata support.
 *
 * For the unified CacheAdapter interface, use createDataCacheAdapter() or
 * asCacheAdapter() to get a compatible wrapper.
 */
export class MemoryCache implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>();
  private readonly maxEntries: number;

  constructor(options?: MemoryCacheOptions) {
    this.maxEntries = options?.maxEntries ?? Infinity;
  }

  // ============================================================================
  // CacheStorage Interface
  // ============================================================================

  /**
   * Get a cache entry with full metadata.
   */
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

    // Promote to end of Map for LRU ordering
    if (this.maxEntries !== Infinity) {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }

    return entry as CacheEntry<T>;
  }

  /**
   * Set a cache entry with full metadata.
   */
  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Remove existing entry first (to update tags properly)
    if (this.cache.has(key)) {
      await this.delete(key);
    }

    // Evict LRU entries if at capacity
    while (this.cache.size >= this.maxEntries && this.cache.size > 0) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) await this.delete(oldest);
    }

    this.cache.set(key, entry as CacheEntry);

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Delete a cache entry.
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      // Remove from tag index
      for (const tag of entry.tags) {
        const tagSet = this.tagIndex.get(tag);
        if (tagSet) {
          tagSet.delete(key);
          if (tagSet.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Delete all entries with a specific tag.
   */
  async deleteByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      // Copy keys since we'll be modifying the set during iteration
      const keysCopy = [...keys];
      for (const key of keysCopy) {
        await this.delete(key);
      }
    }
  }

  /**
   * Clear all entries.
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  /**
   * Get all keys in the cache.
   */
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

  // ============================================================================
  // Unified CacheAdapter-compatible Methods
  // ============================================================================

  /**
   * Get just the value from the cache (not the full entry).
   * Use this for CacheAdapter-compatible access.
   */
  async getValue<T>(key: string): Promise<T | undefined> {
    const entry = await this.get<T>(key);
    return entry?.value;
  }

  /**
   * Set a value using the unified interface.
   * Converts ttl (seconds) and tags from options to a CacheEntry.
   */
  async setValue<T>(key: string, value: T, options?: CoreCacheSetOptions): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      maxAge: options?.ttl ?? 60,
      tags: options?.tags ?? [],
    };
    await this.set(key, entry);
  }

  /**
   * Check if a key exists in the cache.
   */
  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  /**
   * Invalidate all cache entries with a specific tag.
   * Alias for deleteByTag for TaggedCache compatibility.
   */
  async invalidateTag(tag: string): Promise<void> {
    return this.deleteByTag(tag);
  }

  /**
   * Invalidate all cache entries with any of the specified tags.
   */
  async invalidateTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidateTag(tag);
    }
  }

  /**
   * Get all cache keys associated with a specific tag.
   */
  async getByTag(tag: string): Promise<string[]> {
    const keys = this.tagIndex.get(tag);
    if (!keys) {
      return [];
    }

    // Filter out expired entries
    const validKeys: string[] = [];
    for (const key of keys) {
      if (await this.has(key)) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Create a CacheAdapter-compatible wrapper around this cache.
   */
  asCacheAdapter(): CacheAdapter & TaggedCache {
    return {
      get: <T>(key: string) => this.getValue<T>(key),
      set: <T>(key: string, value: T, options?: CoreCacheSetOptions) =>
        this.setValue(key, value, options),
      delete: (key: string) => this.delete(key),
      has: (key: string) => this.has(key),
      clear: () => this.clear(),
      invalidateTag: (tag: string) => this.invalidateTag(tag),
      invalidateTags: (tags: string[]) => this.invalidateTags(tags),
      getByTag: (tag: string) => this.getByTag(tag),
    };
  }
}

/**
 * Create a CacheAdapter-compatible wrapper around a new MemoryCache.
 * Use this when you need a pure CacheAdapter without legacy methods.
 */
export function createDataCacheAdapter(options?: MemoryCacheOptions): CacheAdapter & TaggedCache {
  const memoryCache = new MemoryCache(options);
  return memoryCache.asCacheAdapter();
}

/**
 * Global cache instance (singleton).
 */
let globalCache: CacheStorage | null = null;

/**
 * Get or create the global cache instance.
 */
export function getCache(options?: MemoryCacheOptions): CacheStorage {
  if (!globalCache) {
    globalCache = new MemoryCache(options);
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
