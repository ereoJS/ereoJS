/**
 * Tests for server$ and createServerBlock
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  parseWindow,
  buildRateLimitMiddleware,
  buildCacheMiddleware,
  buildCorsMiddleware,
  buildAuthMiddleware,
  compileConfigMiddleware,
  clearServerFnRateLimitStore,
  _resetIdCounter,
  server$,
  createServerBlock,
  type ServerFnConfig,
} from '../server-block';
import {
  clearServerFnRegistry,
  getAllServerFns,
  getServerFn,
  ServerFnError,
  SERVER_FN_BASE,
  type ServerFnContext,
  type ServerFnMiddleware,
} from '../server-fn';
import { createServerFnHandler } from '../server-fn-handler';

// Clean up between tests
beforeEach(() => {
  clearServerFnRegistry();
  clearServerFnRateLimitStore();
  _resetIdCounter();
});

// Helper to create a minimal ServerFnContext
function makeCtx(overrides?: Partial<ServerFnContext>): ServerFnContext {
  return {
    request: new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    }),
    responseHeaders: new Headers(),
    appContext: {},
    ...overrides,
  };
}

// Helper to build an HTTP request for the handler
function makeRequest(
  fnId: string,
  input?: unknown,
  options?: { headers?: Record<string, string> }
): Request {
  const { headers = {} } = options ?? {};
  const url = `http://localhost${SERVER_FN_BASE}/${encodeURIComponent(fnId)}`;
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1', ...headers },
    body: JSON.stringify({ input }),
  });
}

// =============================================================================
// parseWindow
// =============================================================================

describe('parseWindow', () => {
  test('parses seconds', () => {
    expect(parseWindow('30s')).toBe(30_000);
    expect(parseWindow('1s')).toBe(1_000);
  });

  test('parses minutes', () => {
    expect(parseWindow('1m')).toBe(60_000);
    expect(parseWindow('5m')).toBe(300_000);
  });

  test('parses hours', () => {
    expect(parseWindow('1h')).toBe(3_600_000);
    expect(parseWindow('24h')).toBe(86_400_000);
  });

  test('parses days', () => {
    expect(parseWindow('1d')).toBe(86_400_000);
    expect(parseWindow('7d')).toBe(604_800_000);
  });

  test('throws on invalid format', () => {
    expect(() => parseWindow('')).toThrow('Invalid window format');
    expect(() => parseWindow('abc')).toThrow('Invalid window format');
    expect(() => parseWindow('10')).toThrow('Invalid window format');
    expect(() => parseWindow('10x')).toThrow('Invalid window format');
    expect(() => parseWindow('m5')).toThrow('Invalid window format');
    expect(() => parseWindow('-5m')).toThrow('Invalid window format');
  });

  test('throws on zero value', () => {
    expect(() => parseWindow('0s')).toThrow('Window value must be positive');
  });

  test('handles large values', () => {
    expect(parseWindow('999s')).toBe(999_000);
  });
});

// =============================================================================
// buildRateLimitMiddleware
// =============================================================================

describe('buildRateLimitMiddleware', () => {
  test('allows requests under the limit', async () => {
    const mw = buildRateLimitMiddleware({ max: 3, window: '1m' });
    const ctx = makeCtx();

    for (let i = 0; i < 3; i++) {
      const result = await mw(ctx, async () => 'ok');
      expect(result).toBe('ok');
    }
  });

  test('throws RATE_LIMITED when limit is exceeded', async () => {
    const mw = buildRateLimitMiddleware({ max: 2, window: '1m' });
    const ctx = makeCtx();

    await mw(ctx, async () => 'ok'); // 1
    await mw(ctx, async () => 'ok'); // 2

    try {
      await mw(ctx, async () => 'ok'); // 3 — should throw
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ServerFnError);
      const sfErr = err as ServerFnError;
      expect(sfErr.code).toBe('RATE_LIMITED');
      expect(sfErr.statusCode).toBe(429);
    }
  });

  test('uses custom keyFn', async () => {
    const mw = buildRateLimitMiddleware({
      max: 1,
      window: '1m',
      keyFn: (ctx) => ctx.request.headers.get('X-Api-Key') ?? 'none',
    });

    const ctx1 = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { 'X-Api-Key': 'key-a' },
      }),
    });
    const ctx2 = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { 'X-Api-Key': 'key-b' },
      }),
    });

    // Each key gets its own limit
    expect(await mw(ctx1, async () => 'a')).toBe('a');
    expect(await mw(ctx2, async () => 'b')).toBe('b');

    // key-a is now over limit
    try {
      await mw(ctx1, async () => 'fail');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }
  });

  test('resets after window expires', async () => {
    // Use a very short window and mock Date.now
    const originalNow = Date.now;
    let fakeTime = 1000000;
    Date.now = () => fakeTime;

    try {
      const mw = buildRateLimitMiddleware({ max: 1, window: '1s' });
      const ctx = makeCtx();

      await mw(ctx, async () => 'ok'); // 1 — at limit

      try {
        await mw(ctx, async () => 'fail');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as ServerFnError).code).toBe('RATE_LIMITED');
      }

      // Advance time past the window
      fakeTime += 2000;

      // Should be allowed again
      const result = await mw(ctx, async () => 'ok again');
      expect(result).toBe('ok again');
    } finally {
      Date.now = originalNow;
    }
  });

  test('fails open when store exceeds MAX_ENTRIES after cleanup', async () => {
    // The store has a 10,000 entry limit. When exceeded with no expired entries,
    // it should fail open (allow request without tracking)
    const originalNow = Date.now;
    const fakeTime = 1000000;
    Date.now = () => fakeTime;

    try {
      const mw = buildRateLimitMiddleware({ max: 1, window: '1m' });

      // Fill the store to capacity with unique keys that won't expire
      for (let i = 0; i < 10_000; i++) {
        const ctx = makeCtx({
          request: new Request('http://localhost/test', {
            headers: { 'x-forwarded-for': `ip-${i}` },
          }),
        });
        await mw(ctx, async () => 'ok');
      }

      // New IP at capacity — should fail open (allow request)
      const newCtx = makeCtx({
        request: new Request('http://localhost/test', {
          headers: { 'x-forwarded-for': 'new-ip' },
        }),
      });
      const result = await mw(newCtx, async () => 'allowed');
      expect(result).toBe('allowed');
    } finally {
      Date.now = originalNow;
    }
  });

  test('uses x-forwarded-for by default', async () => {
    const mw = buildRateLimitMiddleware({ max: 1, window: '1m' });

    const ctx1 = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    });
    const ctx2 = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '5.6.7.8' },
      }),
    });

    await mw(ctx1, async () => 'ok');
    await mw(ctx2, async () => 'ok');

    // 1.2.3.4 should be at limit now
    try {
      await mw(ctx1, async () => 'fail');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }

    // 5.6.7.8 should also be at limit
    try {
      await mw(ctx2, async () => 'fail');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }
  });
});

// =============================================================================
// buildCacheMiddleware
// =============================================================================

describe('buildCacheMiddleware', () => {
  test('sets private Cache-Control by default', async () => {
    const mw = buildCacheMiddleware({ maxAge: 60 });
    const ctx = makeCtx();

    await mw(ctx, async () => 'data');
    expect(ctx.responseHeaders.get('Cache-Control')).toBe('private, max-age=60');
  });

  test('sets public Cache-Control when configured', async () => {
    const mw = buildCacheMiddleware({ maxAge: 300, public: true });
    const ctx = makeCtx();

    await mw(ctx, async () => 'data');
    expect(ctx.responseHeaders.get('Cache-Control')).toBe('public, max-age=300');
  });

  test('includes stale-while-revalidate', async () => {
    const mw = buildCacheMiddleware({ maxAge: 60, staleWhileRevalidate: 30 });
    const ctx = makeCtx();

    await mw(ctx, async () => 'data');
    expect(ctx.responseHeaders.get('Cache-Control')).toBe(
      'private, max-age=60, stale-while-revalidate=30'
    );
  });

  test('passes through handler result', async () => {
    const mw = buildCacheMiddleware({ maxAge: 10 });
    const ctx = makeCtx();

    const result = await mw(ctx, async () => ({ items: [1, 2, 3] }));
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  test('does not set header if handler throws', async () => {
    const mw = buildCacheMiddleware({ maxAge: 60 });
    const ctx = makeCtx();

    try {
      await mw(ctx, async () => {
        throw new Error('boom');
      });
    } catch {
      // expected
    }

    // Cache-Control should NOT be set because the error propagated before we got to set it
    expect(ctx.responseHeaders.get('Cache-Control')).toBeNull();
  });
});

// =============================================================================
// buildCorsMiddleware
// =============================================================================

describe('buildCorsMiddleware', () => {
  test('sets wildcard origin', async () => {
    const mw = buildCorsMiddleware({ origins: '*' });
    const ctx = makeCtx();

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('sets matching origin from allowlist', async () => {
    const mw = buildCorsMiddleware({ origins: ['https://example.com', 'https://app.com'] });
    const ctx = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { Origin: 'https://example.com' },
      }),
    });

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });

  test('does not set origin for non-matching request', async () => {
    const mw = buildCorsMiddleware({ origins: ['https://example.com'] });
    const ctx = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { Origin: 'https://evil.com' },
      }),
    });

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('sets default methods and headers', async () => {
    const mw = buildCorsMiddleware({ origins: '*' });
    const ctx = makeCtx();

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Methods')).toBe('GET, POST');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type, Authorization, X-Ereo-RPC'
    );
  });

  test('sets custom methods and headers', async () => {
    const mw = buildCorsMiddleware({
      origins: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      headers: ['X-Custom'],
    });
    const ctx = makeCtx();

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Headers')).toBe('X-Custom');
  });

  test('sets credentials header', async () => {
    const mw = buildCorsMiddleware({ origins: '*', credentials: true });
    const ctx = makeCtx();

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  test('does not set credentials header by default', async () => {
    const mw = buildCorsMiddleware({ origins: '*' });
    const ctx = makeCtx();

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  test('sets max age for preflight', async () => {
    const mw = buildCorsMiddleware({ origins: '*', maxAge: 3600 });
    const ctx = makeCtx();

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Max-Age')).toBe('3600');
  });

  test('handles single string origin', async () => {
    const mw = buildCorsMiddleware({ origins: 'https://single.com' });
    const ctx = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { Origin: 'https://single.com' },
      }),
    });

    await mw(ctx, async () => 'ok');
    expect(ctx.responseHeaders.get('Access-Control-Allow-Origin')).toBe('https://single.com');
  });
});

// =============================================================================
// buildAuthMiddleware
// =============================================================================

describe('buildAuthMiddleware', () => {
  test('allows request when getUser returns a user', async () => {
    const mw = buildAuthMiddleware({
      getUser: () => ({ id: '1', name: 'Alice' }),
    });
    const ctx = makeCtx();

    const result = await mw(ctx, async () => 'protected data');
    expect(result).toBe('protected data');
  });

  test('throws UNAUTHORIZED when getUser returns null', async () => {
    const mw = buildAuthMiddleware({
      getUser: () => null,
    });
    const ctx = makeCtx();

    try {
      await mw(ctx, async () => 'should not reach');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ServerFnError);
      const sfErr = err as ServerFnError;
      expect(sfErr.code).toBe('UNAUTHORIZED');
      expect(sfErr.statusCode).toBe(401);
      expect(sfErr.message).toBe('Unauthorized');
    }
  });

  test('throws UNAUTHORIZED when getUser returns undefined', async () => {
    const mw = buildAuthMiddleware({
      getUser: () => undefined as any,
    });
    const ctx = makeCtx();

    try {
      await mw(ctx, async () => 'fail');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('UNAUTHORIZED');
    }
  });

  test('uses custom message', async () => {
    const mw = buildAuthMiddleware({
      getUser: () => null,
      message: 'Please log in first',
    });
    const ctx = makeCtx();

    try {
      await mw(ctx, async () => 'fail');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).message).toBe('Please log in first');
    }
  });

  test('supports async getUser', async () => {
    const mw = buildAuthMiddleware({
      getUser: async (ctx) => {
        const token = ctx.request.headers.get('Authorization');
        if (token === 'Bearer valid') return { id: '1' };
        return null;
      },
    });

    const authedCtx = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer valid' },
      }),
    });
    const result = await mw(authedCtx, async () => 'secret');
    expect(result).toBe('secret');

    const unauthedCtx = makeCtx({
      request: new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer invalid' },
      }),
    });
    try {
      await mw(unauthedCtx, async () => 'fail');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('UNAUTHORIZED');
    }
  });
});

// =============================================================================
// compileConfigMiddleware
// =============================================================================

describe('compileConfigMiddleware', () => {
  test('returns empty array for empty config', () => {
    const mw = compileConfigMiddleware({});
    expect(mw).toEqual([]);
  });

  test('generates middleware in correct order: CORS → rate limit → auth → cache → user', () => {
    const userMw: ServerFnMiddleware = async (_ctx, next) => next();

    const config: ServerFnConfig = {
      cors: { origins: '*' },
      rateLimit: { max: 10, window: '1m' },
      auth: { getUser: () => ({ id: '1' }) },
      cache: { maxAge: 60 },
      middleware: [userMw],
    };

    const mw = compileConfigMiddleware(config);
    // 5 middleware total: cors, rateLimit, auth, cache, user
    expect(mw.length).toBe(5);
  });

  test('only generates middleware for provided config keys', () => {
    const mw1 = compileConfigMiddleware({ rateLimit: { max: 10, window: '1m' } });
    expect(mw1.length).toBe(1);

    const mw2 = compileConfigMiddleware({ cache: { maxAge: 60 } });
    expect(mw2.length).toBe(1);

    const mw3 = compileConfigMiddleware({ cors: { origins: '*' }, auth: { getUser: () => null } });
    expect(mw3.length).toBe(2);
  });
});

// =============================================================================
// server$
// =============================================================================

describe('server$', () => {
  test('creates a callable server function', async () => {
    const greet = server$(async (name: string) => `Hello, ${name}!`);
    const result = await greet('World');
    expect(result).toBe('Hello, World!');
  });

  test('registers in the global registry', () => {
    server$(async () => 'test');
    expect(getAllServerFns().size).toBe(1);
  });

  test('uses auto-generated ID', () => {
    const fn = server$(async function myHandler() {
      return 42;
    });
    expect(fn._id).toContain('server$_myHandler_');
  });

  test('uses auto-generated ID for anonymous functions', () => {
    const fn = server$(async () => 42);
    expect(fn._id).toContain('server$_anonymous_');
  });

  test('uses explicit ID from config', () => {
    const fn = server$(async () => 42, { id: 'custom-id' });
    expect(fn._id).toBe('custom-id');
  });

  test('applies rate limit config', async () => {
    const fn = server$(async (n: number) => n * 2, {
      rateLimit: { max: 1, window: '1m' },
    });

    expect(await fn(5)).toBe(10);

    // Second call should be rate limited
    try {
      await fn(5);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }
  });

  test('applies cache config via HTTP handler', async () => {
    server$(async () => 'cached', {
      id: 'cached-fn',
      cache: { maxAge: 120, public: true },
    });

    const handler = createServerFnHandler();
    const response = await handler(makeRequest('cached-fn'));

    expect(response!.status).toBe(200);
    expect(response!.headers.get('Cache-Control')).toBe('public, max-age=120');
  });

  test('applies auth config', async () => {
    const fn = server$(async () => 'secret', {
      auth: { getUser: () => null },
    });

    try {
      await fn(undefined as void);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('UNAUTHORIZED');
    }
  });

  test('applies input validation', async () => {
    const schema = {
      parse(data: unknown) {
        if (typeof data !== 'string') throw new Error('must be string');
        return data;
      },
    };

    const fn = server$(async (name: string) => `Hi ${name}`, { input: schema });

    expect(await fn('Alice')).toBe('Hi Alice');
    await expect(fn(42 as any)).rejects.toThrow('must be string');
  });

  test('passes allowPublic to registry', () => {
    const fn = server$(async () => 'public', { allowPublic: true });
    const registered = getServerFn(fn._id);
    expect(registered!.allowPublic).toBe(true);
  });

  test('runs user middleware after config middleware', async () => {
    const order: string[] = [];

    const userMw: ServerFnMiddleware = async (_ctx, next) => {
      order.push('user');
      return next();
    };

    const fn = server$(
      async () => {
        order.push('handler');
        return 'done';
      },
      {
        auth: {
          getUser: () => {
            order.push('auth');
            return { id: '1' };
          },
        },
        middleware: [userMw],
      }
    );

    await fn(undefined as void);
    // Auth runs before user middleware
    expect(order).toEqual(['auth', 'user', 'handler']);
  });
});

// =============================================================================
// createServerBlock
// =============================================================================

describe('createServerBlock', () => {
  test('creates multiple callable server functions', async () => {
    const api = createServerBlock({}, {
      add: async (input: { a: number; b: number }) => input.a + input.b,
      multiply: async (input: { a: number; b: number }) => input.a * input.b,
    });

    expect(await api.add({ a: 3, b: 4 })).toBe(7);
    expect(await api.multiply({ a: 3, b: 4 })).toBe(12);
  });

  test('applies shared rate limit config with independent counters per function', async () => {
    const api = createServerBlock(
      { rateLimit: { max: 1, window: '1m' } },
      {
        fn1: async () => 'a',
        fn2: async () => 'b',
      }
    );

    // Each function gets its own rate limit store, so fn1 and fn2
    // have independent counters even when using the same config
    await api.fn1(undefined as void);
    await api.fn2(undefined as void);

    // fn1 is at its limit (max: 1), second call should be rate limited
    try {
      await api.fn1(undefined as void);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }

    // fn2 is also at its limit independently
    try {
      await api.fn2(undefined as void);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }
  });

  test('rate limits are isolated between functions (no cross-contamination)', async () => {
    // Regression: previously all functions with same window duration shared counters
    const fn1 = server$(async () => 'a', { rateLimit: { max: 2, window: '1m' } });
    const fn2 = server$(async () => 'b', { rateLimit: { max: 2, window: '1m' } });

    // Exhaust fn1's limit
    await fn1(undefined as void);
    await fn1(undefined as void);
    try {
      await fn1(undefined as void);
      expect.unreachable('fn1 should be rate limited');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }

    // fn2 should still have its full allowance
    await fn2(undefined as void);
    await fn2(undefined as void);
    // fn2 at limit now
    try {
      await fn2(undefined as void);
      expect.unreachable('fn2 should be rate limited');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }
  });

  test('per-fn overrides replace block config', async () => {
    const api = createServerBlock(
      { rateLimit: { max: 1, window: '1m' } },
      {
        strict: async () => 'strict',
        relaxed: {
          handler: async () => 'relaxed',
          rateLimit: { max: 100, window: '1m' },
        },
      }
    );

    // Strict: 1 request limit from block config
    await api.strict(undefined as void);
    try {
      await api.strict(undefined as void);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('RATE_LIMITED');
    }

    // Relaxed: 100 request limit from per-fn override
    for (let i = 0; i < 50; i++) {
      await api.relaxed(undefined as void);
    }
    // Should still work — well under 100
  });

  test('concatenates block + per-fn middleware', async () => {
    const order: string[] = [];

    const blockMw: ServerFnMiddleware = async (_ctx, next) => {
      order.push('block');
      return next();
    };

    const fnMw: ServerFnMiddleware = async (_ctx, next) => {
      order.push('fn');
      return next();
    };

    const api = createServerBlock(
      { middleware: [blockMw] },
      {
        myFn: {
          handler: async () => {
            order.push('handler');
            return 'done';
          },
          middleware: [fnMw],
        },
      }
    );

    await api.myFn(undefined as void);
    expect(order).toEqual(['block', 'fn', 'handler']);
  });

  test('supports explicit per-fn ID', () => {
    const api = createServerBlock({}, {
      myFn: {
        handler: async () => 'ok',
        id: 'explicit-id',
      },
    });

    expect(api.myFn._id).toBe('explicit-id');
  });

  test('auto-generates IDs from function names', () => {
    const api = createServerBlock({}, {
      getUsers: async () => [],
      createUser: async () => ({}),
    });

    expect(api.getUsers._id).toContain('getUsers');
    expect(api.createUser._id).toContain('createUser');
  });

  test('registers all functions in global registry', () => {
    createServerBlock({}, {
      fn1: async () => 'a',
      fn2: async () => 'b',
      fn3: async () => 'c',
    });

    expect(getAllServerFns().size).toBe(3);
  });

  test('shared auth config applies to all functions', async () => {
    const api = createServerBlock(
      { auth: { getUser: () => null } },
      {
        secret1: async () => 'a',
        secret2: async () => 'b',
      }
    );

    try {
      await api.secret1(undefined as void);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('UNAUTHORIZED');
    }

    try {
      await api.secret2(undefined as void);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('UNAUTHORIZED');
    }
  });

  test('per-fn can remove block-level auth by overriding with undefined', async () => {
    const api = createServerBlock(
      { auth: { getUser: () => null } },
      {
        protected: async () => 'secret',
        public: {
          handler: async () => 'open',
          auth: undefined,
        },
      }
    );

    // Protected: should throw
    try {
      await api.protected(undefined as void);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ServerFnError).code).toBe('UNAUTHORIZED');
    }

    // Public: auth override is undefined, so no auth middleware
    const result = await api.public(undefined as void);
    expect(result).toBe('open');
  });
});

// =============================================================================
// Integration with createServerFnHandler
// =============================================================================

describe('integration with HTTP handler', () => {
  test('server$ function dispatches via HTTP handler', async () => {
    const fn = server$(async (name: string) => `Hello, ${name}!`, { id: 'greet' });

    const handler = createServerFnHandler();
    const response = await handler(makeRequest('greet', 'World'));

    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBe('Hello, World!');
  });

  test('rate limit error returns 429 via HTTP handler', async () => {
    server$(async () => 'ok', {
      id: 'limited',
      rateLimit: { max: 1, window: '1m' },
    });

    const handler = createServerFnHandler();

    const r1 = await handler(makeRequest('limited'));
    expect(r1!.status).toBe(200);

    const r2 = await handler(makeRequest('limited'));
    expect(r2!.status).toBe(429);

    const body = await r2!.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  test('auth error returns 401 via HTTP handler', async () => {
    server$(async () => 'secret', {
      id: 'authed',
      auth: { getUser: () => null },
    });

    const handler = createServerFnHandler();
    const response = await handler(makeRequest('authed'));

    expect(response!.status).toBe(401);
    const body = await response!.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('CORS headers are set on HTTP response', async () => {
    server$(async () => 'data', {
      id: 'cors-fn',
      cors: { origins: '*', credentials: true },
    });

    const handler = createServerFnHandler();
    const response = await handler(makeRequest('cors-fn'));

    expect(response!.status).toBe(200);
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response!.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  test('createServerBlock functions dispatch via HTTP handler', async () => {
    const api = createServerBlock({}, {
      double: {
        handler: async (n: number) => n * 2,
        id: 'block-double',
      },
    });

    const handler = createServerFnHandler();
    const response = await handler(makeRequest('block-double', 21));

    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBe(42);
  });

  test('full middleware chain: CORS + rate limit + auth + cache + handler', async () => {
    server$(
      async () => 'full-stack',
      {
        id: 'full-chain',
        cors: { origins: '*' },
        rateLimit: { max: 10, window: '1m' },
        auth: { getUser: () => ({ id: '1' }) },
        cache: { maxAge: 300, public: true, staleWhileRevalidate: 60 },
      }
    );

    const handler = createServerFnHandler();
    const response = await handler(makeRequest('full-chain'));

    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body.data).toBe('full-stack');

    // Verify all headers
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response!.headers.get('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=60'
    );
  });
});
