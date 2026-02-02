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
export declare class MemoryCache implements CacheStorage {
    private cache;
    private tagIndex;
    get<T>(key: string): Promise<CacheEntry<T> | null>;
    set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
    delete(key: string): Promise<void>;
    deleteByTag(tag: string): Promise<void>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
    /**
     * Get cache statistics.
     */
    getStats(): {
        size: number;
        tags: number;
    };
}
/**
 * Get or create the global cache instance.
 */
export declare function getCache(): CacheStorage;
/**
 * Set a custom cache storage.
 */
export declare function setCache(storage: CacheStorage): void;
/**
 * Cache function result with explicit options.
 */
export declare function cached<T>(key: string, fn: () => Promise<T>, options: CacheOptions): Promise<T>;
/**
 * Generate a cache key from request.
 */
export declare function generateCacheKey(request: Request): string;
/**
 * Generate a cache key with custom prefix.
 */
export declare function cacheKey(prefix: string, ...parts: (string | number)[]): string;
/**
 * Build Cache-Control header from options.
 */
export declare function buildCacheControl(options: CacheOptions): string;
/**
 * Parse Cache-Control header to options.
 */
export declare function parseCacheControl(header: string): CacheOptions;
/**
 * Decorator for caching method results.
 */
export declare function Cached(options: CacheOptions): <T extends (...args: any[]) => Promise<any>>(_target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T>;
//# sourceMappingURL=cache.d.ts.map