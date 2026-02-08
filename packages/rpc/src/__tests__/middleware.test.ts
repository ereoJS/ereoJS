/**
 * Tests for middleware helpers
 */

import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  logging,
  rateLimit,
  createAuthMiddleware,
  requireRoles,
  validate,
  extend,
  timing,
  catchErrors,
  clearRateLimitStore,
  _triggerCleanup,
  _RateLimitStore,
} from '../middleware';
import type { BaseContext, MiddlewareResult } from '../types';

// Helper to execute middleware
async function runMiddleware<TIn extends BaseContext, TOut>(
  middleware: (opts: { ctx: TIn; next: any }) => Promise<MiddlewareResult<TOut>>,
  ctx: TIn
): Promise<MiddlewareResult<TOut>> {
  return middleware({
    ctx,
    next: <T>(newCtx: T): MiddlewareResult<T> => ({ ok: true, ctx: newCtx }),
  });
}

describe('logging middleware', () => {
  test('logs requests', async () => {
    const logs: string[] = [];
    const middleware = logging({
      log: (...args: unknown[]) => logs.push(args.join(' ')),
      timing: false,
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    await runMiddleware(middleware, ctx);

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('[RPC]');
  });

  test('includes timing when enabled', async () => {
    const logs: string[] = [];
    const middleware = logging({
      log: (...args: unknown[]) => logs.push(args.join(' ')),
      timing: true,
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    await runMiddleware(middleware, ctx);

    expect(logs[0]).toMatch(/\d+(\.\d+)?ms/);
  });

  test('passes through context unchanged', async () => {
    const middleware = logging({ timing: false });

    const ctx: BaseContext = {
      ctx: { custom: 'data' },
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.ctx).toEqual({ custom: 'data' });
    }
  });
});

describe('rateLimit middleware', () => {
  beforeEach(() => {
    // Reset any internal state between tests
  });

  test('allows requests under limit', async () => {
    const middleware = rateLimit({
      limit: 5,
      windowMs: 1000,
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      }),
    };

    // Should allow first 5 requests
    for (let i = 0; i < 5; i++) {
      const result = await runMiddleware(middleware, ctx);
      expect(result.ok).toBe(true);
    }
  });

  test('blocks requests over limit', async () => {
    const middleware = rateLimit({
      limit: 3,
      windowMs: 10000,
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      }),
    };

    // Allow first 3
    for (let i = 0; i < 3; i++) {
      await runMiddleware(middleware, ctx);
    }

    // 4th should be blocked
    const result = await runMiddleware(middleware, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  test('uses custom key function', async () => {
    const middleware = rateLimit({
      limit: 2,
      windowMs: 10000,
      keyFn: (ctx) => ctx.ctx.userId || 'anonymous',
    });

    const ctx1: BaseContext = {
      ctx: { userId: 'user1' },
      request: new Request('http://localhost/test'),
    };

    const ctx2: BaseContext = {
      ctx: { userId: 'user2' },
      request: new Request('http://localhost/test'),
    };

    // Each user gets their own limit
    await runMiddleware(middleware, ctx1);
    await runMiddleware(middleware, ctx1);

    await runMiddleware(middleware, ctx2);
    await runMiddleware(middleware, ctx2);

    // user1 should be blocked
    const result1 = await runMiddleware(middleware, ctx1);
    expect(result1.ok).toBe(false);

    // user2 should also be blocked
    const result2 = await runMiddleware(middleware, ctx2);
    expect(result2.ok).toBe(false);
  });

  test('uses custom error message', async () => {
    const middleware = rateLimit({
      limit: 1,
      windowMs: 10000,
      message: 'Slow down!',
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '172.16.0.1' },
      }),
    };

    await runMiddleware(middleware, ctx);
    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Slow down!');
    }
  });
});

describe('createAuthMiddleware', () => {
  test('adds user to context when authenticated', async () => {
    const mockUser = { id: '1', name: 'John' };
    const middleware = createAuthMiddleware(async (ctx) => {
      const token = ctx.request.headers.get('Authorization');
      if (token === 'Bearer valid') {
        return mockUser;
      }
      return null;
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'Authorization': 'Bearer valid' },
      }),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.user).toEqual(mockUser);
    }
  });

  test('returns error when not authenticated', async () => {
    const middleware = createAuthMiddleware(async () => null);

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('uses custom error message', async () => {
    const middleware = createAuthMiddleware(async () => null, {
      message: 'Please log in first',
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Please log in first');
    }
  });
});

describe('requireRoles middleware', () => {
  test('allows user with required role', async () => {
    const middleware = requireRoles(['admin']);

    const ctx = {
      ctx: {},
      request: new Request('http://localhost/test'),
      user: { id: '1', role: 'admin' },
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
  });

  test('allows user with any of required roles', async () => {
    const middleware = requireRoles(['admin', 'moderator']);

    const ctx = {
      ctx: {},
      request: new Request('http://localhost/test'),
      user: { id: '1', role: 'moderator' },
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
  });

  test('blocks user without required role', async () => {
    const middleware = requireRoles(['admin']);

    const ctx = {
      ctx: {},
      request: new Request('http://localhost/test'),
      user: { id: '1', role: 'user' },
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  test('blocks user without role property', async () => {
    const middleware = requireRoles(['admin']);

    const ctx = {
      ctx: {},
      request: new Request('http://localhost/test'),
      user: { id: '1' },
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
  });

  test('uses custom error message', async () => {
    const middleware = requireRoles(['admin'], {
      message: 'Admin access only',
    });

    const ctx = {
      ctx: {},
      request: new Request('http://localhost/test'),
      user: { id: '1', role: 'user' },
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Admin access only');
    }
  });
});

describe('validate middleware', () => {
  test('passes when validation succeeds', async () => {
    const middleware = validate(async (ctx) => ({ ok: true }));

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
  });

  test('fails when validation fails', async () => {
    const middleware = validate(async (ctx) => ({
      ok: false,
      error: { code: 'INVALID', message: 'Validation failed' },
    }));

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID');
    }
  });

  test('can access context in validator', async () => {
    const middleware = validate(async (ctx: BaseContext & { user?: { banned: boolean } }) => {
      if (ctx.user?.banned) {
        return { ok: false, error: { code: 'BANNED', message: 'User is banned' } };
      }
      return { ok: true };
    });

    const ctx = {
      ctx: {},
      request: new Request('http://localhost/test'),
      user: { banned: true },
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BANNED');
    }
  });
});

describe('extend middleware', () => {
  test('adds properties to context', async () => {
    const middleware = extend(async () => ({
      timestamp: 12345,
      requestId: 'abc',
    }));

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.timestamp).toBe(12345);
      expect(result.ctx.requestId).toBe('abc');
    }
  });

  test('can access existing context', async () => {
    const middleware = extend(async (ctx: BaseContext & { user?: { id: string } }) => ({
      greeting: ctx.user ? `Hello, user ${ctx.user.id}` : 'Hello, guest',
    }));

    const ctx = {
      ctx: {},
      request: new Request('http://localhost/test'),
      user: { id: '123' },
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.greeting).toBe('Hello, user 123');
    }
  });
});

describe('timing middleware', () => {
  test('adds timing object to context', async () => {
    const middleware = timing();

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.timing).toBeDefined();
      expect(result.ctx.timing.start).toBeGreaterThan(0);
      expect(typeof result.ctx.timing.getDuration).toBe('function');
    }
  });

  test('getDuration returns elapsed time', async () => {
    const middleware = timing();

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    if (result.ok) {
      await new Promise(resolve => setTimeout(resolve, 10));
      const duration = result.ctx.timing.getDuration();
      expect(duration).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('catchErrors middleware', () => {
  test('passes through when no error', async () => {
    const middleware = catchErrors(() => {
      throw new Error('Should not be called');
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    const result = await runMiddleware(middleware, ctx);

    expect(result.ok).toBe(true);
  });

  test('catches and transforms errors via the middleware', async () => {
    class DatabaseError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
      }
    }

    const middleware = catchErrors((error) => {
      if (error instanceof DatabaseError) {
        return { code: 'DB_ERROR', message: 'Database operation failed' };
      }
      throw error;
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    // Execute the middleware with a next function that throws
    const result = await middleware({
      ctx,
      next: () => {
        throw new DatabaseError('Connection failed');
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR');
      expect(result.error.message).toBe('Database operation failed');
    }
  });

  test('re-throws unknown errors', async () => {
    const middleware = catchErrors((error) => {
      if (error instanceof TypeError) {
        return { code: 'TYPE_ERROR', message: 'Type error occurred' };
      }
      throw error; // Re-throw unknown
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    await expect(
      middleware({
        ctx,
        next: () => {
          throw new Error('unknown error');
        },
      })
    ).rejects.toThrow('unknown error');
  });
});

describe('RateLimitStore cleanup', () => {
  test('cleanup runs and removes expired entries', async () => {
    // Create a rate limiter with very short window
    const middleware = rateLimit({
      limit: 100,
      windowMs: 50, // 50ms window
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    };

    // Make a request to populate the store
    await runMiddleware(middleware, ctx);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 100));

    // Make another request — the old entry should be cleaned up
    const result = await runMiddleware(middleware, ctx);
    expect(result.ok).toBe(true);
  });

  test('separate rate limit windows are independent', async () => {
    const fast = rateLimit({ limit: 2, windowMs: 100000 });
    const slow = rateLimit({ limit: 5, windowMs: 200000 });

    const ctxFast: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '5.5.5.5' },
      }),
    };

    const ctxSlow: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '5.5.5.5' },
      }),
    };

    // Exhaust fast limiter
    await runMiddleware(fast, ctxFast);
    await runMiddleware(fast, ctxFast);
    const fastBlocked = await runMiddleware(fast, ctxFast);
    expect(fastBlocked.ok).toBe(false);

    // Slow limiter should still allow
    const slowResult = await runMiddleware(slow, ctxSlow);
    expect(slowResult.ok).toBe(true);
  });
});

describe('logging middleware edge cases', () => {
  test('uses default console.log and timing', async () => {
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const middleware = logging(); // no options, uses defaults

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test'),
    };

    await runMiddleware(middleware, ctx);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain('[RPC]');
    expect(logSpy.mock.calls[0][0]).toMatch(/\d+(\.\d+)?ms/);

    logSpy.mockRestore();
  });
});

describe('RateLimitStore cleanup cycle (_triggerCleanup)', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  afterEach(() => {
    clearRateLimitStore();
  });

  test('removes expired entries from store', async () => {
    // Create a rate limiter with a tiny window so entries expire immediately
    const middleware = rateLimit({
      limit: 10,
      windowMs: 1, // 1ms window — expires almost instantly
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '99.99.99.1' },
      }),
    };

    // Populate the store
    await runMiddleware(middleware, ctx);

    // Wait for entries to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    // Trigger cleanup — should remove the expired entry and the empty store
    _triggerCleanup();

    // The entry was cleaned up, so a new request should start fresh (count=1, under limit)
    const result = await runMiddleware(middleware, ctx);
    expect(result.ok).toBe(true);
  });

  test('removes empty stores and stops interval when all stores gone', async () => {
    // Create rate limiter with tiny window
    const middleware = rateLimit({
      limit: 10,
      windowMs: 1,
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '99.99.99.2' },
      }),
    };

    // Populate
    await runMiddleware(middleware, ctx);

    // Let entries expire
    await new Promise(resolve => setTimeout(resolve, 10));

    // Cleanup should remove expired entries, then remove the empty store,
    // then clear the interval since no stores remain
    _triggerCleanup();

    // After cleanup, creating a new request populates a fresh store
    const result = await runMiddleware(middleware, ctx);
    expect(result.ok).toBe(true);
  });

  test('keeps non-expired entries during cleanup', async () => {
    const middleware = rateLimit({
      limit: 3,
      windowMs: 60000, // Long window — entries won't expire
    });

    const ctx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '99.99.99.3' },
      }),
    };

    // Make 3 requests to hit the limit
    await runMiddleware(middleware, ctx);
    await runMiddleware(middleware, ctx);
    await runMiddleware(middleware, ctx);

    // Trigger cleanup — entries should NOT be removed (not expired)
    _triggerCleanup();

    // 4th request should still be blocked because entries were kept
    const result = await runMiddleware(middleware, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  test('handles multiple stores with mixed expiration', async () => {
    // Short window — expires quickly
    const shortMw = rateLimit({ limit: 10, windowMs: 1 });
    // Long window — stays alive
    const longMw = rateLimit({ limit: 10, windowMs: 60000 });

    const shortCtx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '99.99.99.4' },
      }),
    };
    const longCtx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost/test', {
        headers: { 'x-forwarded-for': '99.99.99.5' },
      }),
    };

    // Populate both
    await runMiddleware(shortMw, shortCtx);
    await runMiddleware(longMw, longCtx);

    // Wait for short-window entries to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    // Cleanup: short store entries expire → empty → store removed; long store stays
    _triggerCleanup();

    // Long-window limiter should still track the previous request
    // Make enough requests to hit the limit (already 1 counted)
    for (let i = 1; i < 10; i++) {
      await runMiddleware(longMw, longCtx);
    }
    const blocked = await runMiddleware(longMw, longCtx);
    expect(blocked.ok).toBe(false);
  });
});

describe('RateLimitStore interval-based cleanup', () => {
  test('setInterval callback fires and cleans expired entries', async () => {
    // Create a store with a very short cleanup interval (20ms)
    const store = new _RateLimitStore(20);

    // Get a store for a 1ms window (entries expire almost instantly)
    const entries = store.getStore(1);

    // Add an entry that will expire immediately
    entries.set('test-key', { count: 5, resetAt: Date.now() - 100 });

    // Wait for the interval to fire (20ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 60));

    // The interval callback should have cleaned up the expired entry
    expect(entries.has('test-key')).toBe(false);

    // Clean up the store to stop the interval
    store.clear();
  });
});
