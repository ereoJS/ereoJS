import { describe, expect, test, beforeEach } from 'bun:test';
import {
  MemoryCache,
  getCache,
  setCache,
  cached,
  cacheKey,
  buildCacheControl,
  parseCacheControl,
  createDataCacheAdapter,
} from './cache';

describe('@ereo/data - Cache', () => {
  describe('MemoryCache', () => {
    let cache: MemoryCache;

    beforeEach(() => {
      cache = new MemoryCache();
    });

    test('stores and retrieves values', async () => {
      await cache.set('key', {
        value: 'test',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      const entry = await cache.get('key');
      expect(entry?.value).toBe('test');
    });

    test('returns null for missing keys', async () => {
      const entry = await cache.get('missing');
      expect(entry).toBeNull();
    });

    test('deletes entries', async () => {
      await cache.set('key', {
        value: 'test',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      await cache.delete('key');
      const entry = await cache.get('key');

      expect(entry).toBeNull();
    });

    test('deletes by tag', async () => {
      await cache.set('post:1', {
        value: 'post 1',
        timestamp: Date.now(),
        maxAge: 60,
        tags: ['posts'],
      });

      await cache.set('post:2', {
        value: 'post 2',
        timestamp: Date.now(),
        maxAge: 60,
        tags: ['posts'],
      });

      await cache.deleteByTag('posts');

      expect(await cache.get('post:1')).toBeNull();
      expect(await cache.get('post:2')).toBeNull();
    });

    test('clears all entries', async () => {
      await cache.set('key1', {
        value: 'test1',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      await cache.set('key2', {
        value: 'test2',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    test('returns expired entries as null', async () => {
      await cache.set('expired', {
        value: 'test',
        timestamp: Date.now() - 10000, // 10 seconds ago
        maxAge: 1, // 1 second max age
        tags: [],
      });

      const entry = await cache.get('expired');
      expect(entry).toBeNull();
    });

    test('lists all keys', async () => {
      await cache.set('key1', {
        value: 'test1',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      await cache.set('key2', {
        value: 'test2',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      const keys = await cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('cached', () => {
    beforeEach(() => {
      setCache(new MemoryCache());
    });

    test('caches function results', async () => {
      let callCount = 0;

      const fn = async () => {
        callCount++;
        return 'result';
      };

      const result1 = await cached('test', fn, { maxAge: 60 });
      const result2 = await cached('test', fn, { maxAge: 60 });

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(callCount).toBe(1); // Should only call once
    });

    test('returns stale value and revalidates in background with stale-while-revalidate', async () => {
      const cache = new MemoryCache();
      setCache(cache);

      let callCount = 0;
      const fn = async () => {
        callCount++;
        return `result-${callCount}`;
      };

      // First call - fetches and caches
      const result1 = await cached('swr-test', fn, { maxAge: 1, staleWhileRevalidate: 300 });
      expect(result1).toBe('result-1');
      expect(callCount).toBe(1);

      // Manually make the entry stale by modifying timestamp
      const entry = await cache.get('swr-test');
      if (entry) {
        await cache.set('swr-test', {
          ...entry,
          timestamp: Date.now() - 2000, // 2 seconds ago, stale (maxAge is 1s)
        });
      }

      // Second call - should return stale value and trigger background revalidation
      const result2 = await cached('swr-test', fn, { maxAge: 1, staleWhileRevalidate: 300 });
      expect(result2).toBe('result-1'); // Returns stale value immediately

      // Wait for background revalidation to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Call count should have increased due to background revalidation
      expect(callCount).toBe(2);

      // Now the cache should have the fresh value
      const freshEntry = await cache.get('swr-test');
      expect(freshEntry?.value).toBe('result-2');
    });

    test('handles revalidation errors gracefully', async () => {
      const cache = new MemoryCache();
      setCache(cache);

      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Revalidation failed');
        }
        return `result-${callCount}`;
      };

      // First call - fetches and caches
      await cached('error-test', fn, { maxAge: 1, staleWhileRevalidate: 300 });
      expect(callCount).toBe(1);

      // Make the entry stale
      const entry = await cache.get('error-test');
      if (entry) {
        await cache.set('error-test', {
          ...entry,
          timestamp: Date.now() - 2000,
        });
      }

      // Second call - should return stale value; background revalidation will fail
      const result = await cached('error-test', fn, { maxAge: 1, staleWhileRevalidate: 300 });
      expect(result).toBe('result-1');

      // Wait for background revalidation attempt
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The cache should still have the stale value (revalidation failed)
      const cachedEntry = await cache.get('error-test');
      expect(cachedEntry?.value).toBe('result-1');
    });

    test('fetches fresh data when cache is fully expired without stale-while-revalidate', async () => {
      const cache = new MemoryCache();
      setCache(cache);

      let callCount = 0;
      const fn = async () => {
        callCount++;
        return `result-${callCount}`;
      };

      // First call
      await cached('expired-test', fn, { maxAge: 1 });

      // Make the entry stale (no stale-while-revalidate)
      const entry = await cache.get('expired-test');
      if (entry) {
        await cache.set('expired-test', {
          ...entry,
          timestamp: Date.now() - 2000,
          staleWhileRevalidate: undefined,
        });
      }

      // Second call - should fetch fresh data since no stale-while-revalidate
      const result = await cached('expired-test', fn, { maxAge: 1 });
      expect(result).toBe('result-2');
      expect(callCount).toBe(2);
    });
  });

  describe('cacheKey', () => {
    test('generates cache keys', () => {
      const key = cacheKey('user', 123, 'posts');
      expect(key).toBe('user:123:posts');
    });
  });

  describe('buildCacheControl', () => {
    test('builds public cache control', () => {
      const header = buildCacheControl({ maxAge: 60 });
      expect(header).toBe('public, max-age=60');
    });

    test('builds private cache control', () => {
      const header = buildCacheControl({ maxAge: 60, private: true });
      expect(header).toBe('private, max-age=60');
    });

    test('includes stale-while-revalidate', () => {
      const header = buildCacheControl({
        maxAge: 60,
        staleWhileRevalidate: 300,
      });
      expect(header).toBe('public, max-age=60, stale-while-revalidate=300');
    });
  });

  describe('parseCacheControl', () => {
    test('parses cache control header', () => {
      const options = parseCacheControl('public, max-age=60, stale-while-revalidate=300');

      expect(options.maxAge).toBe(60);
      expect(options.staleWhileRevalidate).toBe(300);
      expect(options.private).toBeFalsy();
    });

    test('parses private cache control', () => {
      const options = parseCacheControl('private, max-age=0');

      expect(options.private).toBe(true);
      expect(options.maxAge).toBe(0);
    });
  });

  // ============================================================================
  // Unified CacheAdapter Interface Tests
  // ============================================================================

  describe('MemoryCache unified interface', () => {
    let cache: MemoryCache;

    beforeEach(() => {
      cache = new MemoryCache();
    });

    test('asCacheAdapter returns a valid adapter', () => {
      const adapter = cache.asCacheAdapter();
      expect(typeof adapter.get).toBe('function');
      expect(typeof adapter.set).toBe('function');
      expect(typeof adapter.delete).toBe('function');
      expect(typeof adapter.has).toBe('function');
      expect(typeof adapter.clear).toBe('function');
      expect(typeof adapter.invalidateTag).toBe('function');
      expect(typeof adapter.invalidateTags).toBe('function');
      expect(typeof adapter.getByTag).toBe('function');
    });

    test('getValue returns just the value', async () => {
      await cache.set('key', {
        value: { name: 'test' },
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      const value = await cache.getValue<{ name: string }>('key');
      expect(value).toEqual({ name: 'test' });
    });

    test('getValue returns undefined for missing keys', async () => {
      const value = await cache.getValue('nonexistent');
      expect(value).toBeUndefined();
    });

    test('setValue stores with ttl and tags', async () => {
      await cache.setValue('key', 'value', { ttl: 120, tags: ['myTag'] });

      const entry = await cache.get('key');
      expect(entry?.value).toBe('value');
      expect(entry?.maxAge).toBe(120);
      expect(entry?.tags).toContain('myTag');
    });

    test('has checks existence correctly', async () => {
      expect(await cache.has('missing')).toBe(false);

      await cache.set('existing', {
        value: 'test',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      expect(await cache.has('existing')).toBe(true);
    });

    test('invalidateTag removes tagged entries', async () => {
      await cache.setValue('a', 1, { tags: ['group1'] });
      await cache.setValue('b', 2, { tags: ['group1'] });
      await cache.setValue('c', 3, { tags: ['group2'] });

      await cache.invalidateTag('group1');

      expect(await cache.has('a')).toBe(false);
      expect(await cache.has('b')).toBe(false);
      expect(await cache.has('c')).toBe(true);
    });

    test('invalidateTags removes multiple tagged entries', async () => {
      await cache.setValue('a', 1, { tags: ['tag1'] });
      await cache.setValue('b', 2, { tags: ['tag2'] });
      await cache.setValue('c', 3, { tags: ['tag3'] });

      await cache.invalidateTags(['tag1', 'tag2']);

      expect(await cache.has('a')).toBe(false);
      expect(await cache.has('b')).toBe(false);
      expect(await cache.has('c')).toBe(true);
    });

    test('getByTag returns keys with specific tag', async () => {
      await cache.setValue('post:1', 'content1', { tags: ['posts'] });
      await cache.setValue('post:2', 'content2', { tags: ['posts'] });
      await cache.setValue('user:1', 'user', { tags: ['users'] });

      const postKeys = await cache.getByTag('posts');

      expect(postKeys).toContain('post:1');
      expect(postKeys).toContain('post:2');
      expect(postKeys).not.toContain('user:1');
    });
  });

  describe('createDataCacheAdapter', () => {
    test('creates a CacheAdapter-compatible wrapper', async () => {
      const adapter = createDataCacheAdapter();

      // Test basic operations
      await adapter.set('key', 'value', { ttl: 60, tags: ['test'] });
      expect(await adapter.get('key')).toBe('value');
      expect(await adapter.has('key')).toBe(true);

      await adapter.delete('key');
      expect(await adapter.has('key')).toBe(false);
    });

    test('adapter supports tag operations', async () => {
      const adapter = createDataCacheAdapter();

      await adapter.set('a', 1, { tags: ['numbers'] });
      await adapter.set('b', 2, { tags: ['numbers'] });

      const keys = await adapter.getByTag('numbers');
      expect(keys).toContain('a');
      expect(keys).toContain('b');

      await adapter.invalidateTag('numbers');

      expect(await adapter.has('a')).toBe(false);
      expect(await adapter.has('b')).toBe(false);
    });

    test('adapter clear removes all entries', async () => {
      const adapter = createDataCacheAdapter();

      await adapter.set('x', 1);
      await adapter.set('y', 2);

      await adapter.clear();

      expect(await adapter.has('x')).toBe(false);
      expect(await adapter.has('y')).toBe(false);
    });
  });
});
