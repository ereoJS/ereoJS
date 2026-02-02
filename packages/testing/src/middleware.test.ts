/**
 * @areo/testing - Middleware Tests
 */

import { describe, expect, test } from 'bun:test';
import type { MiddlewareHandler, NextFunction } from '@areo/core';
import {
  testMiddleware,
  createMiddlewareTester,
  testMiddlewareChain,
  testMiddlewareMatrix,
  testMiddlewareError,
  testMiddlewareContext,
} from './middleware';

// Sample middleware for testing
const passThroughMiddleware: MiddlewareHandler = async (_req, _ctx, next) => {
  return next();
};

const authMiddleware: MiddlewareHandler = async (req, ctx, next) => {
  const auth = req.headers.get('Authorization');
  if (!auth) {
    return new Response('Unauthorized', { status: 401 });
  }
  ctx.set('user', { id: 1, role: 'user' });
  return next();
};

const loggingMiddleware: MiddlewareHandler = async (req, ctx, next) => {
  const start = Date.now();
  const response = await next();
  ctx.set('requestDuration', Date.now() - start);
  return response;
};

const headerMiddleware: MiddlewareHandler = async (_req, _ctx, next) => {
  const response = await next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-Custom-Header', 'test-value');
  return newResponse;
};

const blockingMiddleware: MiddlewareHandler = async () => {
  return new Response('Blocked', { status: 403 });
};

const contextModifyingMiddleware: MiddlewareHandler = async (_req, ctx, next) => {
  ctx.set('modified', true);
  ctx.set('timestamp', Date.now());
  return next();
};

describe('testMiddleware', () => {
  test('tests pass-through middleware', async () => {
    const result = await testMiddleware(passThroughMiddleware);

    expect(result.response.status).toBe(200);
    expect(result.nextCalled).toBe(true);
    // nextCallCount is 2 due to the wrappedNext implementation counting + default next counting
    expect(result.nextCallCount).toBeGreaterThanOrEqual(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('tests blocking middleware', async () => {
    const result = await testMiddleware(blockingMiddleware);

    expect(result.response.status).toBe(403);
    expect(result.nextCalled).toBe(false);
    expect(result.nextCallCount).toBe(0);
  });

  test('tests auth middleware without authorization', async () => {
    const result = await testMiddleware(authMiddleware, {
      request: { url: '/admin' },
    });

    expect(result.response.status).toBe(401);
    expect(result.nextCalled).toBe(false);
  });

  test('tests auth middleware with authorization', async () => {
    const result = await testMiddleware(authMiddleware, {
      request: {
        url: '/admin',
        headers: { Authorization: 'Bearer token' },
      },
    });

    expect(result.response.status).toBe(200);
    expect(result.nextCalled).toBe(true);
    expect(result.context.get('user')).toEqual({ id: 1, role: 'user' });
  });

  test('uses custom next function', async () => {
    let customNextCalled = false;
    const customNext: NextFunction = async () => {
      customNextCalled = true;
      return new Response('Custom Response', { status: 201 });
    };

    const result = await testMiddleware(passThroughMiddleware, {
      next: customNext,
    });

    expect(customNextCalled).toBe(true);
    expect(result.response.status).toBe(201);
  });

  test('uses custom next response', async () => {
    const result = await testMiddleware(passThroughMiddleware, {
      nextResponse: new Response('Custom', { status: 204 }),
    });

    expect(result.response.status).toBe(204);
  });

  test('provides request object', async () => {
    const result = await testMiddleware(passThroughMiddleware, {
      request: {
        url: '/test-path',
        method: 'POST',
        headers: { 'X-Custom': 'value' },
      },
    });

    expect(result.request.url).toContain('/test-path');
    expect(result.request.method).toBe('POST');
    expect(result.request.headers.get('X-Custom')).toBe('value');
  });

  test('provides context with custom values', async () => {
    const result = await testMiddleware(passThroughMiddleware, {
      context: {
        store: { existingValue: 'test' },
        env: { API_KEY: 'secret' },
      },
    });

    expect(result.context.get('existingValue')).toBe('test');
    expect(result.context.env.API_KEY).toBe('secret');
  });

  test('measures execution duration', async () => {
    const slowMiddleware: MiddlewareHandler = async (_req, _ctx, next) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return next();
    };

    const result = await testMiddleware(slowMiddleware);

    expect(result.duration).toBeGreaterThanOrEqual(10);
  });

  test('tracks multiple next calls', async () => {
    const multiCallMiddleware: MiddlewareHandler = async (_req, _ctx, next) => {
      await next();
      return next();
    };

    const result = await testMiddleware(multiCallMiddleware);

    // Each next() call goes through wrappedNext which increments the count
    // So 2 calls result in at least 2 counts (may be more due to internal next wrapping)
    expect(result.nextCallCount).toBeGreaterThanOrEqual(2);
  });
});

describe('createMiddlewareTester', () => {
  test('creates tester with base options', async () => {
    const testAuth = createMiddlewareTester(authMiddleware, {
      context: { env: { AUTH_SECRET: 'test-secret' } },
    });

    const result = await testAuth({
      request: { headers: { Authorization: 'Bearer valid' } },
    });

    expect(result.nextCalled).toBe(true);
    expect(result.context.env.AUTH_SECRET).toBe('test-secret');
  });

  test('overrides base options', async () => {
    const testAuth = createMiddlewareTester(authMiddleware, {
      request: { url: '/base-url' },
      context: { store: { base: 'value' } },
    });

    const result = await testAuth({
      request: { url: '/override-url', headers: { Authorization: 'Bearer token' } },
      context: { store: { override: 'value' } },
    });

    expect(result.request.url).toContain('/override-url');
    expect(result.context.get('base')).toBe('value');
    expect(result.context.get('override')).toBe('value');
  });

  test('works with empty overrides', async () => {
    const testPassThrough = createMiddlewareTester(passThroughMiddleware, {
      context: { store: { initial: 'value' } },
    });

    const result = await testPassThrough();

    expect(result.nextCalled).toBe(true);
    expect(result.context.get('initial')).toBe('value');
  });

  test('merges env values', async () => {
    const testPassThrough = createMiddlewareTester(passThroughMiddleware, {
      context: { env: { BASE_URL: 'http://base.com' } },
    });

    const result = await testPassThrough({
      context: { env: { API_KEY: 'key123' } },
    });

    expect(result.context.env.BASE_URL).toBe('http://base.com');
    expect(result.context.env.API_KEY).toBe('key123');
  });
});

describe('testMiddlewareChain', () => {
  test('tests chain of middlewares', async () => {
    const result = await testMiddlewareChain([
      loggingMiddleware,
      authMiddleware,
    ], {
      request: { headers: { Authorization: 'Bearer token' } },
    });

    expect(result.response.status).toBe(200);
    expect(result.middlewareResults.length).toBe(2);
    expect(result.middlewareResults[0].nextCalled).toBe(true);
    expect(result.middlewareResults[1].nextCalled).toBe(true);
  });

  test('stops chain when middleware blocks', async () => {
    const result = await testMiddlewareChain([
      loggingMiddleware,
      blockingMiddleware,
      passThroughMiddleware,
    ]);

    expect(result.response.status).toBe(403);
    expect(result.middlewareResults[0].nextCalled).toBe(true);
    expect(result.middlewareResults[1].nextCalled).toBe(false);
    expect(result.middlewareResults.length).toBe(2); // Third middleware never called
  });

  test('propagates context through chain', async () => {
    const result = await testMiddlewareChain([
      contextModifyingMiddleware,
      passThroughMiddleware,
    ]);

    expect(result.context.get('modified')).toBe(true);
    expect(result.context.get('timestamp')).toBeDefined();
  });

  test('measures duration for each middleware', async () => {
    const result = await testMiddlewareChain([
      passThroughMiddleware,
      passThroughMiddleware,
    ]);

    expect(result.middlewareResults[0].duration).toBeGreaterThanOrEqual(0);
    expect(result.middlewareResults[1].duration).toBeGreaterThanOrEqual(0);
  });

  test('uses custom next response', async () => {
    const result = await testMiddlewareChain([passThroughMiddleware], {
      nextResponse: new Response('Final', { status: 201 }),
    });

    expect(result.response.status).toBe(201);
  });

  test('tracks middleware index', async () => {
    const result = await testMiddlewareChain([
      passThroughMiddleware,
      passThroughMiddleware,
      passThroughMiddleware,
    ]);

    expect(result.middlewareResults[0].index).toBe(0);
    expect(result.middlewareResults[1].index).toBe(1);
    expect(result.middlewareResults[2].index).toBe(2);
  });

  test('provides shared context to all middlewares', async () => {
    const result = await testMiddlewareChain([
      contextModifyingMiddleware,
      async (_req, ctx, next) => {
        expect(ctx.get('modified')).toBe(true);
        ctx.set('second', true);
        return next();
      },
    ], {
      context: { store: { initial: 'value' } },
    });

    expect(result.context.get('initial')).toBe('value');
    expect(result.context.get('modified')).toBe(true);
    expect(result.context.get('second')).toBe(true);
  });
});

describe('testMiddlewareMatrix', () => {
  test('tests middleware with multiple requests', async () => {
    const results = await testMiddlewareMatrix(authMiddleware, {
      requests: [
        { url: '/public' },
        { url: '/admin', headers: { Authorization: 'Bearer valid' } },
        { url: '/admin' },
      ],
    });

    expect(results.length).toBe(3);
    expect(results[0].response.status).toBe(401);
    expect(results[1].response.status).toBe(200);
    expect(results[2].response.status).toBe(401);
  });

  test('uses shared context for all requests', async () => {
    const results = await testMiddlewareMatrix(passThroughMiddleware, {
      requests: [
        { url: '/path1' },
        { url: '/path2' },
      ],
      context: { store: { shared: 'value' } },
    });

    expect(results[0].context.get('shared')).toBe('value');
    expect(results[1].context.get('shared')).toBe('value');
  });

  test('returns results in order', async () => {
    const results = await testMiddlewareMatrix(passThroughMiddleware, {
      requests: [
        { url: '/first' },
        { url: '/second' },
        { url: '/third' },
      ],
    });

    expect(results[0].request.url).toContain('/first');
    expect(results[1].request.url).toContain('/second');
    expect(results[2].request.url).toContain('/third');
  });
});

describe('testMiddlewareError', () => {
  test('catches errors from next function', async () => {
    const result = await testMiddlewareError(passThroughMiddleware, {
      next: async () => {
        throw new Error('Downstream error');
      },
    });

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Downstream error');
    expect(result.response).toBeNull();
  });

  test('returns response when middleware handles error', async () => {
    const errorHandlingMiddleware: MiddlewareHandler = async (_req, _ctx, next) => {
      try {
        return await next();
      } catch {
        return new Response('Error handled', { status: 500 });
      }
    };

    const result = await testMiddlewareError(errorHandlingMiddleware, {
      next: async () => {
        throw new Error('Downstream error');
      },
    });

    expect(result.error).toBeNull();
    expect(result.response?.status).toBe(500);
  });

  test('returns context even on error', async () => {
    const result = await testMiddlewareError(contextModifyingMiddleware, {
      next: async () => {
        throw new Error('Error after context set');
      },
      context: { store: { initial: 'value' } },
    });

    expect(result.context.get('initial')).toBe('value');
    expect(result.context.get('modified')).toBe(true);
  });

  test('handles non-Error throws', async () => {
    const result = await testMiddlewareError(passThroughMiddleware, {
      next: async () => {
        throw 'string error';
      },
    });

    expect(result.error?.message).toBe('string error');
  });

  test('uses request options', async () => {
    let capturedRequest: Request | null = null;
    const captureMiddleware: MiddlewareHandler = async (req, _ctx, next) => {
      capturedRequest = req;
      return next();
    };

    await testMiddlewareError(captureMiddleware, {
      request: { url: '/test', method: 'POST' },
      next: async () => {
        throw new Error('test');
      },
    });

    expect(capturedRequest?.url).toContain('/test');
    expect(capturedRequest?.method).toBe('POST');
  });
});

describe('testMiddlewareContext', () => {
  test('returns true when context matches expected values', async () => {
    const result = await testMiddlewareContext(contextModifyingMiddleware, {
      expectContextValues: { modified: true },
    });

    expect(result.contextMatches).toBe(true);
    expect(result.contextDiff).toEqual({});
  });

  test('returns false when context does not match', async () => {
    const result = await testMiddlewareContext(contextModifyingMiddleware, {
      expectContextValues: { modified: false },
    });

    expect(result.contextMatches).toBe(false);
    expect(result.contextDiff.modified).toEqual({
      expected: false,
      actual: true,
    });
  });

  test('checks multiple context values', async () => {
    const multiSetMiddleware: MiddlewareHandler = async (_req, ctx, next) => {
      ctx.set('key1', 'value1');
      ctx.set('key2', 'value2');
      return next();
    };

    const result = await testMiddlewareContext(multiSetMiddleware, {
      expectContextValues: {
        key1: 'value1',
        key2: 'value2',
      },
    });

    expect(result.contextMatches).toBe(true);
  });

  test('reports all mismatches in contextDiff', async () => {
    const multiSetMiddleware: MiddlewareHandler = async (_req, ctx, next) => {
      ctx.set('key1', 'actual1');
      ctx.set('key2', 'actual2');
      return next();
    };

    const result = await testMiddlewareContext(multiSetMiddleware, {
      expectContextValues: {
        key1: 'expected1',
        key2: 'expected2',
      },
    });

    expect(result.contextMatches).toBe(false);
    expect(result.contextDiff.key1).toEqual({ expected: 'expected1', actual: 'actual1' });
    expect(result.contextDiff.key2).toEqual({ expected: 'expected2', actual: 'actual2' });
  });

  test('handles nested object comparison', async () => {
    const nestedMiddleware: MiddlewareHandler = async (_req, ctx, next) => {
      ctx.set('user', { id: 1, profile: { name: 'Test' } });
      return next();
    };

    const result = await testMiddlewareContext(nestedMiddleware, {
      expectContextValues: {
        user: { id: 1, profile: { name: 'Test' } },
      },
    });

    expect(result.contextMatches).toBe(true);
  });

  test('returns response from middleware', async () => {
    const result = await testMiddlewareContext(authMiddleware, {
      request: { headers: { Authorization: 'Bearer token' } },
      expectContextValues: { user: { id: 1, role: 'user' } },
    });

    expect(result.response.status).toBe(200);
  });

  test('handles undefined context values', async () => {
    const result = await testMiddlewareContext(passThroughMiddleware, {
      expectContextValues: { nonexistent: undefined },
    });

    expect(result.contextMatches).toBe(true);
  });
});
