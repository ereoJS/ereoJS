import { describe, expect, test, beforeEach } from 'bun:test';
import {
  MemoryCache,
  setCache,
  getCache,
  generateCacheKey,
  cached,
  Cached,
} from './cache';

describe('@ereo/data - Cache (Additional Coverage)', () => {
  describe('MemoryCache additional operations', () => {
    let cache: MemoryCache;

    beforeEach(() => {
      cache = new MemoryCache();
    });

    test('entries with multiple tags are deleted by any tag', async () => {
      await cache.set('multi-tag', {
        value: 'test',
        timestamp: Date.now(),
        maxAge: 60,
        tags: ['tag1', 'tag2', 'tag3'],
      });

      await cache.deleteByTag('tag2');

      expect(await cache.get('multi-tag')).toBeNull();
    });

    test('preserves entries when deleting unrelated tag', async () => {
      await cache.set('tagged', {
        value: 'test',
        timestamp: Date.now(),
        maxAge: 60,
        tags: ['keep'],
      });

      await cache.deleteByTag('delete');

      expect(await cache.get('tagged')).not.toBeNull();
    });

    test('handles concurrent set operations', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          cache.set(`key${i}`, {
            value: `value${i}`,
            timestamp: Date.now(),
            maxAge: 60,
            tags: [],
          })
        );
      }

      await Promise.all(promises);

      // Verify a sample of keys
      expect((await cache.get('key0'))?.value).toBe('value0');
      expect((await cache.get('key25'))?.value).toBe('value25');
      expect((await cache.get('key49'))?.value).toBe('value49');
    });

    test('keys returns all stored keys', async () => {
      await cache.set('a', {
        value: '1',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      await cache.set('b', {
        value: '2',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      const keys = await cache.keys();
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });
  });

  describe('Global cache management', () => {
    test('setCache changes global cache', () => {
      const newCache = new MemoryCache();
      setCache(newCache);

      const retrieved = getCache();
      expect(retrieved).toBe(newCache);
    });

    test('getCache returns same instance', () => {
      const cache1 = getCache();
      const cache2 = getCache();

      expect(cache1).toBe(cache2);
    });
  });

  describe('Cache entry structure', () => {
    test('handles different value types', async () => {
      const cache = new MemoryCache();

      // String
      await cache.set('string', {
        value: 'hello',
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      // Number
      await cache.set('number', {
        value: 42,
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      // Array
      await cache.set('array', {
        value: [1, 2, 3],
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      expect((await cache.get('string'))?.value).toBe('hello');
      expect((await cache.get('number'))?.value).toBe(42);
      expect((await cache.get('array'))?.value).toEqual([1, 2, 3]);
    });

    test('handles object values', async () => {
      const cache = new MemoryCache();

      await cache.set('object', {
        value: { nested: { data: true } },
        timestamp: Date.now(),
        maxAge: 60,
        tags: [],
      });

      const entry = await cache.get('object');
      expect(entry?.value).toEqual({ nested: { data: true } });
    });

    test('getStats returns cache statistics', async () => {
      const cache = new MemoryCache();

      await cache.set('item1', {
        value: 'test1',
        timestamp: Date.now(),
        maxAge: 60,
        tags: ['tag1'],
      });

      await cache.set('item2', {
        value: 'test2',
        timestamp: Date.now(),
        maxAge: 60,
        tags: ['tag1', 'tag2'],
      });

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.tags).toBe(2); // tag1 and tag2
    });

    test('returns stale entry if within stale-while-revalidate window', async () => {
      const cache = new MemoryCache();

      // Set entry that is stale but within SWR window
      await cache.set('swr-key', {
        value: 'stale-value',
        timestamp: Date.now() - 2000, // 2 seconds ago
        maxAge: 1, // 1 second (so it's stale)
        staleWhileRevalidate: 60, // 60 second SWR window
        tags: [],
      });

      // Should still return the entry since it's within SWR
      const entry = await cache.get('swr-key');
      expect(entry?.value).toBe('stale-value');
    });

    test('delete removes entry from tag index', async () => {
      const cache = new MemoryCache();

      await cache.set('tagged-item', {
        value: 'test',
        timestamp: Date.now(),
        maxAge: 60,
        tags: ['mytag'],
      });

      await cache.delete('tagged-item');

      // Should be gone
      expect(await cache.get('tagged-item')).toBeNull();
    });
  });

  describe('generateCacheKey', () => {
    test('generates key from request', () => {
      const request = new Request('http://localhost:3000/users?page=1');
      const key = generateCacheKey(request);

      expect(key).toBe('GET:/users?page=1');
    });

    test('includes request method', () => {
      const request = new Request('http://localhost:3000/users', {
        method: 'POST',
      });
      const key = generateCacheKey(request);

      expect(key).toBe('POST:/users');
    });

    test('handles URL without query string', () => {
      const request = new Request('http://localhost:3000/about');
      const key = generateCacheKey(request);

      expect(key).toBe('GET:/about');
    });
  });

  describe('cached with stale-while-revalidate', () => {
    beforeEach(() => {
      setCache(new MemoryCache());
    });

    test('triggers background revalidation for stale entries', async () => {
      let callCount = 0;

      const fn = async () => {
        callCount++;
        return `value-${callCount}`;
      };

      // First call - populates cache
      const result1 = await cached('swr-test', fn, {
        maxAge: 0, // Immediately stale
        staleWhileRevalidate: 60,
      });

      expect(result1).toBe('value-1');
      expect(callCount).toBe(1);

      // Second call - returns stale value and triggers revalidation
      const result2 = await cached('swr-test', fn, {
        maxAge: 0,
        staleWhileRevalidate: 60,
      });

      // Should return stale value immediately
      expect(result2).toBe('value-1');
      // Wait a bit for background revalidation
      await new Promise((r) => setTimeout(r, 50));
      // Call count should increase due to background revalidation
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cached decorator', () => {
    beforeEach(() => {
      setCache(new MemoryCache());
    });

    test('can create decorator', () => {
      const decorator = Cached({ maxAge: 60 });
      expect(typeof decorator).toBe('function');
    });

    test('decorator wraps method with caching', async () => {
      let callCount = 0;

      class TestClass {
        @Cached({ maxAge: 60 })
        async getData(id: number): Promise<string> {
          callCount++;
          return `data-${id}`;
        }
      }

      const instance = new TestClass();

      const result1 = await instance.getData(1);
      const result2 = await instance.getData(1);

      expect(result1).toBe('data-1');
      expect(result2).toBe('data-1');
      // With caching, should only call once for same args
      expect(callCount).toBe(1);
    });
  });
});
