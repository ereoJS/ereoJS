/**
 * @ereo/plugin-images - Runtime Cache Tests
 */

import { describe, expect, test } from 'bun:test';
import { MemoryCache, generateCacheKey } from './cache';

describe('MemoryCache', () => {
  test('get returns undefined for missing key', () => {
    const cache = new MemoryCache({ maxItems: 10 });
    expect(cache.get('missing')).toBeUndefined();
  });

  test('set and get roundtrip', () => {
    const cache = new MemoryCache({ maxItems: 10 });
    const buf = Buffer.from('hello');
    cache.set('key1', buf);
    expect(cache.get('key1')).toBe(buf);
  });

  test('evicts LRU when maxItems reached', () => {
    const cache = new MemoryCache({ maxItems: 2 });
    cache.set('a', Buffer.from('1'));
    cache.set('b', Buffer.from('2'));
    cache.set('c', Buffer.from('3')); // should evict 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
  });

  test('evicts when maxSize exceeded', () => {
    const cache = new MemoryCache({ maxItems: 100, maxSize: 10 });
    cache.set('a', Buffer.alloc(6, 'a'));
    cache.set('b', Buffer.alloc(6, 'b')); // total would be 12 > 10, evicts 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
  });

  test('does not cache item larger than maxSize', () => {
    const cache = new MemoryCache({ maxItems: 10, maxSize: 5 });
    cache.set('big', Buffer.alloc(10));
    expect(cache.get('big')).toBeUndefined();
  });

  test('TTL expiry removes stale entries', async () => {
    const cache = new MemoryCache({ maxItems: 10, ttl: 50 });
    cache.set('key', Buffer.from('value'));
    expect(cache.get('key')).toBeDefined();

    await new Promise((r) => setTimeout(r, 80));
    expect(cache.get('key')).toBeUndefined();
  });

  test('delete removes entry and frees size', () => {
    const cache = new MemoryCache({ maxItems: 10 });
    cache.set('key', Buffer.alloc(100));
    expect(cache.stats().size).toBe(100);

    cache.delete('key');
    expect(cache.stats().size).toBe(0);
    expect(cache.get('key')).toBeUndefined();
  });

  test('clear removes all entries', () => {
    const cache = new MemoryCache({ maxItems: 10 });
    cache.set('a', Buffer.from('1'));
    cache.set('b', Buffer.from('2'));
    cache.clear();

    expect(cache.stats().items).toBe(0);
    expect(cache.stats().size).toBe(0);
  });

  test('has returns correct value', () => {
    const cache = new MemoryCache({ maxItems: 10 });
    expect(cache.has('key')).toBe(false);
    cache.set('key', Buffer.from('value'));
    expect(cache.has('key')).toBe(true);
  });

  test('overwriting key updates size correctly', () => {
    const cache = new MemoryCache({ maxItems: 10 });
    cache.set('key', Buffer.alloc(50));
    expect(cache.stats().size).toBe(50);
    cache.set('key', Buffer.alloc(30));
    expect(cache.stats().size).toBe(30);
  });
});

describe('generateCacheKey', () => {
  test('generates deterministic key', () => {
    const key1 = generateCacheKey({ src: '/img.png', width: 100 });
    const key2 = generateCacheKey({ src: '/img.png', width: 100 });
    expect(key1).toBe(key2);
  });

  test('different params produce different keys', () => {
    const key1 = generateCacheKey({ src: '/img.png', width: 100 });
    const key2 = generateCacheKey({ src: '/img.png', width: 200 });
    expect(key1).not.toBe(key2);
  });

  test('includes format in key', () => {
    const key1 = generateCacheKey({ src: '/img.png', width: 100, format: 'webp' });
    const key2 = generateCacheKey({ src: '/img.png', width: 100, format: 'avif' });
    expect(key1).not.toBe(key2);
  });
});
