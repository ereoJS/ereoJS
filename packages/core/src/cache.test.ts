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

  describe('Edge cases', () => {
    test('TTL of 0 means entry expires immediately', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('zero-ttl', 'value', { ttl: 0 });

      // Should be expired immediately
      expect(await cache.get('zero-ttl')).toBeUndefined();
      expect(await cache.has('zero-ttl')).toBe(false);
    });

    test('maxSize of 1 keeps only last entry', async () => {
      const cache = new MemoryCacheAdapter({ maxSize: 1 });

      await cache.set('a', 1);
      expect(await cache.get('a')).toBe(1);

      await cache.set('b', 2);
      expect(await cache.has('a')).toBe(false);
      expect(await cache.get('b')).toBe(2);
    });

    test('special characters in keys work correctly', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('key with spaces', 'v1');
      await cache.set('key/with/slashes', 'v2');
      await cache.set('key:with:colons', 'v3');
      await cache.set('', 'empty-key');

      expect(await cache.get('key with spaces')).toBe('v1');
      expect(await cache.get('key/with/slashes')).toBe('v2');
      expect(await cache.get('key:with:colons')).toBe('v3');
      expect(await cache.get('')).toBe('empty-key');
    });

    test('getByTag with empty tag index returns empty array', async () => {
      const cache = new MemoryCacheAdapter();
      const keys = await cache.getByTag('nonexistent');
      expect(keys).toEqual([]);
    });

    test('invalidateTags with empty array does nothing', async () => {
      const cache = new MemoryCacheAdapter();
      await cache.set('safe', 'value');

      await cache.invalidateTags([]);

      expect(await cache.get('safe')).toBe('value');
    });

    test('getStats on empty cache returns zeros', () => {
      const cache = new MemoryCacheAdapter();
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.tags).toBe(0);
    });

    test('keys() on empty cache returns empty array', async () => {
      const cache = new MemoryCacheAdapter();
      const keys = await cache.keys();
      expect(keys).toEqual([]);
    });

    test('updating entry with different tags cleans up old tag index', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('item', 'v1', { tags: ['old-tag'] });
      expect(await cache.getByTag('old-tag')).toContain('item');

      await cache.set('item', 'v2', { tags: ['new-tag'] });
      expect(await cache.getByTag('old-tag')).toEqual([]);
      expect(await cache.getByTag('new-tag')).toContain('item');
    });

    test('clear removes all entries and tags', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('a', 1, { tags: ['t1'] });
      await cache.set('b', 2, { tags: ['t2'] });

      await cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.getStats().tags).toBe(0);
      expect(await cache.getByTag('t1')).toEqual([]);
    });

    test('delete non-existent key returns false', async () => {
      const cache = new MemoryCacheAdapter();
      expect(await cache.delete('ghost')).toBe(false);
    });

    test('set without options uses no tags and no TTL', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('plain', 'value');

      expect(await cache.get('plain')).toBe('value');
      // Should persist indefinitely (no TTL)
      expect(await cache.has('plain')).toBe(true);
    });

    test('negative TTL is treated as expired', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('neg-ttl', 'value', { ttl: -1 });

      // Negative TTL * 1000 = negative, age > negative is true
      // Actually depends on implementation - let's verify
      const result = await cache.get('neg-ttl');
      // age (>0) > -1000 should be true, so expired
      expect(result).toBeUndefined();
    });
  });

  describe('Stats after operations', () => {
    test('stats reflect current state after adds and deletes', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('a', 1, { tags: ['t1'] });
      await cache.set('b', 2, { tags: ['t1', 't2'] });
      expect(cache.getStats()).toEqual({ size: 2, tags: 2 });

      await cache.delete('a');
      // 'b' still has t1 and t2, so both tag entries remain
      expect(cache.getStats()).toEqual({ size: 1, tags: 2 });

      await cache.delete('b');
      // All entries and tags gone
      expect(cache.getStats()).toEqual({ size: 0, tags: 0 });
    });

    test('stats after tag invalidation', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('a', 1, { tags: ['shared'] });
      await cache.set('b', 2, { tags: ['shared'] });
      await cache.set('c', 3, { tags: ['other'] });

      await cache.invalidateTag('shared');

      expect(cache.getStats().size).toBe(1);
      expect(cache.getStats().tags).toBe(1); // only 'other' remains
    });

    test('stats after clear', async () => {
      const cache = new MemoryCacheAdapter();

      await cache.set('a', 1, { tags: ['t1'] });
      await cache.set('b', 2, { tags: ['t2'] });

      await cache.clear();
      expect(cache.getStats()).toEqual({ size: 0, tags: 0 });
    });
  });

  describe('createCache return type', () => {
    test('createCache returns MemoryCacheAdapter', () => {
      const cache = createCache();
      expect(cache).toBeInstanceOf(MemoryCacheAdapter);
    });

    test('createTaggedCache returns MemoryCacheAdapter', () => {
      const cache = createTaggedCache();
      expect(cache).toBeInstanceOf(MemoryCacheAdapter);
    });

    test('createCache with options passes them through', async () => {
      const cache = createCache({ maxSize: 1 }) as MemoryCacheAdapter;

      await cache.set('a', 1);
      await cache.set('b', 2);

      expect(cache.getStats().size).toBe(1);
    });

    test('createTaggedCache with defaultTtl', async () => {
      const cache = createTaggedCache({ defaultTtl: 1 });

      await cache.set('expire', 'val');
      expect(await cache.get('expire')).toBe('val');

      await new Promise(r => setTimeout(r, 1100));
      expect(await cache.get('expire')).toBeUndefined();
    });
  });

  describe('isTaggedCache edge cases', () => {
    test('returns false for object with only some TaggedCache methods', () => {
      const partial = {
        get: async () => undefined,
        set: async () => {},
        delete: async () => false,
        has: async () => false,
        clear: async () => {},
        invalidateTag: async () => {}, // has this
        // missing invalidateTags and getByTag
      };
      expect(isTaggedCache(partial as any)).toBe(false);
    });

    test('returns false for object with non-function tagged methods', () => {
      const fake = {
        get: async () => undefined,
        set: async () => {},
        delete: async () => false,
        has: async () => false,
        clear: async () => {},
        invalidateTag: 'not-a-function',
        invalidateTags: 'not-a-function',
        getByTag: 'not-a-function',
      };
      expect(isTaggedCache(fake as any)).toBe(false);
    });
  });

  describe('wrapCacheAdapter edge cases', () => {
    test('wrapped adapter preserves async behavior', async () => {
      const store = new Map<string, unknown>();

      const adapter = wrapCacheAdapter({
        get: async <T>(key: string) => {
          await new Promise(r => setTimeout(r, 5));
          return store.get(key) as T | undefined;
        },
        set: async <T>(key: string, value: T) => {
          await new Promise(r => setTimeout(r, 5));
          store.set(key, value);
        },
        delete: async (key: string) => {
          await new Promise(r => setTimeout(r, 5));
          return store.delete(key);
        },
        has: async (key: string) => {
          await new Promise(r => setTimeout(r, 5));
          return store.has(key);
        },
        clear: async () => {
          await new Promise(r => setTimeout(r, 5));
          store.clear();
        },
      });

      await adapter.set('key', 'value');
      expect(await adapter.get('key')).toBe('value');
      expect(await adapter.has('key')).toBe(true);
      expect(await adapter.delete('key')).toBe(true);
      expect(await adapter.has('key')).toBe(false);
    });

    test('wrapped adapter passes options through', async () => {
      let receivedOptions: any = null;

      const adapter = wrapCacheAdapter({
        get: async () => undefined,
        set: async (_key: string, _value: unknown, opts?: any) => {
          receivedOptions = opts;
        },
        delete: async () => false,
        has: async () => false,
        clear: async () => {},
      });

      await adapter.set('key', 'value', { ttl: 60, tags: ['test'] });
      expect(receivedOptions).toEqual({ ttl: 60, tags: ['test'] });
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
