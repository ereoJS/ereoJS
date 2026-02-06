import { describe, expect, test } from 'bun:test';
import { createContext, RequestContext, isRequestContext, attachContext, getContext } from './context';

describe('@ereo/core - Context', () => {
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

  describe('cookies', () => {
    test('reads cookies from Cookie header', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'session=abc123; theme=dark' },
      });
      const context = createContext(request);

      expect(context.cookies.get('session')).toBe('abc123');
      expect(context.cookies.get('theme')).toBe('dark');
    });

    test('returns undefined for missing cookie', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'session=abc123' },
      });
      const context = createContext(request);

      expect(context.cookies.get('missing')).toBeUndefined();
    });

    test('has() checks cookie existence', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'session=abc123' },
      });
      const context = createContext(request);

      expect(context.cookies.has('session')).toBe(true);
      expect(context.cookies.has('missing')).toBe(false);
    });

    test('getAll() returns all cookies', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'a=1; b=2; c=3' },
      });
      const context = createContext(request);

      const all = context.cookies.getAll();
      expect(all).toEqual({ a: '1', b: '2', c: '3' });
    });

    test('set() updates in-memory and adds Set-Cookie header', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cookies.set('session', 'xyz789', { maxAge: 3600 });

      // In-memory update
      expect(context.cookies.get('session')).toBe('xyz789');

      // Set-Cookie header applied to response
      const response = context.applyToResponse(new Response('OK'));
      const setCookies = response.headers.getSetCookie();
      expect(setCookies.length).toBeGreaterThanOrEqual(1);
      const sessionCookie = setCookies.find(c => c.startsWith('session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('Max-Age=3600');
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Path=/');
    });

    test('delete() sets Max-Age=0', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'session=abc123' },
      });
      const context = createContext(request);

      context.cookies.delete('session');

      // Removed from in-memory
      expect(context.cookies.has('session')).toBe(false);

      // Set-Cookie with Max-Age=0
      const response = context.applyToResponse(new Response('OK'));
      const setCookies = response.headers.getSetCookie();
      const deleteCookie = setCookies.find(c => c.startsWith('session='));
      expect(deleteCookie).toBeDefined();
      expect(deleteCookie).toContain('Max-Age=0');
    });

    test('handles URL-encoded values', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'name=hello%20world' },
      });
      const context = createContext(request);

      expect(context.cookies.get('name')).toBe('hello world');
    });

    test('multiple set() calls append multiple Set-Cookie headers', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cookies.set('a', '1');
      context.cookies.set('b', '2');

      const response = context.applyToResponse(new Response('OK'));
      const setCookies = response.headers.getSetCookie();
      expect(setCookies.length).toBe(2);
    });

    test('set() respects options', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cookies.set('token', 'val', {
        secure: true,
        sameSite: 'Strict',
        domain: '.example.com',
        path: '/api',
        httpOnly: true,
      });

      const response = context.applyToResponse(new Response('OK'));
      const setCookies = response.headers.getSetCookie();
      const cookie = setCookies[0];
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Domain=.example.com');
      expect(cookie).toContain('Path=/api');
      expect(cookie).toContain('HttpOnly');
    });

    test('works with no Cookie header', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      expect(context.cookies.getAll()).toEqual({});
      expect(context.cookies.has('anything')).toBe(false);
    });
  });
});
