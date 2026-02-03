/**
 * @ereo/db - Query Deduplication
 *
 * Request-scoped query deduplication using EreoJS's RequestContext.
 * Automatically caches identical queries within a single request to avoid
 * redundant database calls (e.g., N+1 queries in nested loaders).
 */

import type { AppContext } from '@ereo/core';
import type { DedupStats, DedupResult } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Key used to store dedup cache in request context */
const DEDUP_CACHE_KEY = '__ereo_db_dedup_cache';

/** Key used to store dedup stats in request context */
const DEDUP_STATS_KEY = '__ereo_db_dedup_stats';

// ============================================================================
// Types
// ============================================================================

/** Internal cache entry */
interface CacheEntry<T = unknown> {
  result: T;
  timestamp: number;
  tables?: string[];
}

/** Internal cache structure */
type DedupCache = Map<string, CacheEntry>;

/** Internal stats structure */
interface InternalStats {
  total: number;
  hits: number;
  misses: number;
}

// ============================================================================
// Fingerprint Generation
// ============================================================================

/**
 * Generate a cache key (fingerprint) for a query.
 * The fingerprint is deterministic for the same query + params combination.
 *
 * @param query - SQL query or query identifier
 * @param params - Query parameters
 * @returns A string fingerprint suitable for use as a cache key
 */
export function generateFingerprint(query: string, params?: unknown[]): string {
  // Normalize the query by removing extra whitespace
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');

  // Serialize params in a deterministic way
  const serializedParams = params
    ? JSON.stringify(params, (_, value) => {
        // Handle special types that JSON.stringify doesn't handle well
        if (value instanceof Date) {
          return `__date:${value.toISOString()}`;
        }
        if (typeof value === 'bigint') {
          return `__bigint:${value.toString()}`;
        }
        if (value === undefined) {
          return '__undefined';
        }
        return value;
      })
    : '';

  // Create a simple hash using the query and params
  // This is fast and sufficient for request-scoped caching
  return `${hashString(normalizedQuery)}:${hashString(serializedParams)}`;
}

/**
 * Simple string hash function (djb2 algorithm).
 * Fast and suitable for cache keys.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Get or create the dedup cache for a request context.
 */
function getCache(context: AppContext): DedupCache {
  let cache = context.get<DedupCache>(DEDUP_CACHE_KEY);
  if (!cache) {
    cache = new Map();
    context.set(DEDUP_CACHE_KEY, cache);
  }
  return cache;
}

/**
 * Get or create the stats tracker for a request context.
 */
function getStats(context: AppContext): InternalStats {
  let stats = context.get<InternalStats>(DEDUP_STATS_KEY);
  if (!stats) {
    stats = { total: 0, hits: 0, misses: 0 };
    context.set(DEDUP_STATS_KEY, stats);
  }
  return stats;
}

// ============================================================================
// Deduplication Logic
// ============================================================================

/**
 * Execute a query with automatic deduplication.
 * If an identical query was already executed in this request, returns the cached result.
 *
 * @param context - The request context
 * @param query - SQL query or query identifier
 * @param params - Query parameters
 * @param executor - Function that executes the actual query
 * @param options - Additional options for caching behavior
 * @returns The query result wrapped with dedup metadata
 */
export async function dedupQuery<T>(
  context: AppContext,
  query: string,
  params: unknown[] | undefined,
  executor: () => Promise<T>,
  options?: {
    /** Tables affected by this query (for selective invalidation) */
    tables?: string[];
    /** Skip caching for this query */
    noCache?: boolean;
  }
): Promise<DedupResult<T>> {
  const stats = getStats(context);
  stats.total++;

  // Skip caching if requested
  if (options?.noCache) {
    const result = await executor();
    stats.misses++;
    return {
      result,
      fromCache: false,
      cacheKey: '',
    };
  }

  const cache = getCache(context);
  const cacheKey = generateFingerprint(query, params);

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    stats.hits++;
    return {
      result: cached.result as T,
      fromCache: true,
      cacheKey,
    };
  }

  // Execute query and cache result
  const result = await executor();
  stats.misses++;

  cache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    tables: options?.tables,
  });

  return {
    result,
    fromCache: false,
    cacheKey,
  };
}

/**
 * Clear the entire dedup cache for a request.
 * Call this after mutations to ensure subsequent reads get fresh data.
 *
 * @param context - The request context
 */
export function clearDedupCache(context: AppContext): void {
  const cache = context.get<DedupCache>(DEDUP_CACHE_KEY);
  if (cache) {
    cache.clear();
  }
}

/**
 * Invalidate cache entries related to specific tables.
 * More selective than clearing the entire cache.
 *
 * @param context - The request context
 * @param tables - Table names to invalidate
 */
export function invalidateTables(context: AppContext, tables: string[]): void {
  const cache = context.get<DedupCache>(DEDUP_CACHE_KEY);
  if (!cache) return;

  const tableSet = new Set(tables.map(t => t.toLowerCase()));

  for (const [key, entry] of cache.entries()) {
    if (entry.tables) {
      const hasOverlap = entry.tables.some(t => tableSet.has(t.toLowerCase()));
      if (hasOverlap) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Get deduplication statistics for the current request.
 *
 * @param context - The request context
 * @returns Statistics about query deduplication
 */
export function getRequestDedupStats(context: AppContext): DedupStats {
  const stats = context.get<InternalStats>(DEDUP_STATS_KEY);

  if (!stats) {
    return {
      total: 0,
      deduplicated: 0,
      unique: 0,
      hitRate: 0,
    };
  }

  return {
    total: stats.total,
    deduplicated: stats.hits,
    unique: stats.misses,
    hitRate: stats.total > 0 ? stats.hits / stats.total : 0,
  };
}

// ============================================================================
// Debugging Utilities
// ============================================================================

/**
 * Get the current cache contents for debugging.
 * Only use this in development.
 *
 * @param context - The request context
 * @returns Array of cache entries with their keys
 */
export function debugGetCacheContents(
  context: AppContext
): Array<{ key: string; tables?: string[]; age: number }> {
  const cache = context.get<DedupCache>(DEDUP_CACHE_KEY);
  if (!cache) return [];

  const now = Date.now();
  return Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    tables: entry.tables,
    age: now - entry.timestamp,
  }));
}
