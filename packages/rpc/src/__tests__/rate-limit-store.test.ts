/**
 * Tests for rate limiting shared store
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { rateLimit, clearRateLimitStore } from '../middleware';
import type { BaseContext } from '../types';

describe('Rate Limit Shared Store', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  test('shares store between middleware instances with same windowMs', async () => {
    const middleware1 = rateLimit({ limit: 5, windowMs: 60000 });
    const middleware2 = rateLimit({ limit: 5, windowMs: 60000 });

    const mockCtx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    };

    // Use up 3 requests via first middleware
    for (let i = 0; i < 3; i++) {
      await middleware1({
        ctx: mockCtx as any,
        next: () => ({ ok: true as const, ctx: mockCtx as any }),
      });
    }

    // Use up 2 more via second middleware - should share count
    for (let i = 0; i < 2; i++) {
      await middleware2({
        ctx: mockCtx,
        next: () => ({ ok: true as const, ctx: mockCtx }),
      });
    }

    // 6th request should be rate limited
    const result = await middleware1({
      ctx: mockCtx,
      next: () => ({ ok: true as const, ctx: mockCtx }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  test('separate stores for different windowMs values', async () => {
    const middleware1m = rateLimit({ limit: 2, windowMs: 60000 });
    const middleware5m = rateLimit({ limit: 10, windowMs: 300000 });

    const mockCtx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    };

    // Use 2 requests on 1-minute limit
    await middleware1m({ ctx: mockCtx, next: () => ({ ok: true as const, ctx: mockCtx }) });
    await middleware1m({ ctx: mockCtx, next: () => ({ ok: true as const, ctx: mockCtx }) });

    // 3rd request on 1-minute limit should be blocked
    const result1m = await middleware1m({
      ctx: mockCtx,
      next: () => ({ ok: true as const, ctx: mockCtx }),
    });
    expect(result1m.ok).toBe(false);

    // But 5-minute limit should still work
    const result5m = await middleware5m({
      ctx: mockCtx,
      next: () => ({ ok: true as const, ctx: mockCtx }),
    });
    expect(result5m.ok).toBe(true);
  });

  test('clearRateLimitStore resets all limits', async () => {
    const middleware1 = rateLimit({ limit: 2, windowMs: 60000 });

    const mockCtx: BaseContext = {
      ctx: {},
      request: new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    };

    // Use up limit
    await middleware1({ ctx: mockCtx as any, next: () => ({ ok: true as const, ctx: mockCtx as any }) });
    await middleware1({ ctx: mockCtx as any, next: () => ({ ok: true as const, ctx: mockCtx as any }) });

    // Verify rate limited (old middleware still has reference to old store)
    const beforeClear = await middleware1({
      ctx: mockCtx as any,
      next: () => ({ ok: true as const, ctx: mockCtx as any }),
    });
    expect(beforeClear.ok).toBe(false);

    // Clear store and create NEW middleware instance
    clearRateLimitStore();
    const middleware2 = rateLimit({ limit: 2, windowMs: 60000 });

    // Should work again with new middleware
    const afterClear = await middleware2({
      ctx: mockCtx as any,
      next: () => ({ ok: true as const, ctx: mockCtx as any }),
    });
    expect(afterClear.ok).toBe(true);
  });

  test('different keys are tracked separately', async () => {
    const middleware = rateLimit({
      limit: 2,
      windowMs: 60000,
      keyFn: (ctx) => ctx.request.headers.get('x-api-key') ?? 'unknown',
    });

    const mockRequest1: BaseContext = {
      ctx: {},
      request: new Request('http://localhost', {
        headers: { 'x-api-key': 'key1' },
      }),
    };

    const mockRequest2: BaseContext = {
      ctx: {},
      request: new Request('http://localhost', {
        headers: { 'x-api-key': 'key2' },
      }),
    };

    // Use up limit for key1
    await middleware({ ctx: mockRequest1, next: () => ({ ok: true as const, ctx: mockRequest1 }) });
    await middleware({ ctx: mockRequest1, next: () => ({ ok: true as const, ctx: mockRequest1 }) });

    // key1 should be rate limited
    const result1 = await middleware({
      ctx: mockRequest1,
      next: () => ({ ok: true as const, ctx: mockRequest1 }),
    });
    expect(result1.ok).toBe(false);

    // key2 should still work
    const result2 = await middleware({
      ctx: mockRequest2,
      next: () => ({ ok: true as const, ctx: mockRequest2 }),
    });
    expect(result2.ok).toBe(true);
  });
});
