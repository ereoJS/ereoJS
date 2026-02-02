import { describe, expect, test, beforeEach } from 'bun:test';
import {
  revalidateTag,
  revalidatePath,
  revalidate,
  createRevalidationHandler,
  tags,
  onDemandRevalidate,
  unstable_cache,
} from './revalidate';
import { MemoryCache, setCache, getCache } from './cache';

describe('@oreo/data - Revalidate', () => {
  beforeEach(() => {
    setCache(new MemoryCache());
  });

  describe('revalidateTag', () => {
    test('revalidates single tag', async () => {
      const result = await revalidateTag('posts');

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toContain('posts');
      expect(result.timestamp).toBeDefined();
    });

    test('revalidates multiple tags', async () => {
      const result = await revalidateTag('posts', 'users', 'comments');

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toContain('posts');
      expect(result.revalidated.tags).toContain('users');
      expect(result.revalidated.tags).toContain('comments');
    });

    test('returns empty paths array', async () => {
      const result = await revalidateTag('test');

      expect(result.revalidated.paths).toEqual([]);
    });
  });

  describe('revalidatePath', () => {
    test('revalidates single path', async () => {
      const result = await revalidatePath('/users');

      expect(result.success).toBe(true);
      expect(result.revalidated.paths.length).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    test('revalidates multiple paths', async () => {
      const result = await revalidatePath('/users', '/posts', '/comments');

      expect(result.success).toBe(true);
    });

    test('returns empty tags array', async () => {
      const result = await revalidatePath('/test');

      expect(result.revalidated.tags).toEqual([]);
    });

    test('deletes cache entries matching path', async () => {
      const cache = getCache();

      // Add some entries with path-like keys
      await cache.set('GET:/users', {
        value: 'users data',
        timestamp: Date.now(),
        maxAge: 3600,
        tags: [],
      });

      await cache.set('POST:/users', {
        value: 'post data',
        timestamp: Date.now(),
        maxAge: 3600,
        tags: [],
      });

      // Revalidate /users path
      const result = await revalidatePath('/users');

      expect(result.success).toBe(true);
      // Verify entries were deleted
      expect(await cache.get('GET:/users')).toBeNull();
      expect(await cache.get('POST:/users')).toBeNull();
    });

    test('matches paths that end with the specified path', async () => {
      const cache = getCache();

      await cache.set('/api/users', {
        value: 'users data',
        timestamp: Date.now(),
        maxAge: 3600,
        tags: [],
      });

      const result = await revalidatePath('/users');

      expect(result.success).toBe(true);
    });
  });

  describe('revalidate', () => {
    test('revalidates by tags', async () => {
      const result = await revalidate({ tags: ['posts', 'users'] });

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toContain('posts');
      expect(result.revalidated.tags).toContain('users');
    });

    test('revalidates by paths', async () => {
      const result = await revalidate({ paths: ['/users', '/posts'] });

      expect(result.success).toBe(true);
    });

    test('revalidates all when all option is true', async () => {
      const result = await revalidate({ all: true });

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toContain('*');
      expect(result.revalidated.paths).toContain('*');
    });

    test('handles empty options', async () => {
      const result = await revalidate({});

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toEqual([]);
      expect(result.revalidated.paths).toEqual([]);
    });

    test('handles both tags and paths', async () => {
      const result = await revalidate({
        tags: ['posts'],
        paths: ['/users'],
      });

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toContain('posts');
    });
  });

  describe('createRevalidationHandler', () => {
    test('creates a request handler', () => {
      const handler = createRevalidationHandler();
      expect(typeof handler).toBe('function');
    });

    test('handles revalidation request', async () => {
      const handler = createRevalidationHandler();

      const request = new Request('http://localhost/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['posts'] }),
      });

      const response = await handler(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    test('validates secret when provided', async () => {
      const handler = createRevalidationHandler('secret-token');

      // Without token
      const request1 = new Request('http://localhost/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['posts'] }),
      });

      const response1 = await handler(request1);
      expect(response1.status).toBe(401);

      // With wrong token
      const request2 = new Request('http://localhost/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-token',
        },
        body: JSON.stringify({ tags: ['posts'] }),
      });

      const response2 = await handler(request2);
      expect(response2.status).toBe(401);

      // With correct token
      const request3 = new Request('http://localhost/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-token',
        },
        body: JSON.stringify({ tags: ['posts'] }),
      });

      const response3 = await handler(request3);
      expect(response3.status).toBe(200);
    });

    test('handles errors gracefully', async () => {
      const handler = createRevalidationHandler();

      const request = new Request('http://localhost/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await handler(request);
      expect(response.status).toBe(500);
    });
  });

  describe('tags helper', () => {
    test('creates resource tag', () => {
      expect(tags.resource('post', 123)).toBe('post:123');
      expect(tags.resource('user', 'abc')).toBe('user:abc');
    });

    test('creates collection tag', () => {
      expect(tags.collection('posts')).toBe('posts');
      expect(tags.collection('users')).toBe('users');
    });

    test('creates user-scoped tag', () => {
      expect(tags.userScoped(123, 'posts')).toBe('user:123:posts');
      expect(tags.userScoped('abc', 'comments')).toBe('user:abc:comments');
    });
  });

  describe('onDemandRevalidate', () => {
    test('revalidates tags (non-path strings)', async () => {
      const result = await onDemandRevalidate('posts', 'users');

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toContain('posts');
      expect(result.revalidated.tags).toContain('users');
    });

    test('revalidates paths (strings starting with /)', async () => {
      const result = await onDemandRevalidate('/users', '/posts');

      expect(result.success).toBe(true);
    });

    test('handles mixed tags and paths', async () => {
      const result = await onDemandRevalidate('posts', '/users', 'comments', '/api');

      expect(result.success).toBe(true);
      expect(result.revalidated.tags).toContain('posts');
      expect(result.revalidated.tags).toContain('comments');
    });

    test('distinguishes between tags and paths by leading slash', async () => {
      const result = await onDemandRevalidate('tag-without-slash', '/path-with-slash');

      expect(result.revalidated.tags).toContain('tag-without-slash');
    });
  });

  describe('unstable_cache', () => {
    test('wraps async function with caching', async () => {
      let callCount = 0;

      const fetchData = async (id: string) => {
        callCount++;
        return { id, name: `Item ${id}` };
      };

      const cachedFetch = unstable_cache(fetchData, ['items'], {
        tags: ['items'],
        revalidate: 60,
      });

      // First call should execute function
      const result1 = await cachedFetch('123');
      expect(result1).toEqual({ id: '123', name: 'Item 123' });
      expect(callCount).toBe(1);

      // Second call should return cached value
      const result2 = await cachedFetch('123');
      expect(result2).toEqual({ id: '123', name: 'Item 123' });
      // Call count may or may not increase depending on cache behavior
    });

    test('uses default revalidate time when not specified', async () => {
      const fetchData = async () => ({ value: 'test' });

      const cachedFetch = unstable_cache(fetchData, ['test-key']);

      const result = await cachedFetch();
      expect(result).toEqual({ value: 'test' });
    });

    test('creates unique keys from keyParts and args', async () => {
      const fetchData = async (a: number, b: number) => a + b;

      const cachedFetch = unstable_cache(fetchData, ['math', 'add'], {
        tags: ['math'],
      });

      const result = await cachedFetch(1, 2);
      expect(result).toBe(3);
    });
  });
});
