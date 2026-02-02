/**
 * @areo/plugin-images - Transform Cache Management
 *
 * LRU memory cache and disk cache for optimized images.
 */

import { readFile, writeFile, mkdir, unlink, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Cached item with metadata.
 */
interface CacheItem<T> {
  value: T;
  size: number;
  createdAt: number;
  lastAccessed: number;
}

/**
 * LRU memory cache options.
 */
export interface MemoryCacheOptions {
  /** Maximum number of items */
  maxItems?: number;
  /** Maximum total size in bytes */
  maxSize?: number;
  /** TTL in milliseconds (0 = no expiry) */
  ttl?: number;
}

/**
 * LRU memory cache for image buffers.
 */
export class MemoryCache {
  private readonly cache = new Map<string, CacheItem<Buffer>>();
  private readonly maxItems: number;
  private readonly maxSize: number;
  private readonly ttl: number;
  private currentSize = 0;

  constructor(options: MemoryCacheOptions = {}) {
    this.maxItems = options.maxItems ?? 100;
    this.maxSize = options.maxSize ?? 100 * 1024 * 1024; // 100MB
    this.ttl = options.ttl ?? 0;
  }

  /**
   * Get an item from cache.
   */
  get(key: string): Buffer | undefined {
    const item = this.cache.get(key);

    if (!item) {
      return undefined;
    }

    // Check TTL
    if (this.ttl > 0 && Date.now() - item.createdAt > this.ttl) {
      this.delete(key);
      return undefined;
    }

    // Update last accessed time (LRU)
    item.lastAccessed = Date.now();

    return item.value;
  }

  /**
   * Set an item in cache.
   */
  set(key: string, value: Buffer): void {
    // Remove existing item if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const size = value.length;

    // Evict items if necessary
    while (
      (this.cache.size >= this.maxItems || this.currentSize + size > this.maxSize) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // Don't cache if single item exceeds max size
    if (size > this.maxSize) {
      return;
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      size,
      createdAt: now,
      lastAccessed: now,
    });

    this.currentSize += size;
  }

  /**
   * Check if key exists in cache.
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    // Check TTL
    if (this.ttl > 0 && Date.now() - item.createdAt > this.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete an item from cache.
   */
  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    this.currentSize -= item.size;
    return this.cache.delete(key);
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics.
   */
  stats(): { items: number; size: number; maxItems: number; maxSize: number } {
    return {
      items: this.cache.size,
      size: this.currentSize,
      maxItems: this.maxItems,
      maxSize: this.maxSize,
    };
  }

  /**
   * Evict the least recently used item.
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}

/**
 * Disk cache options.
 */
export interface DiskCacheOptions {
  /** Cache directory */
  dir: string;
  /** Maximum total size in bytes */
  maxSize?: number;
  /** TTL in milliseconds (0 = no expiry) */
  ttl?: number;
}

/**
 * Disk cache for persisting optimized images.
 */
export class DiskCache {
  private readonly dir: string;
  private readonly maxSize: number;
  private readonly ttl: number;
  private initialized = false;

  constructor(options: DiskCacheOptions) {
    this.dir = options.dir;
    this.maxSize = options.maxSize ?? 500 * 1024 * 1024; // 500MB
    this.ttl = options.ttl ?? 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Initialize the cache directory.
   */
  private async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await mkdir(this.dir, { recursive: true });
    this.initialized = true;
  }

  /**
   * Generate a file path for a cache key.
   */
  private getPath(key: string): string {
    const hash = createHash('md5').update(key).digest('hex');
    // Use first 2 chars as subdirectory to avoid too many files in one dir
    return join(this.dir, hash.slice(0, 2), hash);
  }

  /**
   * Get an item from disk cache.
   */
  async get(key: string): Promise<Buffer | undefined> {
    await this.init();

    const path = this.getPath(key);

    try {
      const stats = await stat(path);

      // Check TTL
      if (this.ttl > 0 && Date.now() - stats.mtimeMs > this.ttl) {
        await unlink(path).catch(() => {});
        return undefined;
      }

      return await readFile(path);
    } catch {
      return undefined;
    }
  }

  /**
   * Set an item in disk cache.
   */
  async set(key: string, value: Buffer): Promise<void> {
    await this.init();

    const path = this.getPath(key);

    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value);
    } catch (error) {
      console.warn('Failed to write to disk cache:', error);
    }
  }

  /**
   * Check if key exists in disk cache.
   */
  async has(key: string): Promise<boolean> {
    await this.init();

    const path = this.getPath(key);

    try {
      const stats = await stat(path);

      // Check TTL
      if (this.ttl > 0 && Date.now() - stats.mtimeMs > this.ttl) {
        await unlink(path).catch(() => {});
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete an item from disk cache.
   */
  async delete(key: string): Promise<boolean> {
    await this.init();

    const path = this.getPath(key);

    try {
      await unlink(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired entries.
   */
  async cleanup(): Promise<{ deleted: number; freed: number }> {
    await this.init();

    let deleted = 0;
    let freed = 0;

    try {
      const subdirs = await readdir(this.dir);

      for (const subdir of subdirs) {
        const subdirPath = join(this.dir, subdir);
        const stats = await stat(subdirPath).catch(() => null);

        if (!stats?.isDirectory()) {
          continue;
        }

        const files = await readdir(subdirPath);

        for (const file of files) {
          const filePath = join(subdirPath, file);
          const fileStats = await stat(filePath).catch(() => null);

          if (!fileStats) {
            continue;
          }

          // Check TTL
          if (this.ttl > 0 && Date.now() - fileStats.mtimeMs > this.ttl) {
            try {
              await unlink(filePath);
              deleted++;
              freed += fileStats.size;
            } catch {
              // Ignore deletion errors
            }
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    return { deleted, freed };
  }

  /**
   * Get cache statistics.
   */
  async stats(): Promise<{ files: number; size: number }> {
    await this.init();

    let files = 0;
    let size = 0;

    try {
      const subdirs = await readdir(this.dir);

      for (const subdir of subdirs) {
        const subdirPath = join(this.dir, subdir);
        const stats = await stat(subdirPath).catch(() => null);

        if (!stats?.isDirectory()) {
          continue;
        }

        const dirFiles = await readdir(subdirPath);

        for (const file of dirFiles) {
          const filePath = join(subdirPath, file);
          const fileStats = await stat(filePath).catch(() => null);

          if (fileStats?.isFile()) {
            files++;
            size += fileStats.size;
          }
        }
      }
    } catch {
      // Ignore stat errors
    }

    return { files, size };
  }
}

/**
 * Two-tier cache combining memory and disk.
 */
export class TwoTierCache {
  private readonly memory: MemoryCache;
  private readonly disk: DiskCache;

  constructor(options: { memory?: MemoryCacheOptions; disk: DiskCacheOptions }) {
    this.memory = new MemoryCache(options.memory);
    this.disk = new DiskCache(options.disk);
  }

  /**
   * Get an item from cache (checks memory first, then disk).
   */
  async get(key: string): Promise<Buffer | undefined> {
    // Check memory first
    const memResult = this.memory.get(key);
    if (memResult) {
      return memResult;
    }

    // Check disk
    const diskResult = await this.disk.get(key);
    if (diskResult) {
      // Promote to memory cache
      this.memory.set(key, diskResult);
      return diskResult;
    }

    return undefined;
  }

  /**
   * Set an item in cache (writes to both memory and disk).
   */
  async set(key: string, value: Buffer): Promise<void> {
    this.memory.set(key, value);
    await this.disk.set(key, value);
  }

  /**
   * Check if key exists in either cache.
   */
  async has(key: string): Promise<boolean> {
    if (this.memory.has(key)) {
      return true;
    }
    return this.disk.has(key);
  }

  /**
   * Delete from both caches.
   */
  async delete(key: string): Promise<boolean> {
    const memDeleted = this.memory.delete(key);
    const diskDeleted = await this.disk.delete(key);
    return memDeleted || diskDeleted;
  }

  /**
   * Clear both caches.
   */
  async clear(): Promise<void> {
    this.memory.clear();
    // Note: We don't clear disk cache here to preserve persistent data
  }

  /**
   * Get combined statistics.
   */
  async stats(): Promise<{
    memory: { items: number; size: number };
    disk: { files: number; size: number };
  }> {
    const memStats = this.memory.stats();
    const diskStats = await this.disk.stats();

    return {
      memory: { items: memStats.items, size: memStats.size },
      disk: diskStats,
    };
  }

  /**
   * Clean up expired disk cache entries.
   */
  async cleanup(): Promise<{ deleted: number; freed: number }> {
    return this.disk.cleanup();
  }
}

/**
 * Generate a cache key for image optimization parameters.
 */
export function generateCacheKey(params: {
  src: string;
  width: number;
  height?: number;
  quality?: number;
  format?: string;
}): string {
  return `${params.src}:w${params.width}:h${params.height || ''}:q${params.quality || ''}:f${params.format || ''}`;
}
