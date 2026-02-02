/**
 * @areo/core - Unified Cache Interface
 *
 * A unified cache adapter interface for the Areo framework.
 * All cache implementations should implement CacheAdapter for interoperability.
 */

// ============================================================================
// Core Cache Interfaces
// ============================================================================

/**
 * Options for cache set operations.
 */
export interface CacheSetOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Cache tags for grouped invalidation */
  tags?: string[];
}

/**
 * Base cache adapter interface.
 * All cache implementations in Areo should implement this interface.
 *
 * @example
 * // Using a cache adapter
 * const cache: CacheAdapter = createCache();
 *
 * await cache.set('user:123', userData, { ttl: 3600, tags: ['users'] });
 * const user = await cache.get<User>('user:123');
 * await cache.delete('user:123');
 */
export interface CacheAdapter {
  /**
   * Get a value from the cache.
   * @param key - Cache key
   * @returns The cached value, or undefined if not found or expired
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Set a value in the cache.
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options (ttl, tags)
   */
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;

  /**
   * Delete a value from the cache.
   * @param key - Cache key
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists in the cache.
   * @param key - Cache key
   * @returns true if the key exists and is not expired
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all entries from the cache.
   */
  clear(): Promise<void>;
}

/**
 * Extended cache adapter with tag-based invalidation support.
 * Use this interface when you need to invalidate groups of cached items.
 *
 * @example
 * const cache: TaggedCache = createCache({ tagged: true });
 *
 * // Store items with tags
 * await cache.set('post:1', post1, { tags: ['posts', 'user:alice'] });
 * await cache.set('post:2', post2, { tags: ['posts', 'user:bob'] });
 *
 * // Invalidate all posts
 * await cache.invalidateTag('posts');
 *
 * // Invalidate by user
 * await cache.invalidateTags(['user:alice']);
 */
export interface TaggedCache extends CacheAdapter {
  /**
   * Invalidate all cache entries with a specific tag.
   * @param tag - Tag to invalidate
   */
  invalidateTag(tag: string): Promise<void>;

  /**
   * Invalidate all cache entries with any of the specified tags.
   * @param tags - Array of tags to invalidate
   */
  invalidateTags(tags: string[]): Promise<void>;

  /**
   * Get all cache keys associated with a specific tag.
   * @param tag - Tag to look up
   * @returns Array of cache keys with this tag
   */
  getByTag(tag: string): Promise<string[]>;
}

// ============================================================================
// Cache Options
// ============================================================================

/**
 * Options for creating a cache instance.
 */
export interface CacheOptions {
  /** Maximum number of entries to store */
  maxSize?: number;
  /** Default TTL for entries in seconds */
  defaultTtl?: number;
  /** Enable tag support */
  tagged?: boolean;
}

// ============================================================================
// Memory Cache Implementation
// ============================================================================

/**
 * Internal cache entry structure.
 */
interface MemoryCacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  ttl?: number;
  tags: string[];
}

/**
 * Default in-memory cache implementation.
 * Implements both CacheAdapter and TaggedCache interfaces.
 */
export class MemoryCacheAdapter implements TaggedCache {
  private readonly cache = new Map<string, MemoryCacheEntry>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly maxSize: number;
  private readonly defaultTtl?: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? Infinity;
    this.defaultTtl = options.defaultTtl;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      await this.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    // Remove existing entry first (to update tags properly)
    if (this.cache.has(key)) {
      await this.delete(key);
    }

    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        await this.delete(firstKey);
      }
    }

    const tags = options?.tags ?? [];
    const ttl = options?.ttl ?? this.defaultTtl;

    const entry: MemoryCacheEntry<T> = {
      value,
      createdAt: Date.now(),
      ttl,
      tags,
    };

    this.cache.set(key, entry as MemoryCacheEntry);

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

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

    return this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  async invalidateTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (!keys) {
      return;
    }

    // Copy keys since we'll be modifying the set during iteration
    const keysCopy = [...keys];
    for (const key of keysCopy) {
      await this.delete(key);
    }
  }

  async invalidateTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidateTag(tag);
    }
  }

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
   * Get cache statistics.
   */
  getStats(): { size: number; tags: number } {
    return {
      size: this.cache.size,
      tags: this.tagIndex.size,
    };
  }

  /**
   * Get all keys in the cache.
   */
  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if an entry is expired.
   */
  private isExpired(entry: MemoryCacheEntry): boolean {
    if (!entry.ttl) {
      return false;
    }

    const age = Date.now() - entry.createdAt;
    return age > entry.ttl * 1000;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new cache instance.
 *
 * @param options - Cache configuration options
 * @returns A CacheAdapter (or TaggedCache if tagged option is true)
 *
 * @example
 * // Simple cache
 * const cache = createCache();
 *
 * // Cache with size limit
 * const limitedCache = createCache({ maxSize: 1000 });
 *
 * // Cache with default TTL
 * const ttlCache = createCache({ defaultTtl: 3600 });
 *
 * // Tagged cache for invalidation
 * const taggedCache = createCache({ tagged: true });
 */
export function createCache(options?: CacheOptions): CacheAdapter {
  return new MemoryCacheAdapter(options);
}

/**
 * Create a tagged cache instance with invalidation support.
 *
 * @param options - Cache configuration options
 * @returns A TaggedCache instance
 */
export function createTaggedCache(options?: Omit<CacheOptions, 'tagged'>): TaggedCache {
  return new MemoryCacheAdapter({ ...options, tagged: true });
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a cache adapter supports tag operations.
 */
export function isTaggedCache(cache: CacheAdapter): cache is TaggedCache {
  return (
    'invalidateTag' in cache &&
    'invalidateTags' in cache &&
    'getByTag' in cache &&
    typeof (cache as TaggedCache).invalidateTag === 'function' &&
    typeof (cache as TaggedCache).invalidateTags === 'function' &&
    typeof (cache as TaggedCache).getByTag === 'function'
  );
}

// ============================================================================
// Adapter Wrapper
// ============================================================================

/**
 * Wrap any object with get/set methods to conform to CacheAdapter interface.
 * Useful for adapting existing cache implementations.
 *
 * @param impl - Object with cache-like methods
 * @returns A conformant CacheAdapter
 *
 * @example
 * // Adapt a simple Map-based cache
 * const mapCache = new Map();
 * const adapter = wrapCacheAdapter({
 *   get: async (key) => mapCache.get(key),
 *   set: async (key, value) => { mapCache.set(key, value); },
 *   delete: async (key) => mapCache.delete(key),
 *   has: async (key) => mapCache.has(key),
 *   clear: async () => mapCache.clear(),
 * });
 */
export function wrapCacheAdapter(impl: {
  get: <T>(key: string) => Promise<T | undefined> | T | undefined;
  set: <T>(key: string, value: T, options?: CacheSetOptions) => Promise<void> | void;
  delete: (key: string) => Promise<boolean> | boolean;
  has: (key: string) => Promise<boolean> | boolean;
  clear: () => Promise<void> | void;
}): CacheAdapter {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return impl.get<T>(key);
    },
    async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
      await impl.set(key, value, options);
    },
    async delete(key: string): Promise<boolean> {
      return impl.delete(key);
    },
    async has(key: string): Promise<boolean> {
      return impl.has(key);
    },
    async clear(): Promise<void> {
      await impl.clear();
    },
  };
}
