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

  describe('cache control edge cases', () => {
    test('returns null when no cache options set', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);
      expect(context.buildCacheControlHeader()).toBeNull();
    });

    test('addTags accumulates and deduplicates tags', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cache.addTags(['posts', 'users']);
      context.cache.addTags(['posts', 'comments']);

      const tags = context.cache.getTags();
      expect(tags).toEqual(['posts', 'users', 'comments']);
    });

    test('cache.set without tags does not modify tags', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cache.addTags(['existing']);
      context.cache.set({ maxAge: 60 });

      expect(context.cache.getTags()).toEqual(['existing']);
    });

    test('applyToResponse does not override existing Cache-Control header', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cache.set({ maxAge: 60 });

      const original = new Response('OK', {
        headers: { 'Cache-Control': 'no-store' },
      });
      const modified = context.applyToResponse(original);

      expect(modified.headers.get('Cache-Control')).toBe('no-store');
    });

    test('applyToResponse does not override existing X-Cache-Tags header', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cache.addTags(['new-tag']);

      const original = new Response('OK', {
        headers: { 'X-Cache-Tags': 'existing' },
      });
      const modified = context.applyToResponse(original);

      expect(modified.headers.get('X-Cache-Tags')).toBe('existing');
    });

    test('cache control with only maxAge and no privacy set defaults to public', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cache.set({ maxAge: 120 });

      const header = context.buildCacheControlHeader();
      expect(header).toBe('public, max-age=120');
    });
  });

  describe('env property', () => {
    test('provides process.env reference', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      // env should be available
      expect(context.env).toBeDefined();
      expect(typeof context.env).toBe('object');
    });
  });

  describe('store operations', () => {
    test('delete returns true for existing key, false for non-existing', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.set('key', 'value');
      expect(context.delete('key')).toBe(true);
      expect(context.delete('key')).toBe(false);
    });

    test('overwriting a key preserves latest value', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.set('key', 'first');
      context.set('key', 'second');
      expect(context.get('key')).toBe('second');
    });
  });

  describe('applyToResponse preserves original response properties', () => {
    test('preserves status code and statusText', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const original = new Response('Created', { status: 201, statusText: 'Created' });
      const modified = context.applyToResponse(original);

      expect(modified.status).toBe(201);
    });

    test('preserves response body', async () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const original = new Response('Hello World');
      const modified = context.applyToResponse(original);

      expect(await modified.text()).toBe('Hello World');
    });

    test('merges context responseHeaders onto response', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.responseHeaders.set('X-Request-Id', 'abc123');
      context.responseHeaders.set('X-Frame-Options', 'DENY');

      const original = new Response('OK');
      const modified = context.applyToResponse(original);

      expect(modified.headers.get('X-Request-Id')).toBe('abc123');
      expect(modified.headers.get('X-Frame-Options')).toBe('DENY');
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

    test('handles malformed %-encoding in cookie values gracefully', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'bad=%E0%A4%A' },
      });
      const context = createContext(request);

      // Should not throw, should store raw value
      const value = context.cookies.get('bad');
      expect(value).toBe('%E0%A4%A');
    });

    test('handles cookie pair without = sign (skips it)', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'invalid; valid=yes' },
      });
      const context = createContext(request);

      expect(context.cookies.has('invalid')).toBe(false);
      expect(context.cookies.get('valid')).toBe('yes');
    });

    test('handles empty cookie name (skips it)', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: '=value; real=data' },
      });
      const context = createContext(request);

      expect(context.cookies.get('')).toBeUndefined();
      expect(context.cookies.get('real')).toBe('data');
    });

    test('handles cookie with = in value', () => {
      const request = new Request('http://localhost:3000/', {
        headers: { Cookie: 'token=abc=def=ghi' },
      });
      const context = createContext(request);

      expect(context.cookies.get('token')).toBe('abc=def=ghi');
    });

    test('set() with httpOnly explicitly false omits HttpOnly', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cookies.set('session', 'val', { httpOnly: false });

      const response = context.applyToResponse(new Response('OK'));
      const setCookies = response.headers.getSetCookie();
      const cookie = setCookies[0];
      expect(cookie).not.toContain('HttpOnly');
    });

    test('set() with expires adds Expires header', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);
      const expiry = new Date('2030-01-01T00:00:00Z');

      context.cookies.set('session', 'val', { expires: expiry });

      const response = context.applyToResponse(new Response('OK'));
      const setCookies = response.headers.getSetCookie();
      expect(setCookies[0]).toContain('Expires=');
    });

    test('delete() with custom path and domain', () => {
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      context.cookies.delete('session', { path: '/api', domain: '.example.com' });

      const response = context.applyToResponse(new Response('OK'));
      const setCookies = response.headers.getSetCookie();
      const cookie = setCookies[0];
      expect(cookie).toContain('Path=/api');
      expect(cookie).toContain('Domain=.example.com');
      expect(cookie).toContain('Max-Age=0');
    });
  });

  describe('getContext returns undefined for unattached request', () => {
    test('returns undefined when no context attached', () => {
      const request = new Request('http://localhost:3000/');
      expect(getContext(request)).toBeUndefined();
    });
  });
});

// ============================================================================
// Cache control header edge cases
// ============================================================================
describe('@ereo/core - Context cache control header combinations', () => {
  test('staleWhileRevalidate without maxAge', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.cache.set({ staleWhileRevalidate: 300 });

    const header = context.buildCacheControlHeader();
    expect(header).toContain('public');
    expect(header).toContain('stale-while-revalidate=300');
    expect(header).not.toContain('max-age');
  });

  test('empty cache options object returns header with just public', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.cache.set({});

    const header = context.buildCacheControlHeader();
    expect(header).toBe('public');
  });

  test('private with staleWhileRevalidate', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.cache.set({ private: true, staleWhileRevalidate: 60 });

    const header = context.buildCacheControlHeader();
    expect(header).toContain('private');
    expect(header).toContain('stale-while-revalidate=60');
    expect(header).not.toContain('public');
  });

  test('maxAge of 0 is valid', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.cache.set({ maxAge: 0 });

    const header = context.buildCacheControlHeader();
    expect(header).toContain('max-age=0');
  });
});

// ============================================================================
// Set-Cookie combined with cache control
// ============================================================================
describe('@ereo/core - Context applyToResponse combined operations', () => {
  test('Set-Cookie headers coexist with cache control', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.cache.set({ maxAge: 300, tags: ['session'] });
    context.cookies.set('token', 'abc', { maxAge: 3600 });

    const response = context.applyToResponse(new Response('OK'));

    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
    expect(response.headers.get('X-Cache-Tags')).toBe('session');
    const setCookies = response.headers.getSetCookie();
    expect(setCookies.some(c => c.includes('token='))).toBe(true);
  });

  test('response headers, cache control, and cookies all applied together', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.responseHeaders.set('X-Request-Id', 'abc');
    context.cache.set({ maxAge: 60, private: true });
    context.cookies.set('session', '123');
    context.cookies.set('theme', 'dark');

    const response = context.applyToResponse(new Response('OK'));

    expect(response.headers.get('X-Request-Id')).toBe('abc');
    expect(response.headers.get('Cache-Control')).toContain('private');
    const setCookies = response.headers.getSetCookie();
    expect(setCookies.length).toBe(2);
  });
});

// ============================================================================
// Cookie encoding verification
// ============================================================================
describe('@ereo/core - Context cookie encoding', () => {
  test('set() encodes special characters in cookie name and value', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.cookies.set('user name', 'hello world');

    const response = context.applyToResponse(new Response('OK'));
    const setCookies = response.headers.getSetCookie();
    const cookie = setCookies[0];

    // encodeURIComponent('user name') = 'user%20name'
    // encodeURIComponent('hello world') = 'hello%20world'
    expect(cookie).toContain('user%20name=hello%20world');
  });

  test('set() stores raw value in memory (not encoded)', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.cookies.set('key', 'value with spaces');

    // In-memory should be raw
    expect(context.cookies.get('key')).toBe('value with spaces');
  });
});

// ============================================================================
// Attach/get context lifecycle
// ============================================================================
describe('@ereo/core - Context attach lifecycle', () => {
  test('attaching context to multiple requests', () => {
    const req1 = new Request('http://localhost:3000/a');
    const req2 = new Request('http://localhost:3000/b');
    const ctx1 = createContext(req1);
    const ctx2 = createContext(req2);

    attachContext(req1, ctx1);
    attachContext(req2, ctx2);

    expect(getContext(req1)).toBe(ctx1);
    expect(getContext(req2)).toBe(ctx2);
    expect(getContext(req1)).not.toBe(ctx2);
  });

  test('overwriting attached context', () => {
    const request = new Request('http://localhost:3000/');
    const ctx1 = createContext(request);
    const ctx2 = createContext(request);

    attachContext(request, ctx1);
    expect(getContext(request)).toBe(ctx1);

    attachContext(request, ctx2);
    expect(getContext(request)).toBe(ctx2);
  });
});

// ============================================================================
// URL parsing edge cases
// ============================================================================
describe('@ereo/core - Context URL parsing', () => {
  test('parses query parameters correctly', () => {
    const request = new Request('http://localhost:3000/search?q=hello&page=2&sort=desc');
    const context = createContext(request);

    expect(context.url.searchParams.get('q')).toBe('hello');
    expect(context.url.searchParams.get('page')).toBe('2');
    expect(context.url.searchParams.get('sort')).toBe('desc');
  });

  test('handles URLs with hash (fragment stripped by URL spec)', () => {
    const request = new Request('http://localhost:3000/page#section');
    const context = createContext(request);

    expect(context.url.pathname).toBe('/page');
    // Note: fragments are not sent to server, but URL constructor handles them
    expect(context.url.hash).toBe('#section');
  });

  test('handles root URL', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    expect(context.url.pathname).toBe('/');
    expect(context.url.search).toBe('');
  });
});

// ============================================================================
// Store edge cases
// ============================================================================
describe('@ereo/core - Context store edge cases', () => {
  test('stores various value types', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.set('null', null);
    context.set('number', 42);
    context.set('array', [1, 2, 3]);
    context.set('nested', { a: { b: { c: true } } });
    context.set('boolean', false);

    expect(context.get('null')).toBeNull();
    expect(context.get('number')).toBe(42);
    expect(context.get('array')).toEqual([1, 2, 3]);
    expect(context.get('nested')).toEqual({ a: { b: { c: true } } });
    expect(context.get('boolean')).toBe(false);
  });

  test('has returns false after delete', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.set('key', 'value');
    expect(context.has('key')).toBe(true);

    context.delete('key');
    expect(context.has('key')).toBe(false);
    expect(context.get('key')).toBeUndefined();
  });
});
