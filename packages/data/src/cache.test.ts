import { describe, expect, test, beforeEach } from 'bun:test';
import {
  MemoryCache,
  getCache,
  setCache,
  cached,
  cacheKey,
  buildCacheControl,
  parseCacheControl,
} from './cache';

describe('@oreo/data - Cache', () => {
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
});
