import { describe, expect, test, beforeEach } from 'bun:test';
import {
  MemoryCacheAdapter,
  createCache,
  createTaggedCache,
  isTaggedCache,
  wrapCacheAdapter,
  type CacheAdapter,
  type TaggedCache,
} from './cache';

describe('@ereo/core - Unified Cache Interface', () => {
  describe('MemoryCacheAdapter', () => {
    let cache: MemoryCacheAdapter;

    beforeEach(() => {
      cache = new MemoryCacheAdapter();
    });

    test('implements CacheAdapter interface', async () => {
      // set and get
      await cache.set('key1', 'value1');
      expect(await cache.get<string>('key1')).toBe('value1');

      // has
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('nonexistent')).toBe(false);

      // delete
      expect(await cache.delete('key1')).toBe(true);
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.delete('key1')).toBe(false);

      // clear
      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.clear();
      expect(await cache.has('a')).toBe(false);
      expect(await cache.has('b')).toBe(false);
    });

    test('stores and retrieves different value types', async () => {
      // String
      await cache.set('string', 'hello');
      expect(await cache.get<string>('string')).toBe('hello');

      // Number
      await cache.set('number', 42);
      expect(await cache.get<number>('number')).toBe(42);

      // Object
      await cache.set('object', { nested: { data: true } });
      expect(await cache.get<object>('object')).toEqual({ nested: { data: true } });

      // Array
      await cache.set('array', [1, 2, 3]);
      expect(await cache.get<number[]>('array')).toEqual([1, 2, 3]);

      // Boolean
      await cache.set('boolean', true);
      expect(await cache.get<boolean>('boolean')).toBe(true);

      // Null
      await cache.set('null', null);
      expect(await cache.get('null')).toBeNull();
    });

    test('returns undefined for missing keys', async () => {
      expect(await cache.get('nonexistent')).toBeUndefined();
    });

    test('respects TTL expiration', async () => {
      await cache.set('expiring', 'value', { ttl: 1 }); // 1 second TTL

      // Should exist immediately
      expect(await cache.get('expiring')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(await cache.get('expiring')).toBeUndefined();
      expect(await cache.has('expiring')).toBe(false);
    });

    test('uses default TTL when set', async () => {
      const cacheWithTtl = new MemoryCacheAdapter({ defaultTtl: 1 });

      await cacheWithTtl.set('auto-expire', 'value');

      // Should exist immediately
      expect(await cacheWithTtl.get('auto-expire')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(await cacheWithTtl.get('auto-expire')).toBeUndefined();
    });

    test('respects maxSize option', async () => {
      const limitedCache = new MemoryCacheAdapter({ maxSize: 3 });

      await limitedCache.set('a', 1);
      await limitedCache.set('b', 2);
      await limitedCache.set('c', 3);

      // All should exist
      expect(await limitedCache.has('a')).toBe(true);
      expect(await limitedCache.has('b')).toBe(true);
      expect(await limitedCache.has('c')).toBe(true);

      // Adding one more should evict the oldest
      await limitedCache.set('d', 4);

      expect(await limitedCache.has('d')).toBe(true);
      // One of a, b, or c should be evicted
      const remaining = [
        await limitedCache.has('a'),
        await limitedCache.has('b'),
        await limitedCache.has('c'),
      ].filter(Boolean).length;

      expect(remaining).toBe(2);
    });

    test('updates existing entries', async () => {
      await cache.set('key', 'initial');
      expect(await cache.get('key')).toBe('initial');

      await cache.set('key', 'updated');
      expect(await cache.get('key')).toBe('updated');
    });

    test('getStats returns cache statistics', async () => {
      await cache.set('a', 1, { tags: ['tag1'] });
      await cache.set('b', 2, { tags: ['tag1', 'tag2'] });

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.tags).toBe(2); // tag1 and tag2
    });

    test('keys returns all cache keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const keys = await cache.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      expect(keys.length).toBe(3);
    });
  });

  describe('TaggedCache interface', () => {
    let cache: MemoryCacheAdapter;

    beforeEach(() => {
      cache = new MemoryCacheAdapter();
    });

    test('implements TaggedCache interface', () => {
      expect(typeof cache.invalidateTag).toBe('function');
      expect(typeof cache.invalidateTags).toBe('function');
      expect(typeof cache.getByTag).toBe('function');
    });

    test('stores entries with tags', async () => {
      await cache.set('post:1', { title: 'Post 1' }, { tags: ['posts', 'user:alice'] });
      await cache.set('post:2', { title: 'Post 2' }, { tags: ['posts', 'user:bob'] });

      const keys = await cache.getByTag('posts');

      expect(keys).toContain('post:1');
      expect(keys).toContain('post:2');
      expect(keys.length).toBe(2);
    });

    test('invalidateTag removes all entries with that tag', async () => {
      await cache.set('post:1', 'content1', { tags: ['posts'] });
      await cache.set('post:2', 'content2', { tags: ['posts'] });
      await cache.set('user:1', 'user1', { tags: ['users'] });

      await cache.invalidateTag('posts');

      expect(await cache.has('post:1')).toBe(false);
      expect(await cache.has('post:2')).toBe(false);
      expect(await cache.has('user:1')).toBe(true);
    });

    test('invalidateTags removes entries with any of the tags', async () => {
      await cache.set('post:1', 'content1', { tags: ['posts', 'featured'] });
      await cache.set('post:2', 'content2', { tags: ['posts'] });
      await cache.set('comment:1', 'comment1', { tags: ['comments'] });

      await cache.invalidateTags(['posts', 'comments']);

      expect(await cache.has('post:1')).toBe(false);
      expect(await cache.has('post:2')).toBe(false);
      expect(await cache.has('comment:1')).toBe(false);
    });

    test('getByTag returns only non-expired keys', async () => {
      await cache.set('fresh', 'value', { ttl: 60, tags: ['test'] });
      await cache.set('expiring', 'value', { ttl: 1, tags: ['test'] });

      // Both should be returned immediately
      let keys = await cache.getByTag('test');
      expect(keys.length).toBe(2);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Only fresh should remain
      keys = await cache.getByTag('test');
      expect(keys).toContain('fresh');
      expect(keys).not.toContain('expiring');
    });

    test('invalidating non-existent tag does not throw', async () => {
      await cache.invalidateTag('nonexistent');
      // Should not throw
    });

    test('entries with multiple tags are deleted by any tag', async () => {
      await cache.set('multi', 'value', { tags: ['tag1', 'tag2', 'tag3'] });

      await cache.invalidateTag('tag2');

      expect(await cache.has('multi')).toBe(false);
    });
  });

  describe('createCache factory', () => {
    test('creates a CacheAdapter', () => {
      const cache = createCache();

      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
      expect(typeof cache.delete).toBe('function');
      expect(typeof cache.has).toBe('function');
      expect(typeof cache.clear).toBe('function');
    });

    test('passes options to underlying implementation', async () => {
      const cache = createCache({ maxSize: 2, defaultTtl: 60 });

      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.set('c', 3);

      // Should only have 2 entries due to maxSize
      const stats = (cache as MemoryCacheAdapter).getStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('createTaggedCache factory', () => {
    test('creates a TaggedCache', () => {
      const cache = createTaggedCache();

      expect(cache).toBeDefined();
      expect(typeof cache.invalidateTag).toBe('function');
      expect(typeof cache.invalidateTags).toBe('function');
      expect(typeof cache.getByTag).toBe('function');
    });

    test('supports tag operations', async () => {
      const cache = createTaggedCache();

      await cache.set('key', 'value', { tags: ['myTag'] });

      const keys = await cache.getByTag('myTag');
      expect(keys).toContain('key');

      await cache.invalidateTag('myTag');
      expect(await cache.has('key')).toBe(false);
    });
  });

  describe('isTaggedCache type guard', () => {
    test('returns true for TaggedCache instances', () => {
      const cache = new MemoryCacheAdapter();
      expect(isTaggedCache(cache)).toBe(true);
    });

    test('returns true for createTaggedCache results', () => {
      const cache = createTaggedCache();
      expect(isTaggedCache(cache)).toBe(true);
    });

    test('returns false for plain CacheAdapter', () => {
      const plainCache: CacheAdapter = {
        get: async () => undefined,
        set: async () => {},
        delete: async () => false,
        has: async () => false,
        clear: async () => {},
      };

      expect(isTaggedCache(plainCache)).toBe(false);
    });
  });

  describe('wrapCacheAdapter utility', () => {
    test('wraps a simple map-based cache', async () => {
      const mapCache = new Map<string, unknown>();

      const adapter = wrapCacheAdapter({
        get: async <T>(key: string) => mapCache.get(key) as T | undefined,
        set: async <T>(key: string, value: T) => {
          mapCache.set(key, value);
        },
        delete: async (key: string) => mapCache.delete(key),
        has: async (key: string) => mapCache.has(key),
        clear: async () => mapCache.clear(),
      });

      // Test the adapter
      await adapter.set('key', 'value');
      expect(await adapter.get('key')).toBe('value');
      expect(await adapter.has('key')).toBe(true);

      await adapter.delete('key');
      expect(await adapter.has('key')).toBe(false);

      await adapter.set('a', 1);
      await adapter.set('b', 2);
      await adapter.clear();
      expect(await adapter.has('a')).toBe(false);
    });

    test('wraps synchronous implementations', async () => {
      const syncCache = new Map<string, unknown>();

      const adapter = wrapCacheAdapter({
        get: <T>(key: string) => syncCache.get(key) as T | undefined,
        set: <T>(key: string, value: T) => {
          syncCache.set(key, value);
        },
        delete: (key: string) => syncCache.delete(key),
        has: (key: string) => syncCache.has(key),
        clear: () => syncCache.clear(),
      });

      await adapter.set('sync', 'works');
      expect(await adapter.get('sync')).toBe('works');
    });
  });

  describe('Concurrent operations', () => {
    test('handles concurrent set operations', async () => {
      const cache = new MemoryCacheAdapter();
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }

      await Promise.all(promises);

      // Verify some random keys
      expect(await cache.get('key0')).toBe('value0');
      expect(await cache.get('key50')).toBe('value50');
      expect(await cache.get('key99')).toBe('value99');
    });

    test('handles concurrent get operations', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('concurrent', 'value');

      const promises: Promise<string | undefined>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(cache.get<string>('concurrent'));
      }

      const results = await Promise.all(promises);
      expect(results.every((r) => r === 'value')).toBe(true);
    });

    test('handles concurrent invalidation', async () => {
      const cache = new MemoryCacheAdapter();

      // Set up many entries with the same tag
      for (let i = 0; i < 50; i++) {
        await cache.set(`key${i}`, `value${i}`, { tags: ['bulk'] });
      }

      // Concurrent invalidation
      await Promise.all([
        cache.invalidateTag('bulk'),
        cache.invalidateTag('bulk'),
        cache.invalidateTag('bulk'),
      ]);

      // All should be gone
      for (let i = 0; i < 50; i++) {
        expect(await cache.has(`key${i}`)).toBe(false);
      }
    });
  });
});
