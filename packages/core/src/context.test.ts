import { describe, expect, test } from 'bun:test';
import { createContext, RequestContext, isRequestContext, attachContext, getContext } from './context';

describe('@oreo/core - Context', () => {
  describe('createContext', () => {
    test('creates a context from a request', () => {
      const request = new Request('http://localhost:3000/test?foo=bar');
      const context = createContext(request);

      expect(context).toBeInstanceOf(RequestContext);
      expect(context.url.pathname).toBe('/test');
      expect(context.url.searchParams.get('foo')).toBe('bar');
    });
  });

  describe('RequestContext', () => {
    test('stores and retrieves values', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.set('user', { id: 1, name: 'Test' });

      const user = context.get<{ id: number; name: string }>('user');
      expect(user?.id).toBe(1);
      expect(user?.name).toBe('Test');
    });

    test('returns undefined for missing keys', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      expect(context.get('missing')).toBeUndefined();
    });

    test('checks if key exists', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.set('exists', true);

      expect(context.has('exists')).toBe(true);
      expect(context.has('missing')).toBe(false);
    });

    test('deletes keys', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.set('key', 'value');
      expect(context.has('key')).toBe(true);

      context.delete('key');
      expect(context.has('key')).toBe(false);
    });

    describe('cache control', () => {
      test('sets cache options', () => {
        const request = new Request('http://localhost:3000/');
        const context = createContext(request);

        context.cache.set({
          maxAge: 60,
          staleWhileRevalidate: 300,
          tags: ['posts'],
        });

        const options = context.cache.get();
        expect(options?.maxAge).toBe(60);
        expect(options?.staleWhileRevalidate).toBe(300);
      });

      test('accumulates cache tags', () => {
        const request = new Request('http://localhost:3000/');
        const context = createContext(request);

        context.cache.set({ tags: ['posts'] });
        context.cache.set({ tags: ['user:1'] });

        const tags = context.cache.getTags();
        expect(tags).toContain('posts');
        expect(tags).toContain('user:1');
      });

      test('builds cache-control header', () => {
        const request = new Request('http://localhost:3000/');
        const context = createContext(request);

        context.cache.set({
          maxAge: 60,
          staleWhileRevalidate: 300,
        });

        const header = context.buildCacheControlHeader();
        expect(header).toContain('max-age=60');
        expect(header).toContain('stale-while-revalidate=300');
        expect(header).toContain('public');
      });

      test('handles private cache', () => {
        const request = new Request('http://localhost:3000/');
        const context = createContext(request);

        context.cache.set({
          maxAge: 60,
          private: true,
        });

        const header = context.buildCacheControlHeader();
        expect(header).toContain('private');
        expect(header).not.toContain('public');
      });
    });

    describe('applyToResponse', () => {
      test('applies headers to response', () => {
        const request = new Request('http://localhost:3000/');
        const context = createContext(request);

        context.responseHeaders.set('X-Custom', 'value');
        context.cache.set({ maxAge: 60, tags: ['test'] });

        const original = new Response('OK');
        const modified = context.applyToResponse(original);

        expect(modified.headers.get('X-Custom')).toBe('value');
        expect(modified.headers.get('Cache-Control')).toContain('max-age=60');
        expect(modified.headers.get('X-Cache-Tags')).toBe('test');
      });
    });
  });

  describe('isRequestContext', () => {
    test('returns true for RequestContext', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      expect(isRequestContext(context)).toBe(true);
    });

    test('returns false for other objects', () => {
      expect(isRequestContext({})).toBe(false);
      expect(isRequestContext(null)).toBe(false);
      expect(isRequestContext('string')).toBe(false);
    });
  });

  describe('attachContext/getContext', () => {
    test('attaches and retrieves context from request', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      attachContext(request, context);
      const retrieved = getContext(request);

      expect(retrieved).toBe(context);
    });
  });
});
