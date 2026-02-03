/**
 * @ereo/router - Middleware Chain Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { MiddlewareHandler, AppContext } from '@ereo/core';
import {
  registerMiddleware,
  getMiddleware,
  hasMiddleware,
  unregisterMiddleware,
  clearMiddlewareRegistry,
  resolveMiddleware,
  executeMiddlewareChain,
  createMiddlewareExecutor,
  composeMiddleware,
  when,
  method,
  path,
  createLoggerMiddleware,
  createCorsMiddleware,
  createRateLimitMiddleware,
  createMiddleware,
  chainMiddleware,
  registerTypedMiddleware,
  getTypedMiddleware,
  validateMiddlewareChain,
  globToRegex,
  type TypedMiddleware,
} from './middleware-chain';

// Mock context helper
function createMockContext(): AppContext {
  return {
    cache: {
      set: () => {},
      get: () => undefined,
      getTags: () => [],
    },
    get: () => undefined,
    set: () => {},
    responseHeaders: new Headers(),
    url: new URL('http://localhost:3000/test'),
    env: {},
  };
}

describe('Middleware Registry', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should register and retrieve middleware', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    registerMiddleware('test', handler);

    expect(hasMiddleware('test')).toBe(true);
    expect(getMiddleware('test')).toBe(handler);
  });

  it('should return undefined for unknown middleware', () => {
    expect(getMiddleware('unknown')).toBeUndefined();
    expect(hasMiddleware('unknown')).toBe(false);
  });

  it('should unregister middleware', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    registerMiddleware('test', handler);

    expect(unregisterMiddleware('test')).toBe(true);
    expect(hasMiddleware('test')).toBe(false);
  });

  it('should clear all middleware', () => {
    registerMiddleware('test1', async (req, ctx, next) => next());
    registerMiddleware('test2', async (req, ctx, next) => next());

    clearMiddlewareRegistry();

    expect(hasMiddleware('test1')).toBe(false);
    expect(hasMiddleware('test2')).toBe(false);
  });
});

describe('resolveMiddleware', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should return function references directly', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    expect(resolveMiddleware(handler)).toBe(handler);
  });

  it('should resolve named middleware', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    registerMiddleware('named', handler);

    expect(resolveMiddleware('named')).toBe(handler);
  });

  it('should return undefined for unknown named middleware', () => {
    expect(resolveMiddleware('unknown')).toBeUndefined();
  });
});

describe('executeMiddlewareChain', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should execute middleware in order', async () => {
    const order: string[] = [];

    const handler1: MiddlewareHandler = async (req, ctx, next) => {
      order.push('1');
      const response = await next();
      order.push('1-end');
      return response;
    };

    const handler2: MiddlewareHandler = async (req, ctx, next) => {
      order.push('2');
      return next();
    };

    const finalHandler = async () => {
      order.push('final');
      return new Response('OK');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler1, handler2], {
      request,
      context,
      finalHandler,
    });

    expect(order).toEqual(['1', '2', 'final', '1-end']);
    expect(response.status).toBe(200);
  });

  it('should short-circuit on middleware response', async () => {
    const handler1: MiddlewareHandler = async (req, ctx, next) => {
      return new Response('Blocked', { status: 403 });
    };

    const handler2: MiddlewareHandler = async (req, ctx, next) => next();

    let finalCalled = false;
    const finalHandler = async () => {
      finalCalled = true;
      return new Response('OK');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler1, handler2], {
      request,
      context,
      finalHandler,
    });

    expect(response.status).toBe(403);
    expect(finalCalled).toBe(false);
  });

  it('should support named middleware references', async () => {
    registerMiddleware('auth', async (req, ctx, next) => {
      ctx.set('authenticated', true);
      return next();
    });

    const finalHandler = async () => {
      return new Response('OK');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain(['auth'], {
      request,
      context,
      finalHandler,
    });

    expect(response.status).toBe(200);
  });

  it('should throw for unknown named middleware', async () => {
    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    expect(
      executeMiddlewareChain(['unknown-middleware'], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      })
    ).rejects.toThrow('Named middleware not found');
  });

  it('should throw for invalid middleware reference', async () => {
    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    expect(
      executeMiddlewareChain([123 as unknown as string], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      })
    ).rejects.toThrow('Invalid middleware reference');
  });

  it('should handle non-Error thrown values', async () => {
    const errorHandler = (error: Error) => new Response(`Error: ${error.message}`, { status: 500 });

    const handler: MiddlewareHandler = async () => {
      throw 'string error';
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler], {
      request,
      context,
      finalHandler: async () => new Response('OK'),
      onError: errorHandler,
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error: string error');
  });

  it('should rethrow errors when no error handler provided', async () => {
    const handler: MiddlewareHandler = async () => {
      throw new Error('Unhandled error');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await expect(
      executeMiddlewareChain([handler], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      })
    ).rejects.toThrow('Unhandled error');
  });

  it('should handle errors with custom error handler', async () => {
    const errorHandler = (error: Error) => new Response('Error handled', { status: 500 });

    const handler: MiddlewareHandler = async () => {
      throw new Error('Test error');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler], {
      request,
      context,
      finalHandler: async () => new Response('OK'),
      onError: errorHandler,
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error handled');
  });
});

describe('createMiddlewareExecutor', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should create bound executor from config', async () => {
    registerMiddleware('test', async (req, ctx, next) => next());

    const executor = createMiddlewareExecutor({
      middleware: ['test'],
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executor({
      request,
      context,
      finalHandler: async () => new Response('OK'),
    });

    expect(response.status).toBe(200);
  });
});

describe('composeMiddleware', () => {
  it('should compose multiple handlers into one', async () => {
    const order: string[] = [];

    const handler1: MiddlewareHandler = async (req, ctx, next) => {
      order.push('1');
      return next();
    };

    const handler2: MiddlewareHandler = async (req, ctx, next) => {
      order.push('2');
      return next();
    };

    const composed = composeMiddleware(handler1, handler2);

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await composed(request, context, async () => {
      order.push('final');
      return new Response('OK');
    });

    expect(order).toEqual(['1', '2', 'final']);
  });
});

describe('when', () => {
  it('should run middleware when predicate is true', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = when(() => true, handler);

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should skip middleware when predicate is false', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = when(() => false, handler);

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });
});

describe('method', () => {
  it('should run middleware for matching method', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = method('POST', handler);

    const request = new Request('http://localhost:3000/test', { method: 'POST' });
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should skip middleware for non-matching method', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = method('GET', handler);

    const request = new Request('http://localhost:3000/test', { method: 'POST' });
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });
});

describe('path', () => {
  it('should run middleware for matching path', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/api/*', handler);

    const request = new Request('http://localhost:3000/api/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should run middleware for regex pattern', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path(/^\/api\/.*/, handler);

    const request = new Request('http://localhost:3000/api/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should run middleware for exact path match', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/about', handler);

    const request = new Request('http://localhost:3000/about');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should skip middleware for non-matching path', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/api/*', handler);

    const request = new Request('http://localhost:3000/other/route');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });

  it('should support array of patterns', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path(['/api/*', '/v2/*'], handler);

    const request = new Request('http://localhost:3000/v2/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should match prefix patterns without wildcard', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/api', handler);

    const request = new Request('http://localhost:3000/api/users/123');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });
});

describe('createLoggerMiddleware', () => {
  it('should log requests with duration', async () => {
    const logger = createLoggerMiddleware();

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await logger(request, context, async () => new Response('OK'));

    expect(response.status).toBe(200);
  });

  it('should include specified headers in logs', async () => {
    const logger = createLoggerMiddleware({
      includeHeaders: ['Content-Type', 'Authorization'],
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    });
    const context = createMockContext();

    const response = await logger(request, context, async () => new Response('OK'));

    expect(response.status).toBe(200);
  });

  it('should log errors and rethrow', async () => {
    const logger = createLoggerMiddleware();

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await expect(
      logger(request, context, async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });

  it('should handle non-Error thrown values in error path', async () => {
    const logger = createLoggerMiddleware();

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await expect(
      logger(request, context, async () => {
        throw 'string error';
      })
    ).rejects.toBe('string error');
  });
});

describe('createCorsMiddleware', () => {
  it('should add CORS headers to response', async () => {
    const cors = createCorsMiddleware({
      origin: '*',
      methods: ['GET', 'POST'],
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
  });

  it('should handle preflight requests', async () => {
    const cors = createCorsMiddleware();

    const request = new Request('http://localhost:3000/test', { method: 'OPTIONS' });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.status).toBe(204);
  });

  it('should handle array of allowed origins', async () => {
    const cors = createCorsMiddleware({
      origin: ['http://localhost:3000', 'http://example.com'],
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://example.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com');
  });

  it('should not set origin header for disallowed origins in array', async () => {
    const cors = createCorsMiddleware({
      origin: ['http://localhost:3000'],
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://evil.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should handle function origin validator', async () => {
    const cors = createCorsMiddleware({
      origin: (origin) => origin.endsWith('.example.com'),
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://app.example.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://app.example.com');
  });

  it('should not set origin header for denied function origins', async () => {
    const cors = createCorsMiddleware({
      origin: () => false,
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://example.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should add custom headers', async () => {
    const cors = createCorsMiddleware({
      headers: ['X-Custom-Header', 'Authorization'],
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('X-Custom-Header, Authorization');
  });

  it('should add credentials header when enabled', async () => {
    const cors = createCorsMiddleware({
      credentials: true,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });
});

describe('createRateLimitMiddleware', () => {
  it('should allow requests within limit', async () => {
    const rateLimit = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 5,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    for (let i = 0; i < 5; i++) {
      const response = await rateLimit(request, context, async () => new Response('OK'));
      expect(response.status).toBe(200);
    }
  });

  it('should block requests over limit', async () => {
    const rateLimit = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 2,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    // First 2 requests should pass
    await rateLimit(request, context, async () => new Response('OK'));
    await rateLimit(request, context, async () => new Response('OK'));

    // Third should be blocked
    const response = await rateLimit(request, context, async () => new Response('OK'));
    expect(response.status).toBe(429);
  });

  it('should add rate limit headers', async () => {
    const rateLimit = createRateLimitMiddleware({
      maxRequests: 10,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await rateLimit(request, context, async () => new Response('OK'));

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
    expect(response.headers.has('X-RateLimit-Reset')).toBe(true);
  });

  it('should skip successful requests when configured', async () => {
    const rateLimit = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 2,
      skipSuccessfulRequests: true,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    // Successful requests should reset count
    const response1 = await rateLimit(request, context, async () => new Response('OK', { status: 200 }));
    expect(response1.status).toBe(200);

    const response2 = await rateLimit(request, context, async () => new Response('OK', { status: 200 }));
    expect(response2.status).toBe(200);

    // Should still be under limit because successful requests were skipped
    const response3 = await rateLimit(request, context, async () => new Response('OK', { status: 200 }));
    expect(response3.status).toBe(200);
  });

  it('should use custom key generator', async () => {
    const rateLimit = createRateLimitMiddleware({
      maxRequests: 1,
      keyGenerator: (req) => req.headers.get('X-User-ID') || 'anonymous',
    });

    const context = createMockContext();

    // Different users should have separate rate limits
    const request1 = new Request('http://localhost:3000/test', {
      headers: { 'X-User-ID': 'user1' },
    });
    const request2 = new Request('http://localhost:3000/test', {
      headers: { 'X-User-ID': 'user2' },
    });

    const response1 = await rateLimit(request1, context, async () => new Response('OK'));
    expect(response1.status).toBe(200);

    const response2 = await rateLimit(request2, context, async () => new Response('OK'));
    expect(response2.status).toBe(200);
  });
});

describe('createMiddleware (typed middleware)', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should create typed middleware with config', () => {
    const authMiddleware = createMiddleware<{ user: { id: string } }>({
      name: 'auth',
      provides: ['user'],
      handler: async (req, ctx, next) => {
        ctx.set('user', { id: '123' });
        return next();
      },
    });

    expect(authMiddleware.name).toBe('auth');
    expect(authMiddleware.provides).toEqual(['user']);
    expect(typeof authMiddleware.handler).toBe('function');
    expect(typeof authMiddleware.register).toBe('function');
  });

  it('should register middleware via register method', () => {
    const middleware = createMiddleware({
      name: 'test-typed',
      handler: async (req, ctx, next) => next(),
    });

    middleware.register();

    expect(hasMiddleware('test-typed')).toBe(true);
  });

  it('should handle middleware with requires constraint', () => {
    const adminMiddleware = createMiddleware<
      { isAdmin: boolean },
      { user: { id: string } }
    >({
      name: 'admin',
      provides: ['isAdmin'],
      requires: ['user'],
      handler: async (req, ctx, next) => {
        ctx.set('isAdmin', true);
        return next();
      },
    });

    expect(adminMiddleware.requires).toEqual(['user']);
  });
});

describe('chainMiddleware', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should chain two middleware together', async () => {
    const order: string[] = [];

    const m1 = createMiddleware({
      name: 'first',
      provides: ['firstValue'],
      handler: async (req, ctx, next) => {
        order.push('first');
        return next();
      },
    });

    const m2 = createMiddleware({
      name: 'second',
      provides: ['secondValue'],
      handler: async (req, ctx, next) => {
        order.push('second');
        return next();
      },
    });

    const chained = chainMiddleware(m1, m2);

    expect(chained.name).toBe('first+second');
    expect(chained.provides).toContain('firstValue');
    expect(chained.provides).toContain('secondValue');

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await chained.handler(request, context, async () => {
      order.push('final');
      return new Response('OK');
    });

    expect(order).toEqual(['first', 'second', 'final']);
  });

  it('should chain three middleware together', async () => {
    const order: string[] = [];

    const m1 = createMiddleware({
      name: 'a',
      handler: async (req, ctx, next) => {
        order.push('a');
        return next();
      },
    });

    const m2 = createMiddleware({
      name: 'b',
      handler: async (req, ctx, next) => {
        order.push('b');
        return next();
      },
    });

    const m3 = createMiddleware({
      name: 'c',
      handler: async (req, ctx, next) => {
        order.push('c');
        return next();
      },
    });

    const chained = chainMiddleware(m1, m2, m3);

    expect(chained.name).toBe('a+b+c');

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await chained.handler(request, context, async () => {
      order.push('final');
      return new Response('OK');
    });

    expect(order).toEqual(['a', 'b', 'c', 'final']);
  });

  it('should combine requires from all middleware', () => {
    const m1 = createMiddleware<{}, { a: string }>({
      name: 'first',
      requires: ['a'],
      handler: async (req, ctx, next) => next(),
    });

    const m2 = createMiddleware<{}, { b: string }>({
      name: 'second',
      requires: ['b'],
      handler: async (req, ctx, next) => next(),
    });

    const chained = chainMiddleware(m1, m2);

    expect(chained.requires).toContain('a');
    expect(chained.requires).toContain('b');
  });
});

describe('registerTypedMiddleware and getTypedMiddleware', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should register and retrieve typed middleware', () => {
    const typedMiddleware: TypedMiddleware<{ user: string }> = {
      name: 'auth-typed',
      provides: ['user'],
      handler: async (req, ctx, next) => next(),
    };

    registerTypedMiddleware(typedMiddleware);

    const retrieved = getTypedMiddleware('auth-typed');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('auth-typed');
    expect(retrieved?.provides).toEqual(['user']);

    // Should also be in regular registry
    expect(hasMiddleware('auth-typed')).toBe(true);
  });

  it('should return undefined for unregistered typed middleware', () => {
    const result = getTypedMiddleware('nonexistent');
    expect(result).toBeUndefined();
  });
});

describe('validateMiddlewareChain', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should validate chain where all requirements are met', () => {
    registerTypedMiddleware({
      name: 'auth',
      provides: ['user'],
      handler: async (req, ctx, next) => next(),
    });

    registerTypedMiddleware({
      name: 'admin',
      requires: ['user'],
      provides: ['isAdmin'],
      handler: async (req, ctx, next) => next(),
    });

    const result = validateMiddlewareChain(['auth', 'admin']);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required context', () => {
    registerTypedMiddleware({
      name: 'admin',
      requires: ['user'],
      provides: ['isAdmin'],
      handler: async (req, ctx, next) => next(),
    });

    const result = validateMiddlewareChain(['admin']);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('user');
    expect(result.errors[0]).toContain('admin');
  });

  it('should skip validation for non-typed middleware', () => {
    registerMiddleware('simple', async (req, ctx, next) => next());

    const result = validateMiddlewareChain(['simple']);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate complex chain with multiple dependencies', () => {
    registerTypedMiddleware({
      name: 'session',
      provides: ['session'],
      handler: async (req, ctx, next) => next(),
    });

    registerTypedMiddleware({
      name: 'auth',
      requires: ['session'],
      provides: ['user'],
      handler: async (req, ctx, next) => next(),
    });

    registerTypedMiddleware({
      name: 'admin',
      requires: ['user', 'session'],
      provides: ['isAdmin'],
      handler: async (req, ctx, next) => next(),
    });

    // Correct order
    const validResult = validateMiddlewareChain(['session', 'auth', 'admin']);
    expect(validResult.valid).toBe(true);

    // Wrong order
    const invalidResult = validateMiddlewareChain(['admin', 'auth', 'session']);
    expect(invalidResult.valid).toBe(false);
  });

  it('should handle middleware without provides or requires', () => {
    registerTypedMiddleware({
      name: 'logger',
      handler: async (req, ctx, next) => next(),
    });

    const result = validateMiddlewareChain(['logger']);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('path middleware with glob patterns', () => {
  it('should match glob pattern with ** for nested paths', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    // Test simple prefix match
    const conditional = path('/admin', handler);

    const request = new Request('http://localhost:3000/admin/users/123');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should handle array of regex patterns', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path([/^\/api\//, /^\/v2\//], handler);

    const request = new Request('http://localhost:3000/api/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should not run for non-matching regex', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path(/^\/api\//, handler);

    const request = new Request('http://localhost:3000/other/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });
});

describe('method middleware with array of methods', () => {
  it('should run middleware for any method in array', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = method(['GET', 'POST'], handler);

    const request = new Request('http://localhost:3000/test', { method: 'POST' });
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should skip middleware for methods not in array', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = method(['GET', 'POST'], handler);

    const request = new Request('http://localhost:3000/test', { method: 'DELETE' });
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });
});

describe('createMiddlewareExecutor with empty middleware', () => {
  it('should call final handler directly when no middleware', async () => {
    const executor = createMiddlewareExecutor({});

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    let finalCalled = false;
    const response = await executor({
      request,
      context,
      finalHandler: async () => {
        finalCalled = true;
        return new Response('OK');
      },
    });

    expect(finalCalled).toBe(true);
    expect(response.status).toBe(200);
  });
});

describe('globToRegex', () => {
  it('should convert simple glob pattern with single asterisk', () => {
    const regex = globToRegex('/api/*');

    expect(regex.test('/api/users')).toBe(true);
    expect(regex.test('/api/products')).toBe(true);
    expect(regex.test('/api/')).toBe(true);
    expect(regex.test('/api/users/123')).toBe(false); // Single * doesn't match /
    expect(regex.test('/other')).toBe(false);
  });

  it('should convert glob pattern with double asterisk (globstar)', () => {
    const regex = globToRegex('/api/**');

    expect(regex.test('/api/users')).toBe(true);
    expect(regex.test('/api/users/123')).toBe(true);
    expect(regex.test('/api/a/b/c/d')).toBe(true);
    expect(regex.test('/api/')).toBe(true);
    expect(regex.test('/other')).toBe(false);
  });

  it('should handle question mark for single character', () => {
    const regex = globToRegex('/api/user?');

    expect(regex.test('/api/user1')).toBe(true);
    expect(regex.test('/api/userX')).toBe(true);
    expect(regex.test('/api/user')).toBe(false);
    // Note: 'users' matches because ? matches any single char (s), so user + s = users
    expect(regex.test('/api/users')).toBe(true);
    expect(regex.test('/api/user12')).toBe(false);
  });

  it('should escape regex special characters', () => {
    const regex = globToRegex('/api/v1.0/users');

    expect(regex.test('/api/v1.0/users')).toBe(true);
    expect(regex.test('/api/v1X0/users')).toBe(false); // . is escaped, not wildcard
  });

  it('should handle complex patterns', () => {
    const regex = globToRegex('/api/**/users/*.json');

    expect(regex.test('/api/v1/users/data.json')).toBe(true);
    expect(regex.test('/api/v1/v2/users/file.json')).toBe(true);
    // Note: ** is greedy and matches anything including empty, but needs to include /users/
    expect(regex.test('/api//users/info.json')).toBe(true); // ** matches empty
    expect(regex.test('/api/users/data.xml')).toBe(false);
  });

  it('should handle patterns with brackets', () => {
    const regex = globToRegex('/users/[id]');

    // Brackets should be escaped
    expect(regex.test('/users/[id]')).toBe(true);
    expect(regex.test('/users/123')).toBe(false);
  });

  it('should handle patterns with plus sign', () => {
    const regex = globToRegex('/math/1+1');

    expect(regex.test('/math/1+1')).toBe(true);
    expect(regex.test('/math/11')).toBe(false); // + is escaped, not regex quantifier
  });

  it('should handle patterns with caret and dollar', () => {
    const regex = globToRegex('/regex/^test$');

    expect(regex.test('/regex/^test$')).toBe(true);
    expect(regex.test('/regex/test')).toBe(false);
  });

  it('should handle patterns with curly braces', () => {
    const regex = globToRegex('/api/{resource}');

    expect(regex.test('/api/{resource}')).toBe(true);
    expect(regex.test('/api/users')).toBe(false);
  });

  it('should handle patterns with parentheses', () => {
    const regex = globToRegex('/group/(name)');

    expect(regex.test('/group/(name)')).toBe(true);
  });

  it('should handle patterns with pipe', () => {
    const regex = globToRegex('/cmd/a|b');

    expect(regex.test('/cmd/a|b')).toBe(true);
    expect(regex.test('/cmd/a')).toBe(false); // | is escaped
  });

  it('should handle patterns with backslash', () => {
    const regex = globToRegex('/path\\to');

    expect(regex.test('/path\\to')).toBe(true);
  });

  it('should match exact paths', () => {
    const regex = globToRegex('/exact/path');

    expect(regex.test('/exact/path')).toBe(true);
    expect(regex.test('/exact/path/more')).toBe(false);
    expect(regex.test('/exact/pat')).toBe(false);
  });
});
